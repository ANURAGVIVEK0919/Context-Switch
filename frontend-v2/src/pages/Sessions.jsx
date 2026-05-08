import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Search, ChevronRight, FileCode, ArrowRight, Sparkles, Trash2, Clock, Terminal } from 'lucide-react';
import { useApi } from '../hooks';
import { getSessionHistory, getSessionEvents, endSession, timeAgo, formatDuration, formatEventTime, deleteSession } from '../api';

export default function Sessions() {
  const [selectedId, setSelectedId] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [search, setSearch] = useState('');

  const { data: historyData, refetch: refetchHistory } = useApi(() => getSessionHistory(50));
  const allSessions = historyData?.sessions || [];

  const filtered = useMemo(() => {
    return allSessions.filter(s => 
      !search || `${s.project} #${s.id}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [allSessions, search]);

  const selected = filtered.find(s => s.id === selectedId) || filtered[0] || null;

  const { data: sessionEventsData, refetch: refetchSessionEvents } = useApi(
    () => (selected?.id ? getSessionEvents(selected.id) : Promise.resolve({ events: [] })),
    [selected?.id]
  );

  const sessionEvents = sessionEventsData?.events || [];

  // WebSocket for Instant Sync
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3002');
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'events_updated' || msg.type === 'session_summary_ready') {
        refetchHistory();
        if (selected?.id) refetchSessionEvents();
      }
    };
    return () => socket.close();
  }, [selected?.id, refetchHistory, refetchSessionEvents]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3 overflow-hidden">
      {/* Sidebar List */}
      <div className="w-[320px] flex-shrink-0 flex flex-col border border-outline bg-surface-dim overflow-hidden">
        <div className="p-3 border-b border-outline">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-2.5 text-tertiary" />
            <input
              placeholder="Search sessions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border border-outline pl-7 pr-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary-container"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`p-4 border-b border-outline cursor-pointer hover:bg-surface transition-colors ${selectedId === s.id ? 'bg-surface border-l-2 border-l-primary-container' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-sm font-bold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.status === 'active' ? 'bg-[#4de082] animate-pulse' : 'border border-outline'}`} />
                  #{s.id}
                </span>
                <span className="text-[10px] text-tertiary font-mono">{timeAgo(s.start_ts)}</span>
              </div>
              <div className="text-xs text-tertiary font-mono truncate">{s.project}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 flex flex-col border border-outline bg-surface overflow-hidden">
        {selected ? (
          <>
            <div className="p-6 border-b border-outline bg-surface-dim flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3" style={{ fontFamily: 'Space Grotesk' }}>
                  Session #{selected.id}
                  <span className="text-xs border border-outline px-2 py-0.5 text-tertiary font-mono">{selected.project}</span>
                </h2>
                <p className="text-xs text-tertiary font-mono mt-1">
                  Started: {new Date(selected.start_ts).toLocaleString()} · 
                  Duration: {selected.status === 'active' ? 'Ongoing' : formatDuration(selected.end_ts - selected.start_ts)}
                </p>
              </div>
              {selected.status === 'active' && (
                <div className="flex items-center gap-2 text-[#4de082] font-mono text-xs border border-[#4de082]/20 px-3 py-1 bg-[#4de082]/5">
                  <span className="w-2 h-2 rounded-full bg-[#4de082] animate-pulse" /> LIVE TRACKING
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Summary Section */}
              {selected.ai_summary && (
                <div className="border border-primary-container/30 bg-primary-container/5 p-4 rounded">
                  <div className="flex items-center gap-2 mb-2 text-primary-container font-mono text-[10px] uppercase tracking-widest">
                    <Sparkles size={12} /> AI Session Summary
                  </div>
                  <p className="text-sm text-on-surface font-mono leading-relaxed">{selected.ai_summary}</p>
                </div>
              )}

              {/* Serial Events Timeline */}
              <div className="space-y-3">
                <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} /> Serial Activity Timeline
                </h3>
                {sessionEvents.length === 0 ? (
                  <p className="text-tertiary font-mono text-xs italic">Recording events...</p>
                ) : (
                  <div className="space-y-2">
                    {sessionEvents.map((e, idx) => (
                      <div key={idx} className="border border-outline bg-surface-dim rounded overflow-hidden">
                        <div 
                          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface transition-colors"
                          onClick={() => setExpandedEvent(expandedEvent === idx ? null : idx)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {e.type.includes('terminal') ? <Terminal size={14} className="text-tertiary" /> : <FileCode size={14} className="text-primary-container" />}
                            <span className="text-xs font-mono text-on-surface truncate">
                              {e.filePath?.split(/[\\/]/).pop() || 'Command Execution'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] text-tertiary font-mono uppercase border border-outline px-1">{e.type}</span>
                            <span className="text-[10px] text-tertiary font-mono">{new Date(e.ts).toLocaleTimeString()}</span>
                            <ChevronDown size={14} className={`text-tertiary transition-transform ${expandedEvent === idx ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        {expandedEvent === idx && (
                          <div className="p-4 bg-black/20 border-t border-outline font-mono text-[11px] text-accent-container">
                            <pre className="whitespace-pre-wrap break-all text-teal-400">
                              {e.diff || 'No detailed diff captured for this event.'}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-tertiary font-mono text-xs">
            Select a session to view detailed timeline and diffs.
          </div>
        )}
      </div>
    </div>
  );
}

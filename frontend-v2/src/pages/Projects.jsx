import React, { useState, useMemo } from 'react';
import { ChevronDown, ArrowRight, X, Folder, Clock, ExternalLink } from 'lucide-react';
import { useApi } from '../hooks';
import useWebSocket from '../hooks/useWebSocket';
import InfoTooltip from '../components/InfoTooltip';
import { getAllEvents, getStaleness, getSessionHistory, getBrainDumps, timeAgo, formatDuration, groupByProject, formatEventTime } from '../api';
import { useNavigate } from 'react-router-dom';

function stalePct(score) {
  // Bug 1 fix: score is already a percentage (0-100), format directly without multiplication
  const pct = parseFloat(score || 0);
  return pct.toFixed(0);
}

function stalenessColor(pct) {
  if (pct >= 70) return '#ffb4ab';
  if (pct >= 40) return '#F59E0B';
  return '#4de082';
}

export default function Projects() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('lastActive');
  const navigate = useNavigate();

  const { data: eventsRaw, loading: eventsLoading, refetch: refetchEvents } = useApi(getAllEvents);
  const { data: stalenessData, refetch: refetchStaleness } = useApi(getStaleness);
  const { data: sessionsData, refetch: refetchSessions } = useApi(() => getSessionHistory(50));
  const { data: dumpsData, refetch: refetchDumps } = useApi(() => getBrainDumps(50));

  const events = Array.isArray(eventsRaw) ? eventsRaw : [];
  const staleMap = useMemo(() => {
    const m = {};
    (stalenessData?.files || []).forEach(f => { m[f.filePath] = f; });
    return m;
  }, [stalenessData]);

  const projects = useMemo(() => {
    const groups = groupByProject(events);
    return groups.map(p => {
      // Find the worst staleness score among files touched by this project
      const projectEvents = p.events;
      let maxStale = 0;
      for (const e of projectEvents) {
        const s = staleMap[e.filePath]?.score || 0;
        if (s > maxStale) maxStale = s;
      }
      const languages = [...new Set(projectEvents.map(e => e.language).filter(Boolean))];
      const allSessions = (sessionsData?.sessions || []).filter(s => s.project === p.name);
      const activeSession = allSessions.find(s => s.status === 'active');
      return {
        name: p.name,
        events: projectEvents,
        lastTs: p.lastTs,
        staleness: maxStale,
        languages,
        sessions: allSessions,
        activeSession,
        status: activeSession ? 'active' : 'idle',
      };
    }).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [events, staleMap, sessionsData, search]);

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (sortBy === 'lastActive') return b.lastTs - a.lastTs;
      if (sortBy === 'events') return b.events.length - a.events.length;
      if (sortBy === 'staleness') return b.staleness - a.staleness;
      return 0;
    });
  }, [projects, sortBy]);

  const active = sorted.filter(p => p.status === 'active').length;
  const stale = sorted.filter(p => stalePct(p.staleness) >= 60).length;

  useWebSocket('ws://localhost:3001/ws', message => {
    if (message?.type !== 'events_updated') return;
    refetchEvents();
    refetchStaleness();
    refetchSessions();
    refetchDumps();
  });

  // Details for selected project
  const selectedSessions = selected ? (sessionsData?.sessions || []).filter(s => s.project === selected.name) : [];
  const selectedEvents = selected ? selected.events : [];
  const topFiles = useMemo(() => {
    if (!selected) return [];
    const map = {};
    for (const e of selected.events) {
      map[e.filePath] = (map[e.filePath] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [selected]);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3 relative overflow-hidden">

      {/* Main Table */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl text-on-surface mb-1" style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Projects</h1>
            <p className="font-mono text-[11px] text-tertiary flex items-center flex-wrap gap-x-1">{active} active<InfoTooltip text="Number of VS Code windows currently open and being tracked" /> · {stale} stale · {sorted.length} total</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-surface border border-outline px-3 py-1.5 text-xs font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none w-40"
            />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-surface border border-outline px-2 py-1.5 text-xs font-mono text-tertiary focus:border-primary-container focus:outline-none cursor-pointer"
            >
              <option value="lastActive">Sort: Last Active</option>
              <option value="events">Sort: Events</option>
              <option value="staleness">Sort: Staleness</option>
            </select>
          </div>
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto">
          {eventsLoading ? (
            <div className="flex items-center justify-center py-16 text-tertiary font-mono text-xs">Loading projects…</div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-tertiary font-mono text-xs">No projects found. Start coding and events will appear here.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
              {sorted.map(p => {
                const pct = stalePct(p.staleness);
                const color = stalenessColor(pct);
                const isSelected = selected?.name === p.name;
                return (
                  <div
                    key={p.name}
                    className={`border ${isSelected ? 'border-primary-container bg-surface' : 'border-outline hover:border-outline-strong'} bg-surface-dim p-4 flex flex-col transition-colors cursor-pointer`}
                  >
                    {/* Header with status dot */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-mono text-sm font-bold text-on-surface flex-1 truncate">{p.name}</h3>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${p.status === 'active' ? 'bg-[#4de082]' : 'border border-outline bg-transparent'}`} />
                    </div>

                    {/* Languages as badges */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {p.languages.map((lang, i) => (
                        <span key={i} className="text-[10px] font-mono border border-outline/50 px-2 py-0.5 text-tertiary">
                          {lang || '—'}
                        </span>
                      ))}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between text-xs text-tertiary font-mono mb-3 border-t border-outline pt-2.5">
                      <span>{p.events.length} events</span>
                      <span>{timeAgo(p.lastTs)}</span>
                    </div>

                    {/* Staleness bar */}
                    <div className="mb-3 border-b border-outline pb-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-tertiary font-mono uppercase tracking-widest flex items-center">Staleness<InfoTooltip text="How overdue a file is for attention. Score = 100 / edit_count. Lower is better. 100% means only edited once." /></span>
                        <span className="text-[10px] font-mono" style={{ color }}>{pct}%</span>
                      </div>
                      <div className="w-full h-[4px] bg-outline">
                        <div className="h-full" style={{ width: `${Math.min(100, parseFloat(pct))}%`, backgroundColor: color }} />
                      </div>
                    </div>

                    {/* Synthesize button */}
                    <button
                      onClick={() => navigate(`/ai-synthesis?project=${p.name}`)}
                      className="w-full border border-primary-container text-primary-container bg-primary-container/10 py-2 text-xs font-mono uppercase tracking-wide hover:bg-primary-container/20 transition-colors flex items-center justify-center gap-1"
                    >
                      Synthesize <ArrowRight size={11} />
                    </button>

                    {/* Sessions filter trigger */}
                    <button
                      onClick={() => setSelected(p)}
                      className="w-full mt-2 border border-outline text-tertiary py-1.5 text-[10px] font-mono uppercase tracking-wide hover:text-primary-container hover:border-primary-container/50 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Drawer */}
      <div
        className="flex-shrink-0 border-l border-outline bg-surface flex flex-col overflow-y-auto transition-all duration-200"
        style={{ width: selected ? 380 : 0, opacity: selected ? 1 : 0, overflow: selected ? 'auto' : 'hidden' }}
      >
        {selected && (
          <div className="p-5 flex flex-col min-w-[380px]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => setSelected(null)} className="text-tertiary hover:text-primary-container">
                <X size={18} />
              </button>
              <Folder size={15} className="text-primary-container" />
              <span className="font-mono text-base text-on-surface font-medium">{selected.name}</span>
              {selected.activeSession && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-[#4de082] border border-[#4de082]/30 px-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4de082] animate-pulse" />
                  LIVE
                  <InfoTooltip text="This project currently has an active session" />
                </span>
              )}
            </div>
              <div className="flex items-center gap-3 text-[11px] text-tertiary font-mono mb-5 pl-8">
              <Clock size={11} />
              {formatEventTime(selected.lastTs)}
              <span className="border border-outline/40 px-1">{selected.languages[0] || '?'}</span>
              <span>{selected.events.length} events</span>
            </div>

            {/* Event summary */}
            <div className="mb-4">
              <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-2 border-b border-outline pb-1 flex items-center">Recent Activity<InfoTooltip text="The most recent file and git activity for this project" /></h3>
              <div className="space-y-1.5">
                {selectedEvents.slice(0, 3).map((e, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-code-snippet text-primary-container truncate max-w-[200px]" title={e.filePath}>
                      {e.filePath?.split(/[\\/]/).pop()}
                    </span>
                    <span className="text-tertiary font-mono">{formatEventTime(e.ts)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Files */}
            <div className="mb-4">
              <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-2 border-b border-outline pb-1 flex items-center">Top Files ({topFiles.length})<InfoTooltip text="Files touched most often in this project" /></h3>
              <div className="space-y-1.5">
                {topFiles.map(([file, count]) => (
                  <div key={file} className="flex justify-between text-xs">
                    <span className="font-code-snippet text-on-surface truncate max-w-[220px]" title={file}>
                      {file.split(/[\\/]/).pop()}
                    </span>
                    <span className="text-tertiary font-mono">{count} edits</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sessions */}
            <div className="mb-4">
              <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-2 border-b border-outline pb-1">Sessions ({selectedSessions.length})</h3>
              {selectedSessions.length === 0 ? (
                <p className="text-xs text-tertiary font-mono">No sessions recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedSessions.slice(0, 3).map(s => (
                    <div key={s.id} className="flex justify-between text-xs">
                      <span className="font-mono text-on-surface flex items-center gap-1.5">
                        {s.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[#4de082] inline-block" />}
                        #{s.id}
                      </span>
                      <span className="text-tertiary font-mono">
                        {s.status === 'active' ? 'ongoing' : formatDuration(s.end_ts - s.start_ts)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Staleness */}
            <div className="mb-6">
              <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-2 border-b border-outline pb-1 flex items-center">Staleness<InfoTooltip text="How overdue a file is for attention. Score = 100 / edit_count. Lower is better. 100% means only edited once." /></h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[3px] bg-outline">
                  <div className="h-full" style={{ width: `${Math.min(100, parseFloat(stalePct(selected.staleness)))}%`, backgroundColor: stalenessColor(parseFloat(stalePct(selected.staleness))) }} />
                </div>
                <span className="text-xs font-mono" style={{ color: stalenessColor(parseFloat(stalePct(selected.staleness))) }}>
                  {stalePct(selected.staleness)}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto pt-4 border-t border-outline flex gap-2">
              <button
                onClick={() => navigate(`/ai-synthesis?project=${encodeURIComponent(selected.name)}`)}
                className="flex-1 border border-primary-container text-primary-container bg-primary-container/10 py-2 text-xs font-mono uppercase tracking-wide hover:bg-primary-container/20 transition-colors flex items-center justify-center gap-1"
              >
                <ExternalLink size={11} />
                AI Synthesis
              </button>
              <button
                onClick={() => navigate(`/sessions?project=${encodeURIComponent(selected.name)}`)}
                className="flex-1 border border-outline text-tertiary py-2 text-xs font-mono uppercase tracking-wide hover:text-primary-container hover:border-primary-container/50 transition-colors"
              >
                View Sessions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { BrainCircuit, Play, MessageSquare, Edit2, Save, AlertTriangle, Square } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { usePolling, useApi } from '../hooks';
import useWebSocket from '../hooks/useWebSocket';
import InfoTooltip from '../components/InfoTooltip';
import {
  getStats, getTimeline, getStaleness, getSessionHistory,
  getBrainDumps, getAllEvents, createBrainDump, getAllEnhancedEvents,
  timeAgo, formatDuration, endSessionByProject
} from '../api';

const VelocityTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-tooltip-bg)', border: '1px solid var(--color-outline)', padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--color-on-surface)' }}>
      {label} — {payload[0].value} events
    </div>
  );
};

function StatCard({ label, tooltip, value, loading }) {
  return (
    <div className="bg-surface-dim border border-outline p-4 flex flex-col justify-between hover:border-outline-strong transition-colors">
      <span className="font-label-mono-xs text-on-surface-variant uppercase tracking-widest flex items-center">{label}{tooltip && <InfoTooltip text={tooltip} />}</span>
      <span className="text-4xl text-on-surface mt-3" style={{ fontFamily: 'Space Grotesk', fontWeight: 700, letterSpacing: '-0.02em' }}>
        {loading ? <span className="text-tertiary text-2xl">—</span> : value}
      </span>
    </div>
  );
}

export default function Overview() {
  const [thought, setThought] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const { data: stats, loading: statsLoading, refetch: refetchStats } = usePolling(getStats, 8000);
  const { data: timelineData, loading: tlLoading, refetch: refetchTimeline } = usePolling(() => getTimeline(24), 15000);
  const { data: staleness, refetch: refetchStaleness } = usePolling(getStaleness, 15000);
  const { data: sessions, refetch: refetchSessions } = usePolling(() => getSessionHistory(3), 10000);
  const { data: dumps, refetch: refetchDumps } = usePolling(() => getBrainDumps(3), 15000);
  // Bug 4 fix: poll all enhanced events across all projects, newest first, refresh every 10s
  const { data: liveEventsData, refetch: refetchLiveEvents } = usePolling(getAllEnhancedEvents, 10000);

  useWebSocket('ws://localhost:3001/ws', message => {
    if (message?.type !== 'events_updated') return;
    refetchStats();
    refetchTimeline();
    refetchStaleness();
    refetchSessions();
    refetchDumps();
    refetchLiveEvents();
  });

  const timeline = (timelineData?.timeline || []).map(row => ({
    h: row.hour ? row.hour.slice(11, 16) : '?',
    v: row.eventCount,
  }));

  // Group events by project for the projects board
  const projectGroups = React.useMemo(() => {
    const events = Array.isArray(liveEventsData) ? liveEventsData : [];
    const map = {};
    for (const e of events) {
      const p = e.project || 'unknown';
      if (!map[p]) map[p] = { name: p, file: e.filePath, lastTs: 0, count: 0 };
      map[p].count++;
      if (e.ts > map[p].lastTs) { map[p].lastTs = e.ts; map[p].file = e.filePath; }
    }
    return Object.values(map).sort((a, b) => b.lastTs - a.lastTs).slice(0, 4);
  }, [liveEventsData]);

  const staleFiles = staleness?.files?.slice(0, 4) || [];
  // Bug 4 fix: sort all events by ts descending, take top 10
  const recentEvents = Array.isArray(liveEventsData)
    ? [...liveEventsData].sort((a, b) => b.ts - a.ts).slice(0, 10)
    : [];
  const recentSessions = sessions?.sessions || [];
  const recentDumps = dumps?.braindumps || [];

  async function handleDump(e) {
    e.preventDefault();
    if (!thought.trim()) return;
    setSubmitting(true);
    try {
      await createBrainDump(thought.trim());
      setThought('');
      setToastMsg('Brain dump saved!');
      setTimeout(() => setToastMsg(''), 2500);
      refetchDumps();
    } catch (err) {
      setToastMsg('Failed: ' + err.message);
      setTimeout(() => setToastMsg(''), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full relative">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[color:var(--color-surface-dim)] border border-outline text-on-surface text-xs font-mono px-4 py-2.5 shadow-lg transition-opacity">
          {toastMsg}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Captured Events" tooltip="Total number of file change and git activity events recorded across all projects" value={stats?.totalEvents ?? 0} loading={statsLoading} />
        <StatCard label="Brain Dumps" tooltip="Quick thoughts and notes you've manually added while coding" value={stats?.totalBrainDumps ?? 0} loading={statsLoading} />
        <StatCard label="Active Sessions" tooltip="Number of VS Code windows currently open and being tracked" value={stats?.activeSessions ?? 0} loading={statsLoading} />
        <StatCard label="Files Tracked" tooltip="Unique files that have been edited at least once" value={stats?.topFiles?.length ?? 0} loading={statsLoading} />
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">

        {/* LEFT col */}
        <div className="lg:col-span-8 flex flex-col gap-3">

          {/* Event Velocity */}
          <div className="bg-surface-dim border border-outline p-4">
            <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3 flex items-center">Event Velocity (24h)<InfoTooltip text="Number of file change events over time, showing your coding activity pattern" /></h2>
            {tlLoading ? (
              <div className="h-36 flex items-center justify-center text-tertiary font-mono text-xs">Loading chart…</div>
            ) : timeline.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-tertiary font-mono text-xs">No events in the last 24h</div>
            ) : (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline} margin={{ top: 2, right: 0, left: -28, bottom: 0 }} barCategoryGap="30%">
                    <XAxis dataKey="h" axisLine={{ stroke: 'var(--color-outline)' }} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} dy={8} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} />
                    <Tooltip content={<VelocityTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="v" fill="var(--color-info)" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Active Projects Board */}
          <div className="bg-surface-dim border border-outline p-4">
            <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3">Active Projects Board</h2>
            {projectGroups.length === 0 ? (
              <p className="text-tertiary font-mono text-xs">No events captured yet — start coding!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projectGroups.map((p, i) => {
                  const stalePct = staleness?.files?.find(f => f.filePath?.includes(p.name))?.score || 0;
                  const barColors = ['var(--color-info)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-muted)'];
                  
                  const handleEnd = async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`End session for ${p.name} and generate AI summary?`)) return;
                    try {
                      await endSessionByProject(p.name);
                      setToastMsg(`Session ended for ${p.name}`);
                      setTimeout(() => setToastMsg(''), 3000);
                      refetchSessions();
                      refetchStats();
                    } catch (err) {
                      setToastMsg('Error: ' + err.message);
                    }
                  };

                  return (
                    <div key={p.name} className="border border-outline p-3 hover:bg-surface transition-colors cursor-pointer relative group">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-mono text-sm text-on-surface font-medium">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleEnd}
                            title="End & Summarize"
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/20 text-error rounded transition-all"
                          >
                            <Square size={12} fill="currentColor" />
                          </button>
                          <div className="w-2 h-2 rounded-full bg-[color:var(--color-success)]" />
                        </div>
                      </div>
                      <div className="text-[11px] text-tertiary mb-2 font-code-snippet truncate">{p.file}</div>
                      <div className="w-full bg-outline h-[3px]">
                        <div className="h-full" style={{ width: `${Math.min(100, (p.count / 30) * 100)}%`, backgroundColor: barColors[i % 4] }} />
                      </div>
                      <div className="flex justify-between mt-1.5 font-mono text-[10px] text-tertiary">
                        <span>{p.count} events</span>
                        <span>{timeAgo(p.lastTs)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stale Files Panel */}
          <div className="bg-surface-dim border border-outline p-4">
            <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3 flex items-center">Stale Files Panel<InfoTooltip text="How overdue a file is for attention. Score = 100 / edit_count. Lower is better. 100% means only edited once." /></h2>
            {staleFiles.length === 0 ? (
              <p className="text-tertiary font-mono text-xs">No stale files tracked yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 border-t border-outline">
                {staleFiles.map(f => {
                  // Bug 1 fix: score is already 0-100, use directly without multiplication
                  const pct = parseFloat(f.score || 0);
                  const isHigh = pct >= 60;
                  return (
                    <div key={f.filePath} className="flex justify-between items-center py-2 border-b border-outline hover:bg-surface transition-colors px-2 cursor-pointer">
                      <span className="font-code-snippet text-on-surface text-xs truncate max-w-[60%]" title={f.filePath}>
                        {f.filePath?.split(/[\\/]/).pop()}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 font-label-mono-xs border text-[10px] ${isHigh ? 'bg-error/10 text-error border-error/20' : 'bg-outline/20 text-tertiary border-outline/30'}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT col */}
        <div className="lg:col-span-4 flex flex-col gap-3">

          {/* AI Synthesis */}
          <div className="bg-surface-dim border border-outline p-4">
            <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3 flex items-center gap-2">
              <BrainCircuit size={13} className="text-primary-container" />
              AI Synthesis
            </h2>
            <p className="text-xs text-tertiary font-mono mb-3">Use the AI Synthesis page for full project reconstruction.</p>
            <a href="/ai-synthesis" className="block w-full text-center bg-primary-container/10 border border-primary-container text-primary-container py-1.5 font-label-mono-xs uppercase hover:bg-primary-container/20 transition-colors tracking-widest text-xs">
              Open AI Synthesis →
            </a>
          </div>

          {/* Live Activity Feed */}
          <div className="bg-surface-dim border border-outline p-4">
            <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3 flex items-center">Live Activity Feed <InfoTooltip text="Latest file and git activity across all projects, refreshed in real time" /></h2>
            {recentEvents.length === 0 ? (
              <p className="text-tertiary font-mono text-xs py-2">No events yet — start coding and your VS Code extension will feed events here.</p>
            ) : (
              <div className="flex flex-col border-t border-outline">
                {recentEvents.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-outline hover:bg-surface px-2 transition-colors last:border-b-0">
                    <Edit2 size={12} className="text-primary-container mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-code-snippet text-on-surface text-xs truncate">{e.filePath?.split(/[\\/]/).pop()}</span>
                        <span className="text-tertiary flex-shrink-0 text-[10px] font-mono">{timeAgo(e.ts)}</span>
                      </div>
                      <span className="text-[10px] text-tertiary px-1 border border-outline/40 mt-1 inline-block font-mono">{e.project || 'unknown'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session History */}
          <div className="bg-surface-dim border border-outline p-4">
            <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3">Session History</h2>
            {recentSessions.length === 0 ? (
              <p className="text-tertiary font-mono text-xs">No sessions yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {recentSessions.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-3 cursor-pointer hover:text-primary-container transition-colors">
                    <div className="flex items-center gap-2 text-xs text-on-surface font-body-md">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'active' ? 'bg-[color:var(--color-success)]' : 'border border-outline bg-transparent'}`} />
                      <span className="font-mono">#{s.id} · {s.project}</span>
                    </div>
                    <span className="text-[10px] text-tertiary font-mono shrink-0">
                      {s.status === 'active' ? 'ongoing' : formatDuration(s.end_ts - s.start_ts)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Brain Dumps */}
          <div className="bg-surface-dim border border-outline p-4">
              <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3 flex items-center gap-2">
              <MessageSquare size={13} className="text-tertiary" />
              Brain Dumps
            </h2>
            <form onSubmit={handleDump} className="relative mb-3 flex items-center gap-2">
              <input
                className="flex-1 bg-surface border border-outline focus:border-primary-container focus:outline-none text-xs p-2 font-body-md text-on-surface placeholder:text-tertiary"
                placeholder="Quick thought..."
                value={thought}
                onChange={e => setThought(e.target.value)}
                disabled={submitting}
              />
              <button type="submit" disabled={submitting || !thought.trim()} className="border border-outline px-3 py-2 text-[10px] font-mono uppercase text-tertiary hover:text-primary-container hover:border-primary-container transition-colors disabled:opacity-40">
                Add
              </button>
            </form>
            <ul className="space-y-2 border-t border-outline pt-2">
              {recentDumps.length === 0 ? (
                <li className="text-xs text-tertiary font-mono">No brain dumps yet.</li>
              ) : recentDumps.map((d, i) => (
                <li key={i} className={`text-xs text-on-surface font-body-md border-l-2 pl-2 py-0.5 ${i === 0 ? 'border-primary-container/70' : 'border-outline'}`}>
                  <div className="truncate">{d.content}</div>
                  <div className="text-[10px] text-tertiary font-mono mt-0.5">{timeAgo(d.ts)}</div>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}

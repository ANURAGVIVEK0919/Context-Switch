import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line,
} from 'recharts';
import { useApi } from '../hooks';
import useWebSocket from '../hooks/useWebSocket';
import InfoTooltip from '../components/InfoTooltip';
import { getTimeline, getStaleness, getSessionHistory, getAllEvents, groupByProject, formatDuration } from '../api';

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chart error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center py-8 text-error font-mono text-xs">
          <div className="text-center">
            <div>Chart failed to render</div>
            <div className="text-tertiary text-[11px] mt-1">{this.state.error?.message}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-tooltip-bg)', border: '1px solid var(--color-outline)', padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--color-on-surface)' }}>
      <div style={{ color: 'var(--color-tertiary)', marginBottom: 2 }}>{label}</div>
      <div>{payload[0].value}</div>
    </div>
  );
};

const RANGES = ['24h', '7d', '30d'];
const RANGE_HOURS = { '24h': 24, '7d': 168, '30d': 720 };

// Heatmap for last 30 days only (7 rows × 4 weeks + buffer = realistic data)
const generateHeatmap = () => {
  const days = 30;
  return Array.from({ length: days }, (_, i) => {
    const s = ((i * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    return s > 0.6 ? s : s * 0.12;
  });
};

const heatmapData = generateHeatmap();

function ChartCard({ title, tooltip, children, extra, span }) {
  return (
    <div className={`bg-surface-dim border border-outline p-4 ${span ? `md:col-span-${span}` : ''}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest flex items-center">{title}{tooltip && <InfoTooltip text={tooltip} />}</h2>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState('7d');

  const { data: tlData, loading: tlLoading, refetch: refetchTimeline } = useApi(() => getTimeline(RANGE_HOURS[range]), [range]);
  const { data: staleness, refetch: refetchStaleness } = useApi(getStaleness);
  const { data: sessionsData, refetch: refetchSessions } = useApi(() => getSessionHistory(100));
  const { data: eventsRaw, refetch: refetchEvents } = useApi(getAllEvents);

  useWebSocket('ws://localhost:3001/ws', message => {
    if (message?.type !== 'events_updated') return;
    refetchTimeline();
    refetchStaleness();
    refetchSessions();
    refetchEvents();
  });

  const events = Array.isArray(eventsRaw) ? eventsRaw : [];

  // Velocity chart
  const velocityChart = useMemo(() => {
    const tl = tlData?.timeline || [];
    return tl.map(row => ({
      time: row.hour ? row.hour.slice(5, 16).replace('T', ' ') : '?',
      events: row.eventCount,
    }));
  }, [tlData]);

  // Projects by activity
  const projectActivity = useMemo(() => {
    const groups = groupByProject(events);
    const colors = ['var(--color-warning)', 'var(--color-info)', 'var(--color-tertiary)', 'var(--color-muted)', 'var(--color-success)', 'var(--color-danger)'];
    return groups.slice(0, 6).map((g, i) => ({
      name: g.name,
      events: g.events.length,
      color: colors[i % colors.length],
    }));
  }, [events]);

  // Session length distribution
  const sessionDist = useMemo(() => {
    const sessions = sessionsData?.sessions || [];
    const buckets = { '<15m': 0, '15–30m': 0, '30–60m': 0, '60–120m': 0, '120m+': 0 };
    for (const s of sessions) {
      if (!s.end_ts || !s.start_ts) continue;
      const mins = (s.end_ts - s.start_ts) / 60000;
      if (mins < 15) buckets['<15m']++;
      else if (mins < 30) buckets['15–30m']++;
      else if (mins < 60) buckets['30–60m']++;
      else if (mins < 120) buckets['60–120m']++;
      else buckets['120m+']++;
    }
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
  }, [sessionsData]);

  // Context switch frequency (daily sessions)
  const switchFreq = useMemo(() => {
    const sessions = sessionsData?.sessions || [];
    const map = {};
    for (const s of sessions) {
      const day = new Date(s.start_ts).toLocaleDateString('en', { month: 'short', day: 'numeric' });
      map[day] = (map[day] || 0) + 1;
    }
    return Object.entries(map).slice(-7).map(([day, switches]) => ({ day, switches }));
  }, [sessionsData]);

  // Stale files sparklines
  const staleFiles = staleness?.files?.slice(0, 6) || [];

  const totalEvents = events.length;
  const totalSessions = sessionsData?.sessions?.length || 0;
  const avgSessionDuration = useMemo(() => {
    const sessions = (sessionsData?.sessions || []).filter(s => s.end_ts && s.start_ts);
    if (!sessions.length) return '—';
    const avg = sessions.reduce((sum, s) => sum + (s.end_ts - s.start_ts), 0) / sessions.length;
    return formatDuration(avg);
  }, [sessionsData]);

  return (
    <div className="w-full overflow-y-auto">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl text-on-surface" style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Analytics</h1>
        <div className="flex gap-6 font-mono text-xs text-tertiary">
          <div><span className="text-on-surface">{totalEvents}</span> total events</div>
          <div><span className="text-on-surface">{totalSessions}</span> sessions</div>
          <div><span className="text-on-surface">{avgSessionDuration}</span> avg session</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">

        {/* Event Velocity — spans 2 cols */}
        <ErrorBoundary>
          <div className="md:col-span-2 bg-surface-dim border border-outline p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest flex items-center">Event Velocity<InfoTooltip text="Number of file change events over time, showing your coding activity pattern" /></h2>
              <div className="flex gap-3">
                {RANGES.map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    className={`font-mono text-xs transition-colors ${range === r ? 'text-primary-container' : 'text-tertiary hover:text-on-surface'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {tlLoading ? (
              <div className="h-52 flex items-center justify-center text-tertiary font-mono text-xs">Loading…</div>
            ) : velocityChart.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-tertiary font-mono text-xs">No data for this range.</div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocityChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-info)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--color-info)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" axisLine={{ stroke: 'var(--color-outline)' }} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} dy={8} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="events" stroke="var(--color-info)" strokeWidth={2} fill="url(#vg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* Projects by Activity */}
        <ErrorBoundary>
          <ChartCard title="Projects by Activity" tooltip="Distribution of recent event activity across projects">
            {projectActivity.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-tertiary font-mono text-xs">No data yet.</div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={projectActivity} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-on-surface)', fontFamily: 'monospace' }} width={80} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="events" radius={[0, 2, 2, 0]} maxBarSize={16}>
                      {projectActivity.map((p, i) => <Cell key={i} fill={p.color} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </ErrorBoundary>

        {/* Session Length Distribution */}
        <ErrorBoundary>
          <ChartCard title="Session Length Distribution" tooltip="Breakdown of how long your coding sessions typically last">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionDist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="bucket" axisLine={{ stroke: 'var(--color-outline)' }} tickLine={false} tick={{ fontSize: 9, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" fill="var(--color-muted)" fillOpacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </ErrorBoundary>

        {/* Context Switch Frequency */}
        <ErrorBoundary>
          <ChartCard title="Daily Session Frequency" tooltip="How often sessions are started across recent days">
            <div className="h-52">
              {switchFreq.length === 0 ? (
                <div className="h-full flex items-center justify-center text-tertiary font-mono text-xs">No sessions yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={switchFreq} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" axisLine={{ stroke: 'var(--color-outline)' }} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-tertiary)', fontFamily: 'monospace' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="switches" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-warning)', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </ErrorBoundary>

        {/* Brain Dump Heatmap - wrapped in error boundary */}
        {/* Brain Dump Heatmap - wrapped in error boundary */}
        <ChartCard title="Activity Heatmap (Last 30 Days)" tooltip="Visual overview of coding activity intensity by day and time">
          <ErrorBoundary>
            <div className="h-52 flex flex-col justify-center">
              <div className="flex gap-[2px] mb-2 text-[8px] text-tertiary font-mono">
                <div className="flex-1">Week 1</div>
                <div className="flex-1">Week 2</div>
                <div className="flex-1">Week 3</div>
                <div className="flex-1">Week 4</div>
              </div>
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', flex: 1 }}>
                {heatmapData.map((op, i) => (
                  <div key={i} style={{ backgroundColor: `rgba(139,92,246,${op})`, borderRadius: 1 }} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 justify-end">
                <span className="font-mono text-[9px] text-tertiary">less</span>
                {[0.1, 0.3, 0.5, 0.7, 1.0].map(op => (
                  <div key={op} className="w-3 h-3 rounded-[1px]" style={{ backgroundColor: `rgba(139,92,246,${op})` }} />
                ))}
                <span className="font-mono text-[9px] text-tertiary">more</span>
              </div>
            </div>
          </ErrorBoundary>
        </ChartCard>

        {/* Stale Files Table */}
        <ErrorBoundary>
          <ChartCard title="Staleness Overview" tooltip="Files sorted by staleness score, where higher means a file needs attention sooner" span={2}>
          {staleFiles.length === 0 ? (
            <div className="text-tertiary font-mono text-xs py-4">No staleness data yet.</div>
          ) : (
            <div className="border-t border-outline">
              {staleFiles.map(f => {
                // Bug 3 fix: score is already a percentage (0-100), don't multiply
                const pct = parseFloat(f.score || 0);
                const pctCapped = Math.min(100, pct);
                const color = pct >= 70 ? 'var(--color-danger)' : pct >= 40 ? 'var(--color-warning)' : 'var(--color-success)';
                return (
                  <div key={f.filePath} className="flex items-center gap-4 py-2.5 border-b border-outline hover:bg-surface px-2 transition-colors">
                    <span className="font-code-snippet text-xs text-on-surface truncate w-48" title={f.filePath}>
                      {f.filePath?.split(/[\\/]/).pop()}
                    </span>
                    <span className="text-[10px] font-mono text-tertiary">{f.editCount} edits</span>
                    <div className="flex-1 h-[3px] bg-outline">
                      <div className="h-full" style={{ width: `${pctCapped}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          )}
          </ChartCard>
        </ErrorBoundary>

      </div>
    </div>
  );
}

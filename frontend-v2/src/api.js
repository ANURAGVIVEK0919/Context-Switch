const BASE = 'http://localhost:3001';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Dashboard ────────────────────────────────────────────────
export const getStats = () => req('/dashboard/stats');
export const getTimeline = (hours = 24) => req(`/dashboard/timeline?hours=${hours}`);
export const getStaleness = () => req('/dashboard/staleness');

// ── Sessions ─────────────────────────────────────────────────
export const getSessionHistory = (limit = 50) => req(`/session/history?limit=${limit}`);
export const getCurrentSession = () => req('/session/current');
export const getActiveSessions = () => req('/session/active');
export const getSessionEvents = (sessionId) => req(`/session/${encodeURIComponent(sessionId)}/events`);
export const startSession = (project) =>
  req('/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
export const endSession = (sessionId) =>
  req('/session/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

// ── Events / Context ─────────────────────────────────────────
export const getAllEvents = () => req('/context/events');
export const getEnhancedContext = (project = 'default') =>
  req(`/context/enhanced?project=${encodeURIComponent(project)}`);
export const getAllEnhancedEvents = () => req('/context/enhanced');

// ── Brain Dumps ───────────────────────────────────────────────
export const getBrainDumps = (limit = 50) => req(`/braindump?limit=${limit}`);
export const createBrainDump = (content, project, sessionId) =>
  req('/braindump', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, project, sessionId }),
  });

// ── AI Reconstruct ────────────────────────────────────────────
export const reconstructProject = (projectId, queryType = 'context') => {
  return req(`/reconstruct/${encodeURIComponent(projectId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryType }),
  });
};

// ── Helpers ───────────────────────────────────────────────────
export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatEventTime(ts) {
  try {
    const d = new Date(ts);
    const today = new Date();
    if (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    ) {
      return d.toLocaleTimeString();
    }
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString()}`;
  } catch (e) {
    return new Date(ts).toLocaleString();
  }
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return 'ongoing';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function groupByProject(events) {
  const map = {};
  for (const e of events) {
    const p = e.project || 'unknown';
    if (!map[p]) map[p] = { name: p, events: [], lastTs: 0 };
    map[p].events.push(e);
    if (e.ts > map[p].lastTs) map[p].lastTs = e.ts;
  }
  return Object.values(map).sort((a, b) => b.lastTs - a.lastTs);
}

export function groupByFile(events) {
  const map = {};
  for (const e of events) {
    const f = e.filePath || 'unknown';
    if (!map[f]) map[f] = { file: f, language: e.language, events: [] };
    map[f].events.push(e);
  }
  return Object.values(map);
}

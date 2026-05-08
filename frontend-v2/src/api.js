const BASE = 'http://localhost:3001';

async function req(path, options = {}) {
  // Automatically add Auth header if token exists
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────
export const login = (email, password) =>
  req('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

export const register = (email, password) =>
  req('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

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
export const endSessionByProject = (project) =>
  req('/session/end-by-project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
// CRUD
export const getSession = (id) => req(`/session/${id}`);
export const updateSession = (id, fields) =>
  req(`/session/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
export const deleteSession = (id) => req(`/session/${id}`, { method: 'DELETE' });
export const regenerateSessionSummary = (id) =>
  req(`/session/${id}/regenerate-summary`, { method: 'POST' });

// ── Events / Context ─────────────────────────────────────────
export const getAllEvents = () => req('/context/events');
export const getEnhancedContext = (project = 'default') =>
  req(`/context/enhanced?project=${encodeURIComponent(project)}`);
export const getAllEnhancedEvents = () => req('/context/enhanced');
// CRUD
export const getEvent = (id) => req(`/context/events/${id}`);
export const updateEvent = (id, fields) =>
  req(`/context/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
export const deleteEvent = (id) => req(`/context/events/${id}`, { method: 'DELETE' });
export const bulkDeleteEvents = (ids) =>
  req('/context/events', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

// ── Brain Dumps ───────────────────────────────────────────────
export const getBrainDumps = (limit = 50) => req(`/braindump?limit=${limit}`);
export const createBrainDump = (content, project, sessionId) =>
  req('/braindump', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, project, sessionId }),
  });
// CRUD
export const getBrainDump = (id) => req(`/braindump/${id}`);
export const updateBrainDump = (id, content, sessionId) =>
  req(`/braindump/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, session_id: sessionId || null }),
  });
export const deleteBrainDump = (id) => req(`/braindump/${id}`, { method: 'DELETE' });
export const getBrainDumpsBySession = (sessionId) => req(`/braindump/session/${sessionId}`);

// ── Memory Nodes ──────────────────────────────────────────────
export const queryMemory = (project = 'default', limit = 20) =>
  req(`/memory/query?project=${encodeURIComponent(project)}&limit=${limit}`);
// CRUD
export const getMemoryNode = (id) => req(`/memory/${id}`);
export const createMemoryNode = (fields) =>
  req('/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
export const updateMemoryNode = (id, fields) =>
  req(`/memory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
export const deleteMemoryNode = (id) => req(`/memory/${id}`, { method: 'DELETE' });

// ── Staleness ─────────────────────────────────────────────────
export const getAllStaleness = () => req('/staleness');
export const getStalenessForFile = (filePath) =>
  req(`/staleness/${encodeURIComponent(filePath)}`);
export const updateStaleness = (filePath, fields) =>
  req(`/staleness/${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
export const deleteStaleness = (filePath) =>
  req(`/staleness/${encodeURIComponent(filePath)}`, { method: 'DELETE' });

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

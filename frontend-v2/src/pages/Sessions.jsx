import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Search, ChevronRight, FileCode, ArrowRight, Brain, Sparkles, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useApi } from '../hooks';
import useWebSocket from '../hooks/useWebSocket';
import InfoTooltip from '../components/InfoTooltip';
import { getSessionHistory, getActiveSessions, getSessionEvents, startSession, endSession, timeAgo, formatDuration, groupByFile, formatEventTime, updateSession, deleteSession, regenerateSessionSummary, getBrainDumpsBySession } from '../api';

function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel, confirming = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-md border border-outline bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-outline flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${danger ? 'bg-error/10 border border-error/30 text-error' : 'bg-primary-container/10 border border-primary-container/30 text-primary-container'} flex items-center justify-center`}>
            {danger ? <Trash2 size={15} /> : <Sparkles size={15} />}
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-tertiary">{title}</div>
            <div className="text-sm text-on-surface font-mono mt-1">{message}</div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="border border-outline text-tertiary px-4 py-2 text-xs font-mono uppercase hover:text-on-surface transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className={`${danger ? 'bg-error text-background' : 'bg-primary-container text-background'} px-4 py-2 text-xs font-mono uppercase font-bold hover:opacity-90 transition-opacity disabled:opacity-50`}
            >
              {confirming ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sessions() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [expandedFile, setExpandedFile] = useState(null);
  const [openActiveProject, setOpenActiveProject] = useState(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editTarget, setEditTarget]         = useState(null);
  const [editForm, setEditForm]             = useState({});
  const [saving, setSaving]                 = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [regenerating, setRegenerating]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: historyData, refetch: refetchHistory } = useApi(() => getSessionHistory(50));
  const { data: activeData, refetch: refetchActive } = useApi(getActiveSessions);
  const { data: brainDumpsData } = useApi(() => selectedId ? getBrainDumpsBySession(selectedId) : null);

  const allSessions = historyData?.sessions || [];
  const activeProjects = activeData?.activeProjects || [];
  const activeProjectsCount = activeData?.activeProjectsCount ?? activeProjects.length;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const project = params.get('project') || 'all';
    setProjectFilter(project);
  }, [location.search]);

  const projects = useMemo(() => ['all', ...new Set(allSessions.map(s => s.project).filter(Boolean))], [allSessions]);

  function updateProjectFilter(nextProject) {
    setProjectFilter(nextProject);
    if (nextProject === 'all') {
      navigate('/sessions');
      return;
    }
    navigate(`/sessions?project=${encodeURIComponent(nextProject)}`);
  }

  const filtered = useMemo(() => {
    return allSessions.filter(s => {
      if (projectFilter !== 'all' && s.project !== projectFilter) return false;
      if (search && !`${s.project} #${s.id}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allSessions, projectFilter, search]);

  const selected = filtered.find(s => s.id === selectedId) || filtered[0] || null;

  const activeGroups = useMemo(() => {
    return (activeProjects || [])
      .map(g => {
        const sessions = g.sessions || [];
        const project = g.project || (sessions[0] && sessions[0].project) || 'unknown';
        const ordered = [...sessions].sort((a, b) => b.start_ts - a.start_ts);
        return { project, sessions: ordered };
      })
      .filter(g => projectFilter === 'all' || g.project === projectFilter);
  }, [activeProjects, projectFilter]);

  const activeLookup = useMemo(() => {
    const m = new Map();
    for (const g of activeGroups) {
      (g.sessions || []).forEach((s, idx) => {
        m.set(s.id, { isLatestForProject: idx === 0, isDuplicate: idx > 0 });
      });
    }
    return m;
  }, [activeGroups]);

  function toDateTimeLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatReadableDateTime(value) {
    if (!value) return 'Not set';
    try {
      return new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  }

  const visibleSessions = useMemo(() => {
    return filtered.filter(s => s.status !== 'active');
  }, [filtered]);

  const { data: sessionEventsData, refetch: refetchSessionEvents } = useApi(
    () => (selected?.id ? getSessionEvents(selected.id) : Promise.resolve({ events: [] })),
    [selected?.id]
  );

  const sessionEvents = sessionEventsData?.events || [];

  const fileGroups = useMemo(() => groupByFile(sessionEvents), [sessionEvents]);

  const { lastEventAt } = useWebSocket('ws://localhost:3001/ws', message => {
    if (message?.type !== 'events_updated') return;
  });

  useEffect(() => {
    if (!lastEventAt) return;
    refetchHistory();
    refetchActive();
    refetchSessionEvents();
  }, [lastEventAt, refetchHistory, refetchActive, refetchSessionEvents]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
      return;
    }
    if (selectedId && !filtered.some(s => s.id === selectedId)) {
      setSelectedId(filtered[0]?.id || null);
    }
  }, [filtered, selectedId]);

  async function handleStart(e) {
    e.preventDefault();
    if (!newProject.trim()) return;
    setStarting(true);
    try {
      await startSession(newProject.trim());
      setNewProject('');
      setShowStartModal(false);
      await refetchHistory();
      await refetchActive();
    } catch (err) {
      alert('Failed to start session: ' + err.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleEnd(sessionId) {
    setEnding(true);
    try {
      await endSession(sessionId);
      await refetchHistory();
      await refetchActive();
    } catch (err) {
      alert('Failed to end session: ' + err.message);
    } finally {
      setEnding(false);
    }
  }

  function openEdit(session) {
    setEditTarget(session.id);
    const prettyAi = (() => {
      try { return session.ai_summary ? JSON.parse(session.ai_summary) : null; } catch { return null; }
    })();
    setEditForm({
      id: session.id,
      project: session.project || '',
      summary: session.summary || '',
      ai_summary: prettyAi ? JSON.stringify(prettyAi, null, 2) : session.ai_summary || '',
      end_ts: session.end_ts || null,
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      let aiPayload = null;
      try { aiPayload = editForm.ai_summary ? JSON.parse(editForm.ai_summary) : null; } catch (err) { /* keep as raw string */ }
      const payload = {
        project: editForm.project,
        summary: editForm.summary,
        ai_summary: aiPayload ? JSON.stringify(aiPayload) : (editForm.ai_summary || null),
        end_ts: editForm.end_ts || null,
      };
      await updateSession(editTarget, payload);
      setShowEditModal(false);
      setEditTarget(null);
      await refetchHistory();
      await refetchActive();
    } catch (err) {
      alert('Failed to save session: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sessionId) {
    setSelectedId(sessionId);
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteSession() {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await deleteSession(selectedId);
      await refetchHistory();
      await refetchActive();
      setSelectedId(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      alert('Failed to delete session: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRegenerate(sessionId) {
    if (!window.confirm('Regenerate AI summary for this session?')) return;
    setRegenerating(true);
    try {
      await regenerateSessionSummary(sessionId);
      await refetchHistory();
      await refetchActive();
      refetchSessionEvents();
    } catch (err) {
      alert('Failed to regenerate summary: ' + err.message);
    } finally {
      setRegenerating(false);
    }
  }

  function clearProjectFilter() {
    navigate('/sessions');
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3 overflow-hidden">

      {/* Left Panel */}
      <div className="w-[340px] flex-shrink-0 flex flex-col border border-outline bg-surface-dim overflow-hidden">
        {/* Filters */}
        <div className="p-3 border-b border-outline space-y-2">
          {projectFilter !== 'all' && (
            <div className="flex items-center justify-between gap-2 bg-surface border border-primary-container/30 px-3 py-2 text-xs font-mono text-on-surface">
              <span className="truncate">Showing sessions for: {projectFilter}</span>
              <button onClick={clearProjectFilter} className="text-tertiary hover:text-on-surface">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-2.5 text-tertiary" />
              <input
                placeholder="Search sessions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-surface border border-outline pl-6 pr-2 py-1.5 text-xs font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowStartModal(true)}
              className="text-xs font-mono text-primary-container border border-primary-container/50 px-2 hover:bg-primary-container/10 transition-colors whitespace-nowrap"
            >
              + New
            </button>
          </div>
          <select
            value={projectFilter}
            onChange={e => updateProjectFilter(e.target.value)}
            className="w-full bg-surface border border-outline px-2 py-1.5 text-xs font-mono text-tertiary focus:border-primary-container focus:outline-none cursor-pointer"
          >
            {projects.map(p => (
              <option key={p} value={p}>{p === 'all' ? 'All Projects' : p}</option>
            ))}
          </select>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto">
          {/* Active sessions grouped by project */}
          {activeGroups.map(g => (
            <div key={`active-group-${g.project}`} className="border-b border-outline">
              {g.sessions.length > 1 ? (
                <div className={`p-4 cursor-pointer hover:bg-surface transition-colors ${openActiveProject === g.project ? 'bg-surface' : ''}`} onClick={() => setOpenActiveProject(openActiveProject === g.project ? null : g.project)}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-sm text-on-surface flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${openActiveProject === g.project ? 'bg-[#4de082] animate-pulse' : 'bg-[#8b919d]'}`} />
                      {g.project} · {g.sessions.length} active sessions
                    </span>
                    <span className="text-[10px] text-tertiary font-mono">{timeAgo(g.sessions[0]?.start_ts)}</span>
                  </div>
                  <div className="text-xs text-tertiary font-mono flex items-center gap-2">
                    <span className="text-tertiary">Click to expand</span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setSelectedId(g.sessions[0]?.id)}
                  className={`p-4 border-b-0 border-outline cursor-pointer hover:bg-surface transition-colors ${selected?.id === g.sessions[0]?.id ? 'bg-surface' : ''} ${'border-l-2 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-sm text-on-surface flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full bg-[#4de082]`} />
                      Session #{g.sessions[0]?.id}
                    </span>
                    <span className="text-[10px] text-tertiary font-mono">{timeAgo(g.sessions[0]?.start_ts)}</span>
                  </div>
                  <div className="text-xs text-tertiary font-mono">
                    {g.project} · ongoing
                  </div>
                </div>
              )}

              {openActiveProject === g.project && (
                <div>
                  {g.sessions.map((s, idx) => (
                    <div
                      key={`active-${s.id}`}
                      onClick={() => setSelectedId(s.id)}
                      className={`p-3 pl-8 border-t border-outline cursor-pointer hover:bg-surface transition-colors ${selected?.id === s.id ? 'bg-surface' : ''}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm">Session #{s.id}</span>
                        <span className="text-[10px] text-tertiary font-mono">{timeAgo(s.start_ts)}</span>
                      </div>
                      <div className="text-xs text-tertiary font-mono">
                        {s.project} · {idx === 0 ? <span className="text-[#4de082]">● LIVE</span> : <span className="text-tertiary">● duplicate</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {visibleSessions.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`p-4 border-b border-outline cursor-pointer hover:bg-surface transition-colors ${selected?.id === s.id ? 'bg-surface border-l-2 border-l-primary-container' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-sm text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full border border-outline" />
                  Session #{s.id}
                </span>
                <span className="text-[10px] text-tertiary font-mono">{timeAgo(s.start_ts)}</span>
              </div>
              <div className="text-xs text-tertiary font-mono">
                {s.project} · {formatDuration(s.end_ts - s.start_ts)}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-16 text-tertiary font-mono text-xs">No sessions found.</div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col border border-outline bg-surface overflow-hidden">
        {selected ? (
          <>
            {/* Session Header */}
            <div className="p-6 border-b border-outline bg-surface-dim flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl text-on-surface flex items-center gap-3 mb-1" style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                    Session #{selected.id}
                    <span className="text-sm border border-outline/50 px-2 py-0.5 text-tertiary font-mono">{selected.project}</span>
                    {selected.status === 'active' && activeLookup.get(selected.id)?.isLatestForProject && (
                      <span className="text-[10px] font-mono text-[#4de082] border border-[#4de082]/30 px-1.5 py-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4de082] animate-pulse" />
                        LIVE
                        <InfoTooltip text="This session is currently active — VS Code window is open" />
                      </span>
                    )}
                    {selected.status === 'active' && activeLookup.get(selected.id)?.isDuplicate && (
                      <span className="text-[10px] font-mono text-tertiary border border-outline/30 px-1.5 py-0.5 flex items-center gap-1">
                        duplicate
                        <InfoTooltip text="Another session for this project is already active" />
                      </span>
                    )}
                  </h2>
                  {selected.summary && <p className="text-xs text-tertiary font-mono mt-1">{selected.summary}</p>}
                </div>
                <div className="flex flex-col items-end gap-3 text-right">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(selected)}
                      className="text-xs font-mono border border-outline/40 px-3 py-1 flex items-center gap-2 hover:bg-surface transition-colors"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleRegenerate(selected.id)}
                      disabled={regenerating}
                      className="text-xs font-mono border border-outline/40 px-3 py-1 flex items-center gap-2 hover:bg-surface transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={13} /> {regenerating ? 'Regenerating…' : 'Regenerate AI Summary'}
                    </button>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      disabled={deleting}
                      className="text-xs font-mono text-error border border-error/30 px-3 py-1 flex items-center gap-2 hover:bg-error/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>

                  <div className="flex gap-5">
                    <div>

                    <ConfirmDialog
                      open={showDeleteConfirm}
                      title="Confirm delete"
                      message={`Delete session #${selected?.id || selectedId} and all associated events?`}
                      confirmLabel="Delete"
                      cancelLabel="Cancel"
                      danger
                      confirming={deleting}
                      onCancel={() => setShowDeleteConfirm(false)}
                      onConfirm={confirmDeleteSession}
                    />
                      <div className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-0.5">Duration</div>
                      <div className="text-lg font-mono">{selected.status === 'active' ? 'ongoing' : formatDuration(selected.end_ts - selected.start_ts)}</div>
                    </div>
                    <div>
                      <div className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-0.5">Events</div>
                      <div className="text-lg font-mono">{sessionEvents.length}</div>
                    </div>
                    <div>
                      <div className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-0.5">Files</div>
                      <div className="text-lg font-mono">{fileGroups.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              {showEditModal && selected && (
                <div className="mt-4 border border-outline bg-surface-dim p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="font-label-mono-xs text-tertiary uppercase tracking-widest">Inline Session Editor</div>
                      <div className="text-[10px] font-mono text-tertiary mt-1">
                        Editing in place on the session details panel.
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-tertiary">
                      Started {formatReadableDateTime(selected.start_ts)}
                    </div>
                  </div>

                  <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-tertiary font-mono">Project</label>
                        <input value={editForm.project} onChange={e => setEditForm({...editForm, project: e.target.value})} className="w-full bg-surface border border-outline px-3 py-2 text-sm font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none mt-1" />
                      </div>
                      <div>
                        <label className="text-xs text-tertiary font-mono">End timestamp</label>
                        <input
                          type="datetime-local"
                          value={toDateTimeLocalInput(editForm.end_ts)}
                          onChange={e => setEditForm({...editForm, end_ts: e.target.value ? new Date(e.target.value).getTime() : null})}
                          className="w-full bg-surface border border-outline px-3 py-2 text-sm font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none mt-1"
                        />
                        <div className="mt-1 text-[10px] font-mono text-tertiary">
                          {formatReadableDateTime(editForm.end_ts)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-tertiary font-mono">Human Summary</label>
                      <textarea value={editForm.summary} onChange={e => setEditForm({...editForm, summary: e.target.value})} rows={4} className="w-full bg-surface border border-outline px-3 py-2 text-sm font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none mt-1" />
                    </div>

                    <div>
                      <label className="text-xs text-tertiary font-mono">AI Summary (JSON or plain text)</label>
                      <textarea value={editForm.ai_summary} onChange={e => setEditForm({...editForm, ai_summary: e.target.value})} rows={8} className="w-full bg-surface border border-outline px-3 py-2 text-sm font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none mt-1" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={saving} className="bg-primary-container text-background py-2 text-xs font-mono uppercase px-4 hover:opacity-90 transition-opacity disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => setShowEditModal(false)} className="border border-outline text-tertiary px-4 py-2 text-xs font-mono uppercase hover:text-on-surface transition-colors">Cancel</button>
                      <button type="button" onClick={() => handleRegenerate(editForm.id)} disabled={regenerating} className="ml-auto text-xs font-mono border border-outline/40 px-3 py-2 flex items-center gap-2 hover:bg-surface transition-colors disabled:opacity-50"><RefreshCw size={13} /> {regenerating ? 'Regenerating…' : 'Regenerate AI Summary'}</button>
                      <button type="button" onClick={() => handleDelete(editForm.id)} disabled={deleting} className="text-xs font-mono text-error border border-error/30 px-3 py-2 flex items-center gap-2 hover:bg-error/10 transition-colors disabled:opacity-50"><Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* AI Session Summary Panel */}
              {(() => {
                let aiSummary = null;
                try { aiSummary = selected.ai_summary ? JSON.parse(selected.ai_summary) : null; } catch {}
                if (!aiSummary) return null;
                return (
                  <div className="mt-4 border border-primary-container/30 bg-primary-container/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={13} className="text-primary-container" />
                      <span className="font-label-mono-xs text-primary-container uppercase tracking-widest">AI Session Summary</span>
                      {aiSummary.confidence != null && (
                        <span className="ml-auto text-[10px] font-mono text-tertiary">confidence {aiSummary.confidence}%</span>
                      )}
                    </div>
                    <p className="text-sm text-on-surface font-mono leading-relaxed mb-3">{aiSummary.summary}</p>
                    {aiSummary.key_insight && (
                      <div className="border-l-2 border-primary-container pl-3 mb-3">
                        <span className="text-[10px] text-tertiary uppercase tracking-widest font-mono">Key Insight · </span>
                        <span className="text-xs text-on-surface font-mono">{aiSummary.key_insight}</span>
                      </div>
                    )}
                    {aiSummary.next_steps?.length > 0 && (
                      <div>
                        <div className="text-[10px] text-tertiary uppercase tracking-widest font-mono mb-1.5">Next Session →</div>
                        <ul className="space-y-1">
                          {aiSummary.next_steps.map((s, i) => (
                            <li key={i} className="text-xs text-on-surface font-mono flex items-start gap-2">
                              <span className="text-primary-container mt-0.5">›</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSummary.errors_fixed?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        <span className="text-[10px] text-tertiary uppercase tracking-widest font-mono mr-1">Fixed:</span>
                        {aiSummary.errors_fixed.map((e, i) => (
                          <span key={i} className="text-[10px] font-mono border border-success/30 text-success px-1.5 py-0.5">{e}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Brain Dumps */}
              {(() => {
                const dumps = brainDumpsData?.braindumps || [];
                if (dumps.length === 0) return null;
                return (
                  <div className="mt-4 border border-outline bg-surface-dim p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain size={13} className="text-tertiary" />
                      <span className="font-label-mono-xs text-tertiary uppercase tracking-widest">Brain Dumps ({dumps.length})</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {dumps.map(dump => (
                        <div key={dump.id} className="border border-outline/30 bg-surface p-2 text-xs font-mono text-on-surface/80 hover:text-on-surface transition-colors">
                          <div className="line-clamp-2">{dump.content}</div>
                          <div className="text-[9px] text-tertiary mt-1">{formatEventTime(dump.ts)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* End session button if active */}
              {selected.status === 'active' && (
                <button
                  onClick={() => handleEnd(selected.id)}
                  disabled={ending}
                  className="mt-3 text-xs font-mono uppercase text-error border border-error/30 px-4 py-1.5 hover:bg-error/10 transition-colors disabled:opacity-50"
                >
                  {ending ? 'Ending…' : 'End Session'}
                </button>
              )}
            </div>

            {/* Code Diffs */}
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-4">
                Full Event Details & Code Diffs
              </h3>

              {fileGroups.length === 0 ? (
                <p className="text-tertiary font-mono text-xs">No events found for this project yet.</p>
              ) : (
                <div className="space-y-3">
                  {fileGroups.map(group => (
                    <div key={group.file} className="border border-outline bg-surface-dim overflow-hidden">
                      <div
                        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface transition-colors"
                        onClick={() => setExpandedFile(expandedFile === group.file ? null : group.file)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ChevronRight size={14} className={`text-tertiary flex-shrink-0 transition-transform ${expandedFile === group.file ? 'rotate-90' : ''}`} />
                          <FileCode size={14} className="text-primary-container flex-shrink-0" />
                          <span className="font-code-snippet text-sm text-on-surface truncate">{group.file.split(/[\\/]/).pop()}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-tertiary font-mono">{group.events.length} events</span>
                          {group.language && (
                            <span className="text-[10px] font-mono border border-outline px-1.5 py-0.5 uppercase text-tertiary">{group.language}</span>
                          )}
                        </div>
                      </div>

                      {expandedFile === group.file && (
                        <div className="border-t border-outline bg-surface">
                          {group.events.slice(0, 5).map((e, i) => (
                            <div key={i} className="border-b border-outline last:border-b-0">
                              <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-tertiary font-mono border-l-2 border-l-teal-400/70">
                                <ArrowRight size={12} />
                                <span>{formatEventTime(e.ts)}</span>
                                <span className="border border-outline/40 px-1">{e.project}</span>
                                <span className="text-tertiary ml-auto">{e.type}</span>
                              </div>
                              {e.diff ? (
                                <pre className="code-block mx-4 mb-3">
                                  {e.diff}
                                </pre>
                              ) : (
                                <div className="mx-4 mb-3 text-[11px] text-tertiary font-mono">no diff captured</div>
                              )}
                            </div>
                          ))}
                          {group.events.length > 5 && (
                            <div className="px-4 py-2 text-[10px] text-tertiary font-mono border-t border-outline">
                              +{group.events.length - 5} more events
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-tertiary font-mono text-xs">
            Select a session from the left to view details.
          </div>
        )}
      </div>

      {/* Start Session Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowStartModal(false)}>
          <form
            onSubmit={handleStart}
            onClick={e => e.stopPropagation()}
            className="bg-surface border border-outline p-6 w-80"
          >
            <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-4">Start New Session</h3>
            <input
              autoFocus
              type="text"
              placeholder="Project name..."
              value={newProject}
              onChange={e => setNewProject(e.target.value)}
              className="w-full bg-surface-dim border border-outline px-3 py-2 text-sm font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={starting || !newProject.trim()} className="flex-1 bg-primary-container text-background py-2 text-xs font-mono uppercase font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                {starting ? 'Starting…' : 'Start Session'}
              </button>
              <button type="button" onClick={() => setShowStartModal(false)} className="border border-outline text-tertiary px-4 py-2 text-xs font-mono uppercase hover:text-on-surface transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowRight, X, Pencil, Trash2, Check, Sparkles, ExternalLink } from 'lucide-react';
import { useApi } from '../hooks';
import { getBrainDumps, getAllEvents, createBrainDump, updateBrainDump, deleteBrainDump, getActiveSessions, timeAgo } from '../api';

const PROJECTS_ALL = 'all';
const RANGES = ['today', 'week', 'month', 'all'];
const RANGE_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' };
const TYPES = ['all', 'manual'];

function inRange(ts, range) {
  const now = Date.now();
  if (range === 'today') return now - ts < 86400000;
  if (range === 'week') return now - ts < 7 * 86400000;
  if (range === 'month') return now - ts < 30 * 86400000;
  return true;
}

export default function BrainDumps() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(PROJECTS_ALL);
  const [rangeFilter, setRangeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editingDump, setEditingDump] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();
  const { data: dumpsData, refetch } = useApi(() => getBrainDumps(100));
  const { data: eventsRaw } = useApi(getAllEvents);
  const { data: activeData } = useApi(getActiveSessions);
  const currentSession = activeData?.activeProjects?.[0]?.sessions?.[0] || null;

  const dumps = dumpsData?.braindumps || [];
  const events = Array.isArray(eventsRaw) ? eventsRaw : [];

  // Build project list from events (braindumps don't store project in current schema)
  const projectList = useMemo(() => {
    const ps = [...new Set(events.map(e => e.project).filter(Boolean))];
    return [PROJECTS_ALL, ...ps];
  }, [events]);

  const filtered = useMemo(() => {
    return dumps.filter(d => {
      if (!inRange(d.ts, rangeFilter)) return false;
      if (search && !d.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [dumps, projectFilter, rangeFilter, typeFilter, search]);

  function formatReadableDate(ts) {
    if (!ts) return 'Unknown date';
    const date = new Date(ts);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString(undefined, { month: 'long' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  function openEdit(dump) {
    setEditingDump({ id: dump.id, content: dump.content, session_id: dump.session_id });
    setExpandedId(dump.id);
  }

  async function handleSaveEdit() {
    if (!editingDump?.content?.trim()) return;
    setSavingEdit(true);
    try {
      const sessionId = editingDump.session_id || currentSession?.id || null;
      await updateBrainDump(editingDump.id, editingDump.content.trim(), sessionId);
      setToast('Brain dump updated');
      setEditingDump(null);
      refetch();
    } catch (err) {
      setToast('Error: ' + err.message);
    } finally {
      setSavingEdit(false);
      setTimeout(() => setToast(''), 2500);
    }
  }

  async function handleDelete(id) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBrainDump(deleteTarget);
      setToast('Brain dump deleted');
      if (editingDump?.id === deleteTarget) setEditingDump(null);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setToast('Error: ' + err.message);
    } finally {
      setDeleting(false);
      setTimeout(() => setToast(''), 2500);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      const sessionId = currentSession?.id || null;
      await createBrainDump(input.trim(), null, sessionId);
      setInput('');
      setToast('Thought captured!');
      setTimeout(() => setToast(''), 2000);
      refetch();
    } catch (err) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3 overflow-hidden">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#18181E] border border-outline text-on-surface text-xs font-mono px-4 py-2.5">
          {toast}
        </div>
      )}

      {/* Left Filter Sidebar */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-5 pt-1">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-tertiary" />
          <input
            type="text"
            placeholder="Search dumps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface-dim border border-outline pl-7 pr-2 py-2 text-xs font-mono text-on-surface placeholder:text-tertiary focus:border-primary-container focus:outline-none"
          />
        </div>

        <div>
          <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3">Date Range</h3>
          <ul className="space-y-2">
            {RANGES.map(r => (
              <li key={r}>
                <button
                  onClick={() => setRangeFilter(r)}
                  className={`flex items-center gap-2 text-xs font-mono w-full text-left transition-colors ${rangeFilter === r ? 'text-on-surface' : 'text-tertiary hover:text-on-surface'}`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rangeFilter === r ? 'bg-primary-container' : 'border border-outline'}`} />
                  {RANGE_LABELS[r]}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3">Stats</h3>
          <div className="space-y-2 font-mono text-xs text-tertiary">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="text-on-surface">{dumps.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Today</span>
              <span className="text-on-surface">{dumps.filter(d => inRange(d.ts, 'today')).length}</span>
            </div>
            <div className="flex justify-between">
              <span>This Week</span>
              <span className="text-on-surface">{dumps.filter(d => inRange(d.ts, 'week')).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Input bar */}
        <form onSubmit={handleSubmit} className="bg-surface-dim border border-outline p-3 flex gap-3 mb-3 flex-shrink-0">
          <input
            type="text"
            className="flex-1 bg-surface border border-outline p-3 font-code-snippet text-sm focus:border-primary-container focus:outline-none text-on-surface placeholder:text-tertiary"
            placeholder="Drop a thought..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !input.trim()}
            className="bg-primary-container text-background px-6 font-mono text-sm uppercase font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? '…' : 'Add'}
          </button>
        </form>

        {/* Count bar */}
        <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
          <span className="font-label-mono-xs text-tertiary uppercase tracking-widest">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            {search && ` matching "${search}"`}
          </span>
          {search && (
            <button onClick={() => setSearch('')} className="text-tertiary hover:text-primary-container text-xs font-mono flex items-center gap-1">
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-tertiary font-mono text-xs gap-2">
              <span>{dumps.length === 0 ? 'No brain dumps yet.' : 'No results for this filter.'}</span>
              {dumps.length === 0 && (
                <span className="text-[10px] text-tertiary/60">Start typing a thought above!</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start pb-4">
              {filtered.map(d => {
                const isExpanded = expandedId === d.id;
                const isLong = d.content.length > 140;
                return (
                  <div
                    key={d.id}
                    className="group bg-surface-dim border border-outline border-l-2 border-l-primary-container/60 p-5 flex flex-col hover:bg-surface transition-colors relative"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono text-primary-container border border-primary-container/30 px-1.5 py-0.5 uppercase">manual</span>
                      <span className="text-[10px] text-tertiary font-mono">{timeAgo(d.ts)}</span>
                    </div>

                    <div className="flex items-start justify-between gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : d.id)}
                        className="text-left flex-1"
                      >
                        <p className={`text-sm leading-relaxed text-on-surface mb-1 ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}>
                          {d.content}
                        </p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          className="p-1.5 border border-outline text-tertiary hover:text-on-surface hover:bg-surface transition-colors"
                          title="Edit brain dump"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="p-1.5 border border-error/30 text-error hover:bg-error/10 transition-colors"
                          title="Delete brain dump"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isLong && (
                      <span className="text-[10px] font-mono text-tertiary">
                        {isExpanded ? '▲ Show less' : '▼ Show more'}
                      </span>
                    )}

                    <div className="mt-auto pt-3 border-t border-outline space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-tertiary font-mono">{formatReadableDate(d.ts)}</span>
                      </div>
                      {d.session_id ? (
                        <button
                          type="button"
                          onClick={() => navigate('/sessions')}
                          className="text-[10px] font-mono text-primary-container flex items-center gap-1 hover:text-on-surface transition-colors"
                        >
                          <Sparkles size={10} /> Session #{d.session_id}
                        </button>
                      ) : (
                        <div className="text-[10px] font-mono text-tertiary italic">No session linked</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingDump && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setEditingDump(null)}>
          <div className="w-full max-w-2xl border border-outline bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-outline flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-tertiary">Edit Brain Dump</div>
                <div className="text-[10px] font-mono text-tertiary mt-1">ID #{editingDump.id}</div>
              </div>
              <button type="button" onClick={() => setEditingDump(null)} className="text-tertiary hover:text-on-surface">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {editingDump.session_id && (
                <div className="text-[10px] font-mono text-tertiary bg-surface-dim border border-outline px-3 py-2">
                  Session #{editingDump.session_id}
                </div>
              )}
              <textarea
                value={editingDump.content}
                onChange={e => setEditingDump({ ...editingDump, content: e.target.value })}
                rows={9}
                className="w-full bg-surface-dim border border-outline px-3 py-2 text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editingDump.content.trim()}
                  className="bg-primary-container text-background px-4 py-2 text-xs font-mono uppercase font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  <Check size={13} /> {savingEdit ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDump(null)}
                  className="border border-outline text-tertiary px-4 py-2 text-xs font-mono uppercase hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-md border border-outline bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-outline flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-error/10 border border-error/30 flex items-center justify-center text-error">
                <Trash2 size={15} />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-tertiary">Confirm delete</div>
                <div className="text-sm text-on-surface font-mono mt-1">Delete this brain dump permanently?</div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs font-mono text-tertiary leading-relaxed">
                This will remove the thought from your history. This action cannot be undone.
              </p>
              <div className="mt-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="border border-outline text-tertiary px-4 py-2 text-xs font-mono uppercase hover:text-on-surface transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="bg-error text-background px-4 py-2 text-xs font-mono uppercase font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

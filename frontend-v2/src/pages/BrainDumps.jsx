import React, { useState, useMemo } from 'react';
import { Search, Plus, ArrowRight, X } from 'lucide-react';
import { useApi } from '../hooks';
import { getBrainDumps, getAllEvents, createBrainDump, timeAgo } from '../api';

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

  const { data: dumpsData, refetch } = useApi(() => getBrainDumps(100));
  const { data: eventsRaw } = useApi(getAllEvents);

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      await createBrainDump(input.trim());
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
                    className="group bg-surface-dim border border-outline border-l-2 border-l-primary-container/60 p-5 flex flex-col hover:bg-surface transition-colors relative cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono text-primary-container border border-primary-container/30 px-1.5 py-0.5 uppercase">manual</span>
                      <span className="text-[10px] text-tertiary font-mono">{timeAgo(d.ts)}</span>
                    </div>

                    <p className={`text-sm leading-relaxed text-on-surface mb-4 ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}>
                      {d.content}
                    </p>

                    {isLong && (
                      <span className="text-[10px] font-mono text-tertiary">
                        {isExpanded ? '▲ Show less' : '▼ Show more'}
                      </span>
                    )}

                    <div className="mt-auto pt-3 border-t border-outline flex justify-between items-center">
                      <span className="text-[10px] text-tertiary font-mono">
                        {new Date(d.ts).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

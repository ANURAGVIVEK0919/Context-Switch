import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApi } from '../hooks';
import useWebSocket from '../hooks/useWebSocket';
import InfoTooltip from '../components/InfoTooltip';
import { getAllEvents, reconstructProject, groupByProject, timeAgo } from '../api';

function ConfidenceBar({ value }) {
  const blocks = 24;
  const filled = Math.round((value || 0) * blocks);
  return (
    <div className="flex gap-px">
      {Array.from({ length: blocks }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-2"
          style={{ backgroundColor: i < filled ? '#4de082' : '#222228' }}
        />
      ))}
    </div>
  );
}

const QUERY_TYPES = [
  { id: 'context', label: 'Context Brief' },
  { id: 'handoff', label: 'Handoff Doc' },
  { id: 'staleness', label: 'Staleness Analysis' },
];

function getQueryLabel(type) {
  return QUERY_TYPES.find(q => q.id === type)?.label || 'Context Brief';
}

export default function AISynthesis() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const preselect = params.get('project') || '';

  const [queryType, setQueryType] = useState('context');
  const [selectedProject, setSelectedProject] = useState(preselect);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | result | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('syntheses') || '[]'); } catch { return []; }
  });

  const { data: eventsRaw } = useApi(getAllEvents);
  const events = Array.isArray(eventsRaw) ? eventsRaw : [];
  const projects = [...new Set(events.map(e => e.project).filter(Boolean))];

  useWebSocket('ws://localhost:3001/ws', message => {
    if (message?.type !== 'events_updated') return;
  });

  useEffect(() => {
    if (preselect && !selectedProject) setSelectedProject(preselect);
  }, [preselect]);

  async function handleSynthesize(e) {
    e.preventDefault();
    if (!selectedProject) return;
    setState('loading');
    setError('');
    setResult(null);
    try {
      const data = await reconstructProject(selectedProject, queryType);
      setResult(data);
      setState('result');
      const entry = {
        project: selectedProject,
        type: queryType,
        brief: data.brief?.slice(0, 80),
        ts: Date.now(),
        data,
      };
      const updated = [entry, ...history].slice(0, 5);
      setHistory(updated);
      localStorage.setItem('syntheses', JSON.stringify(updated));
    } catch (err) {
      setError(err.message || 'AI reconstruction failed');
      setState('error');
    }
  }

  function restoreHistory(entry) {
    setSelectedProject(entry.project);
    setResult(entry.data);
    setState('result');
  }

  const confidence = result?.confidence || 0;
  const confidencePct = Math.round(confidence * 100);
  const nextSteps = Array.isArray(result?.next_steps) ? result.next_steps : [];
  const sources = result?.context_sources || {};
  const currentLabel = getQueryLabel(queryType);

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-7rem)] gap-3 overflow-hidden">

      {/* Left — Query Interface */}
      <div className="xl:w-[400px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        <form onSubmit={handleSynthesize} className="bg-surface-dim border border-outline p-6 flex flex-col gap-5">
          <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest border-b border-outline pb-3">
            AI Synthesis
          </h2>

          {/* Project */}
          <div>
            <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-2">Project Context</h3>
            {projects.length === 0 ? (
              <p className="text-xs font-mono text-tertiary">No projects found — start coding to generate events.</p>
            ) : (
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                className="w-full bg-surface border border-outline p-2.5 text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none cursor-pointer"
              >
                <option value="">— Select a project —</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>

          {/* Query Type */}
          <div>
            <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3 flex items-center">Query Type<InfoTooltip text="Choose what kind of AI output to generate for the selected project" /></h3>
            <div className="flex flex-col gap-2.5">
              {QUERY_TYPES.map(qt => (
                <label key={qt.id} className="flex items-center gap-3 cursor-pointer group" onClick={() => setQueryType(qt.id)}>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${queryType === qt.id ? 'border-primary-container bg-primary-container' : 'border-outline group-hover:border-outline-strong'}`}
                  >
                    {queryType === qt.id && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                  </div>
                  <span className={`font-mono text-sm ${queryType === qt.id ? 'text-on-surface' : 'text-tertiary group-hover:text-on-surface-variant'} transition-colors`}>
                    {qt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Extra Query */}
          <div>
            <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-2">Query (optional)</h3>
            <textarea
              className="w-full bg-surface border border-outline p-3 text-sm font-body-md text-on-surface focus:border-primary-container focus:outline-none resize-none placeholder:text-tertiary h-24"
              placeholder="Specific question about this project..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!selectedProject || state === 'loading'}
            className="w-full bg-primary-container text-background py-3 font-mono uppercase font-bold tracking-widest hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {state === 'loading' ? 'Synthesizing…' : 'Synthesize'}
          </button>
        </form>

        {/* Recent Syntheses */}
        {history.length > 0 && (
          <div className="bg-surface-dim border border-outline p-4">
            <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3">Recent Syntheses</h3>
            <div className="space-y-2">
              {history.map((entry, i) => (
                <div
                  key={i}
                  onClick={() => restoreHistory(entry)}
                  className={`border border-outline p-3 cursor-pointer hover:bg-surface transition-colors ${i === 0 ? 'border-l-2 border-l-primary-container' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-code-snippet text-xs text-on-surface">{entry.project} · {QUERY_TYPES.find(q => q.id === entry.type)?.label}</span>
                    <span className="font-mono text-[10px] text-tertiary">{timeAgo(entry.ts)}</span>
                  </div>
                  <p className="text-[11px] text-tertiary font-mono truncate">"{entry.brief}…"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — Output Panel */}
      <div className="flex-1 border border-outline bg-surface-dim flex flex-col overflow-y-auto">
        {state === 'idle' && (
          <div className="flex-1 flex items-center justify-center p-10">
            <span className="font-code-snippet text-tertiary text-center text-sm leading-relaxed">
              Select a project and hit Synthesize to generate a {currentLabel.toLowerCase()}.
            </span>
          </div>
        )}

        {state === 'loading' && (
          <div className="flex-1 flex items-center justify-center p-10">
            <span className="font-code-snippet text-tertiary animate-pulse text-sm">
              _ Agent reasoning...
            </span>
          </div>
        )}

        {state === 'error' && (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="text-center">
              <div className="text-error font-mono text-sm mb-2">Synthesis failed</div>
              <div className="text-tertiary font-mono text-xs">{error}</div>
              <button onClick={() => setState('idle')} className="mt-4 text-xs font-mono text-primary-container hover:underline">
                Try again
              </button>
            </div>
          </div>
        )}

        {state === 'result' && result && (
          <div className="p-8 flex flex-col gap-8">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-outline pb-3">
              <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest flex items-center">{currentLabel}<InfoTooltip text={currentLabel === 'Context Brief' ? 'A 1-2 sentence AI summary of what you were working on' : currentLabel === 'Handoff Doc' ? 'A structured handoff note for another developer' : 'An analysis of which files need attention based on edit history'} /></h2>
              <span className="font-code-snippet text-xs text-primary-container">{confidencePct}% confidence</span>
            </div>

            {/* Brief */}
            <p className="text-sm text-on-surface leading-relaxed">{result.brief || 'No brief generated.'}</p>

            {/* Confidence */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest flex items-center">Confidence Score<InfoTooltip text="AI's confidence in its analysis based on available context. Higher means more data was available." /></h3>
                <span className="font-code-snippet text-xs text-on-surface">{confidencePct}%</span>
              </div>
              <ConfidenceBar value={confidence} />
            </div>

            {/* Next Steps */}
            {nextSteps.length > 0 && (
              <div>
                <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-4">Next Steps</h3>
                <ol className="space-y-3">
                  {nextSteps.map((step, i) => (
                    <li key={i} className="flex gap-4 font-code-snippet text-xs text-on-surface">
                      <span className="text-tertiary flex-shrink-0 w-4">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Memory Snapshot */}
            <div className="border-t border-outline pt-6">
              <h3 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-3 flex items-center">Memory Snapshot<InfoTooltip text="Automatic snapshots created every 5 file edits, used to reconstruct context" /></h3>
              <div className="flex gap-8 font-code-snippet text-xs text-on-surface">
                <div><span className="text-tertiary">Nodes: </span>{sources.memoryNodes ?? '—'}</div>
                <div><span className="text-tertiary">Dumps: </span>{sources.brainDumps ?? '—'}</div>
                <div><span className="text-tertiary">Events: </span>{sources.recentEvents ?? '—'}</div>
                <div><span className="text-tertiary">Stale: </span>{Array.isArray(sources.staleFiles) ? sources.staleFiles.length : '—'}</div>
              </div>
              {Array.isArray(sources.staleFiles) && sources.staleFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {sources.staleFiles.map((f, i) => (
                    <span key={i} className="text-[10px] font-mono text-error border border-error/20 px-1.5 py-0.5">
                      {f.split(/[\\/]/).pop()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Generated */}
            <div className="font-code-snippet text-[10px] text-tertiary uppercase tracking-widest">
              Generated: {result.generated_at ? new Date(result.generated_at).toLocaleString() : 'just now'} · groq/llama-3.3-70b
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

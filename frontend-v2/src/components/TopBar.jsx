import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { usePolling } from '../hooks';
import { getCurrentSession, getActiveSessions, endSession } from '../api';
import useWebSocket from '../hooks/useWebSocket';
import InfoTooltip from './InfoTooltip';
import { useEffect, useState } from 'react';

const pageNames = {
  '/': 'Overview',
  '/projects': 'Projects',
  '/sessions': 'Sessions',
  '/brain-dumps': 'Brain Dumps',
  '/ai-synthesis': 'AI Synthesis',
  '/analytics': 'Analytics',
};

export default function TopBar() {
  const location = useLocation();
  const pageName = pageNames[location.pathname] || 'Overview';
  const [liveVisible, setLiveVisible] = useState(false);

  const { data: currentData, refetch } = usePolling(getCurrentSession, 10000);
  const { data: activeData } = usePolling(getActiveSessions, 10000);
  const session = currentData?.session;
  const activeProjectsCount = activeData?.activeProjectsCount ?? activeData?.activeProjects?.length ?? 0;

  useWebSocket('ws://localhost:3001/ws', message => {
    if (message?.type !== 'events_updated') return;
    setLiveVisible(true);
  });

  useEffect(() => {
    if (!liveVisible) return undefined;
    const timer = window.setTimeout(() => setLiveVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, [liveVisible]);

  async function handleEnd() {
    if (!session) return;
    try {
      await endSession(session.id);
      refetch();
    } catch (e) {
      alert('Could not end session: ' + e.message);
    }
  }

  return (
    <header
      style={{ left: 220, right: 0 }}
      className="fixed top-0 h-12 border-b border-outline bg-background/90 backdrop-blur-sm flex items-center justify-between px-6 z-40"
    >
      <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest">
        <span className="text-tertiary">{pageName}</span>
        <span className="text-outline">/</span>
        {activeProjectsCount > 0 ? (
          <span className="text-primary-container flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-success)] animate-pulse inline-block" />
            {activeProjectsCount} active {activeProjectsCount === 1 ? 'project' : 'projects'}
            <InfoTooltip text="Number of VS Code windows currently open and being tracked" />
          </span>
        ) : (
          <span className="text-tertiary">No active session</span>
        )}
      </div>
      <div className="flex items-center gap-5">
        {liveVisible && (
          <span className="text-[color:var(--color-success)] flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[color:var(--color-success)] animate-pulse inline-block" />
            LIVE
          </span>
        )}
        {session ? (
          <button
            onClick={handleEnd}
            className="font-mono text-xs uppercase tracking-widest text-error hover:text-on-surface transition-colors cursor-pointer border border-error/30 px-3 py-1 hover:bg-error/10"
          >
            End Track
          </button>
        ) : (
          <span className="font-mono text-xs uppercase tracking-widest text-tertiary">No session</span>
        )}
        <Bell size={16} strokeWidth={1.5} className="text-tertiary hover:text-on-surface transition-colors cursor-pointer" />
      </div>
    </header>
  );
}

import db from '../db';

export interface Session {
    id: number;
    project: string;
    start_ts: number;
    end_ts: number | null;
    summary: string | null;
    status: string;
    duration?: number;
}

export function startSession(project: string = 'default'): { sessionId: number; project: string; startTs: number; existing: boolean } {
    const existing = db.prepare(`SELECT id, project, start_ts FROM sessions WHERE status = 'active' AND project = ? ORDER BY start_ts DESC LIMIT 1`).get(project) as { id: number; project: string; start_ts: number } | undefined;
    if (existing) {
        return { sessionId: existing.id, project: existing.project, startTs: existing.start_ts, existing: true };
    }

    const startTs = Date.now();
    const stmt = db.prepare(`INSERT INTO sessions (project, start_ts, status) VALUES (?, ?, 'active')`);
    const info = stmt.run(project, startTs);
    return { sessionId: info.lastInsertRowid as number, project, startTs, existing: false };
}

export function endSession(sessionId: number): { sessionId: number; summary: string; duration: number } {
    const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as Session | undefined;
    if (!session) {
        throw new Error('Session not found');
    }
    if (session.status === 'ended') {
        throw new Error('Session already ended');
    }

    const endTs = Date.now();
    const duration = Math.floor((endTs - session.start_ts) / 1000);
    
    // Generate summary
    const eventsCountRow = db.prepare(`SELECT COUNT(*) as count FROM events WHERE ts >= ? AND ts <= ?`).get(session.start_ts, endTs) as any;
    const eventsCount = eventsCountRow ? eventsCountRow.count : 0;
    
    const files = db.prepare(`SELECT DISTINCT filePath FROM events WHERE ts >= ? AND ts <= ? AND filePath IS NOT NULL`).all(session.start_ts, endTs) as {filePath: string}[];
    const uniqueFiles = files.map(f => f.filePath).join(', ');
    const summary = `${eventsCount} events captured. Files touched: ${uniqueFiles || 'none'}`;

    const stmt = db.prepare(`UPDATE sessions SET end_ts = ?, status = 'ended', summary = ? WHERE id = ?`);
    stmt.run(endTs, summary, sessionId);

    return { sessionId, summary, duration };
}

export function getCurrentSession(): { id: number; project: string; start_ts: number } | null {
    const session = db.prepare(`SELECT id, project, start_ts FROM sessions WHERE status = 'active' ORDER BY start_ts DESC LIMIT 1`).get() as any;
    return session || null;
}

export function getActiveSessions(): Session[] {
    return db.prepare(`SELECT * FROM sessions WHERE status = 'active' ORDER BY start_ts DESC`).all() as Session[];
}

export function getSessionById(sessionId: number): Session | undefined {
    return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as Session | undefined;
}

export function getSessionHistory(limit: number = 10): Session[] {
    const sessions = db.prepare(`SELECT * FROM sessions ORDER BY start_ts DESC LIMIT ?`).all(limit) as Session[];
    return sessions.map(s => ({
        ...s,
        duration: s.end_ts ? Math.floor((s.end_ts - s.start_ts) / 1000) : undefined
    }));
}

export function getSessionStats(): { totalSessions: number; totalDuration: number; avgDuration: number } {
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as totalSessions, 
            SUM(end_ts - start_ts) as totalDurationMs
        FROM sessions 
        WHERE status = 'ended'
    `).get() as any;

    const totalSessions = stats.totalSessions || 0;
    const totalDuration = stats.totalDurationMs ? Math.floor(stats.totalDurationMs / 1000) : 0;
    const avgDuration = totalSessions > 0 ? Math.floor(totalDuration / totalSessions) : 0;

    return { totalSessions, totalDuration, avgDuration };
}

/**
 * Builds a rich context string from all events during a session.
 * This is passed to the AI to generate a detailed session summary.
 */
export function buildSessionContext(sessionId: number): string {
    const session = getSessionById(sessionId) as any;
    if (!session) throw new Error('Session not found');

    const endTs = session.end_ts || Date.now();
    const durationMins = Math.floor((endTs - session.start_ts) / 60000);

    // All events during the session window
    const allEvents = db.prepare(`
        SELECT type, filePath, language, diff, severity, ts FROM events
        WHERE project = ? AND ts >= ? AND ts <= ?
        ORDER BY ts ASC
    `).all(session.project, session.start_ts, endTs) as any[];

    // Brain dumps during this session
    const braindumps = db.prepare(`
        SELECT content, ts FROM braindumps
        WHERE ts >= ? AND ts <= ?
        ORDER BY ts ASC
    `).all(session.start_ts, endTs) as any[];

    // Memory nodes created during this session
    const memoryNodes = db.prepare(`
        SELECT content, type, ts FROM memory_nodes
        WHERE session_id = ?
        ORDER BY ts ASC
    `).all(sessionId) as any[];

    // Categorise events
    const fileChanges = allEvents.filter(e => e.type === 'file:change');
    const gitCommits = allEvents.filter(e => e.type === 'git:commit');
    const gitActivity = allEvents.filter(e => e.type === 'git:activity');
    const errors = allEvents.filter(e => e.type === 'diagnostic:error');
    const terminalCmds = allEvents.filter(e => e.type === 'terminal:command');

    // Unique files touched
    const uniqueFiles = [...new Set(allEvents.map(e => e.filePath).filter(Boolean))];

    const formatTs = (ts: number) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const context = `
=== SESSION CONTEXT ===
Project: ${session.project}
Duration: ${durationMins} minutes (${formatTs(session.start_ts)} → ${formatTs(endTs)})
Total Events: ${allEvents.length}
Unique Files Touched: ${uniqueFiles.length}

=== FILES EDITED (${fileChanges.length} changes) ===
${fileChanges.length > 0
    ? fileChanges.map(e => `  [${formatTs(e.ts)}] ${e.filePath}${e.language ? ` (${e.language})` : ''}: ${e.diff || 'modified'}`).join('\n')
    : '  None'}

=== GIT COMMITS (${gitCommits.length}) ===
${gitCommits.length > 0
    ? gitCommits.map(e => `  [${formatTs(e.ts)}] ${e.diff || e.filePath}`).join('\n')
    : '  None'}

=== GIT SAVES (${gitActivity.length}) ===
${gitActivity.length > 0
    ? gitActivity.map(e => `  [${formatTs(e.ts)}] ${e.filePath}`).join('\n')
    : '  None'}

=== ERRORS ENCOUNTERED (${errors.length}) ===
${errors.length > 0
    ? errors.map(e => `  [${e.severity?.toUpperCase() || 'ERROR'}] ${e.filePath}: ${e.diff}`).join('\n')
    : '  None — clean session!'}

=== TERMINAL COMMANDS (${terminalCmds.length}) ===
${terminalCmds.length > 0
    ? terminalCmds.map(e => `  $ ${e.diff}`).join('\n')
    : '  None captured'}

=== DEVELOPER BRAIN DUMPS (${braindumps.length}) ===
${braindumps.length > 0
    ? braindumps.map(b => `  [${formatTs(b.ts)}] "${b.content}"`).join('\n')
    : '  None — no notes logged'}

=== AUTO MEMORY NODES (${memoryNodes.length}) ===
${memoryNodes.length > 0
    ? memoryNodes.map(m => `  [${m.type}] ${m.content}`).join('\n')
    : '  None'}

=== ALL UNIQUE FILES ===
${uniqueFiles.map(f => `  - ${f}`).join('\n') || '  None'}
    `.trim();

    return context;
}

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

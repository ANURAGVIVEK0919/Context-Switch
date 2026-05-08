import db from '../db';
import { sendTelegramMessage } from './telegramService';

export interface Session {
    id: number;
    project: string;
    start_ts: number;
    end_ts: number | null;
    summary: string | null;
    status: string;
    user_id: number;
    ai_summary?: string;
}

export function startSession(project: string, userId: number) {
    const existing = db.prepare(`
        SELECT * FROM sessions 
        WHERE project = ? COLLATE NOCASE AND status = 'active' AND user_id = ?
        ORDER BY start_ts DESC LIMIT 1
    `).get(project, userId) as Session | undefined;

    if (existing) {
        return { ...existing, existing: true };
    }

    const info = db.prepare(`
        INSERT INTO sessions (project, start_ts, status, user_id)
        VALUES (?, ?, 'active', ?)
    `).run(project, Date.now(), userId);

    return {
        id: info.lastInsertRowid,
        project,
        start_ts: Date.now(),
        status: 'active',
        user_id: userId,
        existing: false
    };
}

export function endSession(sessionId: number) {
    return db.prepare(`
        UPDATE sessions 
        SET end_ts = ?, status = 'ended'
        WHERE id = ?
    `).run(Date.now(), sessionId);
}

export function getCurrentSession(userId: number): Session | null {
    let session = db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND user_id = ? ORDER BY start_ts DESC LIMIT 1`).get(userId) as Session | undefined;
    if (!session) {
        session = db.prepare(`SELECT * FROM sessions WHERE user_id = ? ORDER BY start_ts DESC LIMIT 1`).get(userId) as Session | undefined;
    }
    return session || null;
}

export function getActiveSessions(userId?: number): Session[] {
    if (userId) return db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND user_id = ?`).all(userId) as Session[];
    return db.prepare(`SELECT * FROM sessions WHERE status = 'active'`).all() as Session[];
}

export async function ingestEvents(userId: number, events: any[]) {
    console.log(`[SessionService] Ingesting ${events.length} events for User ${userId}`);
    
    // Auto-start session if it doesn't exist for the first event's project
    if (events.length > 0 && events[0].project) {
        startSession(events[0].project, userId);
    }
    
    const insertStmt = db.prepare(`
        INSERT INTO events (type, filePath, language, project, ts, diff, source, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const event of events) {
        try {
            console.log(`[SessionService] --> Saving: ${event.type} | ${event.filePath}`);
            insertStmt.run(
                event.type,
                event.filePath || 'unknown',
                event.language || null,
                event.project || 'unknown',
                Date.now(), // Always use server time for perfect sync
                event.diff || null,
                event.source || 'human',
                userId
            );
        } catch (err: any) {
            console.error(`[SessionService] Failed to save event: ${err.message}`);
        }
    }
    return { success: true, count: events.length };
}

export function buildSessionContext(sessionId: number): string {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Session;
    if (!session) return '';

    const events = db.prepare(`
        SELECT * FROM events 
        WHERE user_id = ? AND ts >= ? AND (ts <= ? OR ? IS NULL)
        ORDER BY ts ASC
    `).all(session.user_id, session.start_ts, session.end_ts, session.end_ts) as any[];

    let context = `Project: ${session.project}\nSession Start: ${new Date(session.start_ts).toISOString()}\n`;
    if (session.end_ts) context += `Session End: ${new Date(session.end_ts).toISOString()}\n`;
    context += `\nEvents Log:\n`;

    events.forEach(ev => {
        context += `[${new Date(ev.ts).toISOString()}] ${ev.type} - ${ev.filePath || 'Terminal'}\n`;
        if (ev.diff) context += `   Content: ${ev.diff}\n`;
    });

    return context;
}

export function getSessionById(id: number): Session | undefined {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
}

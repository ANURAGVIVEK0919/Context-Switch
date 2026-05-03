import { Router } from 'express';
import db from '../db';
import * as sessionService from '../services/sessionService';
import { broadcastRealtimeUpdate } from '../realtime';

const router = Router();

function groupActiveSessions(sessions: Array<{ id: number; project: string; start_ts: number; end_ts: number | null; summary: string | null; status: string }>) {
    const map = new Map<string, typeof sessions>();
    for (const session of sessions) {
        const existing = map.get(session.project) || [];
        existing.push(session);
        map.set(session.project, existing);
    }

    return Array.from(map.entries())
        .map(([project, grouped]) => {
            const ordered = [...grouped].sort((a, b) => b.start_ts - a.start_ts);
            return {
                project,
                count: ordered.length,
                sessions: ordered,
                latestSession: ordered[0],
            };
        })
        .sort((a, b) => b.latestSession.start_ts - a.latestSession.start_ts);
}

router.post('/start', (req, res) => {
    try {
        const { project } = req.body;
        const session = sessionService.startSession(project);
        res.status(session.existing ? 200 : 201).json({ success: true, session, existing: session.existing });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/end', (req, res) => {
    try {
        const { sessionId } = req.body;
        if (sessionId === undefined) {
            return res.status(400).json({ success: false, error: 'sessionId missing' });
        }
        const result = sessionService.endSession(Number(sessionId));
        res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === 'Session not found' || error.message === 'Session already ended') {
            return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/end-by-project', (req, res) => {
    try {
        const { project } = req.body;
        if (!project) return res.status(400).json({ success: false, error: 'project missing' });

        const row = db.prepare(`SELECT id FROM sessions WHERE status = 'active' AND project = ? ORDER BY start_ts DESC LIMIT 1`).get(project) as { id: number } | undefined;
        if (!row) return res.status(404).json({ success: false, error: 'No active session for project' });

        const result = sessionService.endSession(Number(row.id));
        res.status(200).json({ success: true, result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/current', (req, res) => {
    try {
        const session = sessionService.getCurrentSession();
        res.status(200).json({ success: true, session });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/active', (req, res) => {
    try {
        const activeSessions = sessionService.getActiveSessions();
        const activeProjects = groupActiveSessions(activeSessions);
        res.status(200).json({
            success: true,
            activeProjectsCount: activeProjects.length,
            activeProjects,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:sessionId/events', (req, res) => {
    try {
        const sessionId = Number(req.params.sessionId);
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'sessionId missing' });
        }

        const session = sessionService.getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        const endTs = session.status === 'active' ? Date.now() : (session.end_ts || Date.now());
        const events = db.prepare(`
            SELECT * FROM events
            WHERE project = ?
              AND ts >= ?
              AND ts <= ?
            ORDER BY ts DESC
        `).all(session.project, session.start_ts, endTs);

        res.status(200).json({ success: true, session, events, count: events.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/history', (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 10;
        const finalLimit = Math.min(limit, 50);
        const sessions = sessionService.getSessionHistory(finalLimit);
        res.status(200).json({ success: true, sessions, count: sessions.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/stats', (req, res) => {
    try {
        const stats = sessionService.getSessionStats();
        res.status(200).json({ success: true, stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

let fileChangeCounter = 0;
router.post('/events/ingest', (req, res) => {
    try {
        const { events } = req.body;
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ success: false, error: 'events array required' });
        }

        const db = require('../db').default;
        const { updateScore } = require('../services/stalenessService');

        for (const event of events) {
            if (event.type === 'git:activity') {
                db.prepare(`
                    INSERT INTO events (type, filePath, language, project, ts, diff)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(event.type, event.filePath, event.language || null, event.project || null, event.timestamp, event.diff || null);
                if (event.filePath) updateScore(event.filePath);
                continue;
            }

            if (!event.type || !event.filePath || !event.project || !event.timestamp) {
                continue;
            }

            db.prepare(`
                INSERT INTO events (type, filePath, language, project, ts, diff)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(event.type, event.filePath, event.language || null, event.project || null, event.timestamp, event.diff || null);
            updateScore(event.filePath);

            fileChangeCounter++;
            if (fileChangeCounter >= 5) {
                fileChangeCounter = 0;
                const session = sessionService.getCurrentSession();
                if (session) {
                    db.prepare(`
                        INSERT INTO memory_nodes (sessionId, project, content, ts)
                        VALUES (?, ?, ?, ?)
                    `).run(
                        session.id,
                        event.project,
                        `Auto-snapshot: Heavy activity in ${event.filePath} (${event.language || 'unknown'} file)`,
                        Date.now()
                    );
                }
            }
        }
        broadcastRealtimeUpdate({ type: 'events_updated', count: events.length });
        res.status(200).json({ success: true, count: events.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

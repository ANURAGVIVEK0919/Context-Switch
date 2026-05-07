import { Router } from 'express';
import db from '../db';
import * as sessionService from '../services/sessionService';
import { broadcastRealtimeUpdate } from '../realtime';
import { aiReason } from '../services/aiService';
import { SESSION_SUMMARY_PROMPT } from './reconstruct.routes';
import { sendTelegramMessage } from '../services/telegramService';

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

        // Fire session-start context brief async (non-blocking)
        if (!session.existing) {
            setImmediate(async () => {
                try {
                    const lastSessions = (sessionService.getSessionHistory(5) as any[])
                        .filter((s: any) => s.project === project && s.status === 'ended');
                    const last = lastSessions[0];
                    if (!last) return;

                    let brief = '';
                    if (last.ai_summary) {
                        try {
                            const parsed = JSON.parse(last.ai_summary);
                            brief = parsed.summary || '';
                            const nextSteps = parsed.next_steps?.slice(0, 2).map((s: string) => `  • ${s}`).join('\n') || '';
                            await sendTelegramMessage(
                                `🚀 <b>New Session Started — ${project}</b>\n\n` +
                                `<b>Last time:</b> <i>${brief}</i>\n\n` +
                                (nextSteps ? `<b>▶ Pick up from:</b>\n${nextSteps}` : '')
                            );
                        } catch {}
                    } else if (last.summary) {
                        await sendTelegramMessage(
                            `🚀 <b>New Session Started — ${project}</b>\n\n` +
                            `<b>Last time:</b> <i>${last.summary}</i>`
                        );
                    }
                } catch {}
            });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/end', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (sessionId === undefined) {
            return res.status(400).json({ success: false, error: 'sessionId missing' });
        }
        const result = sessionService.endSession(Number(sessionId));

        // Respond immediately — don't block the client on AI generation
        res.status(200).json({ success: true, result, ai_summary_pending: true });

        // Fire AI session summary generation async (fire and forget)
        setImmediate(async () => {
            try {
                const contextString = sessionService.buildSessionContext(Number(sessionId));
                const aiData = await aiReason(
                    contextString,
                    'Generate a detailed session summary based on the session log provided.',
                    SESSION_SUMMARY_PROMPT
                );
                db.prepare(`UPDATE sessions SET ai_summary = ? WHERE id = ?`)
                    .run(JSON.stringify(aiData), Number(sessionId));
                broadcastRealtimeUpdate({ type: 'session_summary_ready', sessionId: Number(sessionId) });
                sendTelegramMessage(`✨ <b>AI Session Summary Ready</b>\n\n${aiData.summary}`);
                console.log(`✅ AI session summary generated for session ${sessionId}`);
            } catch (aiErr: any) {
                console.error(`⚠️ AI session summary failed for session ${sessionId}:`, aiErr.message);
            }
        });

    } catch (error: any) {
        if (error.message === 'Session not found' || error.message === 'Session already ended') {
            return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/end-by-project', async (req, res) => {
    try {
        const { project } = req.body;
        if (!project) return res.status(400).json({ success: false, error: 'project missing' });

        const row = db.prepare(`SELECT id FROM sessions WHERE status = 'active' AND project = ? ORDER BY start_ts DESC LIMIT 1`).get(project) as { id: number } | undefined;
        if (!row) return res.status(404).json({ success: false, error: 'No active session for project' });

        const result = sessionService.endSession(Number(row.id));

        // Respond immediately
        res.status(200).json({ success: true, result, ai_summary_pending: true });

        // Fire AI session summary async (same as /end)
        setImmediate(async () => {
            try {
                const contextString = sessionService.buildSessionContext(Number(row.id));
                const aiData = await aiReason(
                    contextString,
                    'Generate a detailed session summary based on the session log provided.',
                    SESSION_SUMMARY_PROMPT
                );
                db.prepare(`UPDATE sessions SET ai_summary = ? WHERE id = ?`)
                    .run(JSON.stringify(aiData), Number(row.id));
                broadcastRealtimeUpdate({ type: 'session_summary_ready', sessionId: Number(row.id) });
                sendTelegramMessage(`✨ <b>AI Session Summary Ready</b>\n\n${aiData.summary}`);
                console.log(`✅ AI session summary generated for session ${row.id} (project: ${project})`);
            } catch (aiErr: any) {
                console.error(`⚠️ AI session summary failed for session ${row.id}:`, aiErr.message);
            }
        });

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
            WHERE (project = ? OR project IS NULL OR project = 'unknown')
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

router.get('/debug/session', (req, res) => {
    try {
        const projectName = req.query.project as string;
        let session;
        if (projectName) {
            session = db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND project = ? ORDER BY start_ts DESC LIMIT 1`).get(projectName) as any;
        } else {
            session = sessionService.getCurrentSession() as any;
        }
        if (!session) {
            return res.status(200).json({ message: 'No active session' });
        }
        const endTs = session.status === 'active' ? Date.now() : (session.end_ts || Date.now());

        const events = db.prepare(`
            SELECT * FROM events
            WHERE (project = ? OR project IS NULL OR project = 'unknown')
              AND ts >= ?
              AND ts <= ?
            ORDER BY ts ASC
        `).all(session.project, session.start_ts, endTs) as any[];

        // Fetch the last ENDED session for this project to extract next_steps
        const lastSession = db.prepare(`
            SELECT ai_summary FROM sessions 
            WHERE project = ? AND status = 'ended' AND ai_summary IS NOT NULL
            ORDER BY end_ts DESC LIMIT 1
        `).get(session.project) as any;

        let nextSteps: string[] = [];
        if (lastSession?.ai_summary) {
            try {
                const parsed = JSON.parse(lastSession.ai_summary);
                nextSteps = (parsed.next_steps || []).slice(0, 3);
            } catch {}
        }

        // Get git branch (best effort)
        let gitBranch = 'unknown';
        try {
            const { execSync } = require('child_process');
            const cwd = process.cwd();
            gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd }).toString().trim();
        } catch {}

        res.status(200).json({
            sessionId: session.id,
            project: session.project,
            start_ts: session.start_ts,
            gitBranch,
            nextSteps,
            eventCount: events.length,
            events: events.map(e => ({
                type: e.type,
                message: e.diff || e.filePath || '',
                source: e.source || 'human',
                filePath: e.filePath,
                diff: e.diff,
                timestamp: e.ts
            }))
        });
    } catch (error: any) {
        res.status(500).json({ error: true, message: error.message });
    }
});

let fileChangeCounter = 0;
router.post('/events/ingest', (req, res) => {
    try {
        const { events } = req.body;
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ success: false, error: 'events array required' });
        }

        const { updateScore } = require('../services/stalenessService');

        for (const event of events) {
            if (event.type === 'git:activity') {
                db.prepare(`
                    INSERT INTO events (type, filePath, language, project, ts, diff, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(event.type, event.filePath, event.language || null, event.project || null, event.timestamp, event.diff || null, event.source || 'human');
                if (event.filePath) updateScore(event.filePath);
                continue;
            }

            if (!event.type || !event.filePath || !event.project || !event.timestamp) {
                continue;
            }

            db.prepare(`
                INSERT INTO events (type, filePath, language, project, ts, diff, source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(event.type, event.filePath, event.language || null, event.project || null, event.timestamp, event.diff || null, event.source || 'human');
            updateScore(event.filePath);

            fileChangeCounter++;
            if (fileChangeCounter >= 5) {
                fileChangeCounter = 0;
                const session = sessionService.getCurrentSession();
                if (session) {
                    // ✅ Fixed: column is session_id not sessionId
                    db.prepare(`
                        INSERT INTO memory_nodes (session_id, project, content, type, ts)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        session.id,
                        event.project,
                        `Auto-snapshot: Heavy activity in ${event.filePath} (${event.language || 'unknown'} file)`,
                        'auto_snapshot',
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

// ── CRUD ──────────────────────────────────────────────────────────────────────

// GET /session/:id — fetch a single session
router.get('/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, error: 'Invalid session id' });
        const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        res.status(200).json({ success: true, data: session });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /session/:id — update session fields
router.put('/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, error: 'Invalid session id' });
        const { summary, project, status, ai_summary, end_ts } = req.body;
        const existing = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
        if (!existing) return res.status(404).json({ success: false, error: 'Session not found' });
        db.prepare(`
            UPDATE sessions SET
              summary    = COALESCE(?, summary),
              project    = COALESCE(?, project),
              status     = COALESCE(?, status),
              ai_summary = COALESCE(?, ai_summary),
              end_ts     = COALESCE(?, end_ts)
            WHERE id = ?
        `).run(summary ?? null, project ?? null, status ?? null, ai_summary ?? null, end_ts ?? null, id);
        const updated = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
        res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /session/:id/regenerate-summary — regenerate AI summary on demand
router.post('/:id/regenerate-summary', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, error: 'Invalid session id' });
        const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

        const contextString = sessionService.buildSessionContext(id);
        const aiData = await aiReason(
            contextString,
            'Generate a detailed session summary based on the session log provided.',
            SESSION_SUMMARY_PROMPT
        );
        const aiJson = JSON.stringify(aiData);
        db.prepare(`UPDATE sessions SET ai_summary = ? WHERE id = ?`).run(aiJson, id);
        broadcastRealtimeUpdate({ type: 'session_summary_ready', sessionId: id });

        const updated = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
        res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /session/:id — delete session and its associated events
router.delete('/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, error: 'Invalid session id' });
        const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        const endTs = session.end_ts || Date.now();
        // Delete associated events by project + ts window
        const evDel = db.prepare(`
            DELETE FROM events WHERE project = ? AND ts >= ? AND ts <= ?
        `).run(session.project, session.start_ts, endTs) as any;
        db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
        res.status(200).json({ success: true, deletedEvents: evDel.changes });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;


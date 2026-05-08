import { Router, Request, Response } from 'express';
import db from '../db';
import * as sessionService from '../services/sessionService';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { aiReason } from '../services/aiService';
import { broadcastRealtimeUpdate } from '../realtime';
import { sendTelegramMessage } from '../services/telegramService';

const router = Router();

// Start or resume a session
router.post('/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { project } = req.body;
    const userId = req.user!.id;
    console.log(`[SessionRoute] Starting session for project: ${project}, user: ${userId}`);
    const result = sessionService.startSession(project, userId);
    res.json(result);
  } catch (err: any) {
    console.error('Start Session Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ingest events from extension (New URL)
router.post('/ingest', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { events } = req.body;
    const userId = req.user!.id;
    console.log(`[SessionRoute] Ingesting ${events?.length} events for user: ${userId}`);

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid events data' });
    }

    const result = await sessionService.ingestEvents(userId, events);
    broadcastRealtimeUpdate({ type: 'events_updated', userId, count: events.length });
    res.json(result);
  } catch (err: any) {
    console.error('Ingest Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Compatibility Alias (Old URL)
router.post('/events/ingest', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { events } = req.body;
        const userId = req.user!.id;
        const result = await sessionService.ingestEvents(userId, events);
        broadcastRealtimeUpdate({ type: 'events_updated', userId, count: events.length });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get current/latest activity for sidebar debug
router.get('/debug/session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const session = sessionService.getCurrentSession(userId);
    
    // Get latest 20 events with diffs
    const events = db.prepare(`
      SELECT * FROM events 
      WHERE user_id = ? 
      ORDER BY ts DESC LIMIT 20
    `).all(userId) as any[];

    res.json({
      status: session?.status || 'idle',
      project: session?.project || 'unknown',
      ai_summary: session?.ai_summary || null,
      events
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// End session and generate summary
router.post('/end-by-project', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { project } = req.body;
    const userId = req.user!.id;

    console.log(`[SessionRoute] Ending session for project: ${project}, user: ${userId}`);
    let session = db.prepare(`
      SELECT * FROM sessions 
      WHERE project = ? COLLATE NOCASE AND status = 'active' AND user_id = ?
      ORDER BY start_ts DESC LIMIT 1
    `).get(project, userId) as any;

    if (!session) {
      console.warn(`[SessionRoute] No active session found. Falling back to most recent session for project: ${project}`);
      session = db.prepare(`
        SELECT * FROM sessions 
        WHERE project = ? COLLATE NOCASE AND user_id = ?
        ORDER BY start_ts DESC LIMIT 1
      `).get(project, userId) as any;
    }

    if (!session) {
      console.error(`[SessionRoute] No session history at all found for project: ${project}`);
      return res.status(404).json({ error: 'No active or recent session found for this project' });
    }

    console.log(`[SessionRoute] Summarizing session ID: ${session.id}`);
    // End it (if it was active)
    sessionService.endSession(session.id);

    // AI Summary
    const context = sessionService.buildSessionContext(session.id);
    const summary = await aiReason(context, "Summarize this coding session concisely.");
    
    db.prepare('UPDATE sessions SET ai_summary = ? WHERE id = ?').run(summary.summary, session.id);

    // Send Telegram Notification
    const user = db.prepare('SELECT telegram_chat_id FROM users WHERE id = ?').get(userId) as any;
    if (user?.telegram_chat_id) {
        const msg = `✅ <b>Session Ended: ${project}</b>\n\n${summary}`;
        await sendTelegramMessage(msg, user.telegram_chat_id);
    }

    // Notify listeners
    broadcastRealtimeUpdate({ type: 'session_summary_ready', userId, sessionId: session.id });

    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get full history for Web UI
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const limit = parseInt(req.query.limit as string) || 50;
        const sessions = db.prepare(`
            SELECT * FROM sessions 
            WHERE user_id = ? 
            ORDER BY start_ts DESC 
            LIMIT ?
        `).all(userId, limit);
        res.json({ sessions });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific session details for Web UI
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const sessionId = req.params.id;
        const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as any;
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const events = db.prepare(`
            SELECT * FROM events 
            WHERE user_id = ? AND ts >= ? AND (ts <= ? OR ? IS NULL)
            ORDER BY ts ASC
        `).all(userId, session.start_ts, session.end_ts, session.end_ts);

        res.json({ session, events });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

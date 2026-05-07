import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import sessionRouter from './routes/session.routes';
import db from './db';
import dashboardRouter from './routes/dashboard.routes';
import reconstructRouter from './routes/reconstruct.routes';
import aiRouter from './routes/ai.routes';
import memoryRouter from './routes/memory.routes';
import contextRouter from './routes/context.routes';
import stalenessRouter from './routes/staleness.routes';
import braindumpRouter from './routes/braindump.routes';
import { registerRealtimeClient } from './realtime';
import { buildContextFromMemory } from './services/memoryService';
import { aiReason } from './services/aiService';
import { startTelegramPolling } from './services/telegramInbound';
import { startScheduler } from './services/telegramScheduler';
import './websocket/wsServer'; // Start VS Code extension WebSocket listener on port 3002


const app = express();
app.use(cors());
app.use(express.json());

// Gracefully handle malformed JSON without printing stack traces to console
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: 'Invalid JSON payload' });
        return;
    }
    next();
});

// Serve the React frontend build. prefer `frontend-v2/dist`, fall back to `frontend/dist`
const frontendV2Dist = path.join(__dirname, '../frontend-v2/dist');
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendV2Dist)) {
    app.use(express.static(frontendV2Dist));
    console.log(`Serving frontend from ${frontendV2Dist}`);
} else if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    console.log(`Serving frontend from ${frontendDist}`);
} else {
    console.log('No frontend build found; running in API-only mode');
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// Ask OpenClaw
app.post('/ask', async (req, res) => {
    try {
        const { projectId, question } = req.body;
        if (!projectId) return res.status(400).json({ answer: "projectId is required" });
        const memoryContext = buildContextFromMemory(projectId);
        const reasoning = await aiReason(memoryContext, question || "Answer the question based on context.");
        res.json({ answer: reasoning.summary });
    } catch (err) {
        console.error("Ask error:", err);
        res.status(500).json({ answer: "Error connecting to OpenClaw." });
    }
});

// Routes
app.use('/session', sessionRouter);
app.use('/dashboard', dashboardRouter);
app.use('/reconstruct', reconstructRouter);
app.use('/ai', aiRouter);
app.use('/memory', memoryRouter);
app.use('/context', contextRouter);
app.use('/staleness', stalenessRouter); 

app.use('/braindump', braindumpRouter);

const PORT = process.env.PORT || 3001;
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', ws => {
    registerRealtimeClient(ws);
});

// Start Telegram Polling
startTelegramPolling();

// Start Telegram Proactive Scheduler (daily digest, idle alerts, reminders)
startScheduler();

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Background job: auto-close stale sessions with no activity for 2 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
    try {
        const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
        const endTs = Date.now();
        const info = db.prepare(`
            UPDATE sessions SET status='ended', end_ts=?, summary='Auto-closed: no activity'
            WHERE status='active' AND start_ts < ? AND id NOT IN (
                SELECT s.id FROM sessions s
                JOIN events e ON e.project = s.project
                WHERE e.ts > ? AND s.status='active'
            )
        `).run(endTs, cutoff, cutoff) as any;
        if (info && info.changes) {
            console.log(`Auto-closed ${info.changes} stale sessions`);
        }
    } catch (err) {
        console.error('Stale session cleanup failed', err);
    }
}, CLEANUP_INTERVAL_MS);

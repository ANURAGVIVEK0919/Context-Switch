import express from 'express';
import cors from 'cors';
import path from 'path';
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

// Serve the React frontend from the frontend/dist folder
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: "ok" });
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

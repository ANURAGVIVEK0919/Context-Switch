import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import db from './db';

const JWT_SECRET = process.env.JWT_SECRET || "context-switch-secret-key";

type RealtimePayload = {
  type: string;
  count?: number;
  sessionId?: number;
  userId?: number;
  project?: string;
};

// Store clients by userId
const userClients = new Map<number, Set<WebSocket>>();

export function registerRealtimeClient(ws: WebSocket) {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'auth' && msg.token) {
        const decoded = jwt.verify(msg.token, JWT_SECRET) as { id: number };
        const userId = decoded.id;
        
        // Add to user group
        if (!userClients.has(userId)) userClients.set(userId, new Set());
        userClients.get(userId)!.add(ws);
        
        console.log(`[Realtime] User ${userId} registered for live updates`);
        ws.send(JSON.stringify({ type: 'auth_success' }));

        ws.on('close', () => {
          userClients.get(userId)?.delete(ws);
        });
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
    }
  });
}

/**
 * Broadcasts an update to:
 * 1. The specific userId (if provided)
 * 2. All members of the project (if provided)
 */
export function broadcastRealtimeUpdate(payload: RealtimePayload) {
  const { userId, project } = payload;
  const targetUserIds = new Set<number>();

  if (userId) targetUserIds.add(userId);

  if (project) {
    // Find all users who have access to this project
    const members = db.prepare('SELECT user_id FROM project_members WHERE project = ?').all(project) as { user_id: number }[];
    members.forEach(m => targetUserIds.add(m.user_id));
    
    // Also include the owner (if they are not in project_members but have sessions)
    const owner = db.prepare('SELECT user_id FROM sessions WHERE project = ? LIMIT 1').get(project) as { user_id: number } | undefined;
    if (owner) targetUserIds.add(owner.user_id);
  }

  const message = JSON.stringify(payload);
  
  targetUserIds.forEach(id => {
    const clients = userClients.get(id);
    if (clients) {
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    }
  });
}

// Purpose: Handle real-time events from VS Code extension
// Input: WebSocket messages (file changes, terminal logs)
// Output: Logs for now (processing later)
import db from "../db";
import { WebSocketServer, WebSocket } from "ws";
import { updateScore } from "../services/stalenessService";
import { getCurrentSession } from "../services/sessionService";
import { broadcastRealtimeUpdate } from "../realtime";

const wss = new WebSocketServer({ port: 3002 });
let fileChangeCounter = 0;

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");

  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("Incoming message type:", message.type);

      // Handle batch events from VS Code extension
      const events = message.type === "batch" ? message.events : [message];

      for (const event of events) {
        if (event.type === "git:activity") {
          db.prepare(`
            INSERT INTO events (type, filePath, language, project, ts, diff)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(event.type, event.filePath, event.language || null, event.project || null, event.timestamp, event.diff || null);
          console.log("Git activity saved:", event.filePath);
          if (event.filePath) updateScore(event.filePath);
          continue;
        }

        // Loosened validation: language is optional since VS Code sometimes misses it
        if (!event.type || !event.filePath || !event.project || !event.timestamp) {
          console.log("Invalid event ❌ (missing type, filePath, project, or timestamp)", event);
          continue;
        }

        db.prepare(`
          INSERT INTO events (type, filePath, language, project, ts, diff)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(event.type, event.filePath, event.language || null, event.project || null, event.timestamp, event.diff || null);
        console.log("Saved enriched event:", event.filePath);
        updateScore(event.filePath);

        // Auto-snapshot into memory_nodes every 5 file edits
        fileChangeCounter++;
        if (fileChangeCounter >= 5) {
          fileChangeCounter = 0;
          const session = getCurrentSession();
          if (session) {
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
            console.log(`🧠 Created automatic memory node for session ${session.id}`);
          }
        }
      }

      if (events.length > 0) {
        broadcastRealtimeUpdate({ type: 'events_updated', count: events.length });
      }
    } catch (err) {
      console.log("Invalid message ❌", err);
    }
  });

});

console.log("WebSocket server running on port 3002");
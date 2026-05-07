// Purpose: Handle real-time events from VS Code extension
// Input: WebSocket messages (file changes, terminal logs)
// Output: Logs for now (processing later)
import db from "../db";
import { WebSocketServer, WebSocket } from "ws";
import { updateScore } from "../services/stalenessService";
import { getCurrentSession } from "../services/sessionService";
import { broadcastRealtimeUpdate } from "../realtime";
import { sendTelegramMessage } from "../services/telegramService";
import { updateLastEventTs } from "../services/telegramScheduler";

const wss = new WebSocketServer({ port: 3002 });
let fileChangeCounter = 0;
let errorStreak = 0;
let lastErrorFile = "";

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");

  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("Incoming message type:", message.type);

      // Handle batch events from VS Code extension
      const events = message.type === "batch" ? message.events : [message];
      const currentSession = getCurrentSession();

      for (const event of events) {
        const projectToSave = currentSession ? currentSession.project : (event.project || 'unknown');

        if (event.type === "git:activity") {
          db.prepare(`
            INSERT INTO events (type, filePath, language, project, ts, diff, source)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(event.type, event.filePath, event.language || null, projectToSave, event.timestamp, event.diff || null, event.source || 'human');
          console.log("Git activity saved:", event.filePath);
          if (event.filePath) updateScore(event.filePath);
          continue;
        }

        // Loosened validation: language and project may be missing from some clients
        // Provide sensible defaults so we don't drop useful telemetry coming from
        // editors or git integrations that don't include workspace metadata.
        if (!event.type || !event.filePath || !event.timestamp) {
          console.log("Invalid event ❌ (missing type, filePath, or timestamp)", event);
          continue;
        }

        db.prepare(`
          INSERT INTO events (type, filePath, language, project, ts, diff, source)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(event.type, event.filePath, event.language || null, projectToSave, event.timestamp, event.diff || null, event.source || 'human');
        console.log("Saved enriched event:", event.filePath);
        updateScore(event.filePath);
        updateLastEventTs(); // reset idle timer

        // Auto-snapshot into memory_nodes every 5 file edits
        if (event.type === "file:change") {
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

        // Error Watchdog
        if (event.type === "diagnostic:error") {
            if (lastErrorFile === event.filePath) {
                errorStreak++;
            } else {
                lastErrorFile = event.filePath;
                errorStreak = 1;
            }

            if (errorStreak === 3) { // After 3 consecutive errors in the same file
                sendTelegramMessage(`⚠️ <b>Watchdog Alert</b>\nSeeing multiple errors in <i>${event.filePath}</i>.\n\nNeed me to take a look? Send a message ending in '?'`);
            }
        } else if (event.type === "file:change") {
            // Reset streak if they successfully edit the file or move on
            if (errorStreak >= 3) {
                sendTelegramMessage(`✅ Looks like you're working on the errors in <i>${event.filePath}</i>.`);
            }
            errorStreak = 0;
            lastErrorFile = "";
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
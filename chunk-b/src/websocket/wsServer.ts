// Purpose: Handle real-time events from VS Code extension
// Input: WebSocket messages (file changes, terminal logs)
// Output: Logs for now (processing later)
import db from "../db/db";
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3002 });

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");

  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("Incoming message:", message);

      const events = message.type === "batch" ? message.events : [message];

      for (const ev of events) {
        if (!ev.type || !ev.timestamp) continue;

        db.prepare(`
          INSERT INTO events (type, filePath, language, project, timestamp, diff, message)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          ev.type,
          ev.filePath || null,
          ev.language || null,
          ev.project || null,
          ev.timestamp,
          ev.diff || null,
          ev.message || null
        );
      }
      console.log(`Saved ${events.length} event(s)`);
    } catch (err) {
      console.log("Invalid message ❌", err);
    }
  });
});

console.log("WebSocket server running on port 3002");
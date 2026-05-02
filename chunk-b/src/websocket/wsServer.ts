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
      if (message.type === "git:activity") {
        db.prepare(`
          INSERT INTO events (type, filePath, timestamp)
          VALUES (?, ?, ?)
        `).run(
          message.type,
          message.filePath,
          message.timestamp
        );
        console.log("Git activity saved");
        return;
      }
      if (
        !message.type ||
        !message.filePath ||
        !message.language ||
        !message.project ||
        !message.timestamp
      ) {
        console.log("Invalid message ❌", message);
        return;
      }
      db.prepare(`
        INSERT INTO events (type, filePath, language, project, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        message.type,
        message.filePath,
        message.language,
        message.project,
        message.timestamp
      );
      console.log("Saved enriched event");
    } catch (err) {
      console.log("Invalid message ❌", err);
    }
  });
});

console.log("WebSocket server running on port 3002");
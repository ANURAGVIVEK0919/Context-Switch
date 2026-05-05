// Purpose: Session routes for ContextSwitch backend
// Input: POST /start, POST /end
// Output: { success: true }

import { Router } from "express";
import db from "../db/db";
import { synthesizeMemory } from "../services/aiService";
import { saveMemoryNode } from "../services/memoryService";

const router = Router();

// Start a session: insert into sessions table
router.post("/start", (req, res) => {
  const { project, timestamp } = req.body;
  const startTime = timestamp || Date.now();
  try {
    const stmt = db.prepare("INSERT INTO sessions (project, startTime) VALUES (?, ?)");
    const result = stmt.run(project, startTime);
    const sessionId = result.lastInsertRowid;
    console.log("Session started");
    res.json({ 
      success: true, 
      session: { sessionId } 
    });
  } catch (err) {
    console.error("Failed to start session", err);
    res.status(500).json({ success: false, error: "Failed to start session" });
  }
});

interface Session {
  id: number;
  project: string;
  startTime: number;
  endTime?: number;
}

// End a session: update endTime for latest session
router.post("/end", (req, res) => {
  try {
    // Find latest session without endTime
    const session = db.prepare("SELECT id FROM sessions WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1").get() as Session | undefined;
    if (!session) {
      res.status(404).json({ success: false, error: "No active session found" });
      return;
    }
    const endTime = Date.now();
    db.prepare("UPDATE sessions SET endTime = ? WHERE id = ?").run(endTime, session.id);
    
    // ASYNC Synthesis (don't block the response)
    (async () => {
      try {
        // Fetch events for this session
        const events = db.prepare(`
          SELECT type, filePath, timestamp, diff, message 
          FROM events 
          WHERE timestamp >= ? AND timestamp <= ?
          ORDER BY timestamp ASC
        `).all(session.startTime, endTime);

        if (events.length > 5) {
          const eventsLog = events.map((ev: any) => `- [${ev.type}] ${ev.filePath || ''}: ${ev.message || ev.diff || ''}`).join("\n");
          const synthesis = await synthesizeMemory(eventsLog);
          if (synthesis) {
            // Find project name for this session
            const sessionData = db.prepare("SELECT project FROM sessions WHERE id = ?").get() as { project: string };
            saveMemoryNode(synthesis, "Session Synthesis", sessionData.project, session.id);
            console.log("Auto-memory synthesis saved for project:", sessionData.project);
          }
        }
      } catch (synthErr) {
        console.error("Auto-memory synthesis failed:", synthErr);
      }
    })();

    console.log("Session ended");
    res.json({ success: true, sessionId: session.id });
  } catch (err) {
    console.error("Failed to end session", err);
    res.status(500).json({ success: false, error: "Failed to end session" });
  }
});

// GET /history - Get session history
router.get("/history", (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sessions = db.prepare(`
      SELECT s.*, 
      (SELECT COUNT(*) FROM events WHERE timestamp >= s.startTime AND (s.endTime IS NULL OR timestamp <= s.endTime)) as eventCount
      FROM sessions s
      ORDER BY startTime DESC
      LIMIT ?
    `).all(limit);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch session history" });
  }
});

// GET /current - Get current active session
router.get("/current", (req, res) => {
  try {
    const session = db.prepare("SELECT * FROM sessions WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1").get();
    if (!session) return res.json({ message: "No active session" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current session" });
  }
});

// GET /active - Get all active sessions
router.get("/active", (req, res) => {
  try {
    const sessions = db.prepare("SELECT * FROM sessions WHERE endTime IS NULL").all();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch active sessions" });
  }
});

// GET /:sessionId/events - Get events for a specific session
router.get("/:sessionId/events", (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get() as Session | undefined;
    if (!session) return res.status(404).json({ error: "Session not found" });

    const events = db.prepare(`
      SELECT * FROM events 
      WHERE timestamp >= ? AND (? IS NULL OR timestamp <= ?)
      ORDER BY timestamp ASC
    `).all(session.startTime, session.endTime, session.endTime);
    
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch session events" });
  }
});

export default router;

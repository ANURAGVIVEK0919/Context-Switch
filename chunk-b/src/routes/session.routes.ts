// Purpose: Session routes for ContextSwitch backend
// Input: POST /start, POST /end
// Output: { success: true }

import { Router } from "express";
import db from "../db/db";

const router = Router();

// Start a session: insert into sessions table
router.post("/start", (req, res) => {
  const { project, timestamp } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO sessions (project, startTime) VALUES (?, ?)");
    const result = stmt.run(project, timestamp);
    const sessionId = result.lastInsertRowid;
    console.log("Session started");
    res.json({ success: true, sessionId });
  } catch (err) {
    console.error("Failed to start session", err);
    res.status(500).json({ success: false, error: "Failed to start session" });
  }
});

// End a session: update endTime for latest session
router.post("/end", (req, res) => {
  try {
    // Find latest session without endTime
    const session = db.prepare("SELECT id FROM sessions WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1").get();
    if (!session) {
      res.status(404).json({ success: false, error: "No active session found" });
      return;
    }
    const endTime = Date.now();
    db.prepare("UPDATE sessions SET endTime = ? WHERE id = ?").run(endTime, session.id);
    console.log("Session ended");
    res.json({ success: true, sessionId: session.id });
  } catch (err) {
    console.error("Failed to end session", err);
    res.status(500).json({ success: false, error: "Failed to end session" });
  }
});

export default router;

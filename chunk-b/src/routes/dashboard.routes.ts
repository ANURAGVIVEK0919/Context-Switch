import { Router } from "express";
import db from "../db/db";

const router = Router();

// GET /dashboard/stats - Aggregate statistics
router.get("/stats", (req, res) => {
  try {
    const totalSessions = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as any;
    const totalEvents = db.prepare("SELECT COUNT(*) as count FROM events").get() as any;
    const projectCount = db.prepare("SELECT COUNT(DISTINCT project) as count FROM sessions").get() as any;
    const latestEvent = db.prepare("SELECT timestamp FROM events ORDER BY timestamp DESC LIMIT 1").get() as any;

    res.json({
      totalSessions: totalSessions.count,
      totalEvents: totalEvents.count,
      projectCount: projectCount.count,
      lastActivity: latestEvent ? latestEvent.timestamp : null
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// GET /dashboard/timeline - Event distribution over time
router.get("/timeline", (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const startTime = Date.now() - (hours * 3600000);

    const events = db.prepare(`
      SELECT (timestamp / 3600000) * 3600000 as hour, COUNT(*) as count
      FROM events
      WHERE timestamp >= ?
      GROUP BY hour
      ORDER BY hour ASC
    `).all(startTime);

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch timeline data" });
  }
});

// GET /dashboard/staleness - File focus scores
router.get("/staleness", (req, res) => {
  try {
    const files = db.prepare(`
      SELECT filePath, MAX(timestamp) as lastTouched, COUNT(*) as activityCount
      FROM events
      WHERE filePath IS NOT NULL AND filePath != 'terminal'
      GROUP BY filePath
      ORDER BY lastTouched DESC
    `).all();

    // Simple staleness calculation: hours since last touch
    const now = Date.now();
    const result = files.map((f: any) => ({
      file: f.filePath,
      lastActivity: f.lastTouched,
      activityCount: f.activityCount,
      stalenessScore: Math.floor((now - f.lastTouched) / 3600000) // hours
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch staleness data" });
  }
});

export default router;

import express from "express";
import db from "../db/db";
import { generateMorningBrief, checkStaleProjectAlerts, generateEveningNudge, generateWeeklyReport } from "../services/heartbeatService";

const router = express.Router();

// Trigger Morning Brief manually
router.get("/heartbeat/morning", async (req, res) => {
  const success = await generateMorningBrief();
  res.json({ success });
});

// Trigger Stale Alert manually
router.get("/heartbeat/stale", async (req, res) => {
  await checkStaleProjectAlerts();
  res.json({ success: true });
});

// Trigger Evening Nudge manually
router.get("/heartbeat/evening", async (req, res) => {
  await generateEveningNudge();
  res.json({ success: true });
});

// Trigger Weekly Report manually
router.get("/heartbeat/weekly", async (req, res) => {
  await generateWeeklyReport();
  res.json({ success: true });
});

interface Session {
  id: number;
  project: string;
  startTime: number;
  endTime?: number;
}

interface Event {
  type: string;
  filePath?: string;
  diff?: string;
  message?: string;
  timestamp: number;
}

router.get("/session", (req, res) => {
  // Get latest session (no endTime means active)
  const session = db.prepare(
    `SELECT * FROM sessions WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1`
  ).get() as Session | undefined;

  if (!session) {
    return res.json({ message: "No active session" });
  }

  // Get events for this session (by project and after session startTime)
  const events = db.prepare(
    `SELECT * FROM events WHERE project = ? AND timestamp >= ? ORDER BY timestamp ASC`
  ).all(session.project, session.startTime) as Event[];

  // Map to debug format
  const debugEvents = events.map((ev: Event) => ({
    type: mapEventType(ev.type),
    message: eventMessage(ev),
    timestamp: ev.timestamp
  })).filter(ev => ev.type && ev.message && ev.timestamp);

  res.json({
    sessionId: session.id,
    startTime: session.startTime,
    events: debugEvents
  });
});

// Helper to map event type
function mapEventType(type: string) {
  if (!type) return undefined;
  if (type.startsWith("file")) return "FILE_CHANGE";
  if (type.startsWith("diagnostic")) return "ERROR";
  if (type.startsWith("terminal")) return "TERMINAL";
  if (type.startsWith("git")) return "GIT";
  return type.toUpperCase();
}

// Helper to format event message
function eventMessage(ev: Event) {
  if (ev.type.startsWith("file")) {
    return `Edited ${ev.filePath || ''} ${ev.diff ? '- ' + ev.diff : ''}`;
  }
  if (ev.type.startsWith("diagnostic")) {
    return ev.diff || "Diagnostic error";
  }
  if (ev.type.startsWith("terminal")) {
    return ev.diff || "Terminal event";
  }
  if (ev.type.startsWith("git")) {
    return ev.message || "Git event";
  }
  return ev.diff || ev.message || "Event";
}

export default router;

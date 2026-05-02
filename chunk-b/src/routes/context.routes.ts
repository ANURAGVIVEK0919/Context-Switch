
// Purpose: Generate context summary from events + brain dumps
// Input: HTTP request
// Output: Summary string

import { Router, Request, Response } from "express";
import db from "../db/db";

const router = Router();

// Return all events for /events endpoint
router.get("/events", (req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT * FROM events").all();
    res.json(rows);
  } catch (err) {
    console.error("Failed to fetch events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/", (req: Request, res: Response) => {
  try {
    // Fetch recent events
    const events = db.prepare(`
      SELECT * FROM events ORDER BY timestamp DESC LIMIT 10
    `).all();

    // Fetch recent brain dumps
    const dumps = db.prepare(`
      SELECT * FROM braindumps ORDER BY timestamp DESC LIMIT 3
    `).all();

    // Extract file names
    const files = events.map((e: any) => e.filePath);

    // Extract notes
    const notes = dumps.map((d: any) => d.content);

    // Build summary
    let summary = "You were recently working on multiple files.\n";

    if (files.length) {
      summary += "You edited:\n";
      files.forEach((file: string) => {
        summary += `- ${file}\n`;
      });
    }

    if (notes.length) {
      summary += "\nYou also noted:\n";
      notes.forEach((note: string) => {
        summary += `- ${note}\n`;
      });
    }

    console.log("Generated context summary");

    res.json({ summary });

  } catch (err) {
    console.error("Context error:", err);
    res.status(500).json({ error: "Failed to generate context" });
  }
});

export default router;
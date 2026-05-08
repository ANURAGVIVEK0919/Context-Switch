
// Purpose: Generate context summary from events + brain dumps
// Input: HTTP request
// Output: Summary string

import { Router, Request, Response } from "express";
import db from "../db";
import { buildContextFromMemory } from "../services/memoryService";
import { generateContextSummary } from "../services/aiService";
import { getAllScores } from "../services/stalenessService";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// Return all events for /events endpoint
router.get("/events", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const userId = authReq.user?.id;
    const rows = db.prepare("SELECT * FROM events WHERE user_id = ?").all(userId);
    res.json(rows);
  } catch (err) {
    console.error("Failed to fetch events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const userId = authReq.user?.id;
    // Fetch recent events
    const events = db.prepare(`
      SELECT * FROM events WHERE user_id = ? ORDER BY ts DESC LIMIT 10
    `).all(userId);

    // Fetch recent brain dumps
    const dumps = db.prepare(`
      SELECT * FROM braindumps WHERE user_id = ? ORDER BY ts DESC LIMIT 3
    `).all(userId);

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

    console.log("Generated context summary for user:", userId);

    res.json({ summary });

  } catch (err) {
    console.error("Context error:", err);
    res.status(500).json({ error: "Failed to generate context" });
  }
});

router.get("/enhanced", authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const project = (authReq.query.project as string) || "default";
    const userId = authReq.user?.id;
    
    // fetch recent events filtered by user
    const recentEvents = db.prepare(`SELECT * FROM events WHERE user_id = ? ORDER BY ts DESC LIMIT 50`).all(userId);
    const recentBraindumps = db.prepare(`SELECT * FROM braindumps WHERE user_id = ? ORDER BY ts DESC LIMIT 10`).all(userId);
    
    const memoryContext = buildContextFromMemory(project, userId!);
    const stalenessScores = getAllScores();
    
    // For now we just pass a string representing context to AI
    const combinedContext = `Events: ${recentEvents.length}\nMemory Context:\n${memoryContext}`;
    
    const aiSummaryResponse = await generateContextSummary(combinedContext);
    
    res.json({
      events: recentEvents,
      braindumps: recentBraindumps,
      memoryContext,
      stalenessScores,
      aiSummary: aiSummaryResponse
    });
  } catch (err) {
    console.error("Enhanced context error:", err);
    res.status(500).json({ error: "Failed to generate enhanced context" });
  }
});

// ── Events CRUD ───────────────────────────────────────────────────────────────

// GET /context/events/:id — fetch a single event
router.get("/events/:id", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const userId = authReq.user?.id;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const row = db.prepare(`SELECT * FROM events WHERE id = ? AND user_id = ?`).get(id, userId);
    if (!row) return res.status(404).json({ success: false, error: "Event not found" });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /context/events/:id — update event fields
router.put("/events/:id", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const userId = authReq.user?.id;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const existing = db.prepare(`SELECT * FROM events WHERE id = ? AND user_id = ?`).get(id, userId);
    if (!existing) return res.status(404).json({ success: false, error: "Event not found" });
    const { type, filePath, language, project, diff } = req.body;
    db.prepare(`
      UPDATE events SET
        type     = COALESCE(?, type),
        filePath = COALESCE(?, filePath),
        language = COALESCE(?, language),
        project  = COALESCE(?, project),
        diff     = COALESCE(?, diff)
      WHERE id = ? AND user_id = ?
    `).run(type ?? null, filePath ?? null, language ?? null, project ?? null, diff ?? null, id, userId);
    const updated = db.prepare(`SELECT * FROM events WHERE id = ?`).get(id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /context/events/:id — delete a single event
router.delete("/events/:id", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const userId = authReq.user?.id;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const existing = db.prepare(`SELECT * FROM events WHERE id = ? AND user_id = ?`).get(id, userId);
    if (!existing) return res.status(404).json({ success: false, error: "Event not found" });
    db.prepare(`DELETE FROM events WHERE id = ? AND user_id = ?`).run(id, userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /context/events — bulk delete events by IDs array
router.delete("/events", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const userId = authReq.user?.id;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ success: false, error: "ids array required" });
    const placeholders = ids.map(() => "?").join(",");
    const result = db.prepare(`DELETE FROM events WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, userId) as any;
    res.json({ success: true, deleted: result.changes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
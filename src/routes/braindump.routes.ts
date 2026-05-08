import { Router, Request, Response } from "express";
import db from "../db";
import { saveMemoryNode } from "../services/memoryService";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// GET /braindump?limit=20&project=xxx
router.get("/", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const limit = authReq.query.limit ? Math.min(Number(authReq.query.limit), 100) : 20;
    const project = authReq.query.project as string | undefined;
    const userId = authReq.user?.id;

    let rows;
    if (project) {
      rows = db.prepare(`SELECT * FROM braindumps WHERE user_id = ? AND project = ? ORDER BY ts DESC LIMIT ?`).all(userId, project, limit);
    } else {
      rows = db.prepare(`SELECT * FROM braindumps WHERE user_id = ? ORDER BY ts DESC LIMIT ?`).all(userId, limit);
    }
    return res.json({ success: true, braindumps: rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: "DB error" });
  }
});

// GET /braindump/session/:sessionId — get braindumps for a session
router.get("/session/:sessionId", (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ success: false, error: "Invalid sessionId" });
    const rows = db.prepare(`SELECT * FROM braindumps WHERE session_id = ? ORDER BY ts DESC`).all(sessionId);
    return res.json({ success: true, braindumps: rows || [], count: rows?.length || 0 });
  } catch (err) {
    return res.status(500).json({ error: "DB error" });
  }
});

// POST /braindump
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  const { content, sessionId, project } = authReq.body;
  const userId = authReq.user?.id;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Content required" });
  }

  const timestamp = Date.now();
  try {
    const info = db.prepare("INSERT INTO braindumps (content, ts, session_id, user_id, project) VALUES (?, ?, ?, ?, ?)").run(content.trim(), timestamp, sessionId || null, userId, project || null);
    const dumpId = info.lastInsertRowid as number;
    
    // Save to memory nodes and trigger vector embedding
    await saveMemoryNode(content, "braindump", project || "default", userId!, sessionId);
    
    // Also store embedding directly for the braindump itself
    const { storeEmbedding } = require("../services/embeddingService");
    storeEmbedding(dumpId, 'braindump', content, userId!);

    return res.json({ success: true, ts: timestamp });
  } catch (err) {
    console.error("Braindump save error:", err);
    return res.status(500).json({ error: "DB error" });
  }
});

// GET /braindump/:id — fetch a single braindump
router.get("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const row = db.prepare(`SELECT * FROM braindumps WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ success: false, error: "Braindump not found" });
    return res.json({ success: true, data: row });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /braindump/:id — update braindump content and session_id
router.put("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const { content, session_id } = req.body;
    if (!content || typeof content !== "string" || !content.trim())
      return res.status(400).json({ success: false, error: "content required" });
    const existing = db.prepare(`SELECT * FROM braindumps WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ success: false, error: "Braindump not found" });
    db.prepare(`UPDATE braindumps SET content = ?, session_id = ? WHERE id = ?`).run(content.trim(), session_id || null, id);
    const updated = db.prepare(`SELECT * FROM braindumps WHERE id = ?`).get(id);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /braindump/:id — delete a braindump
router.delete("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const existing = db.prepare(`SELECT * FROM braindumps WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ success: false, error: "Braindump not found" });
    db.prepare(`DELETE FROM braindumps WHERE id = ?`).run(id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


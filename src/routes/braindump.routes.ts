import { Router } from "express";
import db from "../db";
import { saveMemoryNode } from "../services/memoryService";

const router = Router();

// GET /braindump?limit=20&project=xxx
router.get("/", (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20;
    const project = req.query.project as string | undefined;

    let rows;
    if (project) {
      // braindumps table doesn't have project yet — join via sessions is complex, just return all for now
      rows = db.prepare(`SELECT * FROM braindumps ORDER BY ts DESC LIMIT ?`).all(limit);
    } else {
      rows = db.prepare(`SELECT * FROM braindumps ORDER BY ts DESC LIMIT ?`).all(limit);
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
router.post("/", (req, res) => {
  const { content, sessionId, project } = req.body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Content required" });
  }

  const timestamp = Date.now();
  try {
    db.prepare("INSERT INTO braindumps (content, ts, session_id) VALUES (?, ?, ?)").run(content.trim(), timestamp, sessionId || null);
    saveMemoryNode(content, "braindump", project || "default", sessionId);
    return res.json({ success: true, ts: timestamp });
  } catch (err) {
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


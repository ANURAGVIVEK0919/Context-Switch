import { Router, Request, Response } from "express";
import db from "../db";
import { queryMemory } from "../services/memoryService";

const router = Router();

// GET /memory/query — existing query endpoint
router.get("/query", (req: Request, res: Response) => {
  try {
    const project = (req.query.project as string) || "default";
    const limit = parseInt((req.query.limit as string) || "10", 10);
    const nodes = queryMemory(project, limit);
    res.json({ success: true, nodes });
  } catch (err) {
    console.error("Memory query error:", err);
    res.status(500).json({ success: false, error: "Failed to query memory" });
  }
});

// GET /memory/:id — fetch single memory node
router.get("/:id", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const node = db.prepare(`SELECT * FROM memory_nodes WHERE id = ?`).get(id);
    if (!node) return res.status(404).json({ success: false, error: "Memory node not found" });
    res.json({ success: true, data: node });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /memory — manually create a memory node
router.post("/", (req: Request, res: Response) => {
  try {
    const { content, type, project, session_id } = req.body;
    if (!content || !type || !project)
      return res.status(400).json({ success: false, error: "content, type, project required" });
    const ts = Date.now();
    const result = db.prepare(`
      INSERT INTO memory_nodes (session_id, content, type, score, project, ts)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session_id ?? null, content, type, 0, project, ts) as any;
    const node = db.prepare(`SELECT * FROM memory_nodes WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: node });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /memory/:id — update memory node fields
router.put("/:id", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const existing = db.prepare(`SELECT * FROM memory_nodes WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ success: false, error: "Memory node not found" });
    const { content, type, score } = req.body;
    db.prepare(`
      UPDATE memory_nodes SET
        content = COALESCE(?, content),
        type    = COALESCE(?, type),
        score   = COALESCE(?, score)
      WHERE id = ?
    `).run(content ?? null, type ?? null, score ?? null, id);
    const updated = db.prepare(`SELECT * FROM memory_nodes WHERE id = ?`).get(id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /memory/:id — delete a memory node
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid id" });
    const existing = db.prepare(`SELECT * FROM memory_nodes WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ success: false, error: "Memory node not found" });
    db.prepare(`DELETE FROM memory_nodes WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


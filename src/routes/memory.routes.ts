import { Router, Request, Response } from "express";
import { queryMemory } from "../services/memoryService";

const router = Router();

router.get("/query", (req: Request, res: Response) => {
  try {
    const project = (req.query.project as string) || "default";
    const limit = parseInt((req.query.limit as string) || "10", 10);
    const nodes = queryMemory(project, limit);
    res.json({ nodes });
  } catch (err) {
    console.error("Memory query error:", err);
    res.status(500).json({ error: "Failed to query memory" });
  }
});

export default router;

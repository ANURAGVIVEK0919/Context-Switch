import { Router, Request, Response } from "express";
import { aiReason } from "../services/aiService";
import { buildContextFromMemory } from "../services/memoryService";

const router = Router();

router.post("/reason", async (req: Request, res: Response) => {
  try {
    const { projectId, brief } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    const memoryContext = buildContextFromMemory(projectId);
    const reasoning = await aiReason(memoryContext, brief || "Provide next steps.");
    res.json(reasoning);
  } catch (err) {
    console.error("AI reason error:", err);
    res.status(500).json({ error: "Failed to generate reasoning" });
  }
});

export default router;

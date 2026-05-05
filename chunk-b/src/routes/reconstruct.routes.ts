import { Router } from "express";
import db from "../db/db";
import { generateContextSummary } from "../services/aiService";
import { buildContextFromMemory } from "../services/memoryService";

const router = Router();

router.get("/:projectId", async (req, res) => {
  const { projectId } = req.params;

  try {
    // 1. Fetch recent events for this project
    const events = db.prepare(`
      SELECT type, filePath, timestamp, diff, message 
      FROM events 
      WHERE project = ? 
      ORDER BY timestamp DESC 
      LIMIT 20
    `).all(projectId);

    // 2. Fetch recent brain dumps
    const braindumps = db.prepare(`
      SELECT content 
      FROM braindumps 
      ORDER BY timestamp DESC 
      LIMIT 5
    `).all();

    // 3. Fetch Long-Term Memory nodes for this project
    const memoryContext = buildContextFromMemory(projectId);

    // 4. Construct context string for AI
    let contextString = `Project: ${projectId}\n\n`;
    
    if (memoryContext) {
      contextString += `Long-Term Project Memory:\n${memoryContext}\n\n`;
    }

    contextString += `Recent Activity:\n`;
    events.forEach((ev: any) => {
      contextString += `- [${ev.type}] ${ev.filePath || ''}: ${ev.message || ev.diff || ''}\n`;
    });

    if (braindumps.length > 0) {
      contextString += `\nRecent Developer Notes:\n`;
      braindumps.forEach((bd: any) => {
        contextString += `- ${bd.content}\n`;
      });
    }

    // 4. Fetch past session results specifically
    const sessionResults = db.prepare(`
      SELECT content, ts 
      FROM memory_nodes 
      WHERE project = ? AND type = 'Session Synthesis'
      ORDER BY ts DESC
    `).all(projectId);

    // 5. Call AI to generate summary
    const aiResult = await generateContextSummary(contextString);

    res.json({
      projectId,
      brief: aiResult.summary,
      confidence: aiResult.confidence,
      next_steps: aiResult.next_steps,
      pastSessionResults: sessionResults.map((r: any) => ({
        summary: r.content,
        timestamp: r.ts
      }))
    });

  } catch (err) {
    console.error("Reconstruction failed:", err);
    res.status(500).json({ error: "Failed to reconstruct context" });
  }
});

export default router;

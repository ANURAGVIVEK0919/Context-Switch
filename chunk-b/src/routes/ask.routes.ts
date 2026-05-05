import { Router } from "express";
import db from "../db/db";
import { askOpenClaw } from "../services/aiService";

const router = Router();

// POST /ask
// Body: { projectId: string, question: string }
router.post("/", async (req, res) => {
  console.log("DEBUG: /ask request received", req.body);
  const { projectId, question } = req.body;

  if (!projectId || !question) {
    console.error("DEBUG: Missing projectId or question");
    return res.status(400).json({ error: "projectId and question are required" });
  }

  try {
    // 1. "Semantic Search Lite" - Find relevant events and notes
    const keywords = question.split(' ').filter((w: string) => w.length > 3);
    
    // Event Search Conditions
    const eventConditions = keywords.map(() => "(message LIKE ? OR diff LIKE ? OR filePath LIKE ?)").join(" OR ");
    const eventParams = keywords.flatMap((kw: string) => [`%${kw}%`, `%${kw}%`, `%${kw}%`]);

    // Braindump Search Conditions
    const brainConditions = keywords.map(() => "content LIKE ?").join(" OR ");
    const brainParams = keywords.map((kw: string) => `%${kw}%`);

    // Fetch matching events
    const matchingEvents = eventConditions ? db.prepare(`
      SELECT type, filePath, timestamp, diff, message 
      FROM events 
      WHERE project = ? AND (${eventConditions})
      ORDER BY timestamp DESC 
      LIMIT 20
    `).all(projectId, ...eventParams) : [];

    // Fetch matching brain dumps
    const matchingBraindumps = brainConditions ? db.prepare(`
      SELECT content, timestamp 
      FROM braindumps 
      WHERE ${brainConditions}
      ORDER BY timestamp DESC 
      LIMIT 10
    `).all(...brainParams) : [];

    // Fetch matching memory nodes
    const memoryConditions = keywords.map(() => "content LIKE ?").join(" OR ");
    const memoryParams = keywords.map((kw: string) => `%${kw}%`);

    const matchingMemory = memoryConditions ? db.prepare(`
      SELECT content, type, ts 
      FROM memory_nodes 
      WHERE project = ? AND (${memoryConditions})
      ORDER BY ts DESC 
      LIMIT 10
    `).all(projectId, ...memoryParams) : [];

    // 2. Add Recent Context (to ensure we have the very latest state)
    const recentEvents = db.prepare(`
      SELECT type, filePath, timestamp, diff, message 
      FROM events 
      WHERE project = ? 
      ORDER BY timestamp DESC 
      LIMIT 10
    `).all(projectId);

    const recentBraindumps = db.prepare(`
      SELECT content 
      FROM braindumps 
      ORDER BY timestamp DESC 
      LIMIT 5
    `).all();

    // 3. Assemble the "Knowledge Block"
    let knowledgeBase = "--- RELEVANT HISTORY ---\n";
    
    [...matchingEvents, ...recentEvents].forEach((ev: any) => {
      knowledgeBase += `- [Event] ${ev.type} in ${ev.filePath || 'unknown'}: ${ev.message || ev.diff || ''}\n`;
    });

    [...matchingBraindumps, ...recentBraindumps].forEach((bd: any) => {
      knowledgeBase += `- [Note] ${bd.content}\n`;
    });

    matchingMemory.forEach((mem: any) => {
      knowledgeBase += `- [Memory] ${mem.type}: ${mem.content}\n`;
    });

    // 4. Ask the AI
    console.log(`DEBUG: Calling AI with context length: ${knowledgeBase.length}`);
    const answer = await askOpenClaw(knowledgeBase, question);
    console.log("DEBUG: AI responded successfully");

    res.json({
      question,
      answer,
      sourcesFound: matchingEvents.length + matchingBraindumps.length + matchingMemory.length
    });

  } catch (err: any) {
    const errorMsg = err.stack || err.message || String(err);
    console.error("DEBUG: AskOpenClaw failed ERROR ->", errorMsg);
    res.status(500).json({ 
      error: "Failed to process question", 
      details: err.message || "Unknown error",
      stack: err.stack
    });
  }
});

export default router;

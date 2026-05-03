import { Router, Request, Response } from 'express';
import db from '../db';
import { aiReason } from '../services/aiService';

const router = Router();

const SYSTEM_PROMPTS: Record<string, string> = {
    context: 'You are a developer context assistant. Given recent code activity, summarize what the developer was working on in 1-2 sentences.',
    handoff: 'You are writing a handoff document for another developer taking over this project. Given the recent activity, write a structured handoff note covering: (1) What was being worked on, (2) Current state and any incomplete work, (3) Key files to review, (4) Suggested next actions. Be specific and reference actual file names from the context.',
    staleness: 'You are a code health analyst. Given the staleness scores and recent activity, identify: (1) Which files haven\'t been touched recently but were heavily edited (high risk), (2) Which files are being actively worked on (safe), (3) What areas of the codebase may have drifted or need review. Reference specific file names and their edit counts.',
};

async function handleReconstruct(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const queryType = typeof req.body?.queryType === 'string' ? req.body.queryType : (req.query.queryType as string) || 'context';
        const systemPrompt = SYSTEM_PROMPTS[queryType] || SYSTEM_PROMPTS.context;

        // 1. Fetch memory nodes (including NULL project)
        const memoryNodes = db.prepare(`
            SELECT * FROM memory_nodes
            WHERE project = ? OR project IS NULL
            ORDER BY ts DESC
            LIMIT 10
        `).all(projectId);
        
        // 2. Fetch last 10 events
        const recentEvents = db.prepare(`
            SELECT * FROM events
            WHERE project = ? AND diff IS NOT NULL
            ORDER BY ts DESC
            LIMIT 10
        `).all(projectId);

        // Fetch enhanced context (for braindumps and staleness)
        const contextRes = await fetch(`http://localhost:3001/context/enhanced?project=${projectId}`);
        if (!contextRes.ok) {
            throw new Error(`Context query failed with status: ${contextRes.status}`);
        }
        const contextData: any = await contextRes.json();

        // Build context string
        const lastMemories = memoryNodes.slice(-5).map((n: any) => n.content).join('\n- ');
        const recentCodeChanges = recentEvents.map((e: any) => `[${e.filePath}] ${e.diff}`).join('\n- ');
        const braindumps = (contextData.braindumps || []).slice(-3).map((b: any) => b.content).join('\n- ');
        const staleFiles = (contextData.staleness || []).slice(0, 3).map((f: any) => f.filePath).join(', ');

        const contextString = `
Last 5 Memory Nodes:
- ${lastMemories || 'None'}

Recent Code Changes:
- ${recentCodeChanges || 'None'}

Last 3 Brain Dumps:
- ${braindumps || 'None'}

Most Stale Files: ${staleFiles || 'None'}
        `.trim();

        const aiData = await aiReason(contextString, 'Use the context below to produce the requested synthesis.', systemPrompt);

        res.status(200).json({
            projectId,
            brief: aiData.summary,
            confidence: aiData.confidence,
            next_steps: aiData.next_steps || [],
            context_sources: {
                memoryNodes: Math.min(memoryNodes.length, 5),
                recentEvents: Math.min(recentEvents.length, 10),
                brainDumps: Math.min((contextData.braindumps || []).length, 3),
                staleFiles: (contextData.staleness || []).slice(0, 3).map((f: any) => f.filePath)
            },
            generated_at: Date.now()
        });
        
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'AI reconstruction failed. Check backend.' });
    }
}

router.post('/:projectId', handleReconstruct);
router.get('/:projectId', handleReconstruct);

export default router;

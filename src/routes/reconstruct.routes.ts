import { Router, Request, Response } from 'express';
import db from '../db';
import { aiReason } from '../services/aiService';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { getAllScores } from '../services/stalenessService';
import { buildContextFromMemory } from '../services/memoryService';

const router = Router();

// ─── System Prompts ───────────────────────────────────────────────────────────
// Each prompt tells the AI exactly what role to play and what JSON to return.
// Changing these strings changes the quality and structure of AI output.

export const SYSTEM_PROMPTS: Record<string, string> = {
    context: `You are ContextSwitch, an AI developer companion that helps engineers instantly resume work after interruptions.

OBJECTIVE: Analyze the developer's recent coding session data and produce a structured context brief they can read in 30 seconds to immediately resume work — no mental reconstruction needed.

INPUT DATA YOU WILL RECEIVE:
- Memory nodes: auto-snapshots of heavy coding activity
- Recent code changes: file edits with line-level diffs
- Brain dumps: the developer's own notes in their exact words (treat these as highest-priority signals)
- Stale files: files not touched recently that may need attention

OUTPUT RULES — return ONLY valid JSON with EXACTLY these keys:
{
  "summary": "2-3 sentences. What was the developer doing? What was the goal? What was the last known state?",
  "confidence": 0-100 (integer. Low = only auto-snapshots available. High = brain dump exists with clear notes),
  "next_steps": ["Array of 3-5 specific, actionable steps. Reference real file names from the context. Start each with a verb."],
  "current_hypothesis": "Single sentence. What theory or approach was the developer testing or implementing?",
  "key_files": ["Array of the 3-5 most important files to open. Use exact paths from context."],
  "blockers": ["Array of unresolved problems or errors detected. Empty array if session was clean."]
}

TONE: Developer-to-developer. Terse, specific, no fluff. Reference actual file names and line numbers wherever possible. Never say 'it seems like' — be direct.`,

    handoff: `You are ContextSwitch writing a structured handoff document for a developer handing their in-progress work to a teammate.

OBJECTIVE: The incoming developer should be able to open this document and start contributing productively within 10 minutes — zero verbal explanation needed. Be explicit about everything.

INPUT DATA: Recent file edits, git activity, developer brain dumps, memory snapshots, and stale file scores.

OUTPUT RULES — return ONLY valid JSON with EXACTLY these keys:
{
  "summary": "3-4 sentences. What is this project or feature? What stage is it at? What is the overall health?",
  "confidence": 0-100 (integer. How complete and reliable is this handoff based on available data?),
  "next_steps": ["5+ ordered steps the incoming developer should take. Be extremely specific — mention exact files, commands, and what to look for."],
  "project_state": "one of: in_progress | broken | testing | stable | unknown",
  "open_threads": ["Array of strings. Unfinished work items. Be specific — include file paths and what is incomplete about each."],
  "key_files": [{"filePath": "exact path", "reason": "why this file matters for the handoff"}],
  "blockers": [{"description": "what is broken or blocked", "filePath": "relevant file if any", "suggestedFix": "specific suggestion to unblock"}],
  "suggested_first_task": "Single sentence. The single most important thing for the new developer to do immediately after reading this."
}

TONE: Senior engineer writing for a junior developer. Assume nothing is known. Be explicit, reference real file names, explain the 'why' not just the 'what'.`,

    staleness: `You are ContextSwitch performing a codebase health analysis based on file edit frequency and staleness scores.

OBJECTIVE: Identify risk areas, active work zones, and maintenance priorities so the developer can make informed decisions about where to focus next.

STALENESS SCORE INTERPRETATION: Score of 100 = extremely stale (never re-edited since first touch). Low score = actively worked on. High edit_count + high score = edited heavily in the past but now abandoned (highest risk).

INPUT DATA: Staleness scores per file, recent edit activity, memory snapshots.

OUTPUT RULES — return ONLY valid JSON with EXACTLY these keys:
{
  "summary": "2-3 sentences. Overall codebase health. Any critical risk areas? Any files that look abandoned but important?",
  "confidence": 0-100 (integer),
  "next_steps": ["3-5 specific maintenance actions. E.g. 'Review auth.ts — last edited 5 days ago with 12 edits, now abandoned'"],
  "risk_files": [{"filePath": "exact path", "risk_reason": "specific reason this file is risky", "edit_count": number, "score": number}],
  "active_files": ["Array of file paths being actively worked on — these are safe"],
  "recommendation": "Single most important maintenance action the developer should take TODAY."
}

TONE: Code reviewer. Evidence-based, specific, reference actual file names and their scores. Never be vague.`
};

export const SESSION_SUMMARY_PROMPT = `You are ContextSwitch — a strict, technical session recorder for a software developer.

OBJECTIVE: Generate a factually-accurate session log from the raw event data provided. This will be stored permanently and referenced in future sessions. Accuracy matters more than completeness.

CRITICAL RULES:
1. ONLY reference facts that are EXPLICITLY present in the input data. Do NOT invent, assume, or infer beyond what the events show.
2. File edits ARE code changes — the diff field shows what was written. Do NOT say "no code was written" if file:change events exist.
3. The "source" field on events distinguishes human edits (source=human) vs AI-assisted edits (source=ai). Report both accurately.
4. If there are 0 file:change events, say the session was exploratory/reading only. Never fabricate activity.
5. Count the actual events. If there are 30 file:change events across 15 files, say exactly that.
6. Be terse, direct, and technical. No motivational language. No filler phrases like "it seems like" or "ultimately."

OUTPUT RULES — return ONLY valid JSON with EXACTLY these keys:
{
  "summary": "3-4 sentences. State: (1) what project/feature was being worked on, (2) exactly how many files were modified and which ones are most important, (3) what the code changes accomplished based on the diffs, (4) where things stand now. Be specific and factual.",
  "confidence": number from 0-100. 90+ = rich event log with diffs. 50-89 = partial data. Below 50 = very few events captured.,
  "next_steps": ["2-3 concrete next actions based on the last state of the code. Reference the last edited files. Start with a verb."],
  "files_changed": [{"filePath": "exact path from events", "change_description": "what specifically changed based on the diff content — not just 'modified'"}],
  "errors_fixed": ["Only list errors if diagnostic:error events existed AND subsequent file:change events suggest they were addressed. Empty array if no errors."],
  "key_insight": "One sentence: the single most important technical thing accomplished or discovered. If nothing meaningful happened, state that plainly."
}

TONE: Engineering log. Factual, specific, direct. Reference real file names, real diff content, real counts from the data.`;


// ─── Route Handler ────────────────────────────────────────────────────────────

async function handleReconstruct(req: AuthRequest, res: Response) {
    try {
        const { projectId } = req.params;
        const userId = req.user?.id;
        const queryType = typeof req.body?.queryType === 'string'
            ? req.body.queryType
            : (req.query.queryType as string) || 'context';
        
        const systemPrompt = SYSTEM_PROMPTS[queryType] || SYSTEM_PROMPTS.context;

        // 1. Fetch memory nodes (last 10)
        const memoryNodes = db.prepare(`
            SELECT * FROM memory_nodes
            WHERE (project = ? OR project IS NULL) 
            AND (user_id = ? OR project IN (SELECT project FROM project_members WHERE user_id = ?))
            ORDER BY ts DESC LIMIT 10
        `).all(projectId, userId, userId) as any[];

        // 2. Fetch last 50 events for rich context
        const recentEvents = db.prepare(`
            SELECT type, filePath, language, diff, severity, ts, user_id FROM events
            WHERE project = ? 
            AND (user_id = ? OR project IN (SELECT project FROM project_members WHERE user_id = ?))
            ORDER BY ts DESC LIMIT 50
        `).all(projectId, userId, userId) as any[];

        // 3. Fetch braindumps directly (replacing internal HTTP fetch)
        const braindumps = db.prepare(`
            SELECT content, ts, user_id FROM braindumps 
            WHERE project = ? 
            AND (user_id = ? OR project IN (SELECT project FROM project_members WHERE user_id = ?))
            ORDER BY ts DESC LIMIT 10
        `).all(projectId, userId, userId) as any[];

        const { findSimilarContent } = require('../services/embeddingService');
        const similarNodes = await findSimilarContent(projectId, userId!, 5);

        const stalenessScores = getAllScores().slice(0, 10);

        // 4. Build context string
        const similarStr = similarNodes
            .map((s: any) => `  [Semantic Memory] (${s.content_type}): ${s.content?.content || 'Unknown'}`)
            .join('\n');

        const braindumpStr = braindumps
            .map((b: any) => `  [${new Date(b.ts).toLocaleTimeString()}] "${b.content}"`)
            .join('\n');

        const memoryStr = memoryNodes
            .map((n: any) => `  [${n.type || 'snapshot'}] ${n.content}`)
            .join('\n');

        const fileChanges = recentEvents.filter(e => e.type === 'file:change' || e.type === 'file:save');
        const gitCommits = recentEvents.filter(e => e.type === 'git:commit');
        const errors = recentEvents.filter(e => e.type === 'diagnostic:error');

        const fileChangeStr = fileChanges
            .map((e: any) => `  ${e.filePath}${e.language ? ` (${e.language})` : ''}: ${e.diff || 'modified'}`)
            .join('\n');

        const commitStr = gitCommits
            .map((e: any) => `  ${e.diff || e.filePath}`)
            .join('\n');

        const errorStr = errors
            .map((e: any) => `  [${e.severity?.toUpperCase() || 'ERROR'}] ${e.filePath}: ${e.diff}`)
            .join('\n');

        const staleStr = stalenessScores
            .map((f: any) => `  ${f.filePath} (score: ${Math.round(f.score)}, edits: ${f.edit_count || '?'})`)
            .join('\n');

        const contextString = `
PROJECT: ${projectId}
TIMESTAMP: ${new Date().toLocaleString()}

RECENT ACTIVITY (Last 50 Events):
${fileChangeStr || '  None'}

GIT ACTIVITY:
${commitStr || '  None'}

ERRORS DETECTED:
${errorStr || '  None'}

DEVELOPER NOTES (Braindumps):
${braindumpStr || '  None'}

SYSTEM MEMORY SNAPSHOTS:
${memoryStr || '  None'}

SEMANTIC MEMORY (Long-term recall):
${similarStr || '  None'}

STALE FILES (Potential maintenance):
${staleStr}
        `.trim();

        const aiData = await aiReason(contextString, 'Perform a high-fidelity session reconstruction/handoff using the provided context.', systemPrompt);

        res.status(200).json({
            projectId,
            queryType,
            brief: aiData.summary,
            confidence: aiData.confidence,
            next_steps: aiData.next_steps || [],
            // Passthrough rich fields (key_files, blockers, etc.)
            ...aiData,
            context_sources: {
                events: recentEvents.length,
                braindumps: braindumps.length,
                memoryNodes: memoryNodes.length
            },
            generated_at: Date.now()
        });

    } catch (error: any) {
        console.error("Reconstruct Error:", error);
        res.status(500).json({ error: error.message || 'AI reconstruction failed.' });
    }
}

router.post('/:projectId', authMiddleware, (req: Request, res: Response) => handleReconstruct(req as unknown as AuthRequest, res));
router.get('/:projectId', authMiddleware, (req: Request, res: Response) => handleReconstruct(req as unknown as AuthRequest, res));

export default router;

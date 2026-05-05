import { Router, Request, Response } from 'express';
import db from '../db';
import { aiReason } from '../services/aiService';

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

export const SESSION_SUMMARY_PROMPT = `You are ContextSwitch generating a permanent session log entry for a developer's completed coding session.

OBJECTIVE: Produce a detailed, accurate summary of exactly what happened during this session. This will be stored permanently and read later when the developer wants to remember what they did — possibly days or weeks from now.

INPUT DATA: A structured log of all file edits, git commits, errors encountered, terminal commands, and developer notes from a single coding session.

OUTPUT RULES — return ONLY valid JSON with EXACTLY these keys:
{
  "summary": "3-4 sentences. What was the developer trying to accomplish? What did they actually get done? Were there significant issues? Where did they leave off?",
  "confidence": 0-100 (integer. How complete is this summary? Low if very few events captured.),
  "next_steps": ["2-3 specific things to do in the NEXT session to continue from exactly where this one left off."],
  "files_changed": [{"filePath": "exact path", "change_description": "specific description of what changed and why"}],
  "errors_fixed": ["Array of bugs or errors that appear to have been resolved this session. Empty if none."],
  "key_insight": "The single most important thing learned, accomplished, or discovered this session. 1 sentence."
}

TONE: Like a developer's own retrospective notes. Honest, specific, first-person perspective. Reference real file names. Acknowledge what was left incomplete — do not gloss over it.`;

// ─── Route Handler ────────────────────────────────────────────────────────────

async function handleReconstruct(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const queryType = typeof req.body?.queryType === 'string'
            ? req.body.queryType
            : (req.query.queryType as string) || 'context';
        const systemPrompt = SYSTEM_PROMPTS[queryType] || SYSTEM_PROMPTS.context;

        // 1. Fetch memory nodes for this project
        const memoryNodes = db.prepare(`
            SELECT * FROM memory_nodes
            WHERE project = ? OR project IS NULL
            ORDER BY ts DESC
            LIMIT 10
        `).all(projectId) as any[];

        // 2. Fetch last 15 events — more context = better AI
        const recentEvents = db.prepare(`
            SELECT type, filePath, language, diff, severity, ts FROM events
            WHERE project = ?
            ORDER BY ts DESC
            LIMIT 15
        `).all(projectId) as any[];

        // 3. Fetch enhanced context (braindumps + staleness from context route)
        const contextRes = await fetch(`http://localhost:3001/context/enhanced?project=${projectId}`);
        if (!contextRes.ok) {
            throw new Error(`Context query failed with status: ${contextRes.status}`);
        }
        const contextData: any = await contextRes.json();

        // 4. Build rich context string for the AI
        const braindumps = (contextData.braindumps || [])
            .slice(-5)
            .map((b: any) => `  [${new Date(b.ts).toLocaleTimeString()}] "${b.content}"`)
            .join('\n');

        const memoryStr = memoryNodes
            .slice(0, 5)
            .map((n: any) => `  [${n.type || 'snapshot'}] ${n.content}`)
            .join('\n');

        const fileChanges = recentEvents.filter(e => e.type === 'file:change');
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

        const stalenessScores = (contextData.stalenessScores || []).slice(0, 5);
        const staleStr = stalenessScores
            .map((f: any) => `  ${f.filePath} (score: ${Math.round(f.score)}, edits: ${f.edit_count || '?'})`)
            .join('\n');

        const contextString = `
PROJECT: ${projectId}

MEMORY NODES (recent auto-snapshots):
${memoryStr || '  None captured'}

RECENT FILE CHANGES (${fileChanges.length}):
${fileChangeStr || '  None'}

GIT COMMITS (${gitCommits.length}):
${commitStr || '  None'}

ERRORS / DIAGNOSTICS (${errors.length}):
${errorStr || '  None — no errors detected'}

DEVELOPER BRAIN DUMPS (${(contextData.braindumps || []).length}):
${braindumps || '  None — no notes logged this session'}

STALE FILES (most at-risk):
${staleStr || '  No staleness data yet'}
        `.trim();

        const aiData = await aiReason(contextString, 'Produce the requested synthesis using ONLY the context data provided above.', systemPrompt);

        res.status(200).json({
            projectId,
            queryType,
            brief: aiData.summary,
            confidence: aiData.confidence,
            next_steps: aiData.next_steps || [],
            // Pass through all rich fields the AI returns
            current_hypothesis: (aiData as any).current_hypothesis || null,
            key_files: (aiData as any).key_files || [],
            blockers: (aiData as any).blockers || [],
            project_state: (aiData as any).project_state || null,
            open_threads: (aiData as any).open_threads || [],
            risk_files: (aiData as any).risk_files || [],
            recommendation: (aiData as any).recommendation || null,
            context_sources: {
                memoryNodes: Math.min(memoryNodes.length, 10),
                recentEvents: recentEvents.length,
                brainDumps: (contextData.braindumps || []).length,
                staleFiles: stalenessScores.map((f: any) => f.filePath)
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

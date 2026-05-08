import db from "../db";

/**
 * FEAT-7: Semantic Memory — Powered by SQLite FTS5
 * Zero external API keys required. Works 100% offline.
 *
 * Instead of vector embeddings (OpenAI), we use SQLite's built-in
 * Full-Text Search (FTS5) which does BM25-ranked similarity matching.
 */

/**
 * Index a piece of content into the FTS5 search table.
 * Call this when a memory_node or braindump is created.
 */
export function indexContent(
    contentId: number,
    content: string,
    project: string,
    contentType: 'memory_node' | 'braindump',
    userId: number
): void {
    try {
        // Upsert pattern: delete old entry if exists, then insert fresh
        db.prepare(`
            DELETE FROM memory_fts WHERE content_id = ? AND content_type = ?
        `).run(contentId, contentType);

        db.prepare(`
            INSERT INTO memory_fts (content, project, content_type, content_id, user_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(content, project, contentType, contentId, userId);
    } catch (err) {
        console.warn("[FTS] Failed to index content:", err);
    }
}

/**
 * Find similar content using FTS5 BM25 ranking.
 * Returns the top matches for a given query, scoped to the user's accessible projects.
 */
export function findSimilarContent(
    query: string,
    userId: number,
    limit: number = 5
): Array<{ content: string; content_type: string; content_id: number; score: number }> {
    if (!query || query.trim().length === 0) return [];

    try {
        // Wrap query in double quotes to handle hyphens/special chars safely in FTS5
        const escapedQuery = `"${query.trim().replace(/"/g, '""')}"`;
        const results = db.prepare(`
            SELECT 
                content,
                content_type,
                content_id,
                bm25(memory_fts) AS score
            FROM memory_fts
            WHERE memory_fts MATCH ?
              AND user_id = ?
            ORDER BY score
            LIMIT ?
        `).all(escapedQuery, userId, limit) as any[];

        return results;
    } catch (err) {
        console.warn("[FTS] Search failed:", err);
        return [];
    }
}

/**
 * Legacy shim — kept so existing callers don't break.
 * Previously used OpenAI vectors; now delegates to FTS.
 */
export async function generateEmbedding(_text: string): Promise<number[]> {
    // FTS5 handles similarity natively — no vector needed.
    return [];
}

/**
 * Save a memory node AND index it for FTS search.
 */
export function saveMemoryNode(
    content: string,
    project: string,
    sessionId: number,
    userId: number,
    type: string = 'note',
    score: number = 1.0
): number {
    const result = db.prepare(`
        INSERT INTO memory_nodes (session_id, content, type, score, project, ts, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, content, type, score, project, Date.now(), userId) as any;

    const newId = result.lastInsertRowid as number;
    indexContent(newId, content, project, 'memory_node', userId);
    return newId;
}

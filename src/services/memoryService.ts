import db from "../db";
import { indexContent } from "./embeddingService";

export const saveMemoryNode = async (content: string, type: string, project: string, userId: number, sessionId?: number) => {
  const stmt = db.prepare(`
    INSERT INTO memory_nodes (session_id, content, type, score, project, ts, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(sessionId || null, content, type, 1.0, project, Date.now(), userId);
  const id = info.lastInsertRowid as number;

  // Index into FTS5 for semantic search (no API key needed)
  indexContent(id, content, project, 'memory_node', userId);

  return id;
};

export const queryMemory = (project: string, userId: number, limit: number = 10) => {
  const stmt = db.prepare(`
    SELECT * FROM memory_nodes
    WHERE project = ? AND user_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `);
  return stmt.all(project, userId, limit);
};

export const buildContextFromMemory = (project: string, userId: number) => {
  const nodes = queryMemory(project, userId, 20);
  const contextStrings = nodes.map((node: any) => `[${new Date(node.ts).toISOString()}] ${node.type}: ${node.content}`);
  return contextStrings.join("\n");
};

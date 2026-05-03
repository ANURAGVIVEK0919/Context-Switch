import db from "../db";

export const saveMemoryNode = (content: string, type: string, project: string, sessionId?: number) => {
  const stmt = db.prepare(`
    INSERT INTO memory_nodes (session_id, content, type, score, project, ts)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(sessionId || null, content, type, 1.0, project, Date.now());
  return info.lastInsertRowid;
};

export const queryMemory = (project: string, limit: number = 10) => {
  const stmt = db.prepare(`
    SELECT * FROM memory_nodes
    WHERE project = ?
    ORDER BY ts DESC
    LIMIT ?
  `);
  return stmt.all(project, limit);
};

export const buildContextFromMemory = (project: string) => {
  const nodes = queryMemory(project, 20);
  const contextStrings = nodes.map((node: any) => `[${new Date(node.ts).toISOString()}] ${node.type}: ${node.content}`);
  return contextStrings.join("\n");
};

import db from "../db";

export const updateScore = (filePath: string, userId: number) => {
  const now = Date.now();
  
  const existing: any = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ? AND user_id = ?`).get(filePath, userId);
  
  if (existing) {
    const newEditCount = existing.edit_count + 1;
    // simple score logic: more edits = lower staleness score
    const newScore = 100 / newEditCount;
    db.prepare(`
      UPDATE staleness_scores
      SET last_seen = ?, edit_count = ?, score = ?
      WHERE filePath = ? AND user_id = ?
    `).run(now, newEditCount, newScore, filePath, userId);
  } else {
    db.prepare(`
      INSERT INTO staleness_scores (filePath, last_seen, edit_count, score, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(filePath, now, 1, 100, userId);
  }
};

export const getAllScores = (userId: number) => {
  return db.prepare(`
    SELECT * FROM staleness_scores
    WHERE user_id = ?
    ORDER BY score ASC
  `).all(userId);
};

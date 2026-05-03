import db from "../db";

export const updateScore = (filePath: string) => {
  const now = Date.now();
  
  const existing: any = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ?`).get(filePath);
  
  if (existing) {
    const newEditCount = existing.edit_count + 1;
    // simple score logic: more edits = lower staleness score
    const newScore = 100 / newEditCount;
    db.prepare(`
      UPDATE staleness_scores
      SET last_seen = ?, edit_count = ?, score = ?
      WHERE filePath = ?
    `).run(now, newEditCount, newScore, filePath);
  } else {
    db.prepare(`
      INSERT INTO staleness_scores (filePath, last_seen, edit_count, score)
      VALUES (?, ?, ?, ?)
    `).run(filePath, now, 1, 100);
  }
};

export const getAllScores = () => {
  return db.prepare(`
    SELECT * FROM staleness_scores
    ORDER BY score ASC
  `).all();
};

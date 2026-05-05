import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../../events.sqlite3');
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);

// Check existing columns
const columns: string[] = db.prepare("PRAGMA table_info(events);").all().map((row: any) => row.name);
const requiredColumns = ["language", "project", "timestamp"];

// Add missing columns safely
for (const col of requiredColumns) {
  if (!columns.includes(col)) {
    if (col === "timestamp") {
      db.prepare(`ALTER TABLE events ADD COLUMN ${col} INTEGER;`).run();
    } else {
      db.prepare(`ALTER TABLE events ADD COLUMN ${col} TEXT;`).run();
    }
  }
}

// Create table if not exists (with all columns)
db.prepare(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  filePath TEXT,
  language TEXT,
  project TEXT,
  timestamp INTEGER
);`).run();

console.log("Database schema ready ✅");

export default db;

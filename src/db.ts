import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../context_switch.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    filePath TEXT,
    language TEXT,
    project TEXT,
    ts INTEGER,
    diff TEXT
  );

  CREATE TABLE IF NOT EXISTS braindumps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    ts INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT,
    start_ts INTEGER,
    end_ts INTEGER,
    summary TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS memory_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    content TEXT,
    type TEXT,
    score REAL,
    project TEXT,
    ts INTEGER
  );

  CREATE TABLE IF NOT EXISTS staleness_scores (
    filePath TEXT PRIMARY KEY,
    last_seen INTEGER,
    edit_count INTEGER,
    score REAL
  );
`);

// Migration safety: Ensure all required columns exist in 'events' table
// Uses "ts" instead of "timestamp" to match conventions.
const requiredEventColumns = [
  { name: "language", type: "TEXT" },
  { name: "project", type: "TEXT" },
  { name: "ts", type: "INTEGER" },
  { name: "diff", type: "TEXT" }
];

// Check for missing columns and add them if needed
const tableInfo = db.prepare('PRAGMA table_info(events);').all();
const existingColumns = (tableInfo as { name: string }[]).map(col => col.name);

for (const col of requiredEventColumns) {
  if (!existingColumns.includes(col.name)) {
    db.prepare(`ALTER TABLE events ADD COLUMN ${col.name} ${col.type};`).run();
    console.log(`Migrated: Added column '${col.name}' to events table.`);
  }
}

console.log("Database schema ready ✅");

export default db;

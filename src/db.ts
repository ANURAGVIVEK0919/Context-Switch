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
    diff TEXT,
    severity TEXT,
    source TEXT DEFAULT 'human'
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
const requiredEventColumns = [
  { name: "language", type: "TEXT" },
  { name: "project", type: "TEXT" },
  { name: "ts", type: "INTEGER" },
  { name: "diff", type: "TEXT" }
];

const tableInfo = db.prepare('PRAGMA table_info(events);').all();
const existingColumns = (tableInfo as { name: string }[]).map(col => col.name);

for (const col of requiredEventColumns) {
  if (!existingColumns.includes(col.name)) {
    db.prepare(`ALTER TABLE events ADD COLUMN ${col.name} ${col.type};`).run();
    console.log(`Migrated: Added column '${col.name}' to events table.`);
  }
}

// Migration: Add ai_summary column to sessions table if missing
const sessionTableInfo = db.prepare('PRAGMA table_info(sessions);').all();
const sessionColumns = (sessionTableInfo as { name: string }[]).map(col => col.name);
if (!sessionColumns.includes('ai_summary')) {
  db.prepare(`ALTER TABLE sessions ADD COLUMN ai_summary TEXT;`).run();
  console.log(`Migrated: Added column 'ai_summary' to sessions table.`);
}

// Migration: Add severity column to events table for diagnostic events
if (!existingColumns.includes('severity')) {
  db.prepare(`ALTER TABLE events ADD COLUMN severity TEXT;`).run();
  console.log(`Migrated: Added column 'severity' to events table.`);
}

// Migration: Add source column to events table for AI vs Human tracking
if (!existingColumns.includes('source')) {
  db.prepare(`ALTER TABLE events ADD COLUMN source TEXT DEFAULT 'human';`).run();
  console.log(`Migrated: Added column 'source' to events table.`);
}

// Migration: Add session_id column to braindumps table
const braindumpTableInfo = db.prepare('PRAGMA table_info(braindumps);').all();
const braindumpColumns = (braindumpTableInfo as { name: string }[]).map(col => col.name);
if (!braindumpColumns.includes('session_id')) {
  db.prepare(`ALTER TABLE braindumps ADD COLUMN session_id INTEGER;`).run();
  console.log(`Migrated: Added column 'session_id' to braindumps table.`);
}

// Migration: Add tags column to sessions table
if (!sessionColumns.includes('tags')) {
  db.prepare(`ALTER TABLE sessions ADD COLUMN tags TEXT DEFAULT NULL;`).run();
  console.log(`Migrated: Added column 'tags' to sessions table.`);
}

console.log("Database schema ready ✅");

export default db;

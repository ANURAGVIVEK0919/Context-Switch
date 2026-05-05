// Purpose: Setup SQLite database and create tables
// Input: None
// Output: DB instance

import Database from "better-sqlite3";

const db = new Database("contextswitch.db");



// Migration safety: Ensure all required columns exist in 'events' table
const requiredEventColumns = [
  { name: "language", type: "TEXT" },
  { name: "project", type: "TEXT" },
  { name: "timestamp", type: "INTEGER" },
  { name: "diff", type: "TEXT" },
  { name: "message", type: "TEXT" },
];

// Create table if not exists (with all columns)
db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    filePath TEXT,
    language TEXT,
    project TEXT,
    timestamp INTEGER,
    diff TEXT,
    message TEXT
  )
`).run();

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


// Create sessions table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT,
    startTime INTEGER,
    endTime INTEGER
  )
`).run();

// Create braindumps table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS braindumps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    timestamp INTEGER
  )
`).run();

// Create memory_nodes table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS memory_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    content TEXT,
    type TEXT,
    score REAL,
    project TEXT,
    ts INTEGER
  )
`).run();

// Create staleness_scores table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS staleness_scores (
    filePath TEXT PRIMARY KEY,
    last_seen INTEGER,
    edit_count INTEGER,
    score REAL
  )
`).run();

export default db;
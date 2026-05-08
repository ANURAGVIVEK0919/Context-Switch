import Database from 'better-sqlite3';
import path from 'path';

const dbName = process.env.NODE_ENV === 'test' ? 'context_switch_test.db' : 'context_switch.db';
const dbPath = path.resolve(__dirname, '..', dbName);
const db = new Database(dbPath);

// Create base tables
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
    ts INTEGER,
    session_id INTEGER,
    project TEXT,
    user_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT,
    start_ts INTEGER,
    end_ts INTEGER,
    summary TEXT,
    status TEXT,
    ai_summary TEXT,
    tags TEXT,
    user_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS memory_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    content TEXT,
    type TEXT,
    score REAL,
    project TEXT,
    ts INTEGER,
    user_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS staleness_scores (
    filePath TEXT,
    last_seen INTEGER,
    edit_count INTEGER,
    score REAL,
    user_id INTEGER,
    PRIMARY KEY (filePath, user_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at INTEGER
  );
`);

/**
 * Migration helper to safely add columns if they don't exist
 */
function addColumnIfNotExists(table: string, column: string, type: string) {
    const info = db.prepare(`PRAGMA table_info(${table});`).all() as { name: string }[];
    if (!info.map(c => c.name).includes(column)) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`).run();
        console.log(`Migrated: Added column '${column}' to ${table} table.`);
    }
}

// Ensure all schema updates are applied (for existing DBs)
addColumnIfNotExists('events', 'language', 'TEXT');
addColumnIfNotExists('events', 'project', 'TEXT');
addColumnIfNotExists('events', 'ts', 'INTEGER');
addColumnIfNotExists('events', 'diff', 'TEXT');
addColumnIfNotExists('events', 'severity', 'TEXT');
addColumnIfNotExists('events', 'source', "TEXT DEFAULT 'human'");
addColumnIfNotExists('events', 'git_branch', 'TEXT');
addColumnIfNotExists('events', 'user_id', 'INTEGER');

addColumnIfNotExists('sessions', 'ai_summary', 'TEXT');
addColumnIfNotExists('sessions', 'tags', 'TEXT');
addColumnIfNotExists('sessions', 'user_id', 'INTEGER');

addColumnIfNotExists('braindumps', 'session_id', 'INTEGER');
addColumnIfNotExists('braindumps', 'project', 'TEXT');
addColumnIfNotExists('braindumps', 'user_id', 'INTEGER');

addColumnIfNotExists('memory_nodes', 'user_id', 'INTEGER');

addColumnIfNotExists('users', 'telegram_chat_id', 'TEXT');
addColumnIfNotExists('users', 'last_event_ts', 'INTEGER');
addColumnIfNotExists('users', 'idle_warn_sent', 'INTEGER'); // boolean 0/1
addColumnIfNotExists('users', 'idle_alert_sent', 'INTEGER'); // boolean 0/1

addColumnIfNotExists('staleness_scores', 'user_id', 'INTEGER');

// FTS5 virtual table for free semantic text search (replaces OpenAI vectors)
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    content,
    project,
    content_type,
    content_id UNINDEXED,
    user_id UNINDEXED
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT,
    user_id INTEGER,
    role TEXT DEFAULT 'viewer',
    UNIQUE(project, user_id)
  );
`);

console.log("Database schema ready ✅");

export default db;

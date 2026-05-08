const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'context_switch.db');

try {
    const db = new Database(dbPath);
    console.log('Cleaning database...');
    
    // Clear all main tables
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM braindumps').run();
    db.prepare('DELETE FROM memory_nodes').run();
    db.prepare('DELETE FROM memory_fts').run();
    
    console.log('✅ Database wiped successfully. All test data removed.');
    db.close();
} catch (err) {
    console.error('❌ Failed to wipe database:', err.message);
}

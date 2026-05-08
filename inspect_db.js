const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'context_switch.db');

try {
    const db = new Database(dbPath);
    console.log('--- DATABASE INSPECTOR ---');
    
    const users = db.prepare('SELECT id, email FROM users').all();
    console.log('Users:', users);
    
    const sessions = db.prepare('SELECT id, project, user_id, status FROM sessions').all();
    console.log('Sessions:', sessions);
    
    const members = db.prepare('SELECT * FROM project_members').all();
    console.log('Project Members:', members);
    
    console.log('--- ISOLATION TEST ---');
    const testUserId = 4; // User B
    const history = db.prepare(`
        SELECT id, project, user_id FROM sessions 
        WHERE (user_id = ? OR project IN (SELECT project FROM project_members WHERE user_id = ?))
    `).all(testUserId, testUserId);
    
    console.log(`Data visible to User ${testUserId}:`, history);
    
    db.close();
} catch (err) {
    console.error('Error:', err.message);
}

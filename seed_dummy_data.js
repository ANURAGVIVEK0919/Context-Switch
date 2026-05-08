const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'context_switch.db');

try {
    const db = new Database(dbPath);
    
    // 1. Get the first user (User A)
    const user = db.prepare('SELECT id, email FROM users ORDER BY id ASC LIMIT 1').get();
    if (!user) {
        console.error('❌ No users found in database. Please register first.');
        process.exit(1);
    }
    
    console.log(`🌱 Seeding dummy data for user: ${user.email} (ID: ${user.id})...`);
    
    const now = Date.now();
    const tenMinsAgo = now - (10 * 60 * 1000);
    
    // 2. Create a dummy session
    const project = 'E-Commerce-Backend';
    const sessionResult = db.prepare(`
        INSERT INTO sessions (project, start_ts, status, user_id, summary)
        VALUES (?, ?, 'ended', ?, ?)
    `).run(project, tenMinsAgo, user.id, 'Optimized checkout API performance');
    
    const sessionId = sessionResult.lastInsertRowid;
    
    // 3. Add dummy events
    const events = [
        ['file:change', 'src/controllers/orderController.ts', 'typescript', project, tenMinsAgo + 1000, '@@ -10,4 +10,6 @@', user.id],
        ['git:commit', 'Optimized SQL queries for order lookup', null, project, tenMinsAgo + 5000, 'commit hash: a7b8c9', user.id],
        ['terminal:command', 'npm test', null, project, tenMinsAgo + 8000, 'Pass: 12, Fail: 0', user.id]
    ];
    
    const insertEvent = db.prepare(`
        INSERT INTO events (type, filePath, language, project, ts, diff, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const event of events) {
        insertEvent.run(...event);
    }
    
    console.log('✅ Seeded: 1 Session and 3 Events added to User A.');
    db.close();
} catch (err) {
    console.error('❌ Error seeding data:', err.message);
}

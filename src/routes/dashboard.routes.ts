import { Router } from 'express';
import db from '../db';
import { getCurrentSession } from '../services/sessionService';

const router = Router();

router.get('/stats', (req, res) => {
    try {
        const totalEventsRow = db.prepare(`SELECT COUNT(*) as count FROM events`).get() as any;
        const totalBrainDumpsRow = db.prepare(`SELECT COUNT(*) as count FROM braindumps`).get() as any;
        const activeSessionsRow = db.prepare(`SELECT COUNT(DISTINCT project) as count FROM sessions WHERE status = 'active'`).get() as any;
        
        const topFiles = db.prepare(`
            SELECT filePath, edit_count as editCount, score 
            FROM staleness_scores 
            ORDER BY edit_count DESC 
            LIMIT 5
        `).all() as any[];

        res.status(200).json({
            totalEvents: totalEventsRow ? totalEventsRow.count : 0,
            totalBrainDumps: totalBrainDumpsRow ? totalBrainDumpsRow.count : 0,
            activeSessions: activeSessionsRow ? activeSessionsRow.count : 0,
            topFiles
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/timeline', (req, res) => {
    try {
        const hours = req.query.hours ? Number(req.query.hours) : 24;
        const finalHours = Math.min(hours, 168);
        const cutoffTs = Date.now() - (finalHours * 60 * 60 * 1000);

        const timelineData = db.prepare(`
            SELECT 
                strftime('%Y-%m-%d %H:00', datetime(ts/1000, 'unixepoch', 'localtime')) as hour,
                COUNT(*) as eventCount
            FROM events
            WHERE ts >= ?
            GROUP BY hour
            ORDER BY hour ASC
        `).all(cutoffTs) as any[];

        const totalInWindow = timelineData.reduce((sum, item) => sum + item.eventCount, 0);

        res.status(200).json({ timeline: timelineData, totalInWindow });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/staleness', (req, res) => {
    try {
        const files = db.prepare(`
            SELECT filePath, last_seen as lastSeen, edit_count as editCount, score 
            FROM staleness_scores 
            ORDER BY score DESC
        `).all() as any[];

        const mostStale = files.length > 0 ? files[0].filePath : null;

        res.status(200).json({ files, mostStale });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/summary', (req, res) => {
    try {
        const totalEventsRow = db.prepare(`SELECT COUNT(*) as count FROM events`).get() as any;
        const totalBrainDumpsRow = db.prepare(`SELECT COUNT(*) as count FROM braindumps`).get() as any;
        const activeSessionsRow = db.prepare(`SELECT COUNT(DISTINCT project) as count FROM sessions WHERE status = 'active'`).get() as any;
        
        const topStaleFileRow = db.prepare(`
            SELECT filePath, score 
            FROM staleness_scores 
            ORDER BY score DESC 
            LIMIT 1
        `).get() as any;

        const recentSession = getCurrentSession();

        res.status(200).json({
            stats: {
                totalEvents: totalEventsRow ? totalEventsRow.count : 0,
                totalBrainDumps: totalBrainDumpsRow ? totalBrainDumpsRow.count : 0,
                activeSessions: activeSessionsRow ? activeSessionsRow.count : 0,
            },
            recentSession,
            topStaleFile: topStaleFileRow || null
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

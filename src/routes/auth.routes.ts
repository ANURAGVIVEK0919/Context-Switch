import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'context-switch-secret-key';

router.post('/register', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const now = Date.now();
        
        const result = db.prepare(`
            INSERT INTO users (email, password_hash, created_at)
            VALUES (?, ?, ?)
        `).run(email, passwordHash, now);

        const userId = result.lastInsertRowid;
        const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ success: true, token, user: { id: userId, email } });
    } catch (err: any) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

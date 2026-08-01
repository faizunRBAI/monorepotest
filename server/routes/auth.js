import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { loginLimiter } from '../middleware/rateLimiters.js';

const router = Router();
const BCRYPT_ROUNDS = 10;

router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    try {
        const [rows] = await db.query('SELECT * FROM Admin WHERE username = ?', [username]);
        const admin = rows[0];
        if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

        let valid = false;
        if (admin.password.startsWith('$2')) {
            valid = await bcrypt.compare(password, admin.password);
        } else {
            valid = admin.password === password;
            if (valid) {
                const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
                await db.query('UPDATE Admin SET password = ? WHERE username = ?', [hash, username]);
            }
        }

        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { username: admin.username, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ token });
    } catch {
        res.status(500).json({ error: 'Login failed' });
    }
});

export default router;

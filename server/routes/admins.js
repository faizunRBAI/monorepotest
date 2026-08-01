import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const BCRYPT_ROUNDS = 10;

router.get('/admins', authenticateToken, async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username FROM Admin ORDER BY id ASC');
        res.json(rows);
    } catch {
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
});

router.post('/admins', authenticateToken, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const [result] = await db.query('INSERT INTO Admin (username, password) VALUES (?, ?)', [username.trim(), hash]);
        res.status(201).json({ id: result.insertId, username: username.trim() });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists.' });
        res.status(500).json({ error: 'Failed to create admin' });
    }
});

router.delete('/admins/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT id, username FROM Admin WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Admin not found.' });
        if (rows[0].username === req.user.username)
            return res.status(400).json({ error: 'You cannot delete your own account.' });

        const [all] = await db.query('SELECT COUNT(*) as cnt FROM Admin');
        if (all[0].cnt <= 1)
            return res.status(400).json({ error: 'Cannot delete the last admin account.' });

        await db.query('DELETE FROM Admin WHERE id = ?', [id]);
        res.json({ message: 'Admin deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete admin' });
    }
});

router.put('/admins/:id/password', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
        const [rows] = await db.query('SELECT id FROM Admin WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Admin not found.' });
        const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query('UPDATE Admin SET password = ? WHERE id = ?', [hash, id]);
        res.json({ message: 'Password updated' });
    } catch {
        res.status(500).json({ error: 'Failed to update password' });
    }
});

export default router;

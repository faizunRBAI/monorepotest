import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/size-charts', async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM SizeChart ORDER BY name ASC');
        res.json(rows);
    } catch {
        res.status(500).json({ error: 'Failed to fetch size charts' });
    }
});

router.post('/size-charts', authenticateToken, async (req, res) => {
    const { name, content } = req.body;
    try {
        await db.query('INSERT INTO SizeChart (name, content) VALUES (?, ?)', [name, JSON.stringify(content)]);
        res.status(201).json({ message: 'Size chart created' });
    } catch {
        res.status(500).json({ error: 'Failed to create size chart' });
    }
});

router.put('/size-charts/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, content } = req.body;
    try {
        await db.query('UPDATE SizeChart SET name = ?, content = ? WHERE id = ?', [name, JSON.stringify(content), id]);
        res.json({ message: 'Size chart updated' });
    } catch {
        res.status(500).json({ error: 'Failed to update size chart' });
    }
});

router.delete('/size-charts/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM SizeChart WHERE id = ?', [id]);
        res.json({ message: 'Size chart deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete size chart' });
    }
});

export default router;

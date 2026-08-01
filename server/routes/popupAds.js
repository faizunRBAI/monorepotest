import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// --- Popup Ads ---

router.get('/popup-ads', async (_req, res) => {
    try {
        const [ads] = await db.query('SELECT * FROM PopupAd WHERE isActive = 1 ORDER BY createdAt DESC');
        res.json(ads);
    } catch {
        res.status(500).json({ error: 'Failed to fetch popup ads' });
    }
});

router.post('/popup-ads', authenticateToken, async (req, res) => {
    const { imageUrl, categoryId, subCategoryId, isActive } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO PopupAd (imageUrl, categoryId, subCategoryId, isActive) VALUES (?, ?, ?, ?)',
            [imageUrl, categoryId || null, subCategoryId || null, isActive !== undefined ? isActive : 1]
        );
        const [ad] = await db.query('SELECT * FROM PopupAd WHERE id = ?', [result.insertId]);
        res.json(ad[0]);
    } catch {
        res.status(500).json({ error: 'Failed to create popup ad' });
    }
});

router.delete('/popup-ads/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM PopupAd WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete popup ad' });
    }
});

router.put('/popup-ads/:id/toggle', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE PopupAd SET isActive = NOT isActive WHERE id = ?', [id]);
        const [ad] = await db.query('SELECT * FROM PopupAd WHERE id = ?', [id]);
        res.json(ad[0]);
    } catch {
        res.status(500).json({ error: 'Failed to toggle popup ad' });
    }
});

// --- Legacy single-popup settings ---

router.get('/popup', async (_req, res) => {
    const [rows] = await db.query('SELECT * FROM PopupSettings WHERE id = 1');
    res.json(rows[0] || { isEnabled: 0 });
});

router.post('/popup', authenticateToken, async (req, res) => {
    const { isEnabled, imageUrl, message } = req.body;
    const [existing] = await db.query('SELECT id FROM PopupSettings WHERE id = 1');
    if (existing.length > 0) {
        await db.query('UPDATE PopupSettings SET isEnabled=?, imageUrl=?, message=? WHERE id=1', [isEnabled, imageUrl, message]);
    } else {
        await db.query('INSERT INTO PopupSettings (isEnabled, imageUrl, message) VALUES (?, ?, ?)', [isEnabled, imageUrl, message]);
    }
    const [row] = await db.query('SELECT * FROM PopupSettings WHERE id = 1');
    res.json(row[0]);
});

export default router;

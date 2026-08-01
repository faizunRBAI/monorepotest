import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/hero', async (_req, res) => {
    try {
        const [banners] = await db.query('SELECT * FROM Banner WHERE isActive = 1 ORDER BY createdAt ASC');
        if (banners.length > 0) return res.json(banners);

        // Fallback to legacy HeroSection
        const [heroes] = await db.query('SELECT * FROM HeroSection WHERE id = 1');
        res.json(heroes.length > 0 ? [heroes[0]] : []);
    } catch {
        res.status(500).json({ error: 'Failed to fetch hero' });
    }
});

router.put('/hero', authenticateToken, async (req, res) => {
    const { title, subtitle, discountText, description, imageUrl } = req.body;
    try {
        const [existing] = await db.query('SELECT id FROM HeroSection WHERE id = 1');
        if (existing.length > 0) {
            await db.query(
                'UPDATE HeroSection SET title=?, subtitle=?, discountText=?, description=?, imageUrl=? WHERE id=1',
                [title, subtitle, discountText, description, imageUrl]
            );
        } else {
            await db.query(
                'INSERT INTO HeroSection (title, subtitle, discountText, description, imageUrl) VALUES (?, ?, ?, ?, ?)',
                [title, subtitle, discountText, description, imageUrl]
            );
        }
        const [updated] = await db.query('SELECT * FROM HeroSection WHERE id = 1');
        res.json(updated[0]);
    } catch {
        res.status(500).json({ error: 'Failed to update hero' });
    }
});

router.get('/banners', authenticateToken, async (_req, res) => {
    try {
        const [banners] = await db.query('SELECT * FROM Banner ORDER BY createdAt DESC');
        res.json(banners);
    } catch {
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

router.post('/banners', authenticateToken, async (req, res) => {
    const { title, subtitle, discountText, description, imageUrl, isActive } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO Banner (title, subtitle, discountText, description, imageUrl, isActive) VALUES (?, ?, ?, ?, ?, ?)',
            [title, subtitle, discountText, description, imageUrl, isActive ? 1 : 0]
        );
        const [banner] = await db.query('SELECT * FROM Banner WHERE id = ?', [result.insertId]);
        res.json(banner[0]);
    } catch {
        res.status(500).json({ error: 'Failed to create banner' });
    }
});

router.put('/banners/:id/activate', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE Banner SET isActive = NOT isActive WHERE id = ?', [id]);
        const [banner] = await db.query('SELECT * FROM Banner WHERE id = ?', [id]);
        res.json(banner[0]);
    } catch {
        res.status(500).json({ error: 'Failed to toggle banner' });
    }
});

router.delete('/banners/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Banner WHERE id = ?', [id]);
        res.json({ message: 'Banner deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete banner' });
    }
});

export default router;

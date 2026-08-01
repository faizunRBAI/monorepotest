import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, authenticateCustomer } from '../middleware/auth.js';

const router = Router();

router.post('/reviews', authenticateCustomer, async (req, res) => {
    const { productId, rating, comment } = req.body;
    try {
        const [orders] = await db.query(`
            SELECT * FROM \`Order\` o
            JOIN OrderItem oi ON o.id = oi.orderId
            WHERE o.customerId = ? AND o.status = 'Delivered' AND oi.productId = ?`,
            [req.user.id, productId]
        );
        if (orders.length === 0) {
            return res.status(403).json({ error: 'You can only review products you have purchased and received.' });
        }
        const [result] = await db.query(
            'INSERT INTO Review (productId, customerId, rating, comment, isVerified) VALUES (?, ?, ?, ?, 1)',
            [productId, req.user.id, rating, comment]
        );
        const [review] = await db.query('SELECT * FROM Review WHERE id = ?', [result.insertId]);
        res.json(review[0]);
    } catch {
        res.status(500).json({ error: 'Failed to post review' });
    }
});

router.delete('/reviews/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Review WHERE id = ?', [id]);
        res.json({ message: 'Review deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

router.put('/reviews/reorder', authenticateToken, async (req, res) => {
    const { reviews } = req.body;
    if (!reviews || !Array.isArray(reviews)) return res.status(400).json({ error: 'Invalid data' });
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const r of reviews) {
            await conn.query('UPDATE Review SET sortOrder = ? WHERE id = ?', [r.sortOrder, r.id]);
        }
        await conn.commit();
        res.json({ message: 'Reviews reordered' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ error: 'Failed to reorder' });
    } finally {
        conn.release();
    }
});

export default router;

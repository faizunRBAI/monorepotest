import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

router.get('/categories', async (_req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, s.id as subId, s.name as subName
            FROM Category c
            LEFT JOIN SubCategory s ON s.categoryId = c.id
            ORDER BY c.displayOrder ASC, c.id ASC, s.id ASC`);

        const map = new Map();
        for (const row of rows) {
            if (!map.has(row.id)) {
                const { subId, subName, ...cat } = row;
                map.set(row.id, { ...cat, subCategories: [] });
            }
            if (row.subId) {
                map.get(row.id).subCategories.push({ id: row.subId, name: row.subName });
            }
        }
        res.json([...map.values()]);
    } catch {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Merged POST — handles displayOrder, showOnHome, featuredProductId, featuredProductList
router.post('/categories', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, featuredProductId, featuredProductList } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const [maxOrderResult] = await db.query('SELECT MAX(displayOrder) as maxOrder FROM Category');
        const nextOrder = (maxOrderResult[0].maxOrder || 0) + 1;

        const [result] = await db.query(
            'INSERT INTO Category (name, imageUrl, displayOrder, showOnHome, featuredProductId, featuredProductList) VALUES (?, ?, ?, ?, ?, ?)',
            [
                name, imageUrl, nextOrder, 1,
                featuredProductId || null,
                featuredProductList
                    ? (typeof featuredProductList === 'string' ? featuredProductList : JSON.stringify(featuredProductList))
                    : null,
            ]
        );
        const [category] = await db.query('SELECT * FROM Category WHERE id = ?', [result.insertId]);
        res.status(201).json(category[0]);
    } catch {
        res.status(500).json({ error: 'Failed to create category' });
    }
});

router.put('/categories/reorder', authenticateToken, async (req, res) => {
    const { orderedIds } = req.body;
    if (!orderedIds || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'Invalid data' });
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < orderedIds.length; i++) {
            await conn.query('UPDATE Category SET displayOrder = ? WHERE id = ?', [i, orderedIds[i]]);
        }
        await conn.commit();
        res.json({ message: 'Categories reordered' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ error: 'Failed to reorder categories' });
    } finally {
        conn.release();
    }
});

router.put('/categories/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, featuredProductId, featuredProductList, showOnHome } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    try {
        let query = 'UPDATE Category SET name = ?';
        const params = [name];

        if (imageUrl !== undefined) { query += ', imageUrl = ?'; params.push(imageUrl); }
        if (featuredProductId !== undefined) { query += ', featuredProductId = ?'; params.push(featuredProductId || null); }
        if (featuredProductList !== undefined) {
            query += ', featuredProductList = ?';
            params.push(featuredProductList
                ? (typeof featuredProductList === 'string' ? featuredProductList : JSON.stringify(featuredProductList))
                : null);
        }
        if (showOnHome !== undefined) {
            query += ', showOnHome = ?';
            params.push(showOnHome === 'true' || showOnHome === true ? 1 : 0);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.query(query, params);
        res.json({ message: 'Category updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [products] = await conn.query('SELECT id FROM Product WHERE categoryId = ?', [id]);
        const productIds = products.map(p => p.id);

        if (productIds.length > 0) {
            const placeholders = productIds.map(() => '?').join(',');
            const [orderItems] = await conn.query(
                `SELECT id FROM OrderItem WHERE productId IN (${placeholders}) LIMIT 1`,
                productIds
            );
            if (orderItems.length > 0) {
                await conn.rollback();
                return res.status(400).json({ error: 'Cannot delete: Products in this category are part of existing orders.' });
            }
            await conn.query(`DELETE FROM Review WHERE productId IN (${placeholders})`, productIds);
            await conn.query('DELETE FROM Product WHERE categoryId = ?', [id]);
        }

        await conn.query('DELETE FROM PopupAd WHERE categoryId = ?', [id]);
        await conn.query('DELETE FROM SubCategory WHERE categoryId = ?', [id]);
        await conn.query('DELETE FROM Category WHERE id = ?', [id]);

        await conn.commit();
        res.json({ message: 'Category deleted' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ error: 'Failed to delete category due to server error.' });
    } finally {
        conn.release();
    }
});

router.post('/subcategories', authenticateToken, async (req, res) => {
    const { name, categoryId } = req.body;
    try {
        const [result] = await db.query('INSERT INTO SubCategory (name, categoryId) VALUES (?, ?)', [name, categoryId]);
        const [sub] = await db.query('SELECT * FROM SubCategory WHERE id = ?', [result.insertId]);
        res.json(sub[0]);
    } catch {
        res.status(500).json({ error: 'Failed to create subcategory' });
    }
});

router.delete('/subcategories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM SubCategory WHERE id = ?', [id]);
        res.json({ message: 'Subcategory deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete subcategory' });
    }
});

export default router;

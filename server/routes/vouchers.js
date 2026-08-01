import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// A promo code discounts the product price only — never the delivery charge. Callers pass
// the products subtotal; `orderAmount` is accepted as the older name for the same thing.
router.post('/vouchers/validate', async (req, res) => {
    const { code, productsSubtotal, orderAmount, productIds } = req.body;
    const subtotal = Math.max(0, Number(productsSubtotal ?? orderAmount ?? 0) || 0);
    if (!code) return res.status(400).json({ error: 'No code provided.' });
    try {
        const [rows] = await db.query('SELECT * FROM Voucher WHERE code = ? AND isActive = 1', [code.trim().toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ error: 'Invalid or inactive voucher code.' });

        const v = rows[0];
        if (v.expiresAt && new Date(v.expiresAt) < new Date())
            return res.status(400).json({ error: 'This voucher has expired.' });
        if (v.maxClaimsAllowed !== null && v.totalClaimed >= v.maxClaimsAllowed)
            return res.status(400).json({ error: 'This voucher has reached its usage limit.' });
        // Measured against the product value too, so delivery cannot push a small order
        // over the threshold.
        if (subtotal < v.minOrderAmount)
            return res.status(400).json({ error: `Minimum order of ${v.minOrderAmount} BDT in products required for this voucher.` });

        // Check category/subcategory restriction
        if (v.appliesTo && v.appliesTo !== 'all' && v.appliesToId && productIds && productIds.length > 0) {
            const col = v.appliesTo === 'category' ? 'categoryId' : 'subCategoryId';
            const [matches] = await db.query(
                `SELECT 1 FROM Product WHERE id IN (?) AND \`${col}\` = ? LIMIT 1`,
                [productIds, v.appliesToId]
            );
            if (matches.length === 0)
                return res.status(400).json({ error: 'This voucher is not valid for the items in your cart.' });
        }

        // Based on the products subtotal, and a fixed discount can never exceed it.
        const discountAmount = parseFloat((v.discountType === 'percentage'
            ? (subtotal * v.discountValue) / 100
            : Math.min(v.discountValue, subtotal)
        ).toFixed(2));

        res.json({ valid: true, discountAmount, discountType: v.discountType, discountValue: v.discountValue, code: v.code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to validate voucher' });
    }
});

router.get('/vouchers', authenticateToken, async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Voucher ORDER BY createdAt DESC');
        res.json(rows);
    } catch {
        res.status(500).json({ error: 'Failed to fetch vouchers' });
    }
});

router.post('/vouchers', authenticateToken, async (req, res) => {
    const { code, discountType, discountValue, minOrderAmount, maxClaimsAllowed, isActive, expiresAt, appliesTo, appliesToId } = req.body;
    if (!code || !discountValue) return res.status(400).json({ error: 'Code and discount value required.' });
    try {
        const [result] = await db.query(
            'INSERT INTO Voucher (code, discountType, discountValue, minOrderAmount, maxClaimsAllowed, isActive, expiresAt, appliesTo, appliesToId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [code.trim().toUpperCase(), discountType || 'percentage', discountValue, minOrderAmount || 0, maxClaimsAllowed || null, isActive ? 1 : 0, expiresAt || null, appliesTo || 'all', appliesToId || null]
        );
        const [rows] = await db.query('SELECT * FROM Voucher WHERE id = ?', [result.insertId]);
        res.json(rows[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Voucher code already exists.' });
        res.status(500).json({ error: 'Failed to create voucher' });
    }
});

router.put('/vouchers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { code, discountType, discountValue, minOrderAmount, maxClaimsAllowed, isActive, expiresAt, appliesTo, appliesToId } = req.body;
    try {
        await db.query(
            'UPDATE Voucher SET code=?, discountType=?, discountValue=?, minOrderAmount=?, maxClaimsAllowed=?, isActive=?, expiresAt=?, appliesTo=?, appliesToId=? WHERE id=?',
            [code.trim().toUpperCase(), discountType, discountValue, minOrderAmount || 0, maxClaimsAllowed || null, isActive ? 1 : 0, expiresAt || null, appliesTo || 'all', appliesToId || null, id]
        );
        const [rows] = await db.query('SELECT * FROM Voucher WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch {
        res.status(500).json({ error: 'Failed to update voucher' });
    }
});

router.delete('/vouchers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Voucher WHERE id = ?', [id]);
        res.json({ message: 'Voucher deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete voucher' });
    }
});

export default router;

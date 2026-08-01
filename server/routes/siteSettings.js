import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/site-settings', async (_req, res) => {
    const [rows] = await db.query('SELECT * FROM SiteSettings WHERE id = 1');
    res.json(rows[0] || {});
});

router.post('/site-settings', authenticateToken, async (req, res) => {
    const {
        logoUrl, companyName, address, email, phone,
        facebook, instagram, twitter,
        termsContent, privacyContent, cancellationContent, faqsContent,
        deliveryChargeInside, deliveryChargeOutside,
        mfsNumbers, mfsInstructions,
    } = req.body;

    const values = [logoUrl, companyName, address, email, phone, facebook, instagram, twitter, termsContent, privacyContent, cancellationContent, faqsContent, deliveryChargeInside, deliveryChargeOutside, mfsNumbers, mfsInstructions];

    const [existing] = await db.query('SELECT id FROM SiteSettings WHERE id = 1');
    if (existing.length > 0) {
        await db.query(`
            UPDATE SiteSettings SET
            logoUrl=?, companyName=?, address=?, email=?, phone=?,
            facebook=?, instagram=?, twitter=?,
            termsContent=?, privacyContent=?, cancellationContent=?, faqsContent=?,
            deliveryChargeInside=?, deliveryChargeOutside=?,
            mfsNumbers=?, mfsInstructions=?
            WHERE id=1`, values);
    } else {
        await db.query(`
            INSERT INTO SiteSettings
            (logoUrl, companyName, address, email, phone, facebook, instagram, twitter, termsContent, privacyContent, cancellationContent, faqsContent, deliveryChargeInside, deliveryChargeOutside, mfsNumbers, mfsInstructions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);
    }
    const [row] = await db.query('SELECT * FROM SiteSettings WHERE id = 1');
    res.json(row[0]);
});

export default router;

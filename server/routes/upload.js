import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

router.post('/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    res.json({ imageUrl: `${baseUrl}/uploads/${req.file.filename}` });
});

export default router;

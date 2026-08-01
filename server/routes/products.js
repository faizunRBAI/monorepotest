import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { normalizeGroups } from '../utils/measurements.js';

const router = Router();

const parseProduct = (p) => {
    if (!p) return null;
    return {
        ...p,
        images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || []),
        sizes: typeof p.sizes === 'string' ? JSON.parse(p.sizes || '[]') : (p.sizes || []),
        colors: typeof p.colors === 'string' ? JSON.parse(p.colors || '[]') : (p.colors || []),
        sizeStock: typeof p.sizeStock === 'string' ? JSON.parse(p.sizeStock || '{}') : (p.sizeStock || {}),
        // Always resolved to a concrete list so the product page knows exactly which
        // measurement groups to render, whatever the column holds.
        measurementGroups: normalizeGroups(p.measurementGroups),
    };
};

const getProductWithDetails = async (id) => {
    const [rows] = await db.query(`
        SELECT p.*, c.name as catName, s.name as subName
        FROM Product p
        LEFT JOIN Category c ON p.categoryId = c.id
        LEFT JOIN SubCategory s ON p.subCategoryId = s.id
        WHERE p.id = ?`, [id]);

    if (rows.length === 0) return null;
    const p = parseProduct(rows[0]);

    const [reviews] = await db.query(`
        SELECT r.*, c.name as customerName
        FROM Review r
        LEFT JOIN Customer c ON r.customerId = c.id
        WHERE r.productId = ?
        ORDER BY r.sortOrder ASC, r.createdAt DESC`, [id]);

    return {
        ...p,
        category: { id: p.categoryId, name: p.catName },
        subCategory: p.subCategoryId ? { id: p.subCategoryId, name: p.subName } : null,
        reviews: reviews.map(r => ({ ...r, customer: { name: r.customerName }, isVerified: !!r.isVerified })),
    };
};

// Static-segment routes MUST come before /:id
router.get('/products/new', async (_req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.*, c.name as catName
            FROM Product p
            LEFT JOIN Category c ON p.categoryId = c.id
            WHERE p.isNewArrival = 1
            ORDER BY p.createdAt DESC LIMIT 8`);
        res.json(products.map(p => {
            const parsed = parseProduct(p);
            return { ...parsed, category: { id: parsed.categoryId, name: parsed.catName } };
        }));
    } catch {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

router.get('/products/free-shipping', async (_req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.*, c.name as catName
            FROM Product p
            LEFT JOIN Category c ON p.categoryId = c.id
            WHERE p.isFreeShipping = 1
            ORDER BY p.createdAt DESC`);
        res.json(products.map(p => {
            const parsed = parseProduct(p);
            return { ...parsed, category: { id: parsed.categoryId, name: parsed.catName } };
        }));
    } catch {
        res.status(500).json({ error: 'Failed to fetch free shipping products' });
    }
});

router.get('/products/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const [products] = await db.query(`
            SELECT p.*, c.name as catName, s.name as subName
            FROM Product p
            LEFT JOIN Category c ON p.categoryId = c.id
            LEFT JOIN SubCategory s ON p.subCategoryId = s.id
            WHERE p.name LIKE ? OR p.description LIKE ?
            ORDER BY p.createdAt DESC LIMIT 20`, [`%${q}%`, `%${q}%`]);
        res.json(products.map(p => {
            const parsed = parseProduct(p);
            return {
                ...parsed,
                category: { id: parsed.categoryId, name: parsed.catName },
                subCategory: parsed.subCategoryId ? { id: parsed.subCategoryId, name: parsed.subName } : null,
            };
        }));
    } catch {
        res.status(500).json({ error: 'Failed to search' });
    }
});

router.get('/products/list', async (req, res) => {
    const { ids } = req.query;
    if (!ids) return res.json([]);
    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (idArray.length === 0) return res.json([]);
    try {
        const placeholders = idArray.map(() => '?').join(',');
        const [products] = await db.query(`
            SELECT p.*, c.name as catName
            FROM Product p
            LEFT JOIN Category c ON p.categoryId = c.id
            WHERE p.id IN (${placeholders})
            ORDER BY FIELD(p.id, ${placeholders})`, [...idArray, ...idArray]);
        res.json(products.map(p => {
            const parsed = parseProduct(p);
            return { ...parsed, category: { id: parsed.categoryId, name: parsed.catName } };
        }));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch products list' });
    }
});

router.get('/products/category/:id', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.*, c.name as catName
            FROM Product p
            LEFT JOIN Category c ON p.categoryId = c.id
            WHERE p.categoryId = ?
            ORDER BY p.createdAt DESC`, [req.params.id]);
        res.json(products.map(p => {
            const parsed = parseProduct(p);
            return { ...parsed, category: { id: parsed.categoryId, name: parsed.catName } };
        }));
    } catch {
        res.status(500).json({ error: 'Failed to fetch category products' });
    }
});

router.get('/products/subcategory/:id', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.*, c.name as catName
            FROM Product p
            LEFT JOIN Category c ON p.categoryId = c.id
            WHERE p.subCategoryId = ?
            ORDER BY p.createdAt DESC`, [req.params.id]);
        res.json(products.map(p => {
            const parsed = parseProduct(p);
            return { ...parsed, category: { id: parsed.categoryId, name: parsed.catName } };
        }));
    } catch {
        res.status(500).json({ error: 'Failed to fetch subcategory products' });
    }
});

router.get('/products/:id', async (req, res) => {
    try {
        const product = await getProductWithDetails(req.params.id);
        if (!product) return res.status(404).json({ error: 'Not found' });
        res.json(product);
    } catch {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

router.get('/products', authenticateToken, async (_req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.*, c.name as catName, s.name as subName
            FROM Product p
            LEFT JOIN Category c ON p.categoryId = c.id
            LEFT JOIN SubCategory s ON p.subCategoryId = s.id
            ORDER BY p.createdAt DESC`);
        res.json(products.map(p => {
            const parsed = parseProduct(p);
            return {
                ...parsed,
                category: { id: parsed.categoryId, name: parsed.catName },
                subCategory: parsed.subCategoryId ? { id: parsed.subCategoryId, name: parsed.subName } : null,
            };
        }));
    } catch {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

router.post('/products', authenticateToken, upload.fields([{ name: 'imageUrl', maxCount: 1 }, { name: 'images', maxCount: 5 }]), async (req, res) => {
    const {
        name, price, originalPrice, categoryId, subCategoryId,
        isNewArrival, description, fullDescription, stock,
        sizes, colors, sizeChartId, sizeStock, isFreeShipping, measurementGroups,
    } = req.body;
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    let mainImageUrl = req.body.imageUrl || '';
    if (req.files['imageUrl']?.[0]) mainImageUrl = `${baseUrl}/uploads/${req.files['imageUrl'][0].filename}`;

    let additionalImages = req.body.existingImages
        ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages])
        : [];
    if (req.files['images']) {
        additionalImages = [...additionalImages, ...req.files['images'].map(f => `${baseUrl}/uploads/${f.filename}`)];
    }

    try {
        const [result] = await db.query(`
            INSERT INTO Product
            (name, price, originalPrice, imageUrl, categoryId, subCategoryId, isNewArrival, description, fullDescription, images, stock, sizes, colors, sizeChartId, sizeStock, isFreeShipping, measurementGroups)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                parseFloat(price) || 0,
                originalPrice ? parseFloat(originalPrice) : null,
                mainImageUrl,
                categoryId,
                subCategoryId || null,
                (isNewArrival === 'true' || isNewArrival === true) ? 1 : 0,
                description,
                fullDescription || '',
                JSON.stringify(additionalImages),
                parseInt(stock) || 0,
                JSON.stringify(sizes ? (Array.isArray(sizes) ? sizes : sizes.split(',')) : []),
                JSON.stringify(colors ? (Array.isArray(colors) ? colors : colors.split(',')) : []),
                sizeChartId || null,
                sizeStock ? (typeof sizeStock === 'string' ? sizeStock : JSON.stringify(sizeStock)) : null,
                (isFreeShipping === 'true' || isFreeShipping === true) ? 1 : 0,
                JSON.stringify(normalizeGroups(measurementGroups)),
            ]
        );
        const product = await getProductWithDetails(result.insertId);
        res.json(product);
    } catch (error) {
        console.error('Create Product Error:', error);
        res.status(500).json({ error: 'Failed to create product', details: error.message });
    }
});

router.put('/products/:id', authenticateToken, upload.fields([{ name: 'imageUrl', maxCount: 1 }, { name: 'images', maxCount: 5 }]), async (req, res) => {
    const { id } = req.params;
    const {
        name, price, originalPrice, categoryId, subCategoryId,
        isNewArrival, description, fullDescription, stock,
        sizes, colors, sizeChartId, sizeStock, isFreeShipping, measurementGroups,
    } = req.body;
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    let mainImageUrl = req.body.imageUrl || '';
    if (req.files['imageUrl']?.[0]) mainImageUrl = `${baseUrl}/uploads/${req.files['imageUrl'][0].filename}`;

    let finalImages = req.body.existingImages
        ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages])
        : [];
    if (req.files['images']) {
        finalImages = [...finalImages, ...req.files['images'].map(f => `${baseUrl}/uploads/${f.filename}`)];
    }

    try {
        let query = `UPDATE Product SET name=?, price=?, originalPrice=?, categoryId=?, subCategoryId=?, isNewArrival=?, description=?, fullDescription=?, images=?, stock=?, sizes=?, colors=?, sizeChartId=?, sizeStock=?, isFreeShipping=?, measurementGroups=?`;
        const params = [
            name,
            parseFloat(price) || 0,
            originalPrice ? parseFloat(originalPrice) : null,
            categoryId,
            subCategoryId || null,
            (isNewArrival === 'true' || isNewArrival === true) ? 1 : 0,
            description,
            fullDescription || '',
            JSON.stringify(finalImages),
            parseInt(stock) || 0,
            JSON.stringify(sizes ? (Array.isArray(sizes) ? sizes : sizes.split(',')) : []),
            JSON.stringify(colors ? (Array.isArray(colors) ? colors : colors.split(',')) : []),
            sizeChartId || null,
            sizeStock ? (typeof sizeStock === 'string' ? sizeStock : JSON.stringify(sizeStock)) : null,
            (isFreeShipping === 'true' || isFreeShipping === true) ? 1 : 0,
            JSON.stringify(normalizeGroups(measurementGroups)),
        ];

        if (mainImageUrl) { query += ', imageUrl=?'; params.push(mainImageUrl); }
        query += ' WHERE id=?';
        params.push(id);

        await db.query(query, params);
        const [rows] = await db.query('SELECT * FROM Product WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Update Product Error:', error);
        res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
});

router.delete('/products/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM Product WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

export default router;

import { Router } from 'express';
import db from '../db.js';
import { baseUrl, STATIC_PAGES } from '../utils/seo.js';

// robots.txt and sitemap.xml. Mounted at the app root (not under /api) in app.js,
// before the static/SPA fallback, so crawlers find them at the conventional URLs.

const router = Router();

router.get('/robots.txt', (req, res) => {
    const base = baseUrl(req);
    res.type('text/plain').send([
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /login',
        'Disallow: /checkout',
        'Disallow: /account',
        'Disallow: /search',
        'Disallow: /api/',
        '',
        `Sitemap: ${base}/sitemap.xml`,
        '',
    ].join('\n'));
});

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

router.get('/sitemap.xml', async (req, res) => {
    const base = baseUrl(req);
    try {
        const [products] = await db.query('SELECT id, createdAt FROM Product ORDER BY id');
        const [categories] = await db.query('SELECT id FROM Category ORDER BY id');
        const [subCategories] = await db.query('SELECT id FROM SubCategory ORDER BY id');

        const urls = [];
        const add = (path, lastmod) => urls.push({ loc: `${base}${path}`, lastmod });

        Object.keys(STATIC_PAGES).forEach((path) => add(path === '/' ? '/' : path));
        categories.forEach((c) => add(`/category/${c.id}`));
        subCategories.forEach((s) => add(`/subcategory/${s.id}`));
        products.forEach((p) => add(
            `/products/${p.id}`,
            p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : undefined
        ));

        const body = urls.map(({ loc, lastmod }) =>
            `  <url><loc>${xmlEsc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
        ).join('\n');

        res.type('application/xml').send(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
        );
    } catch (err) {
        console.error('sitemap generation failed:', err);
        res.status(500).type('text/plain').send('Sitemap unavailable');
    }
});

export default router;

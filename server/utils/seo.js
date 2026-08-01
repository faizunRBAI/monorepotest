import db from '../db.js';

// Server-side SEO: link-preview bots (Facebook, WhatsApp, Telegram) and first-pass
// crawlers never execute the SPA's JavaScript, so the meta tags they see are whatever
// is in the HTML we send. buildRouteMeta() produces per-route tags that app.js injects
// into client/dist/index.html before serving. Keep the copy in sync with
// client/src/utils/seo.js, which handles the same tags for in-app navigation.

const SITE_NAME = 'Gorur Gari';
const DEFAULT_DESCRIPTION =
    'Shop the latest collections at Gorur Gari. Quality clothing and fashion in Bangladesh with nationwide home delivery, easy returns and secure payment.';

export const STATIC_PAGES = {
    '/': { title: null, description: DEFAULT_DESCRIPTION },
    '/terms': { title: 'Terms & Conditions', description: 'Read the terms and conditions for shopping at Gorur Gari.' },
    '/privacy': { title: 'Privacy Policy', description: 'How Gorur Gari collects, uses and protects your personal information.' },
    '/cancellation': { title: 'Cancellation & Returns', description: 'Gorur Gari cancellation, return and refund policy.' },
    '/faqs': { title: 'FAQs', description: 'Frequently asked questions about ordering, delivery and payments at Gorur Gari.' },
    '/free-delivery': { title: 'Free Delivery Products', description: 'Browse products with free home delivery at Gorur Gari.' },
};

const NOINDEX_PREFIXES = ['/checkout', '/account', '/login', '/admin', '/search'];

// Public origin for absolute URLs (canonical, og:image, sitemap). SITE_URL wins when
// set; otherwise it's derived from the request, which is correct behind the trusted
// proxy configured in app.js.
export const baseUrl = (req) =>
    (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const absolute = (base, url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return base + (url.startsWith('/') ? url : `/${url}`);
};

// Plain-text summary for meta descriptions: strip tags, collapse whitespace, cap length.
const summarize = (text, max = 160) => {
    const plain = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return null;
    return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
};

const priceNumber = (price) => {
    const n = parseFloat(String(price ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
};

// JSON columns arrive parsed on MySQL but as strings on MariaDB (see db.js typeCast).
const parseJson = (value, fallback) => {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
};

const metaTags = ({ base, title, description, path, image, type = 'website', noindex = false, jsonLd = null }) => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Online Shopping in Bangladesh`;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = base + path;
    const img = absolute(base, image);

    const lines = [
        `<meta property="og:title" content="${esc(fullTitle)}" />`,
        `<meta property="og:description" content="${esc(desc)}" />`,
        `<meta property="og:url" content="${esc(url)}" />`,
        `<meta property="og:type" content="${esc(type)}" />`,
        `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />`,
        `<meta name="twitter:title" content="${esc(fullTitle)}" />`,
        `<meta name="twitter:description" content="${esc(desc)}" />`,
    ];
    if (img) {
        lines.push(`<meta property="og:image" content="${esc(img)}" />`);
        lines.push(`<meta name="twitter:image" content="${esc(img)}" />`);
    }
    if (noindex) {
        lines.push('<meta name="robots" content="noindex, nofollow" />');
    } else {
        lines.push(`<link rel="canonical" href="${esc(url)}" />`);
    }
    if (jsonLd) {
        // </script> inside a JSON string would end the tag early; escape the slash.
        lines.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\//g, '<\\/')}</script>`);
    }

    return { title: fullTitle, description: desc, block: lines.join('\n  ') };
};

const productMeta = async (base, id) => {
    const [rows] = await db.query(
        'SELECT id, name, description, fullDescription, price, imageUrl, images, stock, sizeStock FROM Product WHERE id = ?',
        [id]
    );
    if (rows.length === 0) return null;
    const p = rows[0];

    const [[agg]] = await db.query(
        'SELECT COUNT(*) AS reviewCount, AVG(rating) AS avgRating FROM Review WHERE productId = ?',
        [id]
    );

    const images = parseJson(p.images, []);
    const sizeStock = parseJson(p.sizeStock, {});
    const inStock = p.stock > 0 || Object.values(sizeStock).some((v) => Number(v) > 0);
    const price = priceNumber(p.price);
    const description = summarize(p.description || p.fullDescription);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        image: [p.imageUrl, ...images].filter(Boolean).map((u) => absolute(base, u)),
        ...(description ? { description } : {}),
        ...(price !== null ? {
            offers: {
                '@type': 'Offer',
                url: `${base}/products/${p.id}`,
                priceCurrency: 'BDT',
                price,
                availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            },
        } : {}),
        ...(agg.reviewCount > 0 ? {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Math.round(agg.avgRating * 10) / 10,
                reviewCount: agg.reviewCount,
            },
        } : {}),
    };

    return metaTags({
        base,
        title: p.name,
        description,
        path: `/products/${p.id}`,
        image: p.imageUrl,
        type: 'product',
        jsonLd,
    });
};

const categoryMeta = async (base, path, id, isSub) => {
    const [rows] = await db.query(
        isSub ? 'SELECT name FROM SubCategory WHERE id = ?' : 'SELECT name, imageUrl FROM Category WHERE id = ?',
        [id]
    );
    if (rows.length === 0) return null;
    const { name, imageUrl } = rows[0];

    return metaTags({
        base,
        title: name,
        description: `Shop ${name} at ${SITE_NAME}. Quality products with nationwide home delivery across Bangladesh.`,
        path,
        image: imageUrl || null,
    });
};

/**
 * Build the SEO tags for a storefront route, or null when the default index.html
 * should be served untouched. DB errors are the caller's problem to swallow — a
 * failed lookup must never take down page serving.
 */
export async function buildRouteMeta(req) {
    const path = req.path.replace(/\/+$/, '') || '/';
    const base = baseUrl(req);

    if (NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        return metaTags({ base, title: null, path, noindex: true });
    }

    const productMatch = path.match(/^\/products\/(\d+)$/);
    if (productMatch) return productMeta(base, productMatch[1]);

    const categoryMatch = path.match(/^\/(category|subcategory)\/(\d+)$/);
    if (categoryMatch) return categoryMeta(base, path, categoryMatch[2], categoryMatch[1] === 'subcategory');

    if (STATIC_PAGES[path]) {
        const page = STATIC_PAGES[path];
        const jsonLd = path === '/' ? {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: `${base}/`,
            potentialAction: {
                '@type': 'SearchAction',
                target: `${base}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
            },
        } : null;
        return metaTags({ base, title: page.title, description: page.description, path, jsonLd });
    }

    return null;
}

/**
 * Inject route meta into the built index.html: swap <title> and the meta
 * description in place, then add the rest of the tags before </head>.
 */
export function injectMeta(html, meta) {
    return html
        .replace(/<title>[^<]*<\/title>/i, `<title>${esc(meta.title)}</title>`)
        .replace(/<meta\s+name="description"[^>]*\/?>/i, `<meta name="description" content="${esc(meta.description)}" />`)
        .replace('</head>', `  ${meta.block}\n</head>`);
}

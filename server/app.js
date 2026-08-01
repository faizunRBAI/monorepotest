import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { apiLimiter } from './middleware/rateLimiters.js';
import authRoutes from './routes/auth.js';
import bannerRoutes from './routes/banners.js';
import categoryRoutes from './routes/categories.js';
import sizeChartRoutes from './routes/sizeCharts.js';
import productRoutes from './routes/products.js';
import reviewRoutes from './routes/reviews.js';
import orderRoutes from './routes/orders.js';
import voucherRoutes from './routes/vouchers.js';
import popupAdRoutes from './routes/popupAds.js';
import siteSettingsRoutes from './routes/siteSettings.js';
import adminRoutes from './routes/admins.js';
import customerRoutes from './routes/customers.js';
import uploadRoutes from './routes/upload.js';
import seoRoutes from './routes/seo.js';
import { buildRouteMeta, injectMeta } from './utils/seo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();

// Trust one proxy hop (nginx, load balancer, etc.) so req.ip is the real client IP
// Without this, every request looks like it comes from 127.0.0.1 and rate limits
// are shared across ALL users, causing false lockouts.
app.set('trust proxy', 1);

// --- Security & Parsing ---
// Tag Manager and the ad pixels it loads are third-party scripts, so helmet's default
// `script-src 'self'` blocks them outright — including the inline container snippet.
// These allowlists are the minimum GTM, Meta Pixel and Google Ads/GA4 need. To add
// another ad network later (TikTok, Snap), add its script host to TAG_SCRIPT_HOSTS and
// its beacon host to TAG_CONNECT_HOSTS.
const TAG_SCRIPT_HOSTS = [
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://www.googleadservices.com',
    'https://googleads.g.doubleclick.net',
    'https://connect.facebook.net',
];

const TAG_CONNECT_HOSTS = [
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://analytics.google.com',
    'https://*.analytics.google.com',
    'https://*.google-analytics.com',
    'https://stats.g.doubleclick.net',
    'https://connect.facebook.net',
    'https://www.facebook.com',
    'https://graph.facebook.com',
];

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            // 'unsafe-inline' is what GTM requires: the container snippet is inline, and
            // any Custom HTML tag created in the GTM UI injects inline script too. The
            // nonce alternative can't work here because GTM writes those tags at runtime.
            scriptSrc: ["'self'", "'unsafe-inline'", ...TAG_SCRIPT_HOSTS],
            connectSrc: ["'self'", ...TAG_CONNECT_HOSTS],
            // Tracking pixels are 1x1 images served from many rotating ad hosts, and an
            // image can't execute, so this is the one directive worth leaving broad.
            imgSrc: ["'self'", 'data:', 'https:'],
            frameSrc: ["'self'", 'https://www.googletagmanager.com', 'https://td.doubleclick.net', 'https://bid.g.doubleclick.net', 'https://www.facebook.com'],
            // GTM's Preview/Debug mode loads the site inside a tagassistant.google.com
            // frame; without this, previewing a container shows a blank page.
            frameAncestors: ["'self'", 'https://tagassistant.google.com'],
        },
    },
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:5000'];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    // The PDF routes name the download in Content-Disposition. Without exposing it, the
    // browser hides the header from JS on cross-origin dev requests (5173 -> 5000) and
    // the saved file would fall back to a generic name.
    exposedHeaders: ['Content-Disposition'],
}));

app.use(express.json({ limit: '2mb' }));

// --- Static Uploads ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- API Rate Limiting & Routes ---
app.use('/api', apiLimiter);
app.use('/api', authRoutes);
app.use('/api', bannerRoutes);
app.use('/api', categoryRoutes);
app.use('/api', sizeChartRoutes);
app.use('/api', productRoutes);
app.use('/api', reviewRoutes);
app.use('/api', orderRoutes);
app.use('/api', voucherRoutes);
app.use('/api', popupAdRoutes);
app.use('/api', siteSettingsRoutes);
app.use('/api', adminRoutes);
app.use('/api', customerRoutes);
app.use('/api', uploadRoutes);

// --- SEO: robots.txt + sitemap.xml (before static so they can't be shadowed) ---
app.use(seoRoutes);

// --- SPA Fallback: Serve React Build ---
const distPath = path.join(__dirname, '../client/dist');
app.use('/assets', express.static(path.join(distPath, 'assets')));
// index: false — '/' must fall through to the fallback below so it gets SEO meta
// injected instead of being served as a bare directory index.
app.use(express.static(distPath, { index: false }));

app.get('*', async (req, res) => {
    const indexFile = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexFile)) {
        return res.status(500).send('Frontend build not found. Run npm run build.');
    }

    // Link-preview bots (Facebook, WhatsApp) and crawlers don't run the SPA's JS,
    // so inject route-specific meta tags (title, og:*, JSON-LD) into the HTML here.
    // Any failure falls back to the untouched index.html — SEO must never block serving.
    try {
        const meta = await buildRouteMeta(req);
        if (meta) {
            const html = fs.readFileSync(indexFile, 'utf8');
            return res.type('html').send(injectMeta(html, meta));
        }
    } catch (err) {
        console.error('SEO meta injection failed:', err.message);
    }

    res.sendFile(indexFile);
});

export default app;

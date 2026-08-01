import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 100 : 10,    // Relaxed in dev so testing multiple browsers doesn't lock you out
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Use a stable key — falls back to req.ip which is correct once trust proxy is set
    keyGenerator: (req) => req.ip,
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1 minute window
    max: isDev ? 2000 : 500,   // 500 req/min per IP in production (was 200 total)
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    skip: (req) => req.method === 'GET', // Don't rate-limit read-only requests
});

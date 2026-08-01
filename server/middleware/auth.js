import jwt from 'jsonwebtoken';

// Admin and customer tokens are signed with the same secret, so a valid signature
// proves nothing about *which* kind of account is calling. The payload is the only
// discriminator: admins carry { username, role: 'admin' }, customers carry
// { id, email }. Without an audience check any logged-in customer's token opened
// every admin endpoint — the full order list, every customer's name/phone/address,
// and product/category/voucher writes.
const authenticate = (req, res, next, isAllowed) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) return res.sendStatus(403);
        if (!payload || !isAllowed(payload)) return res.sendStatus(403);
        req.user = payload;
        next();
    });
};

// Admin-only routes.
export const authenticateToken = (req, res, next) =>
    authenticate(req, res, next, payload => payload.role === 'admin');

// Customer-only routes — an admin token has no customer id to act on.
export const authenticateCustomer = (req, res, next) =>
    authenticate(req, res, next, payload => Boolean(payload.id));

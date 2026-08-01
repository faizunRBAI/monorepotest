import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticateToken, authenticateCustomer } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiters.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../utils/mailer.js';

const router = Router();
const BCRYPT_ROUNDS = 10;

// --- Customer Auth ---

router.post('/customer/signup', loginLimiter, async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const normalizedEmail = email.trim().toLowerCase();
    try {
        // If account exists but unverified, allow resending OTP
        const [existing] = await db.query('SELECT id, emailVerified FROM Customer WHERE email = ?', [normalizedEmail]);
        if (existing.length > 0) {
            if (existing[0].emailVerified) return res.status(400).json({ error: 'Email already registered.' });
            // Resend OTP for unverified account
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            const expiry = new Date(Date.now() + 10 * 60 * 1000);
            await db.query('UPDATE Customer SET emailOtp=?, emailOtpExpiry=? WHERE id=?', [otp, expiry, existing[0].id]);
            await sendOtpEmail(normalizedEmail, otp, name.trim());
            return res.json({ needsVerification: true, email: normalizedEmail });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await db.query(
            'INSERT INTO Customer (name, email, password, phone, emailVerified, emailOtp, emailOtpExpiry) VALUES (?, ?, ?, ?, 0, ?, ?)',
            [name.trim(), normalizedEmail, hashedPassword, phone || null, otp, expiry]
        );

        await sendOtpEmail(normalizedEmail, otp, name.trim());
        res.json({ needsVerification: true, email: normalizedEmail });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already registered.' });
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Signup failed. Please try again.' });
    }
});

router.post('/customer/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and code are required.' });
    try {
        const [rows] = await db.query(
            'SELECT * FROM Customer WHERE email = ? AND emailVerified = 0',
            [email.trim().toLowerCase()]
        );
        const customer = rows[0];
        if (!customer) return res.status(400).json({ error: 'Account not found or already verified.' });
        if (customer.emailOtp !== String(otp).trim()) return res.status(400).json({ error: 'Incorrect code. Please try again.' });
        if (new Date() > new Date(customer.emailOtpExpiry)) return res.status(400).json({ error: 'Code expired. Please sign up again to get a new code.' });

        await db.query('UPDATE Customer SET emailVerified=1, emailOtp=NULL, emailOtpExpiry=NULL WHERE id=?', [customer.id]);

        const token = jwt.sign({ id: customer.id, email: customer.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const { password, emailOtp, emailOtpExpiry, ...data } = customer;
        res.json({ token, customer: { ...data, emailVerified: 1 } });
    } catch {
        res.status(500).json({ error: 'Verification failed.' });
    }
});

router.post('/customer/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    try {
        const [rows] = await db.query('SELECT * FROM Customer WHERE email = ?', [email.trim().toLowerCase()]);
        const customer = rows[0];
        if (!customer) return res.status(401).json({ error: 'Invalid credentials' });

        let valid = false;
        if (customer.password.startsWith('$2')) {
            valid = await bcrypt.compare(password, customer.password);
        } else {
            valid = customer.password === password;
            if (valid) {
                const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
                await db.query('UPDATE Customer SET password = ? WHERE id = ?', [hash, customer.id]);
            }
        }

        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        if (!customer.emailVerified) return res.status(403).json({ error: 'Please verify your email before logging in.', needsVerification: true, email: customer.email });

        const token = jwt.sign({ id: customer.id, email: customer.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const { password: _, emailOtp: __, emailOtpExpiry: ___, ...data } = customer;
        res.json({ token, customer: data });
    } catch {
        res.status(500).json({ error: 'Login failed' });
    }
});

router.put('/customer/profile', authenticateCustomer, async (req, res) => {
    const { name, phone, address, city, zip, location } = req.body;
    try {
        await db.query(
            'UPDATE Customer SET name=?, phone=?, address=?, city=?, zip=?, location=? WHERE id=?',
            [name, phone, address, city, zip, location, req.user.id]
        );
        const [rows] = await db.query('SELECT * FROM Customer WHERE id = ?', [req.user.id]);
        const { password, ...data } = rows[0];
        res.json(data);
    } catch {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

router.post('/customer/change-password', authenticateCustomer, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    try {
        const [rows] = await db.query('SELECT * FROM Customer WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const customer = rows[0];

        let valid = false;
        if (customer.password.startsWith('$2')) {
            valid = await bcrypt.compare(currentPassword, customer.password);
        } else {
            valid = customer.password === currentPassword;
        }
        if (!valid) return res.status(400).json({ error: 'Incorrect current password' });

        const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query('UPDATE Customer SET password = ? WHERE id = ?', [newHash, req.user.id]);
        res.json({ message: 'Password updated successfully' });
    } catch {
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// --- Forgot / Reset Password ---

router.post('/customer/forgot-password', loginLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    try {
        const [rows] = await db.query('SELECT id, name, emailVerified FROM Customer WHERE email = ?', [email.trim().toLowerCase()]);
        // Always return success to avoid email enumeration
        if (rows.length === 0 || !rows[0].emailVerified) return res.json({ success: true });

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        await db.query('UPDATE Customer SET resetOtp=?, resetOtpExpiry=? WHERE id=?', [otp, expiry, rows[0].id]);
        await sendPasswordResetEmail(email.trim().toLowerCase(), otp, rows[0].name);
        res.json({ success: true });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to send reset email.' });
    }
});

router.post('/customer/verify-reset-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and code required.' });
    try {
        const [rows] = await db.query('SELECT resetOtp, resetOtpExpiry FROM Customer WHERE email = ?', [email.trim().toLowerCase()]);
        if (!rows[0]) return res.status(400).json({ error: 'Account not found.' });
        if (rows[0].resetOtp !== String(otp).trim()) return res.status(400).json({ error: 'Incorrect code.' });
        if (new Date() > new Date(rows[0].resetOtpExpiry)) return res.status(400).json({ error: 'Code expired. Please request a new one.' });
        res.json({ valid: true });
    } catch { res.status(500).json({ error: 'Verification failed.' }); }
});

router.post('/customer/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
        const [rows] = await db.query('SELECT * FROM Customer WHERE email = ?', [email.trim().toLowerCase()]);
        const customer = rows[0];
        if (!customer) return res.status(400).json({ error: 'Account not found.' });
        if (customer.resetOtp !== String(otp).trim()) return res.status(400).json({ error: 'Incorrect code.' });
        if (new Date() > new Date(customer.resetOtpExpiry)) return res.status(400).json({ error: 'Code expired. Please request a new one.' });

        const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query('UPDATE Customer SET password=?, resetOtp=NULL, resetOtpExpiry=NULL WHERE id=?', [hash, customer.id]);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Password reset failed.' });
    }
});

// --- Admin: Customer Management ---

router.get('/customers', authenticateToken, async (_req, res) => {
    try {
        const [customers] = await db.query(`
            SELECT c.id, c.name, c.email, c.phone, c.location, c.address, c.city, c.zip,
                   COUNT(o.id) as orderCount
            FROM Customer c
            LEFT JOIN \`Order\` o ON c.id = o.customerId
            GROUP BY c.id`);
        res.json(customers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

router.get('/customers/:id/details', authenticateToken, async (req, res) => {
    try {
        const [customers] = await db.query('SELECT * FROM Customer WHERE id = ?', [req.params.id]);
        if (customers.length === 0) return res.status(404).json({ error: 'Customer not found' });
        const customer = customers[0];

        const [orders] = await db.query(
            'SELECT * FROM `Order` WHERE customerId = ? ORDER BY createdAt DESC',
            [customer.id]
        );

        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const [allItems] = await db.query(`
                SELECT oi.*, p.name as productName, p.imageUrl
                FROM OrderItem oi
                JOIN Product p ON oi.productId = p.id
                WHERE oi.orderId IN (?)`, [orderIds]);

            const itemsByOrder = {};
            for (const item of allItems) {
                if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
                itemsByOrder[item.orderId].push({ ...item, product: { name: item.productName, imageUrl: item.imageUrl } });
            }
            for (const order of orders) order.items = itemsByOrder[order.id] || [];
        }

        const [reviews] = await db.query(`
            SELECT r.*, p.name as productName
            FROM Review r
            JOIN Product p ON r.productId = p.id
            WHERE r.customerId = ?`, [customer.id]);

        res.json({ customer, orders, reviews });
    } catch {
        res.status(500).json({ error: 'Failed to fetch customer details' });
    }
});

export default router;

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken, authenticateCustomer } from '../middleware/auth.js';
import {
    sanitizeMeasurements, normalizeGroups, missingMeasurements, MEASUREMENT_FIELDS,
} from '../utils/measurements.js';
import { createDocument, buildOrderPdf, buildStatementPdf, orderPdfFileName } from '../utils/pdf.js';
import { orderNumberPrefix, formatOrderNumber, PREFIX_LENGTH } from '../utils/orderNumber.js';

const router = Router();
const PHONE_REGEX = /^\+?\d+$/;
const PAYMENT_METHOD = 'MFS';

const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));

// CSV cell: quote everything, double any internal quotes, and defuse values a spreadsheet
// would treat as a formula.
const csvCell = (value) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
};

const parseMeasurements = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return null; }
};

const loadSettings = async () => {
    const [rows] = await db.query('SELECT * FROM SiteSettings WHERE id = 1');
    return rows[0] || {};
};

const ORDER_SELECT = `
    SELECT o.*,
           COALESCE(c.name, o.guestName) as customerName,
           COALESCE(c.email, 'Guest') as customerEmail,
           COALESCE(c.phone, o.guestPhone) as customerPhone
    FROM \`Order\` o
    LEFT JOIN Customer c ON o.customerId = c.id`;

// Attaches the customer summary and the line items to a page of order rows. Items are
// fetched only for the orders in hand, so this stays cheap however large the table grows.
const attachItems = async (orders) => {
    if (orders.length === 0) return [];

    const [allItems] = await db.query(`
        SELECT oi.*, p.name as productName, p.imageUrl, p.measurementGroups
        FROM OrderItem oi JOIN Product p ON oi.productId = p.id
        WHERE oi.orderId IN (?)`, [orders.map(o => o.id)]);

    const itemsByOrder = {};
    for (const item of allItems) {
        if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
        itemsByOrder[item.orderId].push({
            ...item,
            // Normalised here so every consumer gets an object: MySQL returns a parsed
            // JSON column, MariaDB (where JSON is an alias for LONGTEXT) returns a string.
            measurements: parseMeasurements(item.measurements),
            // Carried through so a reorder knows which groups this product actually needs.
            measurementGroups: normalizeGroups(item.measurementGroups),
            product: { name: item.productName, imageUrl: item.imageUrl },
        });
    }

    return orders.map(o => ({
        ...o,
        customer: { name: o.customerName, email: o.customerEmail, phone: o.customerPhone },
        items: itemsByOrder[o.id] || [],
    }));
};

// Simple path for a customer's own orders and for single-order PDFs.
const loadOrders = async (where = '', params = []) => {
    const [orders] = await db.query(`${ORDER_SELECT} ${where} ORDER BY o.createdAt DESC`, params);
    return attachItems(orders);
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Every admin filter is applied in SQL rather than in the browser, so a 10k-row table is
// never shipped to the client just to be thrown away.
const buildFilters = ({ status, search, from, to, minAmount, maxAmount }) => {
    const where = [];
    const params = [];

    if (status && status !== 'All') { where.push('o.status = ?'); params.push(status); }
    // Inclusive of both endpoints; createdAt is DATETIME(3).
    if (DATE_RE.test(from || '')) { where.push('o.createdAt >= ?'); params.push(`${from} 00:00:00.000`); }
    if (DATE_RE.test(to || '')) { where.push('o.createdAt <= ?'); params.push(`${to} 23:59:59.999`); }
    if (minAmount !== undefined && minAmount !== '' && Number.isFinite(Number(minAmount))) {
        where.push('o.totalAmount >= ?'); params.push(Number(minAmount));
    }
    if (maxAmount !== undefined && maxAmount !== '' && Number.isFinite(Number(maxAmount))) {
        where.push('o.totalAmount <= ?'); params.push(Number(maxAmount));
    }
    if (search && String(search).trim()) {
        const like = `%${String(search).trim()}%`;
        where.push(`(o.orderNumber LIKE ?
                     OR CAST(o.id AS CHAR) LIKE ?
                     OR COALESCE(c.name, o.guestName) LIKE ?
                     OR c.email LIKE ?
                     OR COALESCE(c.phone, o.guestPhone) LIKE ?
                     OR o.voucherCode LIKE ?)`);
        params.push(like, like, like, like, like, like);
    }

    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

// Whitelisted so a sort parameter can never reach the SQL as free text.
const SORT_COLUMNS = {
    createdAt: 'o.createdAt',
    id: 'o.id',
    totalAmount: 'o.totalAmount',
    status: 'o.status',
    customer: 'customerName',
};
const MAX_PAGE_SIZE = 200;

const resolvePaging = ({ sort, dir, page, pageSize }) => ({
    column: SORT_COLUMNS[sort] || SORT_COLUMNS.createdAt,
    direction: String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC',
    page: Math.max(1, parseInt(page, 10) || 1),
    size: Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || 25)),
});

// Totals describe the whole matching set, not just the page on screen, so the admin can
// see what a filter actually selected.
const summarise = async (filters) => {
    const { sql, params } = buildFilters(filters);
    const [[totals]] = await db.query(`
        SELECT COUNT(*) AS count, COALESCE(SUM(o.totalAmount), 0) AS totalAmount
        FROM \`Order\` o LEFT JOIN Customer c ON o.customerId = c.id ${sql}`, params);

    // Status counts ignore the status filter itself, so the chips work as facets.
    const facet = buildFilters({ ...filters, status: 'All' });
    const [statusRows] = await db.query(`
        SELECT o.status, COUNT(*) AS n
        FROM \`Order\` o LEFT JOIN Customer c ON o.customerId = c.id ${facet.sql}
        GROUP BY o.status`, facet.params);

    return {
        count: Number(totals.count),
        totalAmount: Number(totals.totalAmount),
        statusCounts: Object.fromEntries(statusRows.map(r => [r.status, Number(r.n)])),
    };
};

const queryOrders = async (filters, paging) => {
    const { sql, params } = buildFilters(filters);
    const { column, direction, page, size } = resolvePaging(paging);
    const [rows] = await db.query(
        `${ORDER_SELECT} ${sql} ORDER BY ${column} ${direction}, o.id ${direction} LIMIT ? OFFSET ?`,
        [...params, size, (page - 1) * size]
    );
    return { orders: await attachItems(rows), page, pageSize: size };
};

// Exports cover every matching order rather than the current page, but stay bounded so a
// runaway filter cannot try to render an unlimited document.
const EXPORT_LIMITS = { pdf: 2000, csv: 50000 };

const fetchForExport = async (filters, kind) => {
    const { sql, params } = buildFilters(filters);
    const limit = EXPORT_LIMITS[kind];
    const [rows] = await db.query(
        `${ORDER_SELECT} ${sql} ORDER BY o.createdAt DESC LIMIT ?`, [...params, limit + 1]
    );
    const truncated = rows.length > limit;
    return { orders: await attachItems(rows.slice(0, limit)), truncated, limit };
};

const describeFilters = ({ status, search, from, to, minAmount, maxAmount }) => {
    const parts = [status && status !== 'All' ? `status: ${status}` : 'all statuses'];
    if (DATE_RE.test(from || '') || DATE_RE.test(to || '')) {
        parts.push(`dates: ${DATE_RE.test(from || '') ? from : 'any'} to ${DATE_RE.test(to || '') ? to : 'any'}`);
    }
    if (search) parts.push(`search: "${search}"`);
    if (minAmount) parts.push(`min ${minAmount} BDT`);
    if (maxAmount) parts.push(`max ${maxAmount} BDT`);
    return parts.join(', ');
};

const streamPdf = (res, filename, build) => {
    const doc = createDocument();
    res.setHeader('Content-Type', 'application/pdf');
    // A Bangla customer name cannot travel in a plain `filename=` (header values are
    // latin1), so send an ASCII-safe fallback plus the RFC 5987 UTF-8 form that every
    // current browser prefers.
    const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    doc.pipe(res);
    build(doc);
    doc.end();
};

router.post('/orders', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    const {
        items, totalAmount, shippingAddress, specialNote, guestName, guestPhone,
        voucherCode, discountAmount, shippingCost,
    } = req.body;

    let customerId = null;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Only a customer token identifies a buyer. An admin token verifies
            // against the same secret but carries no `id`, so it must not be read
            // as a customer — that produced an undefined customerId.
            if (decoded.id) customerId = decoded.id;
        } catch { /* expired or invalid — fall through to the guest details */ }
    }

    if (!customerId && (!guestName || !guestPhone)) {
        return res.status(400).json({ error: 'Name and phone number are required.' });
    }
    if (guestPhone && !PHONE_REGEX.test(guestPhone.trim())) {
        return res.status(400).json({ error: 'Phone number must contain only numbers and may start with +.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Your bag is empty.' });
    }

    // Items may sit in the bag without measurements, but an order cannot be confirmed
    // without them — the garment is cut to these numbers. Checked against what each
    // product declares, read from the database rather than trusted from the request.
    let requiredGroups;
    try {
        const [rows] = await db.query(
            'SELECT id, measurementGroups FROM Product WHERE id IN (?)',
            [items.map(i => i.id)]
        );
        requiredGroups = new Map(rows.map(r => [r.id, r.measurementGroups]));
    } catch (error) {
        console.error('Failed to load products for the order:', error);
        return res.status(500).json({ error: 'Failed to place order' });
    }

    for (const item of items) {
        const missing = missingMeasurements(item.measurements, requiredGroups.get(Number(item.id)));
        if (missing.length > 0) {
            return res.status(400).json({
                error: `Please provide all measurements before confirming your order. Missing: ${missing.join(', ')}.`,
            });
        }
    }

    // The daily sequence is derived from what is already stored, so two simultaneous
    // orders can pick the same number. The UNIQUE index rejects the loser, and we simply
    // try again with the next number rather than failing the customer's order.
    for (let attempt = 1; attempt <= ORDER_NUMBER_ATTEMPTS; attempt += 1) {
        const conn = await db.getConnection();
        try {
            const result = await placeOrder(conn, {
                customerId, guestName, guestPhone, items, totalAmount, discountAmount,
                shippingCost, shippingAddress, specialNote, voucherCode, requiredGroups,
            });
            return res.json(result);
        } catch (error) {
            await conn.rollback().catch(() => {});
            const isDuplicateNumber = error?.code === 'ER_DUP_ENTRY' && /orderNumber|uq_order_number/i.test(error.message || '');
            if (isDuplicateNumber && attempt < ORDER_NUMBER_ATTEMPTS) {
                console.warn(`Order number collision, retrying (attempt ${attempt})`);
                continue;
            }
            console.error('Failed to place order:', error);
            return res.status(500).json({ error: 'Failed to place order' });
        } finally {
            conn.release();
        }
    }
});

const ORDER_NUMBER_ATTEMPTS = 8;

// Allocates the next sequence for today.
//
// Reading MAX() and adding one is not enough on its own: two orders placed at the same
// instant both read the same maximum and then fight over one number. The bump below is a
// single atomic statement, so concurrent callers are serialised on the day's counter row
// and each is handed a distinct value. GREATEST also folds in any number that reached the
// Order table without going through the counter (a backfill, or a manual insert), so the
// counter can never hand out something already used.
const nextOrderNumber = async (conn, now) => {
    const prefix = orderNumberPrefix(now);

    const [[row]] = await conn.query(
        'SELECT MAX(CAST(SUBSTRING(orderNumber, ?) AS UNSIGNED)) AS maxSeq'
        + ' FROM `Order` WHERE orderNumber LIKE ?',
        [PREFIX_LENGTH + 1, `${prefix}%`]
    );
    const seenInOrders = Number(row.maxSeq) || 0;

    await conn.query(
        'INSERT INTO OrderSequence (dayKey, lastSequence) VALUES (?, LAST_INSERT_ID(?))'
        + ' ON DUPLICATE KEY UPDATE lastSequence = LAST_INSERT_ID(GREATEST(lastSequence, ?) + 1)',
        [prefix, seenInOrders + 1, seenInOrders]
    );
    const [[{ seq }]] = await conn.query('SELECT LAST_INSERT_ID() AS seq');

    return formatOrderNumber(now, Number(seq));
};

const placeOrder = async (conn, ctx) => {
    const {
        customerId, guestName, guestPhone, items, totalAmount, discountAmount,
        shippingCost, shippingAddress, specialNote, voucherCode, requiredGroups,
    } = ctx;

    await conn.beginTransaction();
    {
        // Prices are parsed once so the subtotal, the voucher maths and the stored
        // OrderItem rows can never disagree with each other.
        const lines = items.map(item => {
            const unitPrice = parseFloat(item.price?.toString().replace(/[^\d.]/g, ''));
            if (!Number.isFinite(unitPrice)) {
                throw new Error(`Unreadable price for product ${item.id}: ${item.price}`);
            }
            return { item, unitPrice, quantity: parseInt(item.quantity, 10) || 0 };
        });

        const itemsSubtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));

        // Delivery is kept out of the discount base entirely. Older clients did not send
        // shippingCost, so fall back to deriving it from the total they did send.
        const shipping = shippingCost !== undefined
            ? Math.max(0, round2(parseFloat(shippingCost) || 0))
            : Math.max(0, round2(parseFloat(totalAmount || 0) + parseFloat(discountAmount || 0) - itemsSubtotal));

        let appliedVoucherCode = null;
        let appliedDiscount = 0;

        if (voucherCode) {
            const [rows] = await conn.query(
                'SELECT * FROM Voucher WHERE code = ? AND isActive = 1',
                [voucherCode.trim().toUpperCase()]
            );
            if (rows.length > 0) {
                const v = rows[0];
                const claimOk = v.maxClaimsAllowed === null || v.totalClaimed < v.maxClaimsAllowed;
                const notExpired = !v.expiresAt || new Date(v.expiresAt) >= new Date();
                const meetsMinimum = itemsSubtotal >= Number(v.minOrderAmount || 0);
                if (claimOk && notExpired && meetsMinimum) {
                    appliedVoucherCode = v.code;
                    // Products only — a percentage never touches delivery, and a fixed
                    // amount cannot exceed the product value.
                    appliedDiscount = v.discountType === 'percentage'
                        ? round2((itemsSubtotal * v.discountValue) / 100)
                        : round2(Math.min(v.discountValue, itemsSubtotal));
                    await conn.query('UPDATE Voucher SET totalClaimed = totalClaimed + 1 WHERE id = ?', [v.id]);
                }
            }
        }

        // Discount comes off the products, then delivery is added at full price.
        const verifiedTotal = round2(Math.max(0, round2(itemsSubtotal - appliedDiscount)) + shipping);

        // Lets a guest re-download their slip later without an account, and keeps the
        // link unguessable.
        const slipToken = crypto.randomBytes(24).toString('hex');
        const now = new Date();
        const orderNumber = await nextOrderNumber(conn, now);

        const [orderRes] = await conn.query(
            'INSERT INTO `Order` (customerId, guestName, guestPhone, totalAmount, discountAmount, voucherCode, status, shippingAddress, specialNote, paymentMethod, orderNumber, slipToken, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                customerId,
                customerId ? null : guestName,
                customerId ? null : guestPhone,
                verifiedTotal, appliedDiscount, appliedVoucherCode,
                'Pending', shippingAddress, specialNote, PAYMENT_METHOD, orderNumber, slipToken,
                // Stored explicitly so the row's date can never disagree with the date
                // encoded in its order number (e.g. an order placed at midnight).
                now,
            ]
        );

        for (const { item, unitPrice, quantity } of lines) {
            // Bound to what the product declares, so a kameez-only item cannot store
            // pajama values even if the request contains them.
            const measurements = sanitizeMeasurements(item.measurements, requiredGroups.get(Number(item.id)));
            await conn.query(
                'INSERT INTO OrderItem (orderId, productId, quantity, price, selectedSize, selectedColor, measurements) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    orderRes.insertId, item.id, quantity, unitPrice,
                    item.selectedSize, item.selectedColor,
                    measurements ? JSON.stringify(measurements) : null,
                ]
            );
        }

        await conn.commit();
        return {
            id: orderRes.insertId,
            orderNumber,
            totalAmount: verifiedTotal,
            status: 'Pending',
            paymentMethod: PAYMENT_METHOD,
            slipToken,
        };
    }
};

router.get('/orders/mine', authenticateCustomer, async (req, res) => {
    try {
        const orders = await loadOrders('WHERE o.customerId = ?', [req.user.id]);
        res.json(orders);
    } catch (error) {
        console.error('Failed to fetch customer orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Must be declared before '/orders/:id/...' style routes are consulted for two-segment
// paths; kept adjacent to the admin list for clarity.
router.get('/orders/statement.pdf', authenticateToken, async (req, res) => {
    try {
        const { orders, truncated, limit } = await fetchForExport(req.query, 'pdf');
        const settings = await loadSettings();

        let filterSummary = describeFilters(req.query);
        // Never let a cap pass silently — the document says so on its face.
        if (truncated) filterSummary += ` — showing the ${limit} most recent matches only; narrow the filters or use the CSV export`;

        streamPdf(res, `order-statement-${new Date().toISOString().slice(0, 10)}.pdf`, (doc) =>
            buildStatementPdf(doc, { orders, settings, filterSummary }));
    } catch (error) {
        console.error('Failed to build statement:', error);
        res.status(500).json({ error: 'Failed to build statement' });
    }
});

// One row per order item, so measurements land in their own columns. Practical for the
// volumes a PDF cannot handle.
router.get('/orders/export.csv', authenticateToken, async (req, res) => {
    try {
        const { orders, truncated, limit } = await fetchForExport(req.query, 'csv');

        const headers = [
            'Order ID', 'Date', 'Status', 'Customer', 'Phone', 'Email', 'Address',
            'Payment', 'Voucher', 'Discount (BDT)', 'Order Total (BDT)',
            'Product', 'Quantity', 'Unit Price (BDT)', 'Line Total (BDT)',
            ...MEASUREMENT_FIELDS.map(f => `${f.groupEn} - ${f.en} (in)`),
            'Special Note',
        ];

        const rows = [headers];
        for (const o of orders) {
            const base = [
                o.orderNumber || o.id,
                o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
                o.status, o.customer?.name || '', o.customer?.phone || '', o.customer?.email || '',
                o.shippingAddress || '', o.paymentMethod || '', o.voucherCode || '',
                Number(o.discountAmount || 0).toFixed(2), Number(o.totalAmount || 0).toFixed(2),
            ];
            const items = o.items.length > 0 ? o.items : [null];
            for (const item of items) {
                rows.push([
                    ...base,
                    item?.product?.name || '',
                    item?.quantity ?? '',
                    item ? Number(item.price || 0).toFixed(2) : '',
                    item ? (Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2) : '',
                    ...MEASUREMENT_FIELDS.map(f => item?.measurements?.[f.key] ?? ''),
                    o.specialNote || '',
                ]);
            }
        }
        if (truncated) rows.push([`NOTE: capped at the ${limit} most recent matching orders. Narrow the filters to export the rest.`]);

        const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        // Leading BOM so Excel reads the UTF-8 (Bangla names) correctly. Written as an
        // escape rather than a literal so it stays visible in the source.
        res.send('\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'));
    } catch (error) {
        console.error('Failed to export orders:', error);
        res.status(500).json({ error: 'Failed to export orders' });
    }
});

router.get('/orders', authenticateToken, async (req, res) => {
    try {
        const [{ orders, page, pageSize }, summary] = await Promise.all([
            queryOrders(req.query, req.query),
            summarise(req.query),
        ]);
        res.json({
            orders,
            page,
            pageSize,
            total: summary.count,
            totalPages: Math.max(1, Math.ceil(summary.count / pageSize)),
            summary,
        });
    } catch (error) {
        console.error('Failed to fetch orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Admin copy of a single order.
router.get('/orders/:id/invoice.pdf', authenticateToken, async (req, res) => {
    try {
        const [order] = await loadOrders('WHERE o.id = ?', [req.params.id]);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const settings = await loadSettings();
        streamPdf(res, orderPdfFileName(order, 'invoice'), (doc) =>
            buildOrderPdf(doc, { order, settings, variant: 'invoice' }));
    } catch (error) {
        console.error('Failed to build invoice:', error);
        res.status(500).json({ error: 'Failed to build invoice' });
    }
});

// Customer slip. The per-order slipToken is the credential, so a guest with no account
// can download (and re-download) their own receipt and nobody else's.
router.get('/orders/:id/slip.pdf', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'A slip token is required.' });
    try {
        const [order] = await loadOrders('WHERE o.id = ?', [req.params.id]);
        if (!order || !order.slipToken || order.slipToken !== token) {
            return res.status(404).json({ error: 'Order slip not found' });
        }
        const settings = await loadSettings();
        streamPdf(res, orderPdfFileName(order, 'slip'), (doc) =>
            buildOrderPdf(doc, { order, settings, variant: 'slip' }));
    } catch (error) {
        console.error('Failed to build slip:', error);
        res.status(500).json({ error: 'Failed to build slip' });
    }
});

router.put('/orders/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE `Order` SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Order status updated' });
    } catch (error) {
        console.error('Failed to update order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

router.post('/orders/:id/cancel', authenticateCustomer, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const [orders] = await db.query('SELECT * FROM `Order` WHERE id = ? AND customerId = ?', [id, req.user.id]);
        if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
        if (orders[0].status !== 'Pending') return res.status(400).json({ error: 'Only pending orders can be cancelled' });
        await db.query(
            'UPDATE `Order` SET status = ?, cancellationReason = ? WHERE id = ?',
            ['Cancellation Requested', reason, id]
        );
        res.json({ message: 'Cancellation requested' });
    } catch (error) {
        console.error('Failed to cancel order:', error);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

export default router;

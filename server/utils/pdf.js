import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describeMeasurements, summarizeMeasurements } from './measurements.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAGE = { size: 'A4', margin: 45 };
const CONTENT_WIDTH = 595.28 - PAGE.margin * 2;
const BOTTOM = 841.89 - PAGE.margin;
const RULE = '#d9d9d9';
const MUTED = '#666666';
const ALERT = '#d62020';   // matches the red used on the storefront

// pdfkit's built-in fonts are Latin-only (WinAnsi), so Bengali characters in a customer
// name, address or note cannot render with them. Drop a Unicode TTF covering Bengali
// into server/assets/fonts/ (Noto Sans Bengali, or Windows' Nirmala) and every PDF picks
// it up automatically. English labels, digits and totals are unaffected either way.
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_CANDIDATES = [
    ['NotoSansBengali-Regular.ttf', 'NotoSansBengali-Bold.ttf'],
    ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf'],
    ['Nirmala.ttf', 'NirmalaB.ttf'],
    ['kalpurush.ttf', 'kalpurush.ttf'],
    ['Kalpurush.ttf', 'Kalpurush.ttf'],
];

const resolveFonts = () => {
    for (const [regular, bold] of FONT_CANDIDATES) {
        const regularPath = path.join(FONT_DIR, regular);
        if (fs.existsSync(regularPath)) {
            const boldPath = path.join(FONT_DIR, bold);
            return { regular: regularPath, bold: fs.existsSync(boldPath) ? boldPath : regularPath, unicode: true };
        }
    }
    return { regular: 'Helvetica', bold: 'Helvetica-Bold', unicode: false };
};

const FONTS = resolveFonts();
export const supportsBangla = FONTS.unicode;

export const money = (value) =>
    `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT`;

// Downloads are named "<customer name>_<order id>_<slip|invoice>.pdf". Characters that
// are illegal in a Windows/macOS filename are stripped; the name itself keeps its spaces
// and any non-Latin characters, which the Content-Disposition header encodes separately.
export const orderPdfFileName = (order, variant) => {
    const name = String(order?.customer?.name || 'Customer')
        .replace(/[\\/:*?"<>|]/g, '')      // illegal on Windows
        .replace(/[\x00-\x1f\x7f]/g, '')  // control characters
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) || 'Customer';
    return `${name}_${order.orderNumber || order.id}_${variant}.pdf`;
};

const formatDate = (value) => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const createDocument = () => {
    const doc = new PDFDocument({ ...PAGE, bufferPages: true });
    doc.registerFont('Body', FONTS.regular);
    doc.registerFont('BodyBold', FONTS.bold);
    doc.font('Body');
    return doc;
};

// --- small layout helpers -------------------------------------------------------

const hr = (doc, y, color = RULE) => {
    doc.save().moveTo(PAGE.margin, y).lineTo(PAGE.margin + CONTENT_WIDTH, y)
        .lineWidth(0.75).strokeColor(color).stroke().restore();
};

// Start a new page when `height` will not fit; returns the y to draw at.
const need = (doc, y, height) => {
    if (y + height <= BOTTOM) return y;
    doc.addPage();
    return PAGE.margin;
};

const label = (doc, text, x, y, width) => {
    doc.font('Body').fontSize(8).fillColor(MUTED).text(text, x, y, { width });
    return doc.y;
};

const value = (doc, text, x, y, width, opts = {}) => {
    doc.font(opts.bold ? 'BodyBold' : 'Body').fontSize(opts.size || 10).fillColor('#000')
        .text(text || '-', x, y, { width, ...opts });
    return doc.y;
};

const heading = (doc, settings, title, subtitle) => {
    let y = PAGE.margin;
    doc.font('BodyBold').fontSize(17).fillColor('#000')
        .text(settings?.companyName || 'Gorur Gari', PAGE.margin, y, { width: CONTENT_WIDTH * 0.6 });
    doc.font('Body').fontSize(8).fillColor(MUTED);
    let leftY = doc.y + 1;
    for (const line of [settings?.address, settings?.phone, settings?.email].filter(Boolean)) {
        doc.text(line, PAGE.margin, leftY, { width: CONTENT_WIDTH * 0.6 });
        leftY = doc.y;
    }

    doc.font('BodyBold').fontSize(13).fillColor('#000')
        .text(title, PAGE.margin + CONTENT_WIDTH * 0.6, y, { width: CONTENT_WIDTH * 0.4, align: 'right' });
    doc.font('Body').fontSize(8).fillColor(MUTED)
        .text(subtitle, PAGE.margin + CONTENT_WIDTH * 0.6, doc.y + 1, { width: CONTENT_WIDTH * 0.4, align: 'right' });

    y = Math.max(leftY, doc.y) + 8;
    hr(doc, y, '#000');
    return y + 12;
};

const paymentBlock = (doc, settings, y, amount) => {
    y = need(doc, y, 84);   // the red note is bold 9pt and can wrap to two lines
    doc.save().rect(PAGE.margin, y, CONTENT_WIDTH, 1).fill(RULE).restore();
    y += 10;

    doc.font('BodyBold').fontSize(10).fillColor('#000').text('Payment — Mobile Financial Service (MFS)', PAGE.margin, y);
    y = doc.y + 3;
    doc.font('Body').fontSize(9).fillColor('#000')
        .text(`Amount payable: ${money(amount)}`, PAGE.margin, y, { width: CONTENT_WIDTH });
    y = doc.y + 1;

    if (settings?.mfsNumbers) {
        doc.font('Body').fontSize(9).fillColor('#000')
            .text(`Send money to: ${settings.mfsNumbers}`, PAGE.margin, y, { width: CONTENT_WIDTH });
        y = doc.y + 1;
    }
    // Highlighted in red — this is the instruction the customer must not miss.
    const note = settings?.mfsInstructions
        || 'A customer representative will call you to confirm this order and arrange payment.';
    y += 2;
    doc.font('BodyBold').fontSize(9).fillColor(ALERT).text(note, PAGE.margin, y, { width: CONTENT_WIDTH });
    return doc.y;
};

const pageNumbers = (doc) => {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.font('Body').fontSize(7.5).fillColor(MUTED)
            .text(`Page ${i + 1} of ${range.count}`, PAGE.margin, BOTTOM + 12, { width: CONTENT_WIDTH, align: 'right' });
    }
};

// --- per-order slip / invoice ---------------------------------------------------

const itemBlock = (doc, item, y) => {
    const groups = describeMeasurements(item.measurements);
    const priceWidth = 95;
    const nameWidth = CONTENT_WIDTH - priceWidth - 10;
    const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);

    // Rough height estimate so an item is not split across pages when avoidable.
    y = need(doc, y, 34 + groups.reduce((h, g) => h + 14 + Math.ceil(g.rows.length / 2) * 12, 0));

    const top = y;
    value(doc, item.product?.name || `Product #${item.productId}`, PAGE.margin, y, nameWidth, { bold: true });
    let leftY = doc.y;

    const variant = [
        item.selectedSize ? `Size: ${item.selectedSize}` : null,
        item.selectedColor ? `Colour: ${item.selectedColor}` : null,
    ].filter(Boolean).join('   ');
    if (variant) leftY = label(doc, variant, PAGE.margin, leftY + 1, nameWidth);

    label(doc, `${item.quantity} × ${money(item.price)}`, PAGE.margin, leftY + 1, nameWidth);
    leftY = doc.y;

    value(doc, money(lineTotal), PAGE.margin + nameWidth + 10, top, priceWidth, { bold: true, align: 'right' });

    let cursor = Math.max(leftY, doc.y) + 4;

    for (const group of groups) {
        cursor = need(doc, cursor, 14 + Math.ceil(group.rows.length / 2) * 12);
        doc.font('BodyBold').fontSize(8).fillColor('#000')
            .text(group.title, PAGE.margin + 10, cursor, { width: CONTENT_WIDTH - 10 });
        cursor = doc.y + 2;

        // Two columns of "Label   38""
        const colWidth = (CONTENT_WIDTH - 20) / 2;
        for (let i = 0; i < group.rows.length; i += 2) {
            const rowY = cursor;
            group.rows.slice(i, i + 2).forEach(([name, val], col) => {
                const x = PAGE.margin + 14 + col * colWidth;
                doc.font('Body').fontSize(8.5).fillColor(MUTED).text(name, x, rowY, { width: colWidth * 0.55 });
                doc.font('BodyBold').fontSize(8.5).fillColor('#000')
                    .text(val, x + colWidth * 0.55, rowY, { width: colWidth * 0.4 });
            });
            cursor = rowY + 12;
        }
        cursor += 2;
    }

    if (groups.length === 0) {
        label(doc, 'No measurements recorded for this item.', PAGE.margin + 10, cursor, CONTENT_WIDTH - 10);
        cursor = doc.y + 2;
    }

    hr(doc, cursor + 2);
    return cursor + 10;
};

const totalsBlock = (doc, order, y) => {
    const rows = [];
    const discount = Number(order.discountAmount || 0);
    const itemsTotal = (order.items || []).reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);

    rows.push(['Items total', money(itemsTotal)]);
    if (discount > 0) rows.push([`Discount${order.voucherCode ? ` (${order.voucherCode})` : ''}`, `- ${money(discount)}`]);

    // Whatever is left between the item lines and the charged total is delivery.
    const delivery = Number(order.totalAmount || 0) - itemsTotal + discount;
    if (Math.abs(delivery) >= 0.01) rows.push(['Delivery charge', money(delivery)]);

    y = need(doc, y, 22 * rows.length + 34);
    const labelX = PAGE.margin + CONTENT_WIDTH - 250;

    for (const [name, amount] of rows) {
        doc.font('Body').fontSize(9).fillColor(MUTED).text(name, labelX, y, { width: 140 });
        doc.font('Body').fontSize(9).fillColor('#000').text(amount, labelX + 140, y, { width: 110, align: 'right' });
        y += 14;
    }

    hr(doc, y + 2);
    y += 8;
    doc.font('BodyBold').fontSize(11.5).fillColor('#000').text('Final Price', labelX, y, { width: 140 });
    doc.font('BodyBold').fontSize(11.5).fillColor('#000')
        .text(money(order.totalAmount), labelX + 140, y, { width: 110, align: 'right' });
    return y + 20;
};

export const buildOrderPdf = (doc, { order, settings, variant = 'slip' }) => {
    const isSlip = variant === 'slip';
    let y = heading(
        doc,
        settings,
        isSlip ? 'Order Slip' : 'Order Invoice',
        `Order #${order.orderNumber || order.id}\n${formatDate(order.createdAt)}`
    );

    // Customer / delivery, side by side
    const colWidth = (CONTENT_WIDTH - 20) / 2;
    const rightX = PAGE.margin + colWidth + 20;
    const startY = y;

    label(doc, 'CUSTOMER', PAGE.margin, y, colWidth);
    let ly = value(doc, order.customer?.name, PAGE.margin, doc.y + 1, colWidth, { bold: true });
    for (const line of [order.customer?.phone, order.customer?.email !== 'Guest' ? order.customer?.email : null].filter(Boolean)) {
        ly = value(doc, line, PAGE.margin, ly + 1, colWidth, { size: 9 });
    }

    label(doc, 'DELIVER TO', rightX, startY, colWidth);
    let ry = value(doc, order.shippingAddress, rightX, doc.y + 1, colWidth, { size: 9 });
    ry = label(doc, `Status: ${order.status}`, rightX, ry + 2, colWidth);

    y = Math.max(ly, ry) + 12;

    if (order.specialNote) {
        y = need(doc, y, 30);
        label(doc, 'SPECIAL NOTE', PAGE.margin, y, CONTENT_WIDTH);
        y = value(doc, order.specialNote, PAGE.margin, doc.y + 1, CONTENT_WIDTH, { size: 9 }) + 8;
    }

    y = need(doc, y, 26);
    doc.font('BodyBold').fontSize(10).fillColor('#000').text('Items & Measurements', PAGE.margin, y);
    y = doc.y + 4;
    hr(doc, y);
    y += 8;

    for (const item of order.items || []) y = itemBlock(doc, item, y);

    y = totalsBlock(doc, order, y);
    y = paymentBlock(doc, settings, y + 4, order.totalAmount);

    y = need(doc, y + 12, 26);
    doc.font('Body').fontSize(7.5).fillColor(MUTED).text(
        'All measurements are in inches, as submitted by the customer. '
        + 'Please keep this slip for your records.',
        PAGE.margin, y, { width: CONTENT_WIDTH, align: 'center' }
    );

    pageNumbers(doc);
    return doc;
};

// --- multi-order statement -----------------------------------------------------

const COLS = [
    { key: 'order', title: 'Order', width: 46 },
    { key: 'date', title: 'Date', width: 62 },
    { key: 'customer', title: 'Customer', width: 104 },
    { key: 'products', title: 'Product & Dress Size', width: 190 },
    { key: 'price', title: 'Final Price', width: 103, align: 'right' },
];

const statementHeader = (doc, y) => {
    doc.save().rect(PAGE.margin, y - 3, CONTENT_WIDTH, 17).fill('#f2f2f2').restore();
    let x = PAGE.margin + 4;
    for (const col of COLS) {
        doc.font('BodyBold').fontSize(8).fillColor('#000')
            .text(col.title, x, y + 1, { width: col.width - 8, align: col.align || 'left' });
        x += col.width;
    }
    return y + 18;
};

const statementRow = (doc, order, y) => {
    const cells = {
        order: `#${order.orderNumber || order.id}`,
        date: formatDate(order.createdAt).replace(', ', '\n'),
        customer: [order.customer?.name, order.customer?.phone].filter(Boolean).join('\n'),
        price: money(order.totalAmount),
    };

    const productLines = (order.items || []).map(item => {
        const size = summarizeMeasurements(item.measurements)
            || (item.selectedSize ? `Size ${item.selectedSize}` : 'No measurements recorded');
        return `${item.product?.name || `Product #${item.productId}`} × ${item.quantity}\n${size}`;
    });
    cells.products = productLines.join('\n\n') || '-';

    // Measure before drawing so the row can move to a fresh page intact.
    const heights = COLS.map(col =>
        doc.font('Body').fontSize(7.5).heightOfString(cells[col.key] || '-', { width: col.width - 8 })
    );
    const rowHeight = Math.max(...heights) + 8;

    let top = y;
    if (top + rowHeight > BOTTOM) {
        doc.addPage();
        top = statementHeader(doc, PAGE.margin);
    }

    let x = PAGE.margin + 4;
    for (const col of COLS) {
        doc.font(col.key === 'price' ? 'BodyBold' : 'Body').fontSize(7.5).fillColor('#000')
            .text(cells[col.key] || '-', x, top + 3, { width: col.width - 8, align: col.align || 'left' });
        x += col.width;
    }

    hr(doc, top + rowHeight - 2);
    return top + rowHeight;
};

export const buildStatementPdf = (doc, { orders, settings, filterSummary }) => {
    let y = heading(doc, settings, 'Order Statement', `Generated ${formatDate(new Date())}`);

    doc.font('Body').fontSize(8.5).fillColor(MUTED)
        .text(`${orders.length} order${orders.length === 1 ? '' : 's'} — ${filterSummary}`, PAGE.margin, y, { width: CONTENT_WIDTH });
    y = doc.y + 8;

    y = statementHeader(doc, y);
    for (const order of orders) y = statementRow(doc, order, y);

    if (orders.length === 0) {
        doc.font('Body').fontSize(9).fillColor(MUTED)
            .text('No orders matched the selected filters.', PAGE.margin, y + 8, { width: CONTENT_WIDTH, align: 'center' });
        y = doc.y;
    }

    const grandTotal = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    y = need(doc, y + 6, 30);
    hr(doc, y, '#000');
    y += 6;
    doc.font('BodyBold').fontSize(10.5).fillColor('#000')
        .text(`Grand total (${orders.length} order${orders.length === 1 ? '' : 's'})`, PAGE.margin, y, { width: CONTENT_WIDTH - 150 });
    doc.font('BodyBold').fontSize(10.5).fillColor('#000')
        .text(money(grandTotal), PAGE.margin + CONTENT_WIDTH - 150, y, { width: 150, align: 'right' });

    y = doc.y + 10;
    doc.font('Body').fontSize(7.5).fillColor(MUTED)
        .text('All measurements are in inches. Amounts are the final price charged per order.',
            PAGE.margin, y, { width: CONTENT_WIDTH });

    pageNumbers(doc);
    return doc;
};

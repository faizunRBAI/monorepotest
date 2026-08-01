// Customer-facing order numbers: two-digit day, two-digit month, two-digit year, then a
// sequence that restarts each day. 7 May 2026 gives 07052601, 07052602, and so on.
//
// This is a separate column from Order.id, which stays an AUTO_INCREMENT integer. The
// primary key is what OrderItem points at and what the /orders/:id routes use; changing it
// to a string would mean rewriting the foreign key and every route for no gain. The number
// below is what people read, quote on the phone and see on their slip.

const pad2 = (n) => String(n).padStart(2, '0');

// Built from the local calendar date: an order taken late evening in Dhaka must carry that
// day's date, not the previous day's in UTC.
export const orderNumberPrefix = (date = new Date()) =>
    `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${pad2(date.getFullYear() % 100)}`;

export const PREFIX_LENGTH = 6;

// The sequence is padded to two digits and simply grows past 99 (…98, 99, 100), so a busy
// day is never capped. The prefix is fixed-width, so the split stays unambiguous.
export const formatOrderNumber = (date, sequence) =>
    `${orderNumberPrefix(date)}${String(sequence).padStart(2, '0')}`;

export const sequenceOf = (orderNumber) => {
    const tail = String(orderNumber || '').slice(PREFIX_LENGTH);
    const n = parseInt(tail, 10);
    return Number.isFinite(n) ? n : 0;
};

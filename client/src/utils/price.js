export const calculateDiscount = (price, originalPrice) => {
    if (!originalPrice || !price) return 0;

    // Clean strings (remove commas, currency symbols, etc.)
    const cleanPrice = parseFloat(price.toString().replace(/[^0-9.]/g, ''));
    const cleanOriginal = parseFloat(originalPrice.toString().replace(/[^0-9.]/g, ''));

    if (isNaN(cleanPrice) || isNaN(cleanOriginal) || cleanOriginal <= cleanPrice) return 0;

    const discount = ((cleanOriginal - cleanPrice) / cleanOriginal) * 100;
    return Math.round(discount);
};

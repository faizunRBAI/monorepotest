// Google Tag Manager + ecommerce dataLayer.
//
// GTM owns every marketing tag: the Meta Pixel, GA4, Google Ads conversions. Nothing in
// this file talks to an ad platform directly — it only publishes what happened, and the
// tags configured in the GTM UI decide what to do about it. Adding a new ad network is
// therefore a GTM change with no deploy.
//
// Each push carries the same facts in two shapes:
//   `ecommerce` — GA4's standard spec. A GA4 tag with "Send Ecommerce data: Data Layer"
//                 reads it with no extra configuration.
//   `meta`      — the same numbers pre-formatted for Meta Pixel (content_ids/contents/
//                 value). Meta's format differs from GA4's, and doing that conversion in
//                 a GTM Custom JavaScript variable is easy to get subtly wrong — a bad
//                 `value` yields plausible-looking but false ROAS. It is computed here,
//                 next to the price parsing it depends on, where it can be tested.
//
// The container id comes from VITE_GTM_ID at build time. When it is unset, initGtm() is a
// no-op and every track* call is inert, so local dev sends nothing.

const GTM_ID = import.meta.env.VITE_GTM_ID;
const CURRENCY = 'BDT';

const dataLayer = () => {
    window.dataLayer = window.dataLayer || [];
    return window.dataLayer;
};

/** Inject the GTM container. Call once, as early as possible. */
export function initGtm() {
    if (!GTM_ID) return;
    if (document.getElementById('gtm-container')) return;

    dataLayer().push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    const script = document.createElement('script');
    script.id = 'gtm-container';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
    document.head.appendChild(script);
}

// Prices are stored as free-text strings ("1,460 BDT"), but every ad platform needs a
// number or it drops the value and can no longer optimise on revenue.
export const toAmount = (price) => {
    if (typeof price === 'number') return Number.isFinite(price) ? price : 0;
    const n = parseFloat(String(price ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
};

const toItem = (product, quantity) => ({
    item_id: String(product.id),
    item_name: product.name,
    price: toAmount(product.price),
    ...(product.category?.name ? { item_category: product.category.name } : {}),
    ...(product.selectedSize ? { item_variant: product.selectedSize } : {}),
    quantity: quantity ?? product.quantity ?? 1,
});

const cartValue = (cart) =>
    cart.reduce((sum, item) => sum + toAmount(item.price) * (item.quantity || 1), 0);

// Meta Pixel's parameter shape. `content_ids` is what matches products to the catalogue,
// so dynamic product ads and retargeting break silently without it.
const metaContent = (items, value) => ({
    content_type: 'product',
    content_ids: items.map((i) => i.item_id),
    contents: items.map((i) => ({ id: i.item_id, quantity: i.quantity })),
    currency: CURRENCY,
    value,
});

// GA4 merges the previous `ecommerce` object into the next push, so a stale item list
// leaks into the following event. Clearing both objects first is the documented fix.
const pushEcommerce = (event, ecommerce, meta) => {
    if (!GTM_ID) return;
    dataLayer().push({ ecommerce: null, meta: null });
    dataLayer().push({ event, ecommerce: { currency: CURRENCY, ...ecommerce }, meta });
};

const pushEvent = (event, payload = {}) => {
    if (!GTM_ID) return;
    dataLayer().push({ event, ...payload });
};

/**
 * SPA navigation. GTM's built-in Page View trigger fires only on the initial document
 * load, so the Meta Pixel PageView tag and GA4 must be triggered off this event instead
 * or every route after the landing page goes unrecorded.
 */
export function trackPageView(path) {
    pushEvent('page_view', {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
    });
}

export function trackViewItem(product) {
    const item = toItem(product, 1);
    pushEcommerce('view_item', { value: item.price, items: [item] }, metaContent([item], item.price));
}

export function trackAddToCart(product, quantity, size, color) {
    const item = toItem({ ...product, selectedSize: size, selectedColor: color }, quantity);
    const value = item.price * item.quantity;
    pushEcommerce('add_to_cart', { value, items: [item] }, metaContent([item], value));
}

export function trackBeginCheckout(cart) {
    const items = cart.map((i) => toItem(i));
    const value = cartValue(cart);
    pushEcommerce('begin_checkout', { value, items }, { ...metaContent(items, value), num_items: items.length });
}

/**
 * Order confirmed. `value` must be the amount actually charged (after discount,
 * including delivery) so ad platforms optimise on real revenue, and `transactionId`
 * must be stable — it's how both GA4 and Meta de-duplicate a refreshed confirmation.
 */
export function trackPurchase({ transactionId, cart, value, shipping = 0, discount = 0, voucherCode = null }) {
    const items = cart.map((i) => toItem(i));
    pushEcommerce('purchase', {
        transaction_id: String(transactionId),
        value,
        shipping,
        ...(discount ? { discount } : {}),
        ...(voucherCode ? { coupon: voucherCode } : {}),
        items,
    }, { ...metaContent(items, value), order_id: String(transactionId) });
}

export function trackSearch(term) {
    pushEvent('search', { search_term: term });
}

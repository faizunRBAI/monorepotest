// Client-side SEO: keeps <head> tags in sync with the current route as the SPA
// navigates. Crawlers that execute JS (Google) pick these up; link-preview bots
// (Facebook, WhatsApp) never run JS, so server/utils/seo.js injects the same
// tags into index.html for the first request. Keep the two in sync.

export const SITE_NAME = 'Gorur Gari';
export const DEFAULT_DESCRIPTION =
    'Shop the latest collections at Gorur Gari. Quality clothing and fashion in Bangladesh with nationwide home delivery, easy returns and secure payment.';

const upsertMeta = (attr, key, content) => {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!content) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const upsertLink = (rel, href) => {
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!href) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
};

const absolute = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return window.location.origin + (url.startsWith('/') ? url : `/${url}`);
};

/**
 * Apply SEO tags for the current page.
 * @param {object} opts
 * @param {string} [opts.title]        Page title (site name is appended).
 * @param {string} [opts.description]  Meta description; falls back to the site default.
 * @param {string} [opts.image]        Preview image (relative paths are made absolute).
 * @param {string} [opts.path]         Canonical path; defaults to the current pathname.
 * @param {string} [opts.type]         Open Graph type, e.g. 'website' or 'product'.
 * @param {boolean} [opts.noindex]     Ask crawlers to skip this page (checkout, admin…).
 */
export function applySeo({ title, description, image, path, type = 'website', noindex = false } = {}) {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Online Shopping in Bangladesh`;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = window.location.origin + (path ?? window.location.pathname);
    const img = absolute(image);

    document.title = fullTitle;
    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : null);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:image', img);
    upsertMeta('name', 'twitter:card', img ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertMeta('name', 'twitter:image', img);
    // Indexable pages get a canonical URL; noindex pages shouldn't have one.
    upsertLink('canonical', noindex ? null : url);
}

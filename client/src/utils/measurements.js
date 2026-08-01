// Made-to-measure fields shown on the product page, with Bangla labels for the
// language toggle.
//
// The `key` values must stay identical to server/utils/measurements.js — that is the
// storage contract for OrderItem.measurements and what the order slip / statement PDFs
// read back. The server ignores any key it does not recognise, so a mismatch here shows
// up as a silently missing measurement. Keys are namespaced by garment because Waist
// and Length appear in both groups.

export const MEASUREMENT_GROUPS = [
    {
        id: 'kameez',
        en: 'Dress / Kameez Measurements',
        bn: 'জামা / কামিজের মাপ',
        fields: [
            { key: 'kameezChest', en: 'Chest', bn: 'বুক' },
            { key: 'kameezWaist', en: 'Waist', bn: 'কোমর' },
            { key: 'kameezLength', en: 'Length', bn: 'ঝুল' },
            { key: 'kameezSleeveLength', en: 'Sleeve Length', bn: 'হাতার লম্বা' },
            { key: 'kameezSleeveOpening', en: 'Sleeve Opening', bn: 'হাতার মোহরি' },
        ],
    },
    {
        id: 'pajama',
        en: 'Pajama Measurements',
        bn: 'পায়জামার মাপ',
        fields: [
            { key: 'pajamaWaist', en: 'Waist', bn: 'কোমর' },
            { key: 'pajamaLength', en: 'Length', bn: 'লম্বা' },
            { key: 'pajamaBottomOpening', en: 'Bottom Opening', bn: 'নিচের ঘের / মোহরি' },
        ],
    },
];

export const MEASUREMENT_KEYS = MEASUREMENT_GROUPS.flatMap(g => g.fields.map(f => f.key));

export const GROUP_IDS = MEASUREMENT_GROUPS.map(g => g.id);

// A product declares which garments it is made of, so a kameez-only item never asks for
// pajama measurements. Missing or unrecognised values mean every group, matching
// normalizeGroups in server/utils/measurements.js.
export const normalizeGroups = (raw) => {
    let value = raw;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { value = value.split(','); }
    }
    if (!Array.isArray(value)) return [...GROUP_IDS];

    const picked = value.map(v => String(v).trim()).filter(v => GROUP_IDS.includes(v));
    return picked.length > 0 ? GROUP_IDS.filter(id => picked.includes(id)) : [...GROUP_IDS];
};

export const groupsForProduct = (product) => normalizeGroups(product?.measurementGroups);

export const visibleGroups = (groupIds) => {
    const allowed = new Set(normalizeGroups(groupIds));
    return MEASUREMENT_GROUPS.filter(g => allowed.has(g.id));
};

export const requiredKeys = (groupIds) => visibleGroups(groupIds).flatMap(g => g.fields.map(f => f.key));

// Which groups a cart line is answerable for. Prefer what the product declares; if a line
// predates that (an old bag, or a reorder built from a past order), fall back to the
// groups it actually carries values for so it is not wrongly reported as incomplete.
export const groupsForCartItem = (item) => {
    if (item?.measurementGroups) return normalizeGroups(item.measurementGroups);
    const filled = MEASUREMENT_GROUPS
        .filter(g => g.fields.some(f => item?.measurements?.[f.key]))
        .map(g => g.id);
    return filled.length > 0 ? filled : [...GROUP_IDS];
};

export const UI_TEXT = {
    en: {
        heading: 'Your Measurements',
        unit: 'inches',
        note: 'Please provide all measurements in inches so that your dress can be tailored perfectly.',
        placeholder: 'inch',
        missing: 'Please fill in every measurement (in inches) to confirm your order.',
        invalid: 'Measurements must be numbers in inches.',
        optional: 'optional now',
        laterHint: 'You can skip this and fill it in at checkout.',
        needed: 'Measurements needed to confirm your order',
        toggle: 'বাংলা',
    },
    bn: {
        heading: 'আপনার মাপ',
        unit: 'ইঞ্চি',
        note: 'আপনার পোশাক নিখুঁতভাবে তৈরি করার জন্য অনুগ্রহ করে সব মাপ ইঞ্চিতে দিন।',
        placeholder: 'ইঞ্চি',
        missing: 'অর্ডার নিশ্চিত করতে অনুগ্রহ করে সব মাপ (ইঞ্চিতে) পূরণ করুন।',
        invalid: 'মাপ অবশ্যই ইঞ্চিতে সংখ্যা হতে হবে।',
        optional: 'এখন ঐচ্ছিক',
        laterHint: 'এখন না দিলেও চলবে — চেকআউটে দিতে পারবেন।',
        needed: 'অর্ডার নিশ্চিত করতে মাপ প্রয়োজন',
        toggle: 'English',
    },
};

export const emptyMeasurements = () =>
    MEASUREMENT_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {});

// Measurements are optional when adding to the bag, so this only rejects values that are
// present but nonsensical. Completeness is enforced later, at order confirmation.
export const validateFilledMeasurements = (values, groupIds) => {
    const invalid = requiredKeys(groupIds).filter(key => {
        const raw = String(values?.[key] ?? '').trim();
        if (!raw) return false;
        const n = Number(raw);
        return !Number.isFinite(n) || n <= 0;
    });
    return invalid.length > 0 ? { ok: false, reason: 'invalid', missing: invalid } : { ok: true, missing: [] };
};

// Strip anything outside the applicable groups so a kameez-only line never carries
// leftover pajama values. Returns null when nothing was filled in at all, keeping an
// untouched line's measurements genuinely absent rather than an object full of blanks.
export const pickMeasurements = (values, groupIds) => {
    const picked = {};
    for (const key of requiredKeys(groupIds)) {
        const raw = String(values?.[key] ?? '').trim();
        if (raw) picked[key] = raw;
    }
    return Object.keys(picked).length > 0 ? picked : null;
};

// Every applicable field filled — the bar an order must clear to be confirmed.
export const isComplete = (measurements, groupIds) => {
    const keys = requiredKeys(groupIds);
    return keys.length > 0 && keys.every(key => String(measurements?.[key] ?? '').trim());
};

// Compact one-line summary for the cart and checkout rows.
export const summarizeMeasurements = (measurements, lang = 'en') => {
    if (!measurements) return '';
    return MEASUREMENT_GROUPS
        .flatMap(g => g.fields.filter(f => measurements[f.key]).map(f => `${f[lang]} ${measurements[f.key]}"`))
        .join(', ');
};

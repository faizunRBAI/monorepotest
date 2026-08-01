// Canonical definition of the made-to-measure fields a buyer submits per dress.
//
// The keys here ARE the storage contract: they are what lands in
// OrderItem.measurements and what the PDFs read back. client/src/utils/measurements.js
// mirrors this list for the order form (it also carries the Bangla labels used by the
// language toggle) — if you add or rename a field, change it in BOTH files. The keys
// are namespaced by garment because Waist and Length appear in both groups.

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

export const MEASUREMENT_FIELDS = MEASUREMENT_GROUPS.flatMap(g =>
    g.fields.map(f => ({ ...f, groupId: g.id, groupEn: g.en }))
);

export const GROUP_IDS = MEASUREMENT_GROUPS.map(g => g.id);

const FIELD_BY_KEY = new Map(MEASUREMENT_FIELDS.map(f => [f.key, f]));

// A product declares which garments it is made of via Product.measurementGroups, so a
// kameez-only item never asks for pajama measurements. Anything absent or unrecognised
// falls back to every group, which is how products predating this behave.
export const normalizeGroups = (raw) => {
    let value = raw;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { value = value.split(','); }
    }
    if (!Array.isArray(value)) return [...GROUP_IDS];

    const picked = value.map(v => String(v).trim()).filter(v => GROUP_IDS.includes(v));
    // Keep the canonical declaration order rather than whatever order arrived.
    return picked.length > 0 ? GROUP_IDS.filter(id => picked.includes(id)) : [...GROUP_IDS];
};

export const fieldsForGroups = (groupIds) => {
    const allowed = new Set(normalizeGroups(groupIds));
    return MEASUREMENT_GROUPS.filter(g => allowed.has(g.id)).flatMap(g => g.fields);
};

// Keep only keys that are both recognised AND applicable to this product, trimmed to a
// sane length. Anything else is dropped rather than stored, so a kameez-only order can
// never carry stray pajama values and the PDFs cannot render unexpected content.
export const sanitizeMeasurements = (raw, groupIds) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const clean = {};
    for (const { key } of fieldsForGroups(groupIds)) {
        const value = raw[key];
        if (value === undefined || value === null) continue;
        const text = String(value).trim().slice(0, 32);
        if (text) clean[key] = text;
    }
    return Object.keys(clean).length > 0 ? clean : null;
};

// Measurements are optional while an item sits in the bag, but an order cannot be
// confirmed without them — the garment is cut to these numbers. Returns the English labels
// of anything still missing so the caller can say what is needed.
export const missingMeasurements = (raw, groupIds) => {
    const values = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return fieldsForGroups(groupIds)
        .filter(f => !String(values[f.key] ?? '').trim())
        .map(f => f.en);
};

// Ordered [label, value] pairs for display, grouped by garment. Used by the PDFs and
// safe to call on legacy order items that predate this feature (returns []).
export const describeMeasurements = (measurements) => {
    if (!measurements) return [];
    const parsed = typeof measurements === 'string'
        ? (() => { try { return JSON.parse(measurements); } catch { return null; } })()
        : measurements;
    if (!parsed || typeof parsed !== 'object') return [];

    return MEASUREMENT_GROUPS.map(group => ({
        title: group.en,
        rows: group.fields
            .filter(f => parsed[f.key])
            .map(f => [FIELD_BY_KEY.get(f.key).en, `${parsed[f.key]}"`]),
    })).filter(g => g.rows.length > 0);
};

// One-line form for tight table cells, e.g. Chest 38", Waist 32"
export const summarizeMeasurements = (measurements) =>
    describeMeasurements(measurements)
        .flatMap(g => g.rows.map(([label, value]) => `${label} ${value}`))
        .join(', ');

import React from 'react';
import { UI_TEXT, visibleGroups } from '../utils/measurements';

// The made-to-measure input grid, shared by the product page and checkout so both render
// an identical form. Measurements are optional when adding to the bag and required to
// confirm the order, which is why this only draws fields — each caller decides when to
// demand them.
//
// `lang` switches the labels only; values are always stored against the fixed keys.
const MeasurementFields = ({ groupIds, values, onChange, lang = 'en', invalidKeys = [], compact = false }) => {
    const t = UI_TEXT[lang];
    const groups = visibleGroups(groupIds);

    return (
        <>
            {groups.map(group => (
                <div key={group.id} style={{ marginBottom: compact ? '0.75rem' : '1rem' }}>
                    {/* A group heading only earns its place when more than one garment is measured. */}
                    {groups.length > 1 && (
                        <div style={{
                            fontWeight: 600,
                            fontSize: compact ? '0.8rem' : '0.9rem',
                            marginBottom: '0.5rem',
                            color: '#333',
                        }}>
                            {group[lang]}
                        </div>
                    )}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 130 : 150}px, 1fr))`,
                        gap: compact ? '0.5rem' : '0.75rem',
                    }}>
                        {group.fields.map(field => {
                            const isInvalid = invalidKeys.includes(field.key);
                            return (
                                <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ fontSize: compact ? '0.78rem' : '0.85rem', color: '#444' }}>
                                        {field[lang]}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="1"
                                            step="0.25"
                                            value={values?.[field.key] ?? ''}
                                            onChange={(e) => onChange(field.key, e.target.value)}
                                            placeholder={t.placeholder}
                                            style={{
                                                width: '100%',
                                                padding: compact ? '0.45rem 0.5rem' : '0.55rem 0.6rem',
                                                borderRadius: '4px',
                                                border: `1px solid ${isInvalid ? '#d62020' : '#ddd'}`,
                                                background: isInvalid ? '#fff5f5' : '#fff',
                                                fontSize: compact ? '0.88rem' : '0.95rem',
                                            }}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>
                                            {t.unit}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            ))}
        </>
    );
};

export default MeasurementFields;

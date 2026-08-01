import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Trash2, Plus, X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const emptyForm = {
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderAmount: '',
    maxClaimsAllowed: '',
    isActive: true,
    expiresAt: '',
    appliesTo: 'all',
    appliesToId: ''
};

const AdminVouchers = () => {
    const { confirm } = useNotification();
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);

    useEffect(() => {
        fetchVouchers();
        api.get('/categories').then(res => setCategories(res.data)).catch(() => {});
    }, []);

    const fetchVouchers = async () => {
        try {
            const res = await api.get('/vouchers');
            setVouchers(res.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const openCreate = () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(true);
    };

    const handleAppliesToChange = (val) => {
        setForm(prev => ({ ...prev, appliesTo: val, appliesToId: '' }));
        if (val === 'subcategory') {
            // load all subcategories from all categories
            const subs = categories.flatMap(c => (c.subCategories || []).map(s => ({ ...s, catName: c.name })));
            setSubcategories(subs);
        }
    };

    const openEdit = (v) => {
        if (v.appliesTo === 'subcategory') {
            const subs = categories.flatMap(c => (c.subCategories || []).map(s => ({ ...s, catName: c.name })));
            setSubcategories(subs);
        }
        setForm({
            code: v.code,
            discountType: v.discountType,
            discountValue: v.discountValue,
            minOrderAmount: v.minOrderAmount || '',
            maxClaimsAllowed: v.maxClaimsAllowed ?? '',
            isActive: !!v.isActive,
            expiresAt: v.expiresAt ? v.expiresAt.slice(0, 16) : '',
            appliesTo: v.appliesTo || 'all',
            appliesToId: v.appliesToId || ''
        });
        setEditingId(v.id);
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.code.trim() || !form.discountValue) return alert('Code and discount value are required.');
        setSaving(true);
        try {
            const payload = {
                ...form,
                discountValue: parseFloat(form.discountValue),
                minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
                maxClaimsAllowed: form.maxClaimsAllowed !== '' ? parseInt(form.maxClaimsAllowed) : null,
                expiresAt: form.expiresAt || null,
                appliesToId: form.appliesToId ? parseInt(form.appliesToId) : null
            };
            if (editingId) {
                await api.put(`/vouchers/${editingId}`, payload);
            } else {
                await api.post('/vouchers', payload);
            }
            setShowForm(false);
            fetchVouchers();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save voucher');
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        const shouldDelete = await confirm({
            title: 'Delete Voucher',
            message: 'Delete this voucher?',
            confirmLabel: 'Delete Voucher',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try {
            await api.delete(`/vouchers/${id}`);
            fetchVouchers();
        } catch { alert('Failed to delete voucher'); }
    };

    const handleToggle = async (v) => {
        try {
            await api.put(`/vouchers/${v.id}`, { ...v, isActive: !v.isActive, maxClaimsAllowed: v.maxClaimsAllowed ?? null });
            fetchVouchers();
        } catch { alert('Failed to update voucher'); }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1>Vouchers / Promo Codes</h1>
                <button
                    onClick={openCreate}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: '#000', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                    <Plus size={18} /> New Voucher
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative' }}>
                        <button onClick={() => setShowForm(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                        <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Edit Voucher' : 'Create Voucher'}</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Code *</label>
                                <input name="code" value={form.code} onChange={handleChange} placeholder="e.g. SAVE20"
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }} required />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Discount Type *</label>
                                    <select name="discountType" value={form.discountType} onChange={handleChange}
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}>
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (BDT)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>
                                        Value * {form.discountType === 'percentage' ? '(%)' : '(BDT)'}
                                    </label>
                                    <input name="discountValue" type="number" min="0" step="0.01" value={form.discountValue} onChange={handleChange}
                                        placeholder={form.discountType === 'percentage' ? '10' : '50'}
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }} required />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Min Order (BDT)</label>
                                    <input name="minOrderAmount" type="number" min="0" value={form.minOrderAmount} onChange={handleChange}
                                        placeholder="0 = no minimum"
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Max Claims</label>
                                    <input name="maxClaimsAllowed" type="number" min="1" value={form.maxClaimsAllowed} onChange={handleChange}
                                        placeholder="Leave blank = unlimited"
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Expiry Date & Time</label>
                                <input name="expiresAt" type="datetime-local" value={form.expiresAt} onChange={handleChange}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                                <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>Leave blank for no expiry</p>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Applies To</label>
                                <select value={form.appliesTo} onChange={e => handleAppliesToChange(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}>
                                    <option value="all">All Products</option>
                                    <option value="category">Specific Category</option>
                                    <option value="subcategory">Specific Sub-category</option>
                                </select>
                            </div>

                            {form.appliesTo === 'category' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Select Category *</label>
                                    <select value={form.appliesToId} onChange={e => setForm(prev => ({ ...prev, appliesToId: e.target.value }))} required
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}>
                                        <option value="">— Choose category —</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {form.appliesTo === 'subcategory' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Select Sub-category *</label>
                                    <select value={form.appliesToId} onChange={e => setForm(prev => ({ ...prev, appliesToId: e.target.value }))} required
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}>
                                        <option value="">— Choose sub-category —</option>
                                        {subcategories.map(s => <option key={s.id} value={s.id}>{s.catName} → {s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                                Active (users can apply this voucher)
                            </label>

                            <button type="submit" disabled={saving}
                                style={{ padding: '0.875rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', opacity: saving ? 0.7 : 1 }}>
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Voucher'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Vouchers Table */}
            <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead style={{ background: '#f4f6f8', textAlign: 'left' }}>
                            <tr>
                                <th style={{ padding: '1rem' }}>Code</th>
                                <th style={{ padding: '1rem' }}>Discount</th>
                                <th style={{ padding: '1rem' }}>Applies To</th>
                                <th style={{ padding: '1rem' }}>Min Order</th>
                                <th style={{ padding: '1rem' }}>Claims</th>
                                <th style={{ padding: '1rem' }}>Expires</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vouchers.length === 0 ? (
                                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No vouchers yet. Create one above.</td></tr>
                            ) : vouchers.map(v => (
                                <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', background: '#f4f4f4', padding: '3px 8px', borderRadius: '4px' }}>{v.code}</span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {v.discountType === 'percentage'
                                            ? <span style={{ color: '#2b6cb0', fontWeight: 600 }}>{v.discountValue}% off</span>
                                            : <span style={{ color: '#2b6cb0', fontWeight: 600 }}>{v.discountValue} BDT off</span>
                                        }
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                        {!v.appliesTo || v.appliesTo === 'all' ? <span style={{ color: '#aaa' }}>All</span> : `${v.appliesTo === 'category' ? 'Cat' : 'Sub'} #${v.appliesToId}`}
                                    </td>
                                    <td style={{ padding: '1rem' }}>{v.minOrderAmount > 0 ? `${v.minOrderAmount} BDT` : <span style={{ color: '#aaa' }}>None</span>}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ fontWeight: 600 }}>{v.totalClaimed}</span>
                                        <span style={{ color: '#888' }}> / {v.maxClaimsAllowed ?? '∞'}</span>
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                        {v.expiresAt ? new Date(v.expiresAt).toLocaleString() : <span style={{ color: '#aaa' }}>No expiry</span>}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                                            background: v.isActive ? '#e6fffa' : '#f9f9f9',
                                            color: v.isActive ? '#2c7a7b' : '#999'
                                        }}>
                                            {v.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <button onClick={() => openEdit(v)}
                                            style={{ padding: '0.4rem 0.75rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            Edit
                                        </button>
                                        <button onClick={() => handleToggle(v)}
                                            style={{ padding: '0.4rem 0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                                background: v.isActive ? '#fff5f5' : '#f0fff4', color: v.isActive ? '#d62020' : '#2ecc71' }}>
                                            {v.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button onClick={() => handleDelete(v.id)}
                                            style={{ padding: '0.4rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d62020' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminVouchers;

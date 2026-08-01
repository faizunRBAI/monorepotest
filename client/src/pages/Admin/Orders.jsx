import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Download, FileText, Table, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { saveBlobResponse, orderPdfFileName } from '../../utils/download';

// Mirrors the grouping used by the PDFs (server/utils/measurements.js).
const MEASUREMENT_GROUPS = [
    { title: 'Dress / Kameez', keys: [['kameezChest', 'Chest'], ['kameezWaist', 'Waist'], ['kameezLength', 'Length'], ['kameezSleeveLength', 'Sleeve Length'], ['kameezSleeveOpening', 'Sleeve Opening']] },
    { title: 'Pajama', keys: [['pajamaWaist', 'Waist'], ['pajamaLength', 'Length'], ['pajamaBottomOpening', 'Bottom Opening']] },
];

const readMeasurements = (raw) => {
    if (!raw) return null;
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return null; }
};

const measurementGroupsOf = (raw) => {
    const values = readMeasurements(raw);
    if (!values) return [];
    return MEASUREMENT_GROUPS
        .map(g => ({ title: g.title, rows: g.keys.filter(([key]) => values[key]).map(([key, label]) => [label, `${values[key]}"`]) }))
        .filter(g => g.rows.length > 0);
};

const summarize = (raw) =>
    measurementGroupsOf(raw).flatMap(g => g.rows.map(([label, v]) => `${label} ${v}`)).join(', ');

const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancellation Requested', 'Cancelled'];
const PAGE_SIZES = [25, 50, 100, 200];
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Local calendar day, not UTC — an admin in Dhaka picking "today" means their today.
const isoDay = (d) => {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return isoDay(d);
};
const startOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    return isoDay(d);
};

const DATE_PRESETS = [
    { label: 'Today', from: () => isoDay(new Date()), to: () => isoDay(new Date()) },
    { label: 'Last 7 days', from: () => daysAgo(6), to: () => isoDay(new Date()) },
    { label: 'Last 30 days', from: () => daysAgo(29), to: () => isoDay(new Date()) },
    { label: 'This month', from: () => startOfMonth(), to: () => isoDay(new Date()) },
    { label: 'All time', from: () => '', to: () => '' },
];

const EMPTY_FILTERS = {
    search: '', status: 'All', from: '', to: '', minAmount: '', maxAmount: '',
    sort: 'createdAt', dir: 'desc',
};

const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState('');

    // `filters` is what the inputs hold; `applied` is what has actually been queried. The
    // search box is debounced into `applied` so typing does not fire a request per keystroke.
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [applied, setApplied] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [meta, setMeta] = useState({ total: 0, totalPages: 1, summary: { count: 0, totalAmount: 0, statusCounts: {} } });

    const setFilter = (patch) => setFilters(prev => ({ ...prev, ...patch }));

    // Debounce the free-text search; apply everything else immediately.
    useEffect(() => {
        const id = setTimeout(() => setApplied(filters), filters.search === applied.search ? 0 : 350);
        return () => clearTimeout(id);
    }, [filters]);   // eslint-disable-line react-hooks/exhaustive-deps

    // Any filter change returns to the first page — page 7 of the previous result set is
    // meaningless against a new one.
    useEffect(() => { setPage(1); }, [applied, pageSize]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await api.get('/orders', { params: { ...applied, page, pageSize } });
                if (cancelled) return;
                setOrders(res.data.orders || []);
                setMeta({
                    total: res.data.total || 0,
                    totalPages: res.data.totalPages || 1,
                    summary: res.data.summary || { count: 0, totalAmount: 0, statusCounts: {} },
                });
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setError('Could not load orders. Please try again.');
            }
            if (!cancelled) setLoading(false);
        };
        load();
        // Guards against an earlier slow response overwriting a newer one.
        return () => { cancelled = true; };
    }, [applied, page, pageSize]);

    const handleStatusChange = async (id, newStatus) => {
        try {
            await api.put(`/orders/${id}/status`, { status: newStatus });
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
            // The change may move the order out of the current filter, so refresh the counts.
            setApplied(prev => ({ ...prev }));
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const exportParams = { ...applied };
    const activeFilterCount = ['search', 'from', 'to', 'minAmount', 'maxAmount']
        .filter(k => applied[k]).length + (applied.status !== 'All' ? 1 : 0);

    // Files are fetched as blobs so the admin token goes with the request — a plain
    // <a href> would hit these protected endpoints unauthenticated. The saved name comes
    // from the server's Content-Disposition; `filename` is only the fallback.
    const downloadFile = async (url, filename, key, params) => {
        setDownloading(key);
        try {
            const res = await api.get(url, { params, responseType: 'blob' });
            saveBlobResponse(res, filename);
        } catch (err) {
            console.error(err);
            alert('Failed to generate the download. Please try again.');
        }
        setDownloading('');
    };

    const [selectedOrder, setSelectedOrder] = useState(null);

    // Close modal when clicking outside
    const handleCloseModal = (e) => {
        if (e.target.className === 'modal-overlay') setSelectedOrder(null);
    };

    const field = { padding: '0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' };
    const labelStyle = { display: 'block', fontSize: '0.72rem', color: '#666', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
    const presetActive = (p) => filters.from === p.from() && filters.to === p.to();

    return (
        <div>
            <h1>Orders</h1>

            {/* Filters — every one of these is applied in SQL, so the table stays fast
                however many orders exist. */}
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                        <label style={labelStyle}>Search</label>
                        <input
                            type="text"
                            placeholder="Order no. (e.g. 07052601), name, phone, email, voucher…"
                            value={filters.search}
                            onChange={(e) => setFilter({ search: e.target.value })}
                            style={{ ...field, width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Status</label>
                        <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} style={{ ...field, width: '100%' }}>
                            <option value="All">All statuses</option>
                            {STATUSES.map(s => (
                                <option key={s} value={s}>
                                    {s}{meta.summary.statusCounts[s] !== undefined ? ` (${meta.summary.statusCounts[s]})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>From date</label>
                        <input type="date" value={filters.from} max={filters.to || undefined}
                            onChange={(e) => setFilter({ from: e.target.value })} style={{ ...field, width: '100%' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>To date</label>
                        <input type="date" value={filters.to} min={filters.from || undefined}
                            onChange={(e) => setFilter({ to: e.target.value })} style={{ ...field, width: '100%' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Min total (BDT)</label>
                        <input type="number" min="0" placeholder="0" value={filters.minAmount}
                            onChange={(e) => setFilter({ minAmount: e.target.value })} style={{ ...field, width: '100%' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Max total (BDT)</label>
                        <input type="number" min="0" placeholder="Any" value={filters.maxAmount}
                            onChange={(e) => setFilter({ maxAmount: e.target.value })} style={{ ...field, width: '100%' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600 }}>Quick range:</span>
                    {DATE_PRESETS.map(p => (
                        <button
                            key={p.label}
                            onClick={() => setFilter({ from: p.from(), to: p.to() })}
                            style={{
                                padding: '0.3rem 0.7rem', borderRadius: '50px', cursor: 'pointer', fontSize: '0.78rem',
                                border: `1px solid ${presetActive(p) ? '#000' : '#ddd'}`,
                                background: presetActive(p) ? '#000' : '#fff',
                                color: presetActive(p) ? '#fff' : '#333', fontWeight: 500,
                            }}
                        >
                            {p.label}
                        </button>
                    ))}

                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={`${filters.sort}:${filters.dir}`}
                            onChange={(e) => { const [sort, dir] = e.target.value.split(':'); setFilter({ sort, dir }); }}
                            style={{ ...field, padding: '0.4rem' }}
                        >
                            <option value="createdAt:desc">Newest first</option>
                            <option value="createdAt:asc">Oldest first</option>
                            <option value="totalAmount:desc">Highest value</option>
                            <option value="totalAmount:asc">Lowest value</option>
                            <option value="customer:asc">Customer A–Z</option>
                            <option value="status:asc">Status A–Z</option>
                        </select>
                        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ ...field, padding: '0.4rem' }}>
                            {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
                        </select>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => setFilters(EMPTY_FILTERS)}
                                style={{ padding: '0.4rem 0.7rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                                <X size={13} /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                            </button>
                        )}
                    </span>
                </div>
            </div>

            {/* What the current filter actually selected, across every page. */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ background: '#f4f6f8', borderRadius: '6px', padding: '0.6rem 0.9rem', fontSize: '0.85rem' }}>
                    <strong>{meta.total.toLocaleString()}</strong> order{meta.total === 1 ? '' : 's'} match
                </div>
                <div style={{ background: '#f4f6f8', borderRadius: '6px', padding: '0.6rem 0.9rem', fontSize: '0.85rem' }}>
                    Total value <strong>{money(meta.summary.totalAmount)} BDT</strong>
                </div>
                {meta.total > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, meta.total)} of {meta.total.toLocaleString()}
                    </div>
                )}

                <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => downloadFile('/orders/statement.pdf', `order-statement-${new Date().toISOString().slice(0, 10)}.pdf`, 'statement', exportParams)}
                        disabled={downloading === 'statement'}
                        title="PDF statement of every order matching the current filters"
                        style={{
                            padding: '0.6rem 1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px',
                            cursor: downloading === 'statement' ? 'wait' : 'pointer', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', fontSize: '0.85rem'
                        }}
                    >
                        <Download size={15} />
                        {downloading === 'statement' ? 'Preparing…' : 'Statement PDF'}
                    </button>
                    <button
                        onClick={() => downloadFile('/orders/export.csv', `orders-${new Date().toISOString().slice(0, 10)}.csv`, 'csv', exportParams)}
                        disabled={downloading === 'csv'}
                        title="Spreadsheet of every matching order, one row per item, with measurements in their own columns"
                        style={{
                            padding: '0.6rem 1rem', background: '#fff', color: '#000', border: '1px solid #000', borderRadius: '4px',
                            cursor: downloading === 'csv' ? 'wait' : 'pointer', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', fontSize: '0.85rem'
                        }}
                    >
                        <Table size={15} />
                        {downloading === 'csv' ? 'Preparing…' : 'Export CSV'}
                    </button>
                </span>
            </div>

            {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fc8181', color: '#c53030', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            <div style={{ marginTop: '2rem', background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                        <thead style={{ background: '#f4f6f8', textAlign: 'left' }}>
                            <tr>
                                <th style={{ padding: '1rem' }}>Order ID</th>
                                <th style={{ padding: '1rem' }}>Product</th>
                                <th style={{ padding: '1rem' }}>Customer</th>
                                <th style={{ padding: '1rem' }}>Date</th>
                                <th style={{ padding: '1rem' }}>Total</th>
                                <th style={{ padding: '1rem' }}>Method</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading orders…</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center' }}>
                                    No orders match these filters.
                                    {activeFilterCount > 0 && (
                                        <button onClick={() => setFilters(EMPTY_FILTERS)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#2b6cb0' }}>
                                            Clear filters
                                        </button>
                                    )}
                                </td></tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                            <strong>{order.orderNumber || order.id}</strong>
                                        </td>
                                        <td style={{ padding: '1rem', maxWidth: '260px' }}>
                                            {order.items && order.items.length > 0 ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    {order.items[0].product?.imageUrl && (
                                                        <img
                                                            src={order.items[0].product.imageUrl}
                                                            alt="Product"
                                                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                                                        />
                                                    )}
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                                            {order.items[0].product?.name}
                                                            {order.items.length > 1 && <span style={{ color: '#666', fontWeight: 400 }}> +{order.items.length - 1} more</span>}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#888', lineHeight: 1.4 }}>
                                                            {summarize(order.items[0].measurements) || 'No measurements'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#aaa' }}>No items</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {order.customer ? order.customer.name : 'Unknown'}
                                            <div style={{ fontSize: '0.8rem', color: '#888' }}>{order.customer?.email}</div>
                                        </td>
                                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                            {new Date(order.createdAt).toLocaleDateString()}
                                            <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                            {money(order.totalAmount)} BDT
                                            {Number(order.discountAmount) > 0 && (
                                                <div style={{ fontSize: '0.72rem', color: '#1e7e34' }}>
                                                    −{money(order.discountAmount)} {order.voucherCode || ''}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>{order.paymentMethod}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem',
                                                background: order.status === 'Delivered' ? '#e6fffa' : order.status === 'Confirmed' ? '#ebf8ff' : '#fff5f5',
                                                color: order.status === 'Delivered' ? '#2c7a7b' : order.status === 'Confirmed' ? '#2b6cb0' : '#c53030'
                                            }}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                                            <select
                                                value={order.status}
                                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Confirmed">Confirmed</option>
                                                <option value="Shipped">Shipped</option>
                                                <option value="Delivered">Delivered</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                style={{ padding: '0.5rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination. Page numbers window around the current page so 400 pages
                    does not produce 400 buttons. */}
                {meta.totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 1rem', borderTop: '1px solid #eee', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                            Page {page} of {meta.totalPages.toLocaleString()}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                style={{ padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.45 : 1, display: 'flex', alignItems: 'center' }}
                            >
                                <ChevronLeft size={15} />
                            </button>

                            {(() => {
                                const span = 2;
                                const start = Math.max(1, Math.min(page - span, meta.totalPages - span * 2));
                                const end = Math.min(meta.totalPages, Math.max(page + span, span * 2 + 1));
                                const pages = [];
                                for (let p = start; p <= end; p++) pages.push(p);
                                return (
                                    <>
                                        {start > 1 && <span style={{ color: '#999', fontSize: '0.85rem' }}>…</span>}
                                        {pages.map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setPage(p)}
                                                style={{
                                                    padding: '0.4rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem',
                                                    border: `1px solid ${p === page ? '#000' : '#ddd'}`,
                                                    background: p === page ? '#000' : '#fff',
                                                    color: p === page ? '#fff' : '#333', fontWeight: p === page ? 600 : 400,
                                                }}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                        {end < meta.totalPages && <span style={{ color: '#999', fontSize: '0.85rem' }}>…</span>}
                                    </>
                                );
                            })()}

                            <button
                                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                disabled={page >= meta.totalPages}
                                style={{ padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', cursor: page >= meta.totalPages ? 'not-allowed' : 'pointer', opacity: page >= meta.totalPages ? 0.45 : 1, display: 'flex', alignItems: 'center' }}
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="modal-overlay" onClick={handleCloseModal} style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                            <h2>Order Details #{selectedOrder.orderNumber || selectedOrder.id}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                    onClick={() => downloadFile(
                                        `/orders/${selectedOrder.id}/invoice.pdf`,
                                        orderPdfFileName(selectedOrder.customer?.name, selectedOrder.orderNumber || selectedOrder.id, 'invoice'),
                                        `invoice-${selectedOrder.id}`
                                    )}
                                    disabled={downloading === `invoice-${selectedOrder.id}`}
                                    style={{
                                        padding: '0.6rem 1rem', background: '#000', color: '#fff', border: 'none',
                                        borderRadius: '4px', cursor: 'pointer', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap'
                                    }}
                                >
                                    <FileText size={16} />
                                    {downloading === `invoice-${selectedOrder.id}` ? 'Preparing…' : 'Download Invoice'}
                                </button>
                                <button onClick={() => setSelectedOrder(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                            <div>
                                <h3>Customer Info</h3>
                                <p><strong>Name:</strong> {selectedOrder.customer?.name}</p>
                                <p><strong>Email:</strong> {selectedOrder.customer?.email}</p>
                                <p><strong>Phone:</strong> {selectedOrder.customer?.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <h3>Shipping Info</h3>
                                <p><strong>Address:</strong> {selectedOrder.shippingAddress}</p>
                                <p><strong>Note:</strong> {selectedOrder.specialNote || 'None'}</p>
                                <p><strong>Payment:</strong> {selectedOrder.paymentMethod}</p>
                            </div>
                        </div>

                        {/* Cancellation Request Section */}
                        {selectedOrder.status === 'Cancellation Requested' && (
                            <div style={{ marginBottom: '2rem', padding: '1rem', background: '#fff5f5', border: '1px solid #fc8181', borderRadius: '8px' }}>
                                <h3 style={{ color: '#c53030', marginBottom: '0.5rem' }}>Cancellation Requested</h3>
                                <p><strong>Reason:</strong> {selectedOrder.cancellationReason}</p>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button
                                        onClick={() => {
                                            handleStatusChange(selectedOrder.id, 'Cancelled');
                                            setSelectedOrder(prev => ({ ...prev, status: 'Cancelled' }));
                                        }}
                                        style={{ padding: '0.5rem 1rem', background: '#c53030', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Approve Cancellation
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleStatusChange(selectedOrder.id, 'Pending');
                                            setSelectedOrder(prev => ({ ...prev, status: 'Pending' }));
                                        }}
                                        style={{ padding: '0.5rem 1rem', background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Reject (Revert to Pending)
                                    </button>
                                </div>
                            </div>
                        )}

                        <h3>Order Items</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                            <thead style={{ background: '#f9f9f9', borderBottom: '2px solid #eee' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Product</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Details</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Qty</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedOrder.items.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <img src={item.product?.imageUrl} alt="" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', background: '#f0f0f0' }} />
                                            <span>{item.product?.name}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                            {item.selectedSize && <div>Size: {item.selectedSize}</div>}
                                            {item.selectedColor && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    Color:
                                                    <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: item.selectedColor, border: '1px solid #ddd' }}></span>
                                                </div>
                                            )}

                                            {/* Dress measurements the customer submitted (inches). */}
                                            {measurementGroupsOf(item.measurements).length > 0 ? (
                                                <div style={{ marginTop: '0.5rem', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '0.5rem 0.6rem' }}>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.25rem' }}>
                                                        Measurements (inches)
                                                    </div>
                                                    {measurementGroupsOf(item.measurements).map(group => (
                                                        <div key={group.title} style={{ marginBottom: '0.2rem' }}>
                                                            <div style={{ fontSize: '0.72rem', color: '#888' }}>{group.title}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#222', lineHeight: 1.5 }}>
                                                                {group.rows.map(([l, v]) => `${l} ${v}`).join(', ')}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#aaa', fontStyle: 'italic' }}>
                                                    No measurements recorded
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{item.price}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="4" style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>Total Amount:</td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>{selectedOrder.totalAmount.toFixed(2)} BDT</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminOrders;

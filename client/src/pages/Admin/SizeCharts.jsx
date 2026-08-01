import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const AdminSizeCharts = () => {
    const { confirm } = useNotification();
    const [charts, setCharts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    // Form State
    const [name, setName] = useState('');
    const [params, setParams] = useState(['Chest', 'Length']); // e.g., ["Chest", "Length"]
    const [sizes, setSizes] = useState(['S', 'M', 'L', 'XL']);   // e.g., ["S", "M"]
    const [chartData, setChartData] = useState({});
    // chartData structure: { "S": ["20", "28"], "M": ["22", "29"] } where index matches params

    useEffect(() => {
        fetchCharts();
    }, []);

    const fetchCharts = async () => {
        try {
            const res = await api.get('/size-charts');
            setCharts(res.data);
        } catch (err) {
            console.error('Failed to fetch charts', err);
        }
    };

    const handleParamChange = (idx, val) => {
        const newParams = [...params];
        newParams[idx] = val;
        setParams(newParams);
    };

    const addParam = () => setParams([...params, '']);
    const removeParam = (idx) => {
        const newParams = params.filter((_, i) => i !== idx);
        setParams(newParams);
        // Clean up data? Ideally yes, but for now simple is fine, display will ignore extra data
    };

    const handleSizeChange = (idx, val) => {
        const newSizes = [...sizes];
        const oldSize = sizes[idx];
        newSizes[idx] = val;

        // If we rename a size, we should migrate the data
        if (chartData[oldSize]) {
            const data = chartData[oldSize];
            const newData = { ...chartData, [val]: data };
            delete newData[oldSize];
            setChartData(newData);
        }

        setSizes(newSizes);
    };

    const addSize = () => setSizes([...sizes, '']);
    const removeSize = (idx) => {
        const sizeToRemove = sizes[idx];
        const newSizes = sizes.filter((_, i) => i !== idx);
        setSizes(newSizes);
        const newData = { ...chartData };
        delete newData[sizeToRemove];
        setChartData(newData);
    };

    const handleDataChange = (size, paramIdx, val) => {
        const currentSizeData = chartData[size] ? [...chartData[size]] : new Array(params.length).fill('');
        // Ensure array is long enough if we added params recently
        while (currentSizeData.length < params.length) currentSizeData.push('');

        currentSizeData[paramIdx] = val;
        setChartData({
            ...chartData,
            [size]: currentSizeData
        });
    };

    const openModal = (chart = null) => {
        if (chart) {
            setIsEditing(true);
            setEditId(chart.id);
            setName(chart.name);
            const content = typeof chart.content === 'string' ? JSON.parse(chart.content) : chart.content;
            setParams(content.params || []);
            setSizes(Object.keys(content.data || {}));
            setChartData(content.data || {});
        } else {
            setIsEditing(false);
            setEditId(null);
            setName('');
            setParams(['Chest', 'Length']);
            setSizes(['S', 'M', 'L', 'XL']);
            setChartData({});
        }
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!name) return alert('Name is required');

        // Clean up empty params/sizes
        const cleanParams = params.filter(p => p.trim() !== '');
        const cleanSizes = sizes.filter(s => s.trim() !== '');

        // Rebuild data to match clean structure and ensure order
        const cleanData = {};
        cleanSizes.forEach(size => {
            // Get data based on original size name (which might be same)
            // But here we rely on the state current values. 
            // Limitation: If duplicate size names exist, this breaks. Assume unique.
            const row = chartData[size] || [];
            // Slice/Pad to match param length
            const cleanRow = cleanParams.map((_, i) => row[i] || '');
            cleanData[size] = cleanRow;
        });

        const payload = {
            name,
            content: {
                params: cleanParams,
                data: cleanData
            }
        };

        try {
            if (isEditing) {
                await api.put(`/size-charts/${editId}`, payload);
            } else {
                await api.post('/size-charts', payload);
            }
            setShowModal(false);
            fetchCharts();
        } catch (err) {
            console.error(err);
            alert('Failed to save');
        }
    };

    const handleDelete = async (id) => {
        const shouldDelete = await confirm({
            title: 'Delete Size Chart',
            message: 'Delete this chart?',
            confirmLabel: 'Delete Chart',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try {
            await api.delete(`/size-charts/${id}`);
            fetchCharts();
        } catch (err) {
            console.error(err);
            alert('Failed to delete');
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Size Charts</h2>
                <button
                    onClick={() => openModal()}
                    style={{ background: '#000', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Plus size={18} /> New Chart
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {charts.map(chart => (
                    <div key={chart.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{chart.name}</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => openModal(chart)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#007bff' }}><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(chart.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#d62020' }}><Trash2 size={18} /></button>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            {(typeof chart.content === 'string' ? JSON.parse(chart.content) : chart.content)?.params?.join(', ') || 'No params'}
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '900px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem' }}>{isEditing ? 'Edit Size Chart' : 'New Size Chart'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
                        </div>

                        {/* Name */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Template Name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Men's T-Shirt Standard"
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                        </div>

                        {/* Configuration Grid */}
                        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
                            {/* Parameters (Cols) */}
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Measurement Parameters</label>
                                {params.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input
                                            value={p}
                                            onChange={e => handleParamChange(i, e.target.value)}
                                            placeholder="e.g. Chest"
                                            style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                        />
                                        <button onClick={() => removeParam(i)} style={{ color: '#d62020', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={addParam} style={{ fontSize: '0.9rem', color: '#007bff', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Plus size={16} /> Add Parameter
                                </button>
                            </div>

                            {/* Sizes (Rows) */}
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Sizes</label>
                                {sizes.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input
                                            value={s}
                                            onChange={e => handleSizeChange(i, e.target.value)}
                                            placeholder="e.g. S, M, XL"
                                            style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                        />
                                        <button onClick={() => removeSize(i)} style={{ color: '#d62020', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={addSize} style={{ fontSize: '0.9rem', color: '#007bff', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Plus size={16} /> Add Size
                                </button>
                            </div>
                        </div>

                        {/* Data Entry Table */}
                        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Chart Values (Inches)</label>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                                <thead>
                                    <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', borderRight: '1px solid #ddd' }}>Size</th>
                                        {params.map((p, i) => (
                                            <th key={i} style={{ padding: '0.75rem', textAlign: 'left', borderRight: '1px solid #ddd' }}>{p || `Param ${i + 1}`}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sizes.map((size, rIdx) => (
                                        <tr key={rIdx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '0.75rem', fontWeight: 500, borderRight: '1px solid #ddd' }}>{size || `Size ${rIdx + 1}`}</td>
                                            {params.map((_, cIdx) => (
                                                <td key={cIdx} style={{ padding: '0.5rem', borderRight: '1px solid #ddd' }}>
                                                    <input
                                                        value={(chartData[size] && chartData[size][cIdx]) || ''}
                                                        onChange={(e) => handleDataChange(size, cIdx, e.target.value)}
                                                        placeholder="0"
                                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #eee', borderRadius: '4px' }}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                                * Enter values in <strong>Inches</strong>. The frontend will automatically offer a CM conversion toggle.
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={() => setShowModal(false)} style={{ padding: '0.75rem 1.5rem', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleSubmit} style={{ padding: '0.75rem 1.5rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Save size={18} /> Save Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSizeCharts;

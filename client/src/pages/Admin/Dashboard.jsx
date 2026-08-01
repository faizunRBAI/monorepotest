import React, { useState, useEffect } from 'react';
import api from '../../api';

const AdminDashboard = () => {
    const [hero, setHero] = useState({
        title: '',
        subtitle: '',
        discountText: '',
        description: '',
        imageUrl: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Fetch initial data
    useEffect(() => {
        // In a real app, we would fetch current data here
        // api.get('/hero').then(res => setHero(res.data)).catch(console.error);

        // For now, load default state or mock to avoid crashing before backend is ready
        setHero({
            title: 'Valentine Day Special',
            subtitle: 'flat',
            discountText: '50% DISCOUNT',
            description: 'ON 200+ ITEMS',
            imageUrl: 'https://images.unsplash.com/photo-1620799140408-ed5341cd2431?q=80&w=2000&auto=format&fit=crop'
        });
    }, []);

    const handleChange = (e) => {
        setHero({ ...hero, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.put('/hero', hero);
            setMessage('Hero section updated successfully!');
        } catch (error) {
            setMessage('Failed to update. Is the backend running?');
            console.error(error);
        }
        setLoading(false);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <div className="flex-between" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Admin Dashboard</h1>
                {/* Logout button removed */}
            </div>
            <p>Manage website content here.</p>

            <div style={{ background: '#f9f9f9', padding: '2rem', borderRadius: '8px', marginTop: '2rem' }}>
                <h2>Dashboard</h2>
                <p>Welcome to the Admin Dashboard.</p>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                    <a href="/admin/products" style={{ padding: '1rem', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', textDecoration: 'none', color: '#000', fontWeight: 600 }}>
                        Manage Products
                    </a>
                    <a href="/admin/orders" style={{ padding: '1rem', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', textDecoration: 'none', color: '#000', fontWeight: 600 }}>
                        View Orders
                    </a>
                    <a href="/admin/settings" style={{ padding: '1rem', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', textDecoration: 'none', color: '#000', fontWeight: 600 }}>
                        Site Settings (Banners & Popups)
                    </a>
                </div>
            </div>
        </div >
    );
};

export default AdminDashboard;

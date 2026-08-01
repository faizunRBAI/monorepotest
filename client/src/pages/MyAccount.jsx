import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../api';
import { User, Package, MapPin, LogOut, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router';

const MyAccount = () => {
    const { user, logout, token, updateUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // Profile State
    const [profileData, setProfileData] = useState({
        name: '', phone: '', address: '', city: '', zip: '', location: ''
    });
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        setProfileData({
            name: user.name || '',
            phone: user.phone || '',
            address: user.address || '',
            city: user.city || '',
            zip: user.zip || '',
            location: user.location || ''
        });
        fetchOrders();
    }, [user, navigate]);

    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            const res = await api.get('/orders/mine');
            setOrders(res.data);
        } catch (err) {
            console.error("Failed to fetch orders", err);
        }
        setLoadingOrders(false);
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            const res = await api.put('/customer/profile', profileData);
            alert('Profile Updated Successfully');
            // Update context immediatey
            updateUser(res.data);
        } catch (err) {
            alert('Failed to update profile');
        }
        setProfileLoading(false);
    };

    const { addToCart } = useCart();

    const handleReorder = async (orderItems) => {
        orderItems.forEach(item => {
            const product = {
                id: item.productId,
                name: item.product?.name,
                imageUrl: item.product?.imageUrl,
                price: item.price,
                // So checkout demands only the groups this product actually needs.
                measurementGroups: item.measurementGroups
            };
            // Carry the original measurements over so a reorder is tailored the same way.
            addToCart(product, item.quantity, item.selectedSize, item.selectedColor, item.measurements || null);
        });
        alert("Items added to cart!");
        navigate('/checkout');
    };

    return (
        <div className="container" style={{ padding: '3rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '2rem' }}>My Account</h1>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Sidebar */}
                <div style={{ flex: '0 0 250px', background: '#f9f9f9', borderRadius: '8px', overflow: 'hidden', height: 'fit-content' }}>
                    <button
                        onClick={() => setActiveTab('profile')}
                        style={{ width: '100%', padding: '1rem', textAlign: 'left', border: 'none', background: activeTab === 'profile' ? '#000' : 'transparent', color: activeTab === 'profile' ? '#fff' : '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={18} /> Profile & Address
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        style={{ width: '100%', padding: '1rem', textAlign: 'left', border: 'none', background: activeTab === 'orders' ? '#000' : 'transparent', color: activeTab === 'orders' ? '#fff' : '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={18} /> My Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        style={{ width: '100%', padding: '1rem', textAlign: 'left', border: 'none', background: activeTab === 'security' ? '#000' : 'transparent', color: activeTab === 'security' ? '#fff' : '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MapPin size={18} /> Change Password
                    </button>
                    <button
                        onClick={() => logout()}
                        style={{ width: '100%', padding: '1rem', textAlign: 'left', border: 'none', background: 'transparent', color: '#d62020', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid #eee' }}>
                        <LogOut size={18} /> Logout
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                    {activeTab === 'profile' && (
                        <div>
                            <h2 style={{ marginBottom: '1.5rem' }}>Edit Profile</h2>
                            <form onSubmit={handleProfileUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Full Name</label>
                                    <input
                                        value={profileData.name}
                                        onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Phone</label>
                                    <input
                                        value={profileData.phone}
                                        onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                                        style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                    />
                                </div>

                                <button type="submit" disabled={profileLoading} style={{ gridColumn: 'span 2', padding: '1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                                    {profileLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div style={{ maxWidth: '500px' }}>
                            <h2 style={{ marginBottom: '1.5rem' }}>Change Password</h2>
                            <ChangePasswordForm />
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div>
                            <h2 style={{ marginBottom: '1.5rem' }}>Order History</h2>
                            {loadingOrders ? <p>Loading orders...</p> : (
                                orders.length === 0 ? <p>No orders found.</p> : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {orders.map(order => (
                                            <div key={order.id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f9f9f9', paddingBottom: '0.5rem' }}>
                                                    <div>
                                                        <strong>Order #{order.id}</strong>
                                                        <span style={{ marginLeft: '1rem', color: '#666', fontSize: '0.9rem' }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{
                                                            padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600,
                                                            background: order.status === 'Delivered' ? '#eafaf1' : '#fff3cd',
                                                            color: order.status === 'Delivered' ? '#2ecc71' : '#f1c40f'
                                                        }}>
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ marginBottom: '1rem' }}>
                                                    {order.items.map(item => (
                                                        <div key={item.id} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                                            <div style={{ width: '40px', height: '40px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                                {item.product?.imageUrl && <img src={item.product.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <p style={{ margin: 0, fontWeight: 500 }}>{item.product?.name || 'Product'}</p>
                                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>qty: {item.quantity}</p>
                                                            </div>
                                                            <div>{item.price}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #f9f9f9' }}>
                                                    <strong>Total: {order.totalAmount} BDT</strong>
                                                    <button onClick={() => handleReorder(order.items)} style={{ padding: '0.5rem 1rem', border: '1px solid #000', background: 'transparent', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                        Reorder
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const PasswordInput = ({ label, value, onChange, show, setShow }) => (
    <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{label}</label>
        <div style={{ position: 'relative' }}>
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={onChange}
                style={{ width: '100%', padding: '0.8rem', paddingRight: '2.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                required
            />
            <button
                type="button"
                onClick={() => setShow(!show)}
                style={{
                    position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer', color: '#666'
                }}
            >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    </div>
);

const ChangePasswordForm = () => {
    const [pData, setPData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (pData.newPassword !== pData.confirmPassword) {
            return alert("New passwords don't match");
        }
        if (pData.newPassword.length < 6) {
            return alert("Password should be at least 6 characters");
        }

        setLoading(true);
        try {
            await api.post('/customer/change-password', {
                currentPassword: pData.currentPassword,
                newPassword: pData.newPassword
            });
            alert('Password changed successfully');
            setPData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to change password');
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
            <PasswordInput
                label="Current Password"
                value={pData.currentPassword}
                onChange={e => setPData({ ...pData, currentPassword: e.target.value })}
                show={showCurrent}
                setShow={setShowCurrent}
            />
            <PasswordInput
                label="New Password"
                value={pData.newPassword}
                onChange={e => setPData({ ...pData, newPassword: e.target.value })}
                show={showNew}
                setShow={setShowNew}
            />
            <PasswordInput
                label="Confirm New Password"
                value={pData.confirmPassword}
                onChange={e => setPData({ ...pData, confirmPassword: e.target.value })}
                show={showConfirm}
                setShow={setShowConfirm}
            />
            <button type="submit" disabled={loading} style={{ padding: '1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                {loading ? 'Updating...' : 'Update Password'}
            </button>
        </form>
    );
};

export default MyAccount;

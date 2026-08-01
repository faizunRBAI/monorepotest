import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

// Decode JWT payload without a library
const getTokenUsername = () => {
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.username || null;
    } catch {
        return null;
    }
};

const AdminManagement = () => {
    const { confirm } = useNotification();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentUsername = getTokenUsername();

    // New admin form
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [creating, setCreating] = useState(false);

    // Password reset modal
    const [resetTarget, setResetTarget] = useState(null); // { id, username }
    const [resetPassword, setResetPassword] = useState('');
    const [resetting, setResetting] = useState(false);

    useEffect(() => { fetchAdmins(); }, []);

    const fetchAdmins = async () => {
        try {
            const res = await api.get('/admins');
            setAdmins(res.data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.post('/admins', { username: newUsername.trim(), password: newPassword });
            setNewUsername('');
            setNewPassword('');
            fetchAdmins();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create admin');
        }
        setCreating(false);
    };

    const handleDelete = async (admin) => {
        const shouldDelete = await confirm({
            title: 'Delete Admin Account',
            message: `Delete admin "${admin.username}"? This cannot be undone.`,
            confirmLabel: 'Delete Admin',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try {
            await api.delete(`/admins/${admin.id}`);
            fetchAdmins();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete admin');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetting(true);
        try {
            await api.put(`/admins/${resetTarget.id}/password`, { newPassword: resetPassword });
            alert(`Password for "${resetTarget.username}" updated successfully.`);
            setResetTarget(null);
            setResetPassword('');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update password');
        }
        setResetting(false);
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <ShieldCheck size={28} />
                <h1 style={{ margin: 0 }}>Admin Accounts</h1>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {/* Existing admins list */}
                <div style={{ flex: 2, minWidth: '300px', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', background: '#f9f9f9' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Current Admins</h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f4f6f8', textAlign: 'left' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem' }}>Username</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map(admin => (
                                <tr key={admin.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>
                                        {admin.username}
                                        {admin.username === currentUsername && (
                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#e6fffa', color: '#2c7a7b', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>
                                                You
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.875rem 1rem' }}>
                                        <span style={{ fontSize: '0.8rem', background: '#e6fffa', color: '#2c7a7b', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
                                            Active
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.875rem 1rem', display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => { setResetTarget(admin); setResetPassword(''); }}
                                            title="Change password"
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
                                        >
                                            <KeyRound size={14} /> Password
                                        </button>
                                        {admin.username !== currentUsername && (
                                            <button
                                                onClick={() => handleDelete(admin)}
                                                title="Delete admin"
                                                style={{ display: 'flex', alignItems: 'center', padding: '0.4rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d62020' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Add new admin form */}
                <div style={{ flex: 1, minWidth: '260px', background: '#fff', borderRadius: '8px', border: '1px solid #eee', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', background: '#f9f9f9' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Add New Admin</h3>
                    </div>
                    <form onSubmit={handleCreate} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Username</label>
                            <input
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                                placeholder="e.g. manager1"
                                required
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Min. 6 characters"
                                required
                                minLength={6}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={creating}
                            style={{ padding: '0.875rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, opacity: creating ? 0.7 : 1 }}
                        >
                            {creating ? 'Creating...' : 'Create Admin'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Password Reset Modal */}
            {resetTarget && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setResetTarget(null); }}
                >
                    <div style={{ background: '#fff', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ marginBottom: '0.25rem' }}>Change Password</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            Setting new password for <strong>{resetTarget.username}</strong>
                        </p>
                        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="password"
                                value={resetPassword}
                                onChange={e => setResetPassword(e.target.value)}
                                placeholder="New password (min. 6 characters)"
                                required
                                minLength={6}
                                autoFocus
                                style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="submit" disabled={resetting}
                                    style={{ flex: 1, padding: '0.75rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, opacity: resetting ? 0.7 : 1 }}>
                                    {resetting ? 'Saving...' : 'Save Password'}
                                </button>
                                <button type="button" onClick={() => setResetTarget(null)}
                                    style={{ flex: 1, padding: '0.75rem', background: '#f4f4f4', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminManagement;

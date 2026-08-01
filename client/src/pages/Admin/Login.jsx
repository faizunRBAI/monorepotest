import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../../api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/login', { username, password });
            localStorage.setItem('adminToken', res.data.token);
            // No api.defaults here — that default also rode along on storefront
            // requests. The interceptor in api.js picks the admin token on /admin.
            navigate('/admin');
        } catch (err) {
            const msg = err.response?.data?.error;
            setError(msg || 'Invalid Username or Password');
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#f4f4f4'
        }}>
            <form onSubmit={handleLogin} style={{
                background: '#fff',
                padding: '3rem',
                borderRadius: '8px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Admin Login</h2>
                {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem' }}
                        placeholder="admin"
                    />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem' }}
                        placeholder="****"
                    />
                </div>

                <button type="submit" style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600
                }}>
                    LOGIN
                </button>
            </form>
        </div>
    );
};

export default Login;

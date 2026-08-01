import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Customer tokens last 7 days. A stored-but-expired one used to leave the UI
// looking logged in while every authenticated request failed — and checkout then
// withheld the name/phone the server needs to fall back to a guest order, so the
// order was silently rejected. Treat an expired token as no session at all.
const isTokenUsable = (token) => {
    try {
        const { exp } = JSON.parse(atob(token.split('.')[1]));
        return !exp || exp * 1000 > Date.now();
    } catch {
        return false;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('userToken'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // The request interceptor in api.js reads the token straight from
        // localStorage. Setting api.defaults here as well would apply the customer
        // token to admin-panel requests too, since both share the axios instance.
        if (token && isTokenUsable(token)) {
            const storedUser = localStorage.getItem('userData');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } else {
            if (token) {
                // Expired or malformed — clear it so the UI stops claiming a session.
                localStorage.removeItem('userToken');
                localStorage.removeItem('userData');
                setToken(null);
            }
            setUser(null);
        }
        setLoading(false);
    }, [token]);

    const login = async (email, password) => {
        try {
            const res = await api.post('/customer/login', { email, password });
            const { token, customer } = res.data;

            setToken(token);
            setUser(customer);

            localStorage.setItem('userToken', token);
            localStorage.setItem('userData', JSON.stringify(customer));
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Login failed'
            };
        }
    };

    const signup = async (name, email, password, phone) => {
        try {
            const res = await api.post('/customer/signup', { name, email, password, phone });
            if (res.data.needsVerification) {
                return { success: true, needsVerification: true, email: res.data.email };
            }
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Signup failed'
            };
        }
    };

    const verifyOtp = async (email, otp) => {
        try {
            const res = await api.post('/customer/verify-otp', { email, otp });
            const { token, customer } = res.data;
            setToken(token);
            setUser(customer);
            localStorage.setItem('userToken', token);
            localStorage.setItem('userData', JSON.stringify(customer));
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Verification failed'
            };
        }
    };

    const verifyResetOtp = async (email, otp) => {
        try {
            await api.post('/customer/verify-reset-otp', { email, otp });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.error || 'Verification failed' };
        }
    };

    const forgotPassword = async (email) => {
        try {
            await api.post('/customer/forgot-password', { email });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.error || 'Failed to send reset email' };
        }
    };

    const resetPassword = async (email, otp, newPassword) => {
        try {
            await api.post('/customer/reset-password', { email, otp, newPassword });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.error || 'Password reset failed' };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        sessionStorage.clear();
        // Force refresh to clear any in-memory states from other components
        window.location.href = '/';
    };

    const updateUser = (userData) => {
        setUser(userData);
        localStorage.setItem('userData', JSON.stringify(userData));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, signup, verifyOtp, forgotPassword, verifyResetOtp, resetPassword, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

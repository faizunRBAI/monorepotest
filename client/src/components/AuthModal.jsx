import React, { useState } from 'react';
import { X, Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Screens: 'login' | 'signup' | 'verify-otp' | 'forgot' | 'reset-otp' | 'reset-password'
const AuthModal = ({ isOpen, onClose }) => {
    const { login, signup, verifyOtp, forgotPassword, verifyResetOtp, resetPassword } = useAuth();

    const [screen, setScreen] = useState('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
    const [forgotEmail, setForgotEmail] = useState('');
    const [pendingEmail, setPendingEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    if (!isOpen) return null;

    const handleClose = () => {
        setScreen('login'); setError(''); setSuccessMsg('');
        setOtp(''); setNewPassword(''); setConfirmPassword(''); setForgotEmail(''); setPendingEmail('');
        setSignupConfirmPassword('');
        setFormData({ name: '', email: '', password: '', phone: '' });
        setShowPassword(false); setShowNewPassword(false); setShowConfirmPassword(false); setShowSignupConfirmPassword(false);
        onClose();
    };

    const clearError = () => { setError(''); setSuccessMsg(''); };

    // --- Shared UI helpers ---
    const wrap = (children, maxWidth = '400px') => (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
            <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                <button onClick={handleClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
                {successMsg && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>{successMsg}</div>}
                {children}
            </div>
        </div>
    );

    const passwordField = (value, onChange, show, setShow, placeholder = 'Password') => (
        <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: '#666' }} />
            <input type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange} required
                style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 3rem', borderRadius: '4px', border: '1px solid #ddd' }} />
            <button type="button" onClick={() => setShow(!show)}
                style={{ position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 0, display: 'flex' }}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );

    const otpInput = (
        <input type="text" inputMode="numeric" maxLength={6} placeholder="Enter 6-digit code"
            value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required
            style={{ width: '100%', padding: '0.9rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.5rem' }} />
    );

    const submitBtn = (label, disabled = false) => (
        <button type="submit" disabled={loading || disabled}
            style={{ padding: '0.8rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: (loading || disabled) ? 'not-allowed' : 'pointer', opacity: (loading || disabled) ? 0.6 : 1 }}>
            {loading ? 'Processing...' : label}
        </button>
    );

    // --- Login / Signup ---
    if (screen === 'login' || screen === 'signup') {
        const isLogin = screen === 'login';
        const handleSubmit = async (e) => {
            e.preventDefault(); clearError(); setLoading(true);
            if (isLogin) {
                const res = await login(formData.email, formData.password);
                setLoading(false);
                if (res.success) { handleClose(); }
                else if (res.needsVerification) { setPendingEmail(res.email); setScreen('verify-otp'); }
                else setError(res.error);
            } else {
                if (formData.password !== signupConfirmPassword) {
                    setError('Passwords do not match.'); setLoading(false); return;
                }
                const res = await signup(formData.name, formData.email, formData.password, formData.phone);
                setLoading(false);
                if (res.success && res.needsVerification) { setPendingEmail(res.email); setScreen('verify-otp'); }
                else if (!res.success) setError(res.error);
            }
        };
        return wrap(
            <>
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {!isLogin && (
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: '#666' }} />
                            <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
                                style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                        </div>
                    )}
                    <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: '#666' }} />
                        <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required
                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                    </div>
                    {!isLogin && (
                        <div style={{ position: 'relative' }}>
                            <Phone size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: '#666' }} />
                            <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                        </div>
                    )}
                    {passwordField(formData.password, e => setFormData({ ...formData, password: e.target.value }), showPassword, setShowPassword)}
                    {!isLogin && passwordField(signupConfirmPassword, e => setSignupConfirmPassword(e.target.value), showSignupConfirmPassword, setShowSignupConfirmPassword, 'Confirm Password')}
                    {isLogin && (
                        <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                            <button type="button" onClick={() => { setScreen('forgot'); clearError(); }}
                                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
                                Forgot password?
                            </button>
                        </div>
                    )}
                    {submitBtn(isLogin ? 'Login' : 'Sign Up')}
                </form>
                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                    <button onClick={() => { setScreen(isLogin ? 'signup' : 'login'); clearError(); }}
                        style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                        {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </div>
            </>
        );
    }

    // --- Verify Email OTP (after signup) ---
    if (screen === 'verify-otp') {
        const handleVerify = async (e) => {
            e.preventDefault(); clearError(); setLoading(true);
            const res = await verifyOtp(pendingEmail, otp);
            setLoading(false);
            if (res.success) handleClose();
            else setError(res.error);
        };
        return wrap(
            <>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <ShieldCheck size={48} style={{ color: '#000', marginBottom: '0.75rem' }} />
                    <h2 style={{ marginBottom: '0.5rem' }}>Verify your email</h2>
                    <p style={{ color: '#666', fontSize: '0.9rem' }}>We sent a 6-digit code to<br /><strong>{pendingEmail}</strong></p>
                </div>
                <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {otpInput}
                    {submitBtn('Verify Email', otp.length < 6)}
                </form>
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#888' }}>
                    Didn't get the code? Check spam.<br />
                    <button onClick={() => { setScreen('signup'); setOtp(''); clearError(); }} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>Go back</button>
                </p>
            </>, '380px'
        );
    }

    // --- Forgot Password: Enter Email ---
    if (screen === 'forgot') {
        const handleForgot = async (e) => {
            e.preventDefault(); clearError(); setLoading(true);
            const res = await forgotPassword(forgotEmail);
            setLoading(false);
            if (res.success) { setPendingEmail(forgotEmail); setScreen('reset-otp'); setSuccessMsg('If that email is registered, a reset code has been sent.'); }
            else setError(res.error);
        };
        return wrap(
            <>
                <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Forgot Password</h2>
                <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Enter your email to receive a reset code.</p>
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: '#666' }} />
                        <input type="email" placeholder="Email Address" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                    </div>
                    {submitBtn('Send Reset Code')}
                </form>
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <button onClick={() => { setScreen('login'); clearError(); }} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>Back to Login</button>
                </p>
            </>
        );
    }

    // --- Reset: Enter OTP only ---
    if (screen === 'reset-otp') {
        const handleVerifyReset = async (e) => {
            e.preventDefault(); clearError(); setLoading(true);
            const res = await verifyResetOtp(pendingEmail, otp);
            setLoading(false);
            if (res.success) { setScreen('reset-password'); setSuccessMsg(''); }
            else setError(res.error);
        };
        return wrap(
            <>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <ShieldCheck size={48} style={{ color: '#000', marginBottom: '0.75rem' }} />
                    <h2 style={{ marginBottom: '0.5rem' }}>Enter Reset Code</h2>
                    <p style={{ color: '#666', fontSize: '0.9rem' }}>We sent a 6-digit code to<br /><strong>{pendingEmail}</strong></p>
                </div>
                <form onSubmit={handleVerifyReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {otpInput}
                    {submitBtn('Verify Code', otp.length < 6)}
                </form>
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <button onClick={() => { setScreen('forgot'); setOtp(''); clearError(); }} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>Resend code</button>
                </p>
            </>, '380px'
        );
    }

    // --- Reset: Enter New Password + Confirm ---
    if (screen === 'reset-password') {
        const handleReset = async (e) => {
            e.preventDefault(); clearError();
            if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
            if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
            setLoading(true);
            const res = await resetPassword(pendingEmail, otp, newPassword);
            setLoading(false);
            if (res.success) { setSuccessMsg('Password reset! You can now log in.'); setScreen('login'); setOtp(''); setNewPassword(''); setConfirmPassword(''); }
            else setError(res.error);
        };
        return wrap(
            <>
                <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>New Password</h2>
                <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Choose a strong password for your account.</p>
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {passwordField(newPassword, e => setNewPassword(e.target.value), showNewPassword, setShowNewPassword, 'New password (min 6 chars)')}
                    {passwordField(confirmPassword, e => setConfirmPassword(e.target.value), showConfirmPassword, setShowConfirmPassword, 'Confirm new password')}
                    {submitBtn('Reset Password', newPassword.length < 6 || confirmPassword.length < 6)}
                </form>
            </>, '380px'
        );
    }

    return null;
};

export default AuthModal;

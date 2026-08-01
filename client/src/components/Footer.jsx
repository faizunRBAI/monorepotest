import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Facebook, Instagram, Twitter, MapPin, Mail, Phone } from 'lucide-react';
import api from '../api';

const Footer = () => {
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        api.get('/site-settings').then(res => setSettings(res.data)).catch(console.error);
    }, []);

    const year = new Date().getFullYear();

    return (
        <footer style={{ background: '#111', color: '#fff', paddingTop: '4rem', marginTop: 'auto' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '3rem', marginBottom: '3rem' }}>

                    {/* Brand Section */}
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#f1c40f' }}>
                            {settings?.companyName || 'GORUR GARI'}
                        </h2>
                        <p style={{ color: '#aaa', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                            Your one-stop shop for premium fashion. Quality products, fast delivery, and excellent customer service.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', padding: '0.5rem', background: '#222', borderRadius: '50%' }}><Facebook size={20} /></a>}
                            {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', padding: '0.5rem', background: '#222', borderRadius: '50%' }}><Instagram size={20} /></a>}
                            {settings?.twitter && <a href={settings.twitter} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', padding: '0.5rem', background: '#222', borderRadius: '50%' }}><Twitter size={20} /></a>}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem' }}>Quick Links</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <li><Link to="/terms" style={{ color: '#aaa', textDecoration: 'none', transition: 'color 0.3s' }}>Terms & Conditions</Link></li>
                            <li><Link to="/privacy" style={{ color: '#aaa', textDecoration: 'none', transition: 'color 0.3s' }}>Privacy Policy</Link></li>
                            <li><Link to="/cancellation" style={{ color: '#aaa', textDecoration: 'none', transition: 'color 0.3s' }}>Cancellation & Return Policy</Link></li>
                            <li><Link to="/faqs" style={{ color: '#aaa', textDecoration: 'none', transition: 'color 0.3s' }}>FAQs</Link></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem' }}>Contact Us</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', color: '#aaa' }}>
                                <MapPin size={20} color="#f1c40f" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span>{settings?.address || 'Dhaka, Bangladesh'}</span>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#aaa' }}>
                                <Mail size={20} color="#f1c40f" />
                                <a href={`mailto:${settings?.email || 'support@gorurgari.com'}`} style={{ color: '#aaa', textDecoration: 'none' }}>{settings?.email || 'support@gorurgari.com'}</a>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#aaa' }}>
                                <Phone size={20} color="#f1c40f" />
                                <a href={`tel:${settings?.phone || '+8801234567890'}`} style={{ color: '#aaa', textDecoration: 'none' }}>{settings?.phone || '+880 1234 567 890'}</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div style={{ borderTop: '1px solid #222', padding: '2rem 0', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                    <p style={{ marginBottom: '0.5rem' }}>&copy; {year} {settings?.companyName || 'GORUR GARI'}. All rights reserved.</p>
                    <p>
                        Developed by <a href="mailto:faizunnur71@gmail.com" style={{ color: '#f1c40f', textDecoration: 'none', fontWeight: 600 }}>Faizun</a>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

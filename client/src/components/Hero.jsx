import React, { useEffect, useState, useRef } from 'react';
import api from '../api';

const Hero = () => {
    const [banners, setBanners] = useState([]);
    const [current, setCurrent] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        api.get('/hero')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [res.data];
                setBanners(data.filter(b => b && b.imageUrl));
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (banners.length <= 1) return;
        intervalRef.current = setInterval(() => {
            setCurrent(prev => (prev + 1) % banners.length);
        }, 2000);
        return () => clearInterval(intervalRef.current);
    }, [banners.length]);

    if (banners.length === 0) {
        return <div style={{ height: '400px', background: '#f0f0f0' }} />;
    }

    const banner = banners[current];
    const hasText = banner.title || banner.subtitle || banner.discountText || banner.description;

    return (
        <section style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#000' }}>
            {/* Slides */}
            {banners.map((b, i) => (
                <div
                    key={b.id}
                    style={{
                        position: i === 0 ? 'relative' : 'absolute',
                        top: 0, left: 0, width: '100%', height: '100%',
                        opacity: i === current ? 1 : 0,
                        transition: 'opacity 0.6s ease-in-out',
                        pointerEvents: i === current ? 'auto' : 'none'
                    }}
                >
                    <img
                        src={b.imageUrl}
                        alt={b.title || 'Banner'}
                        fetchPriority={i === 0 ? 'high' : 'low'}
                        style={{
                            width: '100%',
                            height: '100%',
                            maxHeight: '50vh',
                            objectFit: 'cover',
                            display: 'block'
                        }}
                    />
                </div>
            ))}

            {/* Text overlay on current banner */}
            {hasText && (
                <div className="container" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: '#fff',
                    width: '100%',
                    padding: '1rem',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    pointerEvents: 'none'
                }}>
                    {banner.title && <h2 style={{ fontFamily: 'cursive', fontSize: 'clamp(1.5rem, 5vw, 3rem)', marginBottom: '0.5rem' }}>{banner.title}</h2>}
                    {banner.subtitle && <h3 style={{ fontSize: 'clamp(1rem, 3vw, 2rem)', fontWeight: 300, marginBottom: '0.5rem' }}>{banner.subtitle}</h3>}
                    {banner.discountText && <h1 style={{ fontSize: 'clamp(3rem, 10vw, 8rem)', lineHeight: 1, fontWeight: 700, margin: '1rem 0' }}>{banner.discountText}</h1>}
                    {banner.description && <p style={{ letterSpacing: '0.2em', marginTop: '1rem', fontSize: 'clamp(0.8rem, 2vw, 1.2rem)' }}>{banner.description}</p>}
                </div>
            )}

            {/* Dot indicators (only if multiple banners) */}
            {banners.length > 1 && (
                <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '8px'
                }}>
                    {banners.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setCurrent(i);
                                clearInterval(intervalRef.current);
                                intervalRef.current = setInterval(() => {
                                    setCurrent(prev => (prev + 1) % banners.length);
                                }, 2000);
                            }}
                            style={{
                                width: i === current ? '24px' : '8px',
                                height: '8px',
                                borderRadius: '4px',
                                background: i === current ? '#fff' : 'rgba(255,255,255,0.5)',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

export default Hero;

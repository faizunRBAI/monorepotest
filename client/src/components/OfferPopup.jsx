import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router';
import api from '../api';

const OfferPopup = () => {
    const [ads, setAds] = useState([]);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user has seen popup explicitly closed (optional: session storage)
        const hasClosed = sessionStorage.getItem('popupClosed');
        if (!hasClosed) {
            fetchAds();
        }
    }, []);

    const fetchAds = async () => {
        try {
            const res = await api.get('/popup-ads');
            if (res.data && res.data.length > 0) {
                setAds(res.data);
                // Delay showing to let page load a bit
                setTimeout(() => setIsOpen(true), 2000);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        sessionStorage.setItem('popupClosed', 'true');
    };

    const handleAdClick = (ad) => {
        handleClose();
        if (ad.subCategoryId) {
            navigate(`/subcategory/${ad.subCategoryId}`);
        } else if (ad.categoryId) {
            navigate(`/category/${ad.categoryId}`);
        }
    };

    if (!isOpen || ads.length === 0) return null;

    const currentAd = ads[currentAdIndex];

    const nextAd = (e) => {
        e.stopPropagation();
        setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    };

    const prevAd = (e) => {
        e.stopPropagation();
        setCurrentAdIndex((prev) => (prev - 1 + ads.length) % ads.length);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div style={{ position: 'relative', maxWidth: '500px', width: '90%', background: '#fff', padding: '0', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                    onClick={handleClose}
                    style={{
                        position: 'absolute', top: '10px', right: '10px',
                        background: '#fff', border: 'none', borderRadius: '50%',
                        cursor: 'pointer', padding: '5px', zIndex: 10
                    }}
                >
                    <X size={20} />
                </button>

                <div
                    onClick={() => handleAdClick(currentAd)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                >
                    <img
                        src={currentAd.imageUrl}
                        alt="Offer"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                    />

                    {/* Navigation Arrows if multiple ads */}
                    {ads.length > 1 && (
                        <>
                            <button
                                onClick={prevAd}
                                style={{
                                    position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%',
                                    width: '30px', height: '30px', cursor: 'pointer', fontSize: '1.2rem'
                                }}>
                                &#8249;
                            </button>
                            <button
                                onClick={nextAd}
                                style={{
                                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%',
                                    width: '30px', height: '30px', cursor: 'pointer', fontSize: '1.2rem'
                                }}>
                                &#8250;
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfferPopup;

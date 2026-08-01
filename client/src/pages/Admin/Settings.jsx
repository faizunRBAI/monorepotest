import React, { useEffect, useState } from 'react';
import api from '../../api';

import getCroppedImg from '../../utils/cropImage';
import ImageCropper from '../../components/ImageCropper';
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const AdminSettings = () => {
    const { confirm } = useNotification();
    // Banner State
    const [banners, setBanners] = useState([]);

    // Popup Ads State
    const [ads, setAds] = useState([]);
    const [categories, setCategories] = useState([]);

    // New Ad State
    const [newAdCategory, setNewAdCategory] = useState('');
    const [newAdSubCategory, setNewAdSubCategory] = useState('');

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadType, setUploadType] = useState('banner'); // 'banner' or 'ad'

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchBanners();
        fetchAds();
        fetchCategories();
    }, []);

    const fetchBanners = () => {
        api.get('/banners').then(res => setBanners(res.data)).catch(err => console.error(err));
    };

    const fetchAds = () => {
        api.get('/popup-ads').then(res => setAds(res.data)).catch(err => console.error(err));
    };

    const fetchCategories = () => {
        api.get('/categories').then(res => setCategories(res.data)).catch(err => console.error(err));
    };

    const onFileChange = (e, type) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploadType(type);
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setSelectedFile(reader.result);
                setShowCropper(true);
            });
            reader.readAsDataURL(file);
        }
    };

    const onCropComplete = async (croppedImageBlob) => {
        setShowCropper(false);
        setLoading(true);

        const formData = new FormData();
        formData.append('image', croppedImageBlob, uploadType === 'banner' ? 'banner.jpg' : 'ad.jpg');

        try {
            // 1. Upload Image
            const uploadRes = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const imageUrl = uploadRes.data.imageUrl;

            if (uploadType === 'banner') {
                await api.post('/banners', { imageUrl, isActive: true });
                alert('Banner Uploaded!');
                fetchBanners();
            } else {
                await api.post('/popup-ads', {
                    imageUrl,
                    categoryId: newAdCategory || null,
                    subCategoryId: newAdSubCategory || null,
                    isActive: true
                });
                alert('Ad Uploaded!');
                fetchAds();
                // Reset selection
                setNewAdCategory('');
                setNewAdSubCategory('');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to upload');
        }
        setLoading(false);
    };

    // --- Banner Actions ---
    const handleToggleBanner = async (id) => {
        try { await api.put(`/banners/${id}/activate`); fetchBanners(); } catch (err) { alert('Error toggling banner'); }
    };
    const handleDeleteBanner = async (id) => {
        const shouldDelete = await confirm({
            title: 'Delete Banner',
            message: 'Delete this banner?',
            confirmLabel: 'Delete Banner',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try { await api.delete(`/banners/${id}`); fetchBanners(); } catch (err) { alert('Error deleting banner'); }
    };

    // --- Ad Actions ---
    const handleToggleAd = async (id) => {
        try { await api.put(`/popup-ads/${id}/toggle`); fetchAds(); } catch (err) { alert('Error toggling ad'); }
    };
    const handleDeleteAd = async (id) => {
        const shouldDelete = await confirm({
            title: 'Delete Popup Ad',
            message: 'Delete this ad?',
            confirmLabel: 'Delete Ad',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try { await api.delete(`/popup-ads/${id}`); fetchAds(); } catch (err) { alert('Error deleting ad'); }
    };

    // --- Settings State ---
    const [settings, setSettings] = useState({
        logoUrl: '',
        companyName: '',
        address: '',
        email: '',
        phone: '',
        facebook: '',
        instagram: '',
        twitter: '',
        termsContent: '',
        privacyContent: '',
        cancellationContent: '',
        faqsContent: '',
        deliveryChargeInside: 60,
        deliveryChargeOutside: 120,
        mfsNumbers: '',
        mfsInstructions: ''
    });

    useEffect(() => {
        fetchSettings();
        fetchBanners();
        fetchAds();
        fetchCategories();
    }, []);

    const fetchSettings = () => {
        api.get('/site-settings').then(res => {
            if (res.data) setSettings(prev => ({ ...prev, ...res.data }));
        }).catch(console.error);
    };

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        try {
            await api.post('/site-settings', settings);
            alert('Settings Updated!');
        } catch (err) {
            console.error(err);
            alert('Failed to update settings');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    // Update onCropComplete to handle logo
    const onCropCompleteWrapper = (blob) => {
        if (uploadType === 'logo') {
            handleUploadLogo(blob);
        } else {
            onCropComplete(blob);
        }
    };

    const handleUploadLogo = async (croppedImageBlob) => {
        const formData = new FormData();
        formData.append('image', croppedImageBlob, 'logo.jpg');

        try {
            const uploadRes = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const imageUrl = uploadRes.data.imageUrl;

            // Update settings with new logo URL
            const newSettings = { ...settings, logoUrl: imageUrl };
            await api.post('/site-settings', newSettings);
            setSettings(newSettings);
            alert('Logo Updated!');
        } catch (err) {
            console.error(err);
            alert('Failed to upload logo');
        }
        setShowCropper(false);
    };

    return (
        <div style={{ padding: '2rem', background: '#fff', borderRadius: '8px' }}>
            <h2 style={{ marginBottom: '2rem' }}>Site Settings</h2>

            {/* --- General Settings (Logo & Contact) --- */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>General & Footer Information</h3>

                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    {/* Logo Section */}
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />}
                            <input type="file" id="logoUpload" accept=".jpg, .jpeg, .png, .webp" onChange={(e) => onFileChange(e, 'logo')} style={{ display: 'none' }} />
                            <label htmlFor="logoUpload" style={{ padding: '0.5rem 1rem', background: '#333', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                Upload Logo
                            </label>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div style={{ flex: 2, minWidth: '300px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Company Name</label>
                                <input type="text" name="companyName" value={settings.companyName || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Phone</label>
                                <input type="text" name="phone" value={settings.phone || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email</label>
                                <input type="email" name="email" value={settings.email || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Address</label>
                                <input type="text" name="address" value={settings.address || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                        </div>
                        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Social Media Links</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <input type="text" name="facebook" placeholder="Facebook URL" value={settings.facebook || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            <input type="text" name="instagram" placeholder="Instagram URL" value={settings.instagram || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            <input type="text" name="twitter" placeholder="Twitter URL" value={settings.twitter || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </div>

                        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Delivery Charges (BDT)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>Inside Dhaka</label>
                                <input type="number" name="deliveryChargeInside" value={settings.deliveryChargeInside || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>Outside Dhaka</label>
                                <input type="number" name="deliveryChargeOutside" value={settings.deliveryChargeOutside || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                        </div>

                        {/* Shown at checkout, on the customer's order slip and on admin PDFs. */}
                        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Payment — Mobile Financial Service (MFS)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                    Payment numbers <span style={{ color: '#888' }}>(e.g. bKash 01XXXXXXXXX, Nagad 01XXXXXXXXX)</span>
                                </label>
                                <input
                                    type="text"
                                    name="mfsNumbers"
                                    placeholder="bKash 01XXXXXXXXX, Nagad 01XXXXXXXXX"
                                    value={settings.mfsNumbers || ''}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                    Payment instructions <span style={{ color: '#888' }}>(leave blank for the default message)</span>
                                </label>
                                <textarea
                                    name="mfsInstructions"
                                    rows="2"
                                    placeholder="A customer representative will call you to confirm this order and arrange payment."
                                    value={settings.mfsInstructions || ''}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit' }}
                                />
                            </div>
                        </div>

                        <button onClick={handleUpdateSettings} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            Save Information
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Policy Pages Content --- */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Policy Pages Content</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Terms & Conditions</label>
                        <textarea name="termsContent" value={settings.termsContent || ''} onChange={handleChange} rows="6" style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Privacy Policy</label>
                        <textarea name="privacyContent" value={settings.privacyContent || ''} onChange={handleChange} rows="6" style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Cancellation & Return Policy</label>
                        <textarea name="cancellationContent" value={settings.cancellationContent || ''} onChange={handleChange} rows="6" style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>FAQs</label>
                        <textarea name="faqsContent" value={settings.faqsContent || ''} onChange={handleChange} rows="6" style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="Enter FAQs here..." />
                    </div>
                    <button onClick={handleUpdateSettings} style={{ alignSelf: 'flex-start', padding: '0.75rem 2rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                        Save Content
                    </button>
                </div>
            </div>

            {/* --- Banner Management --- */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>Hero Banners <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#666' }}>(Rec: 1920x540px)</span></h3>
                    <div>
                        <input type="file" id="bannerUpload" accept=".jpg, .jpeg, .png, .webp" onChange={(e) => onFileChange(e, 'banner')} style={{ display: 'none' }} />
                        <label htmlFor="bannerUpload" style={{ padding: '0.5rem 1rem', background: '#000', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                            Upload New Banner
                        </label>
                    </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
                    Active banners are shown in the hero slideshow. You can activate multiple banners at once.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    {banners.map(banner => (
                        <div key={banner.id} style={{ border: banner.isActive ? '2px solid #2ecc71' : '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                            <img src={banner.imageUrl} alt="Banner" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                            {banner.isActive && (
                                <div style={{ position: 'absolute', top: '5px', right: '5px', background: '#2ecc71', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                                    ACTIVE
                                </div>
                            )}
                            <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9' }}>
                                <button
                                    onClick={() => handleToggleBanner(banner.id)}
                                    style={{
                                        padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer',
                                        border: '1px solid #ccc', borderRadius: '4px',
                                        background: banner.isActive ? '#fff5f5' : '#f0fff4',
                                        color: banner.isActive ? '#d62020' : '#2ecc71',
                                        fontWeight: 600
                                    }}
                                >
                                    {banner.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onClick={() => handleDeleteBanner(banner.id)} style={{ padding: '0.25rem', color: '#d62020', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Promotional Ads Management --- */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3>Promotional Ads (Popups)</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>Upload ads and link them to categories.</p>
                    </div>

                    <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Add New Ad</h4>
                        <select
                            value={newAdCategory}
                            onChange={(e) => { setNewAdCategory(e.target.value); setNewAdSubCategory(''); }}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                            <option value="">Select Category (Optional)</option>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>

                        {newAdCategory && (
                            <select
                                value={newAdSubCategory}
                                onChange={(e) => setNewAdSubCategory(e.target.value)}
                                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                            >
                                <option value="">Select SubCategory (Optional)</option>
                                {categories.find(c => c.id === parseInt(newAdCategory))?.subCategories.map(sub => (
                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                            </select>
                        )}

                        <input type="file" id="adUpload" accept=".jpg, .jpeg, .png, .webp" onChange={(e) => onFileChange(e, 'ad')} style={{ display: 'none' }} />
                        <label htmlFor="adUpload" style={{ padding: '0.5rem 1rem', background: '#d38b28', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'center' }}>
                            Upload Ad Image
                        </label>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                    {ads.map(ad => (
                        <div key={ad.id} style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', opacity: ad.isActive ? 1 : 0.6 }}>
                            <img src={ad.imageUrl} alt="Ad" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                            <div style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                                <div><strong>Cat:</strong> {ad.category?.name || 'All'}</div>
                                {ad.subCategory && <div><strong>Sub:</strong> {ad.subCategory.name}</div>}
                            </div>
                            <div style={{ padding: '0.5rem', background: '#f4f4f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button onClick={() => handleToggleAd(ad.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ad.isActive ? '#2ecc71' : '#999' }}>
                                    {ad.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                </button>
                                <button onClick={() => handleDeleteAd(ad.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d62020' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cropper Modal */}
            {showCropper && (
                <ImageCropper
                    imageSrc={selectedFile}
                    onCropComplete={onCropCompleteWrapper}
                    onCancel={() => setShowCropper(false)}
                    aspect={uploadType === 'banner' ? 32 / 9 : (uploadType === 'logo' ? 0 : 4 / 3)} // 0 for free form or 1 for square? Let's say free form or 3/1 for header logo.
                />
            )}
        </div>
    );
};


export default AdminSettings;

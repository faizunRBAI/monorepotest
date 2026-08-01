import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import api from '../api';
import { Star, CheckCircle, ShoppingBag, Minus, Plus, Zap, X, Ruler, ChevronDown, ChevronUp } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { calculateDiscount } from '../utils/price';
import {
    UI_TEXT, emptyMeasurements, validateFilledMeasurements,
    groupsForProduct, visibleGroups, pickMeasurements,
} from '../utils/measurements';
import MeasurementFields from '../components/MeasurementFields';
import useSeo from '../hooks/useSeo';
import { trackViewItem, trackAddToCart } from '../utils/analytics';
import { isAgeSize } from '../utils/sizes';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart } = useCart();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState('');
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [showSizeChart, setShowSizeChart] = useState(false);
    const [isCM, setIsCM] = useState(false);
    // The measurement form stays collapsed until the buyer asks for it.
    const [showMeasurements, setShowMeasurements] = useState(false);

    // Made-to-measure details. `lang` drives only the labels, never the stored keys.
    const [measurements, setMeasurements] = useState(emptyMeasurements);
    const [lang, setLang] = useState('en');
    const [measureError, setMeasureError] = useState('');
    const [invalidFields, setInvalidFields] = useState([]);
    const t = UI_TEXT[lang];

    // Only the garment groups this product is actually made of. A kameez-only product
    // must not ask for pajama measurements.
    const activeGroups = groupsForProduct(product);
    const shownGroups = visibleGroups(activeGroups);

    useSeo(product ? {
        title: product.name,
        description: (product.description || product.fullDescription || '').replace(/<[^>]*>/g, '').slice(0, 160) || undefined,
        image: product.imageUrl,
        path: `/products/${product.id}`,
        type: 'product',
    } : null);

    // Meta/Google "viewed this product" signal, used for retargeting audiences. Guarded
    // by id so re-renders (size/colour/quantity changes) don't re-fire it.
    const viewedId = useRef(null);
    useEffect(() => {
        if (!product || viewedId.current === product.id) return;
        viewedId.current = product.id;
        trackViewItem(product);
    }, [product]);

    // Reviews State
    const [reviews, setReviews] = useState([]);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [reviewError, setReviewError] = useState('');

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await api.get(`/products/${id}`);
                setProduct(res.data);
                setSelectedImage(res.data.imageUrl);

                // Select first available size
                if (res.data.sizes && res.data.sizes.length > 0) {
                    const firstAvailable = res.data.sizes.find(s => {
                        const sStock = res.data.sizeStock ? (res.data.sizeStock[s] !== undefined ? res.data.sizeStock[s] : res.data.stock) : res.data.stock;
                        return sStock > 0;
                    });
                    setSelectedSize(firstAvailable || res.data.sizes[0]);
                }

                if (res.data.colors && res.data.colors.length > 0) setSelectedColor(res.data.colors[0]);
                setReviews(res.data.reviews || []);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        fetchProduct();
    }, [id]);

    const getStock = (size) => {
        if (!product) return 0;
        if (product.sizeStock && product.sizeStock[size] !== undefined) {
            return parseInt(product.sizeStock[size]);
        }
        return product.stock || 0;
    };

    const currentStock = selectedSize ? getStock(selectedSize) : (product?.stock || 0);

    // Measurements are optional here — taking a tape measure out mid-browse is not always
    // possible, so the bag accepts an item without them and checkout collects them before
    // the order can be confirmed. Only values that are present but nonsensical are refused.
    const commitToCart = () => {
        if (!product) return false;
        if (currentStock < quantity) {
            alert(`Only ${currentStock} items available in this size.`);
            return false;
        }

        const result = validateFilledMeasurements(measurements, activeGroups);
        if (!result.ok) {
            setInvalidFields(result.missing);
            setMeasureError(t.invalid);
            // The form may be collapsed — open it first, then scroll once it has rendered.
            setShowMeasurements(true);
            setTimeout(() => {
                document.getElementById('measurement-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            return false;
        }

        setInvalidFields([]);
        setMeasureError('');
        // Only the applicable keys are stored, and null when nothing was filled in.
        addToCart(product, quantity, selectedSize, selectedColor, pickMeasurements(measurements, activeGroups));
        // Both "Add to Cart" and "Order Now" funnel through here, so this is the one
        // place the conversion event has to fire from.
        trackAddToCart(product, quantity, selectedSize, selectedColor);
        return true;
    };

    const handleAddToCart = () => {
        if (commitToCart()) alert('Added to cart!');
    };

    const handleOrderNow = () => {
        if (commitToCart()) navigate('/checkout');
    };

    const submitReview = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/reviews', {
                productId: product.id,
                rating: newReview.rating,
                comment: newReview.comment
            });
            setReviews([res.data, ...reviews]);
            setNewReview({ rating: 5, comment: '' });
            alert('Review submitted!');
        } catch (err) {
            setReviewError(err.response?.data?.error || 'Failed to submit review');
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
    if (!product) return <div style={{ padding: '2rem', textAlign: 'center' }}>Product not found</div>;

    const allImages = [product.imageUrl, ...(product.images || [])];

    // The admin picks letter sizes, age sizes, or both; the page shows only the
    // group(s) that were actually selected, each under its own heading.
    const letterSizes = (product.sizes || []).filter(s => !isAgeSize(s));
    const ageSizes = (product.sizes || []).filter(isAgeSize);
    const sizeGroups = [
        ...(letterSizes.length ? [{ label: 'Size', sizes: letterSizes }] : []),
        ...(ageSizes.length ? [{ label: 'Age', sizes: ageSizes }] : []),
    ];

    return (
        <div className="product-details-container" style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '4rem' }}>

            <style>{`
                .product-grid {
                    display: grid;
                    /* minmax(0, 1fr): a plain 1fr column grows to fit the thumbnail strip's
                       full width, pushing it past the (clipped) viewport edge instead of
                       letting the strip scroll. */
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 3rem;
                }
                .reviews-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 4rem;
                }
                .add-to-cart-container {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                }
                
                @media (max-width: 768px) {
                    .product-details-container {
                        margin: 1rem auto !important;
                        gap: 2rem !important;
                    }
                    .product-grid {
                        grid-template-columns: minmax(0, 1fr);
                        gap: 1.5rem;
                    }
                    .reviews-grid {
                        grid-template-columns: 1fr;
                        gap: 2rem;
                    }
                    .add-to-cart-container {
                        flex-direction: column; 
                        align-items: stretch;
                        gap: 0.75rem;
                    }
                    .add-to-cart-container > div {
                        justify-content: center;
                    }
                    
                    /* Mobile Order Re-arrangement & Compactness */
                    .product-info-column {
                        display: flex;
                        flex-direction: column;
                    }
                    .product-title { 
                        order: 1; 
                        font-size: 1.5rem !important; 
                        margin-bottom: 0.25rem !important;
                    }
                    .product-price { 
                        order: 2; 
                        font-size: 1.5rem !important;
                        margin-bottom: 0.5rem !important;
                    }
                    .product-selectors { 
                        order: 4; 
                        margin-bottom: 1rem !important;
                    }
                    /* Target direct children divs of selectors to reduce bottom margin */
                    .product-selectors > div {
                        margin-bottom: 1rem !important;
                    }
                    .add-to-cart-container { order: 5; }
                    .product-description { 
                        order: 3; 
                        margin-top: 1rem; 
                        font-size: 0.95rem;
                        line-height: 1.5 !important;
                    }

                    /* Make image smaller on mobile */
                    .product-image-container {
                        max-width: 300px !important;
                        margin: 0 auto 1rem auto !important;
                    }

                    .desktop-only {
                        display: none !important;
                    }
                    .mobile-action-bar {
                        display: flex !important;
                        justify-content: space-between;
                        align-items: center;
                        gap: 1rem;
                    }
                }
                
                /* Desktop styles for mobile bar */
                .mobile-action-bar {
                     display: none;
                     position: fixed;
                     bottom: 0;
                     left: 0;
                     right: 0;
                     background: #fff;
                     padding: 1rem;
                     box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                     z-index: 1000;
                }

                .related-products-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 2rem;
                }
                @media (max-width: 768px) {
                    .related-products-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                        gap: 1rem !important;
                    }
                }
            `}</style>

            {/* Top Section: Gallery & Info */}
            <div className="product-grid">

                {/* 1. Image Gallery */}
                <div>
                    <div className="product-image-container" style={{ marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                        <img src={selectedImage} alt={product.name} style={{ width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'contain' }} />
                        {calculateDiscount(product.price, product.originalPrice) > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: '#ff3b69',
                                color: '#fff',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                zIndex: 10
                            }}>
                                -{calculateDiscount(product.price, product.originalPrice)}%
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {allImages.map((img, idx) => (
                            <img
                                key={idx}
                                src={img}
                                alt={`View ${idx}`}
                                onClick={() => setSelectedImage(img)}
                                style={{
                                    width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer',
                                    border: selectedImage === img ? '2px solid #000' : '1px solid #ddd',
                                    flexShrink: 0
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* 2. Product Info */}
                <div className="product-info-column">
                    <h1 className="product-title" style={{ fontSize: '2rem', marginBottom: '0.5rem', lineHeight: 1.2 }}>{product.name}</h1>
                    <div className="product-price" style={{ fontSize: '2rem', fontWeight: 600, color: '#000', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {product.originalPrice && (
                            <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '1.2rem' }}>
                                {product.originalPrice}
                            </span>
                        )}
                        <span style={{ color: '#000', fontWeight: 'bold' }}>
                            {product.price}
                        </span>
                    </div>

                    <p className="product-description" style={{ lineHeight: '1.6', color: '#555', marginBottom: '2rem', whiteSpace: 'pre-wrap' }}>
                        {product.description || "No description available."}
                    </p>

                    {/* Selectors - Vertical Layout */}
                    <div className="product-selectors" style={{ marginBottom: '2rem' }}>

                        {/* Size Selector — letter sizes and age sizes get their own headings;
                            only the group(s) the admin selected are rendered. */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ display: 'block', fontWeight: 600 }}>
                                    {sizeGroups.length === 1 ? sizeGroups[0].label : 'Size'}
                                </span>
                                {product.sizeChart && (
                                    <button
                                        onClick={() => setShowSizeChart(true)}
                                        style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem', color: '#666' }}
                                    >
                                        View Size Chart
                                    </button>
                                )}
                            </div>
                            {sizeGroups.length === 0 && <span style={{ color: '#888' }}>One Size</span>}
                            {sizeGroups.map(group => (
                                <div key={group.label} style={{ marginBottom: '0.75rem' }}>
                                    {sizeGroups.length > 1 && (
                                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.35rem' }}>{group.label}</div>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {group.sizes.map(size => {
                                            const stock = getStock(size);
                                            const isOutOfStock = stock <= 0;
                                            return (
                                                <button
                                                    key={size}
                                                    onClick={() => !isOutOfStock && setSelectedSize(size)}
                                                    disabled={isOutOfStock}
                                                    style={{
                                                        padding: '0.75rem 1.25rem',
                                                        border: isOutOfStock ? '1px dashed #ddd' : '1px solid #ddd',
                                                        borderRadius: '4px',
                                                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                                        background: selectedSize === size ? '#000' : (isOutOfStock ? '#f9f9f9' : '#fff'),
                                                        color: selectedSize === size ? '#fff' : (isOutOfStock ? '#aaa' : '#000'),
                                                        position: 'relative',
                                                        opacity: isOutOfStock ? 0.7 : 1
                                                    }}>
                                                    {size}
                                                    {isOutOfStock && <span style={{
                                                        position: 'absolute', top: '-5px', right: '-5px',
                                                        background: '#d62020', color: '#fff', fontSize: '0.6rem',
                                                        padding: '2px 4px', borderRadius: '4px'
                                                    }}>Sold Out</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Size Chart Modal */}
                        {showSizeChart && product.sizeChart && (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                            }} onClick={() => setShowSizeChart(false)}>
                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => setShowSizeChart(false)}
                                        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        <X size={24} />
                                    </button>

                                    <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Size Chart</h3>

                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', gap: '1rem' }}>
                                        <button
                                            onClick={() => setIsCM(false)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                border: '1px solid #000',
                                                background: !isCM ? '#000' : '#fff',
                                                color: !isCM ? '#fff' : '#000',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Inches
                                        </button>
                                        <button
                                            onClick={() => setIsCM(true)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                border: '1px solid #000',
                                                background: isCM ? '#000' : '#fff',
                                                color: isCM ? '#fff' : '#000',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            CM
                                        </button>
                                    </div>

                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '300px' }}>
                                            <thead>
                                                <tr style={{ background: '#f4f6f8' }}>
                                                    <th style={{ padding: '0.75rem', border: '1px solid #ddd' }}>Size</th>
                                                    {product.sizeChart.params.map((param, i) => (
                                                        <th key={i} style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{param}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(product.sizeChart.data).map(([size, values]) => (
                                                    <tr key={size}>
                                                        <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{size}</td>
                                                        {values.map((val, i) => {
                                                            const displayVal = isCM ? (parseFloat(val) * 2.54).toFixed(1) : val;
                                                            return (
                                                                <td key={i} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                                                                    {displayVal}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                                        * Measurements are in {isCM ? 'centimeters' : 'inches'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Color Selector - Conditional Rendering */}
                        {product.colors && product.colors.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Color</span>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {product.colors.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setSelectedColor(color)}
                                            style={{
                                                padding: '0.75rem 1.25rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer',
                                                background: selectedColor === color ? '#000' : '#fff',
                                                color: selectedColor === color ? '#fff' : '#000'
                                            }}>
                                            {color}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Made-to-measure form, collapsed behind a button. The Bangla/English
                            toggle swaps only the labels — the values are stored against fixed
                            keys either way. */}
                        <div id="measurement-form" style={{ marginBottom: '1.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowMeasurements(v => !v)}
                                style={{
                                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    gap: '1rem', padding: '0.9rem 1.25rem', cursor: 'pointer',
                                    border: `1px solid ${measureError ? '#f0b0b0' : '#000'}`,
                                    borderRadius: showMeasurements ? '8px 8px 0 0' : '8px',
                                    background: '#fff', color: '#000', fontSize: '1rem', fontWeight: 600
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Ruler size={18} /> {t.heading}
                                    <span style={{ fontWeight: 400, fontSize: '0.85rem', color: '#888' }}>({t.optional})</span>
                                </span>
                                {showMeasurements ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {showMeasurements && (
                                <div
                                    style={{
                                        padding: '1.25rem',
                                        border: `1px solid ${measureError ? '#f0b0b0' : '#e3e3e3'}`,
                                        borderTop: 'none',
                                        borderRadius: '0 0 8px 8px', background: measureError ? '#fff8f8' : '#fbfbfb'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => setLang(l => (l === 'en' ? 'bn' : 'en'))}
                                            aria-label="Switch measurement form language"
                                            style={{
                                                padding: '0.35rem 0.85rem', borderRadius: '50px', cursor: 'pointer',
                                                border: '1px solid #000', background: '#fff', color: '#000',
                                                fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {t.toggle}
                                        </button>
                                    </div>

                                    <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 }}>
                                        {t.note} <span style={{ color: '#555' }}>{t.laterHint}</span>
                                    </p>

                                    <MeasurementFields
                                        groupIds={activeGroups}
                                        values={measurements}
                                        lang={lang}
                                        invalidKeys={invalidFields}
                                        onChange={(key, value) => {
                                            setMeasurements(prev => ({ ...prev, [key]: value }));
                                            if (invalidFields.includes(key)) setInvalidFields(prev => prev.filter(k => k !== key));
                                        }}
                                    />

                                    {measureError && (
                                        <p style={{ color: '#d62020', fontSize: '0.88rem', fontWeight: 500, margin: '0.25rem 0 0' }}>
                                            {measureError}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Quantity & Add to Cart - Side by Side on Desktop */}
                    <div className="desktop-only" style={{ display: 'flex', alignItems: 'end', gap: '2rem', marginBottom: '2rem' }}>
                        {/* Quantity */}
                        <div>
                            <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Quantity</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ padding: '0.5rem', border: '1px solid #ddd', background: '#fff' }}><Minus size={16} /></button>
                                <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>{quantity}</span>
                                <button onClick={() => setQuantity(q => Math.min(currentStock, q + 1))} disabled={quantity >= currentStock} style={{ padding: '0.5rem', border: '1px solid #ddd', background: '#fff', opacity: quantity >= currentStock ? 0.5 : 1 }}><Plus size={16} /></button>
                            </div>
                        </div>

                        {/* Add to Cart + Order Now */}
                        <div className="add-to-cart-container" style={{ flex: 1, display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleAddToCart}
                                disabled={currentStock < 1}
                                style={{
                                    flex: 1, padding: '1rem', background: '#000', color: '#fff', border: '2px solid #000', borderRadius: '4px',
                                    fontSize: '1rem', fontWeight: 600, cursor: currentStock < 1 ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                                    opacity: currentStock < 1 ? 0.5 : 1
                                }}>
                                <ShoppingBag size={18} /> {currentStock < 1 ? 'Out of Stock' : 'Add to Cart'}
                            </button>
                            <button
                                onClick={handleOrderNow}
                                disabled={currentStock < 1}
                                style={{
                                    flex: 1, padding: '1rem', background: '#000', color: '#fff', border: '2px solid #000', borderRadius: '4px',
                                    fontSize: '1rem', fontWeight: 600, cursor: currentStock < 1 ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                                    opacity: currentStock < 1 ? 0.5 : 1
                                }}>
                                <Zap size={18} /> Order Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Full Description Section */}
            {product.fullDescription && (
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>Product Details</h2>
                    <div
                        className="full-description"
                        style={{ lineHeight: '1.8', color: '#444' }}
                        dangerouslySetInnerHTML={{ __html: product.fullDescription.replace(/\n/g, '<br>') }}
                    />
                    <style>{`
                        .full-description img {
                            max-width: 100%;
                            height: auto;
                            border-radius: 8px;
                            margin: 1rem 0;
                        }
                        .full-description p {
                            margin-bottom: 1rem;
                        }
                    `}</style>
                </div>
            )}

            {/* Bottom Section: Reviews */}
            <div>
                <h2 style={{ fontSize: '2rem', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>Customer Reviews</h2>

                <div className="reviews-grid">

                    {/* Review List */}
                    <div>
                        {reviews.length === 0 ? (
                            <p style={{ color: '#888', fontStyle: 'italic' }}>No reviews yet.</p>
                        ) : (
                            reviews.map(review => (
                                <div key={review.id} style={{ marginBottom: '2rem', borderBottom: '1px solid #f9f9f9', paddingBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', color: '#f1c40f' }}>
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} size={16} fill={i < review.rating ? '#f1c40f' : 'none'} />
                                            ))}
                                        </div>
                                        <span style={{ fontWeight: 600 }}>{review.customer?.name || 'Customer'}</span>
                                        {review.isVerified && <span style={{ fontSize: '0.8rem', color: '#2ecc71', background: '#eafaf1', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Verified Purchase</span>}
                                    </div>
                                    <p style={{ color: '#555', lineHeight: '1.5' }}>{review.comment}</p>
                                    <span style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginTop: '0.5rem' }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Write Review Form */}
                    <div style={{ background: '#f9f9f9', padding: '2rem', borderRadius: '8px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Write a Review</h3>
                        {reviewError && <div style={{ color: 'red', marginBottom: '1rem' }}>{reviewError}</div>}
                        <form onSubmit={submitReview}>
                            {/* ... (rest of form same) ... */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Rating</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <div
                                            key={star}
                                            onClick={() => setNewReview({ ...newReview, rating: star })}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <Star
                                                size={24}
                                                fill={star <= newReview.rating ? '#f1c40f' : 'none'}
                                                color="#f1c40f"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Comment</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={newReview.comment}
                                    onChange={e => setNewReview({ ...newReview, comment: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                    placeholder="Share your thoughts..."
                                />
                            </div>
                            <button type="submit" style={{ background: '#000', color: '#fff', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                                Submit Review
                            </button>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem' }}>
                                * Only verified purchases can be reviewed.
                            </p>
                        </form>
                    </div>

                </div>
            </div>



            {/* Related Products Section */}
            < div >
                <h2 style={{ fontSize: '2rem', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>Related Products</h2>
                <RelatedProducts categoryId={product.categoryId} currentProductId={product.id} />
                {/* Mobile Sticky Bottom Bar */}
                <div className="mobile-action-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ padding: '0.5rem', border: '1px solid #ddd', background: '#fff' }}><Minus size={16} /></button>
                        <span style={{ fontSize: '1.1rem', fontWeight: 500, minWidth: '1.5rem', textAlign: 'center' }}>{quantity}</span>
                        <button onClick={() => setQuantity(q => Math.min(currentStock, q + 1))} disabled={quantity >= currentStock} style={{ padding: '0.5rem', border: '1px solid #ddd', background: '#fff', opacity: quantity >= currentStock ? 0.5 : 1 }}><Plus size={16} /></button>
                    </div>
                    <button
                        onClick={handleAddToCart}
                        disabled={currentStock < 1}
                        style={{
                            flex: 1, padding: '0.75rem', background: '#000', color: '#fff', border: '2px solid #000', borderRadius: '4px',
                            fontSize: '0.9rem', fontWeight: 600, cursor: currentStock < 1 ? 'not-allowed' : 'pointer',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem',
                            opacity: currentStock < 1 ? 0.5 : 1
                        }}>
                        <ShoppingBag size={16} /> {currentStock < 1 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                    <button
                        onClick={handleOrderNow}
                        disabled={currentStock < 1}
                        style={{
                            flex: 1, padding: '0.75rem', background: '#000', color: '#fff', border: '2px solid #000', borderRadius: '4px',
                            fontSize: '0.9rem', fontWeight: 600, cursor: currentStock < 1 ? 'not-allowed' : 'pointer',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem',
                            opacity: currentStock < 1 ? 0.5 : 1
                        }}>
                        <Zap size={16} /> Order Now
                    </button>
                </div>

            </div >

        </div >
    );
};

// Component for Related Products
const RelatedProducts = ({ categoryId, currentProductId }) => {
    const [related, setRelated] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRelated = async () => {
            try {
                const res = await api.get(`/products/category/${categoryId}`);
                // Filter out current product and take top 4
                const filtered = res.data.filter(p => p.id !== currentProductId).slice(0, 4);
                setRelated(filtered);
            } catch (err) {
                console.error("Failed to fetch related products", err);
            }
        };
        if (categoryId) fetchRelated();
    }, [categoryId, currentProductId]);

    if (related.length === 0) return <p>No related products found.</p>;

    return (
        <div className="related-products-grid">
            {related.map((product) => (
                <div
                    key={product.id}
                    style={{ cursor: 'pointer', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}
                    onClick={() => {
                        navigate(`/products/${product.id}`);
                        window.scrollTo(0, 0); // Scroll to top when clicking related product
                    }}
                >
                    <div style={{ aspectRatio: '1', overflow: 'hidden', background: '#f4f4f4', position: 'relative' }}>
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                            onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                        />
                        {calculateDiscount(product.price, product.originalPrice) > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: '#ff3b69',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                zIndex: 10
                            }}>
                                -{calculateDiscount(product.price, product.originalPrice)}%
                            </div>
                        )}
                    </div>
                    <div style={{ padding: '1rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{product.name}</h3>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                {product.originalPrice && (
                                    <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9rem' }}>
                                        {product.originalPrice}
                                    </span>
                                )}
                                <span style={{ color: product.originalPrice ? '#d62020' : '#000', fontWeight: 600 }}>
                                    {product.price}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                // Measurements are collected on the product page, so open it.
                                e.stopPropagation();
                                navigate(`/products/${product.id}`);
                                window.scrollTo(0, 0);
                            }}
                            style={{
                                marginTop: '1rem',
                                padding: '0.5rem 1rem',
                                background: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                width: '100%'
                            }}
                        >
                            Customize & Order
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProductDetails;

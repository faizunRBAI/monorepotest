import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { calculateDiscount } from '../utils/price';
import api from '../api';

const CategorySection = ({ category }) => {
    const [products, setProducts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                let featuredList = [];
                if (category.featuredProductList) {
                    try {
                        featuredList = typeof category.featuredProductList === 'string'
                            ? JSON.parse(category.featuredProductList)
                            : category.featuredProductList;
                    } catch (e) {
                        console.error("Error parsing featuredProductList", e);
                    }
                }

                if (featuredList && featuredList.length > 0) {
                    const res = await api.get(`/products/list?ids=${featuredList.join(',')}`);
                    setProducts(res.data.slice(0, 8));
                } else {
                    const res = await api.get(`/products/category/${category.id}`);
                    // Take top 8 for new layout (2 rows x 4 cols)
                    setProducts(res.data.slice(0, 8));
                }
            } catch (err) {
                console.error(`Failed to fetch products for category ${category.name}`, err);
            }
        };
        fetchProducts();
    }, [category.id, category.featuredProductList]);

    // Measurements are collected on the product page, so send the buyer there.
    const handleCustomize = (e, product) => {
        e.stopPropagation();
        navigate(`/products/${product.id}`);
    };

    if (products.length === 0) return null;

    // Determine banner image: Featured Product Image > Category Image > Default Placeholder
    const bannerImage = category.featuredProductImage || category.imageUrl;

    return (
        <section style={{ marginBottom: '2rem' }}>
            {/* New Layout: Left Image | Right Grid */}
            <div className="container category-layout-grid">

                {/* Left Side: Category Banner/Image */}
                <div
                    className="category-banner"
                    onClick={() => navigate(`/category/${category.id}`)}
                    style={{
                        cursor: 'pointer',
                        position: 'relative',
                        height: '100%',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#f4f4f4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                >
                    {bannerImage ? (
                        <img
                            src={bannerImage}
                            alt={category.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase' }}>
                            {category.name}
                        </div>
                    )}
                    <div style={{
                        position: 'absolute',
                        bottom: '0',
                        left: '0',
                        width: '100%',
                        textAlign: 'center',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                        paddingBottom: '2rem',
                        paddingTop: '4rem'
                    }} className="banner-text-overlay">
                        <h2 style={{ margin: 0, fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '2px', color: '#fff' }}>{category.name}</h2>
                    </div>
                </div>

                {/* Right Side: Product Grid (4 cols x 2 rows ideal) */}
                <div className="category-product-grid">
                    {/* Note: In CSS we should add media query to make gridTemplateColumns responsive if not using flex/auto-fit above. 
                          Ideally we add a class or inline style with media query support if possible, or use auto-fill via standard grid.
                          Since we want strict 4 cols on desktop to match "2 row", let's stick to this and rely on container query or mobile stack.
                          For truly responsive without CSS file edit: Use a responsive grid style.
                      */}
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="product-card"
                            onClick={() => navigate(`/products/${product.id}`)}
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                background: '#fff',
                                borderRadius: '8px',
                                padding: '0.5rem',
                                transition: 'transform 0.2s',
                                border: '1px solid #eee'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ position: 'relative', aspectRatio: '1', marginBottom: '0.5rem', background: '#f9f9f9', overflow: 'hidden', borderRadius: '4px' }}>
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {calculateDiscount(product.price, product.originalPrice) > 0 && (
                                    <div style={{ position: 'absolute', top: '5px', right: '5px', background: '#ff3b69', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                        -{calculateDiscount(product.price, product.originalPrice)}%
                                    </div>
                                )}
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{product.price}</span>
                                            {product.originalPrice && (
                                                <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.8rem' }}>{product.originalPrice}</span>
                                            )}
                                        </div>
                                        {(product.isFreeShipping == 1 || product.isFreeShipping === true) && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                color: '#28a745',
                                                background: '#e6f4ea',
                                                padding: '1px 4px',
                                                borderRadius: '3px',
                                                fontWeight: 700
                                            }}>
                                                Free Delivery
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Add to Cart */}
                                <button
                                    onClick={(e) => handleCustomize(e, product)}
                                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                                >
                                    Customize & Order
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* View All Button */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                    onClick={() => navigate(`/category/${category.id}`)}
                    style={{
                        padding: '0.75rem 2rem',
                        background: 'transparent',
                        border: '2px solid #000',
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                    onMouseOver={(e) => { e.target.style.background = '#000'; e.target.style.color = '#fff'; }}
                    onMouseOut={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#000'; }}
                >
                    View All {category.name}
                </button>
            </div>

            {/* Styles moved to main.css */}
        </section>
    );
};

export default CategorySection;

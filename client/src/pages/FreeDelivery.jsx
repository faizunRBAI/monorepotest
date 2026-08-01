import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { calculateDiscount } from '../utils/price';
import api from '../api';

const FreeDelivery = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/products/free-shipping')
            .then(res => {
                setProducts(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    // Measurements are collected on the product page, so send the buyer there.
    const handleCustomize = (e, product) => {
        e.stopPropagation();
        navigate(`/products/${product.id}`);
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    return (
        <section>
            <div style={{ background: '#e8fdfc', padding: '1rem 0', textAlign: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.8rem', color: '#00796b' }}>Free Delivery Products</h2>
                <p style={{ color: '#555' }}>Shop these items and get 0 Delivery Charge!</p>
            </div>

            <div className="container" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '2rem',
                paddingBottom: '4rem'
            }}>
                {products.length > 0 ? (
                    products.map((product) => (
                        <div
                            key={product.id}
                            className="product-card"
                            onClick={() => navigate(`/products/${product.id}`)}
                            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                        >
                            <div style={{
                                background: '#f4f4f4',
                                aspectRatio: '1',
                                marginBottom: '1rem',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    loading="lazy"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                    onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                                />
                                {((product.isFreeShipping === 1 || product.isFreeShipping === true)) && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '5px',
                                        left: '5px',
                                        background: '#28a745',
                                        color: '#fff',
                                        padding: '2px 6px',
                                        borderRadius: '1px',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        zIndex: 10
                                    }}>
                                        Free Delivery
                                    </div>
                                )}
                                {calculateDiscount(product.price, product.originalPrice) > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '5px',
                                        right: '5px',
                                        background: '#ff3b69',
                                        color: '#fff',
                                        padding: '2px 6px',
                                        borderRadius: '1px',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        zIndex: 10
                                    }}>
                                        -{calculateDiscount(product.price, product.originalPrice)}%
                                    </div>
                                )}
                            </div>

                            <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{product.name}</h4>
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                        {product.originalPrice && (
                                            <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9rem' }}>
                                                {product.originalPrice}
                                            </span>
                                        )}
                                        <span style={{ color: product.originalPrice ? '#d62020' : '#888', fontWeight: 600 }}>
                                            {product.price}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleCustomize(e, product)}
                                    style={{
                                        marginTop: '1rem',
                                        padding: '0.5rem 1rem',
                                        background: '#000',
                                        color: '#fff',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        borderRadius: '4px'
                                    }}
                                >
                                    Customize & Order
                                </button>
                                {((product.isFreeShipping === 1 || product.isFreeShipping === true)) && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '5px',
                                        left: '5px',
                                        background: '#28a745',
                                        color: '#fff',
                                        padding: '2px 6px',
                                        borderRadius: '1px',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        zIndex: 10
                                    }}>
                                        Free Delivery
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
                        No products found with free delivery.
                    </div>
                )}
            </div>
        </section>
    );
};

export default FreeDelivery;

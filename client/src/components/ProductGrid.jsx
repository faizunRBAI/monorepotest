import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { calculateDiscount } from '../utils/price';
import api from '../api';

const ProductGrid = () => {
    const [products, setProducts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/products/new')
            .then(res => setProducts(res.data))
            .catch(err => console.error(err));
    }, []);

    // Every dress is tailored to measurements the buyer submits on the product page, so a
    // card cannot drop an item straight into the bag any more.
    const handleCustomize = (e, product) => {
        e.stopPropagation();
        navigate(`/products/${product.id}`);
    };

    return (
        <section>
            <div style={{ background: '#fcf6e8', padding: '0.3rem 0', textAlign: 'center', marginBottom: '1rem', marginTop: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem', color: '#d38b28' }}>NEW ARRIVAL</h2>
            </div>

            <div className="container new-arrival-grid">
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="product-card"
                        onClick={() => navigate(`/products/${product.id}`)}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%'
                        }}
                    >
                        <div style={{
                            background: '#f4f4f4',
                            aspectRatio: '1',
                            marginBottom: '0.75rem',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '2px'
                        }}>
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                            />
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
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.45rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</h4>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.45rem', position: 'relative', flexWrap: 'wrap' }}>
                                    {product.originalPrice && (
                                        <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.85rem' }}>
                                            {product.originalPrice}
                                        </span>
                                    )}
                                    <span style={{ color: product.originalPrice ? '#d62020' : '#888', fontWeight: 700, fontSize: '0.95rem' }}>
                                        {product.price}
                                    </span>
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
                            <button
                                onClick={(e) => handleCustomize(e, product)}
                                style={{
                                    marginTop: '1rem',
                                    padding: '0.55rem 0.75rem',
                                    background: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    width: '100%'
                                }}
                            >
                                Customize & Order
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
                .new-arrival-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 170px));
                    gap: 1.5rem;
                    padding-bottom: 4rem;
                    overflow-x: hidden;
                    align-items: start;
                    justify-content: start;
                }
                @media (max-width: 1024px) {
                    .new-arrival-grid {
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important;
                        gap: 1rem !important;
                    }
                }
                @media (max-width: 768px) {
                    .new-arrival-grid {
                         grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                         gap: 1rem !important;
                    }
                }
                @media (max-width: 480px) {
                    .new-arrival-grid {
                         grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                         gap: 0.75rem !important;
                    }
                }
            `}</style>
        </section>
    );
};

export default ProductGrid;

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import api from '../api';
import { trackSearch } from '../utils/analytics';

// Helper to parse query params
function useQuery() {
    const { search } = useLocation();
    return React.useMemo(() => new URLSearchParams(search), [search]);
}

const SearchResults = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const query = useQuery();
    const searchTerm = query.get('q');
    const navigate = useNavigate();

    useEffect(() => {
        if (searchTerm) {
            setLoading(true);
            trackSearch(searchTerm);
            api.get(`/products/search?q=${encodeURIComponent(searchTerm)}`)
                .then(res => {
                    setProducts(res.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        } else {
            setProducts([]);
            setLoading(false);
        }
    }, [searchTerm]);

    // Measurements are collected on the product page, so send the buyer there.
    const handleCustomize = (e, product) => {
        e.stopPropagation();
        navigate(`/products/${product.id}`);
    };

    return (
        <section style={{ padding: '2rem 1rem', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h2 style={{ fontSize: '2rem' }}>Search Results for "{searchTerm}"</h2>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center' }}>Loading...</div>
            ) : products.length === 0 ? (
                <div style={{ textAlign: 'center' }}>No products found.</div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: '2rem',
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="product-card"
                            onClick={() => navigate(`/products/${product.id}`)}
                            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}
                        >
                            <div style={{ aspectRatio: '1', position: 'relative', overflow: 'hidden' }}>
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{product.name}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                                    onClick={(e) => handleCustomize(e, product)}
                                    style={{
                                        marginTop: '1rem',
                                        padding: '0.5rem',
                                        background: '#000',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Customize & Order
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default SearchResults;

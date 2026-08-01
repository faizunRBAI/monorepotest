import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router';
import api from '../api';
import { useNavigate } from 'react-router';
import { useCart } from '../context/CartContext';
import { calculateDiscount } from '../utils/price';
import useSeo from '../hooks/useSeo';

const CategoryProducts = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('Products');

    const isSubCategory = location.pathname.includes('/subcategory/');

    useSeo(title !== 'Products' ? {
        title,
        description: `Shop ${title} at Gorur Gari. Quality products with nationwide home delivery across Bangladesh.`,
        path: location.pathname,
    } : null);

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const endpoint = isSubCategory
                    ? `/products/subcategory/${id}`
                    : `/products/category/${id}`;

                const res = await api.get(endpoint);
                setProducts(res.data);

                if (res.data.length > 0) {
                    setTitle(isSubCategory
                        ? (res.data[0].subCategory?.name || 'SubCategory')
                        : (res.data[0].category?.name || 'Category'));
                }
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };

        fetchProducts();
    }, [id, isSubCategory]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    return (
        <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
            <h1 style={{ marginBottom: '2rem', textTransform: 'uppercase' }}>{title}</h1>

            {products.length === 0 ? (
                <p>No products found in this category.</p>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: '2rem'
                }}>
                    {products.map((product) => (
                        <div
                            key={product.id}
                            style={{ cursor: 'pointer', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}
                            onClick={() => navigate(`/products/${product.id}`)}
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
                                        // Measurements are collected on the product page.
                                        e.stopPropagation();
                                        navigate(`/products/${product.id}`);
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
            )}
        </div>
    );
};

export default CategoryProducts;

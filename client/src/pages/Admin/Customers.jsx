import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Mail, Phone, ShoppingBag } from 'lucide-react';

const AdminCustomers = () => {
    const [customers, setCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerDetails, setCustomerDetails] = useState({ orders: [], reviews: [] });
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        api.get('/customers').then(res => setCustomers(res.data)).catch(console.error);
    }, []);

    const fetchCustomerDetails = async (id) => {
        setLoadingDetails(true);
        try {
            const res = await api.get(`/customers/${id}/details`);
            setCustomerDetails({ orders: res.data.orders, reviews: res.data.reviews });
        } catch (err) {
            console.error(err);
            alert('Failed to fetch details');
        }
        setLoadingDetails(false);
    };

    const handleViewDetails = (customer) => {
        setSelectedCustomer(customer);
        fetchCustomerDetails(customer.id);
    };

    const closeDetails = () => {
        setSelectedCustomer(null);
        setCustomerDetails({ orders: [], reviews: [] });
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery))
    );

    return (
        <div>
            <h1>Customers</h1>

            {/* Search */}
            <div style={{ marginBottom: '2rem' }}>
                <input
                    type="text"
                    placeholder="Search by Name, Email, Phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '0.75rem', width: '100%', maxWidth: '400px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {filteredCustomers.map(customer => (
                    <div key={customer.id} style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <h3 style={{ margin: '0 0 0.5rem 0' }}>{customer.name}</h3>
                            {customer.location && <span style={{ fontSize: '0.75rem', background: '#ebf8ff', color: '#2b6cb0', padding: '2px 6px', borderRadius: '4px' }}>{customer.location}</span>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', marginBottom: '0.25rem' }}>
                            <Mail size={16} /> <span style={{ fontSize: '0.9rem' }}>{customer.email}</span>
                        </div>

                        {customer.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', marginBottom: '1rem' }}>
                                <Phone size={16} /> <span style={{ fontSize: '0.9rem' }}>{customer.phone}</span>
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ShoppingBag size={16} color="#444" />
                                <span style={{ fontWeight: 600 }}>{customer.orderCount || 0} Orders</span>
                            </div>
                            <button
                                onClick={() => handleViewDetails(customer)}
                                style={{ padding: '0.5rem 1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                                View Details
                            </button>
                        </div>
                    </div>
                ))}

                {filteredCustomers.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#888' }}>
                        No customers found.
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedCustomer && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }} onClick={closeDetails}>
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2>{selectedCustomer.name}</h2>
                            <button onClick={closeDetails} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Contact Info</h3>
                                <p><strong>Email:</strong> {selectedCustomer.email}</p>
                                <p><strong>Phone:</strong> {selectedCustomer.phone || 'N/A'}</p>
                                <p><strong>Location:</strong> {selectedCustomer.location || 'N/A'}</p>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Address</h3>
                                <p>{selectedCustomer.address || 'No address provided'}</p>
                                <p>{selectedCustomer.city} {selectedCustomer.zip}</p>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Order History</h3>
                        {loadingDetails ? <p>Loading...</p> : (
                            customerDetails.orders.length === 0 ? <p style={{ color: '#888' }}>No orders placed.</p> : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f9f9f9', textAlign: 'left' }}>
                                            <th style={{ padding: '0.5rem' }}>ID</th>
                                            <th style={{ padding: '0.5rem' }}>Product(s)</th>
                                            <th style={{ padding: '0.5rem' }}>Date</th>
                                            <th style={{ padding: '0.5rem' }}>Total</th>
                                            <th style={{ padding: '0.5rem' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerDetails.orders.map(order => (
                                            <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '0.5rem' }}>#{order.id}</td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                        {order.items && order.items.map((item, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={`/products/${item.productId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={item.product?.name}
                                                                style={{ textDecoration: 'none' }}
                                                            >
                                                                <img
                                                                    src={item.product?.imageUrl}
                                                                    alt={item.product?.name}
                                                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }}
                                                                />
                                                            </a>
                                                        ))}
                                                        {(!order.items || order.items.length === 0) && <span style={{ color: '#999', fontSize: '0.8rem' }}>No items</span>}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                                                <td style={{ padding: '0.5rem' }}>{order.totalAmount}</td>
                                                <td style={{ padding: '0.5rem' }}>{order.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        )}

                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Reviews</h3>
                        {loadingDetails ? <p>Loading...</p> : (
                            customerDetails.reviews.length === 0 ? <p style={{ color: '#888' }}>No reviews submitted.</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {customerDetails.reviews.map(review => (
                                        <div key={review.id} style={{ border: '1px solid #eee', borderRadius: '4px', padding: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <strong>{review.productName}</strong>
                                                <span style={{ color: '#f1c40f' }}>{'★'.repeat(review.rating)}</span>
                                            </div>
                                            <p style={{ margin: 0, color: '#555' }}>{review.comment}</p>
                                            <span style={{ fontSize: '0.8rem', color: '#999', display: 'block', marginTop: '0.5rem' }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCustomers;

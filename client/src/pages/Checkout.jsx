import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { Trash2, Download, Ruler } from 'lucide-react';
import {
    visibleGroups, groupsForCartItem, isComplete, requiredKeys, UI_TEXT,
} from '../utils/measurements';
import { saveBlobResponse, orderPdfFileName } from '../utils/download';
import MeasurementFields from '../components/MeasurementFields';
import { trackBeginCheckout, trackPurchase } from '../utils/analytics';

const PHONE_REGEX = /^\+?\d+$/;
const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));

const sanitizePhoneInput = (value) => {
    const cleaned = value.replace(/[^\d+]/g, '');
    if (!cleaned) return '';

    const hasLeadingPlus = cleaned.startsWith('+');
    const digitsOnly = cleaned.replace(/\+/g, '');

    return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
};

// Measurements can be skipped when adding to the bag, so checkout is where they get
// collected — and no order can be confirmed until every line is complete.
const hasMeasurements = (item) => isComplete(item.measurements, groupsForCartItem(item));

const measurementRows = (item) =>
    visibleGroups(groupsForCartItem(item))
        .map(group => ({
            title: group.en,
            values: group.fields
                .filter(f => item.measurements?.[f.key])
                .map(f => `${f.en} ${item.measurements[f.key]}"`),
        }))
        .filter(g => g.values.length > 0);

// Fields left blank on a line the buyer is being asked to complete.
const blankKeys = (item) =>
    requiredKeys(groupsForCartItem(item)).filter(key => !String(item.measurements?.[key] ?? '').trim());

const Checkout = () => {
    const { cart, total, clearCart, updateQuantity, removeFromCart, setMeasurement } = useCart();
    const { user, login, signup, updateUser } = useAuth();
    const navigate = useNavigate();

    // One toggle for every measurement form on the page.
    const [measureLang, setMeasureLang] = useState('en');
    // Which already-complete line is open for editing, if any.
    const [editingLine, setEditingLine] = useState(null);
    // Set when the buyer tries to confirm with gaps, so the empty fields can be marked.
    const [showMeasureGaps, setShowMeasureGaps] = useState(false);
    const mt = UI_TEXT[measureLang];

    // Guest info (used when not logged in)
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    // Optional login/signup panel for guests
    const [showLoginPanel, setShowLoginPanel] = useState(false);
    const [isLoginView, setIsLoginView] = useState(true);
    const [authData, setAuthData] = useState({ email: '', password: '', name: '', phone: '' });

    const [loading, setLoading] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState([]);
    // Set once the order is accepted; carries the slipToken used to fetch the PDF receipt.
    const [placedOrder, setPlacedOrder] = useState(null);
    const [slipError, setSlipError] = useState('');

    const itemsNeedingMeasurements = cart.filter(item => !hasMeasurements(item));

    // Voucher / promo code
    const [voucherInput, setVoucherInput] = useState('');
    const [voucher, setVoucher] = useState(null); // { code, discountAmount, discountType, discountValue }
    const [voucherError, setVoucherError] = useState('');
    const [voucherLoading, setVoucherLoading] = useState(false);

    useEffect(() => {
        const fetchRelated = async () => {
            try {
                let res;
                if (cart.length > 0 && cart[0].categoryId) {
                    res = await api.get(`/products/category/${cart[0].categoryId}`);
                } else {
                    res = await api.get('/products/new');
                }
                const cartIds = cart.map(c => c.id);
                const filtered = res.data.filter(p => !cartIds.includes(p.id)).slice(0, 4);
                setRelatedProducts(filtered);
            } catch (err) {
                console.error("Failed to fetch related products", err);
            }
        };
        fetchRelated();
    }, [cart]);

    // Measurements are collected on the product page, so suggestions link there.
    const handleAddRelated = (product) => navigate(`/products/${product.id}`);

    // Optional login handler for guests
    const handleAuth = async (e) => {
        e.preventDefault();
        let res;
        if (isLoginView) {
            res = await login(authData.email, authData.password);
        } else {
            if (!PHONE_REGEX.test(authData.phone.trim())) {
                return alert('Phone number must contain only numbers and may start with +.');
            }
            res = await signup(authData.name, authData.email, authData.password, authData.phone);
        }
        if (res.success) {
            setShowLoginPanel(false);
        } else {
            alert(res.error);
        }
    };

    // Delivery Charge Logic
    const [settings, setSettings] = useState(null);
    const [shippingAddress, setShippingAddress] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [shippingCost, setShippingCost] = useState(0);

    useEffect(() => {
        if (user) {
            setShippingAddress(user.address || '');
            setSelectedLocation(user.location || '');
        }
    }, [user]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/site-settings');
                setSettings(res.data);
            } catch (err) {
                console.error("Failed to fetch settings", err);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const allItemsFreeShipping = cart.length > 0 && cart.every(item => item.isFreeShipping === 1 || item.isFreeShipping === true);
        if (allItemsFreeShipping) {
            setShippingCost(0);
        } else if (settings && selectedLocation) {
            if (selectedLocation === 'Inside Dhaka') {
                setShippingCost(settings.deliveryChargeInside || 60);
            } else if (selectedLocation === 'Outside Dhaka') {
                setShippingCost(settings.deliveryChargeOutside || 120);
            }
        } else {
            setShippingCost(0);
        }
    }, [settings, selectedLocation, cart]);

    // A promo code discounts the product price only, never the delivery charge. Recomputed
    // from the voucher's own type/value rather than reusing the amount returned at
    // validation time, so editing quantities keeps the figure honest and matching the
    // server's calculation in POST /orders.
    const discount = voucher
        ? round2(voucher.discountType === 'percentage'
            ? (total * voucher.discountValue) / 100
            : Math.min(voucher.discountValue, total))
        : 0;
    const discountedProducts = Math.max(0, round2(total - discount));
    const finalTotal = round2(discountedProducts + shippingCost);

    // Reaching checkout with a bag is the mid-funnel signal ad platforms optimise
    // against. Fires once per visit — not on every quantity edit, and not for the
    // post-order render when the bag has just been emptied.
    const checkoutTracked = useRef(false);
    useEffect(() => {
        if (checkoutTracked.current || cart.length === 0) return;
        checkoutTracked.current = true;
        trackBeginCheckout(cart);
    }, [cart]);

    // Fetched through axios rather than a plain link so a failure surfaces as a message
    // instead of a blank tab, and so the blob downloads without navigating away. The file
    // is named "<customer name>_<order id>_slip.pdf" by the server.
    const downloadSlip = async (order) => {
        setSlipError('');
        try {
            const res = await api.get(`/orders/${order.id}/slip.pdf`, {
                params: { token: order.slipToken },
                responseType: 'blob',
            });
            saveBlobResponse(res, orderPdfFileName(order.customerName, order.orderNumber || order.id, 'slip'));
        } catch (err) {
            console.error(err);
            setSlipError('Could not download the slip automatically. Use the button below to try again.');
        }
    };

    const handleApplyVoucher = async () => {
        if (!voucherInput.trim()) return;
        setVoucherError('');
        setVoucher(null);
        setVoucherLoading(true);
        try {
            const res = await api.post('/vouchers/validate', {
                code: voucherInput.trim(),
                // Products only — delivery must not count toward the discount or the
                // voucher's minimum-order threshold.
                productsSubtotal: total
            });
            setVoucher(res.data);
        } catch (err) {
            setVoucherError(err.response?.data?.error || 'Invalid voucher code.');
        }
        setVoucherLoading(false);
    };

    const handleOrder = async (specialNote) => {
        if (cart.length === 0) return alert('Cart is empty');

        const name = user ? user.name : guestName.trim();
        const phone = user ? user.phone : guestPhone.trim();

        if (!name) return alert('Please enter your full name.');
        if (!phone) return alert('Please enter your phone number.');
        if (!PHONE_REGEX.test(phone)) return alert('Phone number must contain only numbers and may start with +.');
        if (!shippingAddress) return alert('Please enter your shipping address.');
        if (!selectedLocation) return alert('Please select your location (Inside/Outside Dhaka).');
        if (itemsNeedingMeasurements.length > 0) {
            // Mark the gaps and take them to the first one rather than just refusing.
            setShowMeasureGaps(true);
            document.getElementById(`measure-${itemsNeedingMeasurements[0].lineId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return alert(mt.missing);
        }

        setLoading(true);
        try {
            if (user) {
                // Update logged-in user's profile with latest address
                const profileRes = await api.put('/customer/profile', {
                    name: user.name,
                    phone: user.phone,
                    city: user.city,
                    zip: user.zip,
                    address: shippingAddress,
                    location: selectedLocation
                });
                if (profileRes.data) updateUser(profileRes.data);
            }

            const orderPayload = {
                items: cart,
                totalAmount: finalTotal,
                shippingAddress: `${shippingAddress}, ${selectedLocation}`,
                specialNote,
                voucherCode: voucher ? voucher.code : null,
                discountAmount: discount,
                // Sent explicitly so the server never has to infer delivery from the
                // total, and can keep it out of the discount base.
                shippingCost,
                // Always sent, even when logged in. The server ignores these once it
                // resolves a customerId, but if the session token turns out to be
                // expired it can still record the order as a guest order instead of
                // rejecting it — which used to lose the order entirely.
                guestName: name,
                guestPhone: phone
            };

            const res = await api.post('/orders', orderPayload);
            // Keep the slip link before clearing the bag, then hand the customer their
            // receipt straight away. `customerName` only feeds the download-name fallback.
            const order = { ...res.data, customerName: name };
            setPlacedOrder(order);
            // The conversion. Fired before clearCart() so the line items are still here,
            // and keyed on the order number so a refresh can't be counted twice.
            trackPurchase({
                transactionId: order.orderNumber || order.id,
                cart,
                value: finalTotal,
                shipping: shippingCost,
                discount,
                voucherCode: voucher ? voucher.code : null,
            });
            clearCart();
            if (order.id && order.slipToken) downloadSlip(order);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Failed to place order');
        }
        setLoading(false);
    };

    // Order accepted — the bag is now empty, so this has to come before the empty check.
    if (placedOrder) {
        return (
            <div style={{ maxWidth: '620px', margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
                <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: '8px', padding: '2rem' }}>
                    <h2 style={{ marginBottom: '0.5rem' }}>Order Placed Successfully</h2>
                    <p style={{ color: '#276749', marginBottom: '0.5rem' }}>
                        Your order number is <strong>#{placedOrder.orderNumber || placedOrder.id}</strong>.
                    </p>
                    {/* Highlighted in red — the buyer must not miss this. */}
                    <p style={{ color: '#d62020', fontWeight: 600, marginBottom: '1.5rem' }}>
                        A customer representative will call you to confirm this order and arrange payment.
                    </p>

                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ color: '#666' }}>Final price</span>
                            <strong>{Number(placedOrder.totalAmount).toFixed(2)} BDT</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#666' }}>Payment</span>
                            <strong>Mobile Financial Service (MFS)</strong>
                        </div>
                    </div>

                    <button
                        onClick={() => downloadSlip(placedOrder)}
                        style={{
                            width: '100%', padding: '1rem', background: '#000', color: '#fff', border: 'none',
                            borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                        }}
                    >
                        <Download size={18} /> Download Order Slip (PDF)
                    </button>
                    {slipError && <p style={{ color: '#d62020', fontSize: '0.85rem', marginTop: '0.75rem' }}>{slipError}</p>}
                    <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem' }}>
                        Your slip lists the product, your dress measurements and the final price.
                    </p>

                    <button
                        onClick={() => navigate('/')}
                        style={{ marginTop: '1.25rem', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#333' }}
                    >
                        Continue shopping
                    </button>
                </div>
            </div>
        );
    }

    if (cart.length === 0) {
        return <div style={{ padding: '4rem', textAlign: 'center' }}><h2>Your Bag is Empty</h2></div>;
    }

    return (
        <div className="container" style={{ padding: '2rem 1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {/* Left: Cart Items */}
            <div style={{ flex: 1, minWidth: '300px' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Shopping Bag</h2>
                {cart.map(item => (
                    <div key={item.lineId} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                        <img src={item.imageUrl} alt={item.name} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <h4>{item.name}</h4>
                                <button
                                    onClick={() => removeFromCart(item.lineId)}
                                    style={{ color: '#ff4d4f', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            {(item.isFreeShipping === 1 || item.isFreeShipping === true) && (
                                <span style={{ fontSize: '0.75rem', background: '#e6f4ea', color: '#1e7e34', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                    Free Delivery
                                </span>
                            )}
                            <p style={{ fontWeight: 500, margin: '0.25rem 0' }}>{item.price}</p>
                            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                                {item.selectedSize && <span style={{ marginRight: '0.5rem' }}>Size: {item.selectedSize}</span>}
                                {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                            </div>

                            {/* Measurements are optional in the bag and required to confirm,
                                so incomplete lines get the form inline right here. */}
                            <div id={`measure-${item.lineId}`} style={{ marginBottom: '0.5rem' }}>
                                {hasMeasurements(item) ? (
                                    <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#333' }}>
                                                <Ruler size={13} /> Your measurements (inches)
                                            </span>
                                            <button
                                                onClick={() => setEditingLine(prev => (prev === item.lineId ? null : item.lineId))}
                                                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', color: '#555', fontSize: '0.75rem' }}
                                            >
                                                {editingLine === item.lineId ? 'Done' : 'Edit'}
                                            </button>
                                        </div>
                                        {editingLine === item.lineId ? (
                                            <MeasurementFields
                                                compact
                                                groupIds={groupsForCartItem(item)}
                                                values={item.measurements}
                                                lang={measureLang}
                                                onChange={(key, value) => setMeasurement(item.lineId, key, value)}
                                            />
                                        ) : (
                                            measurementRows(item).map(group => (
                                                <div key={group.title} style={{ fontSize: '0.78rem', color: '#555', lineHeight: 1.6 }}>
                                                    <span style={{ color: '#888' }}>{group.title}:</span> {group.values.join(', ')}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ background: '#fff8f8', border: '1px solid #f0b0b0', borderRadius: '6px', padding: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#c53030', fontWeight: 600 }}>
                                                <Ruler size={13} /> {mt.needed}
                                            </span>
                                            <button
                                                onClick={() => setMeasureLang(l => (l === 'en' ? 'bn' : 'en'))}
                                                aria-label="Switch measurement form language"
                                                style={{
                                                    padding: '0.2rem 0.6rem', borderRadius: '50px', cursor: 'pointer',
                                                    border: '1px solid #c53030', background: '#fff', color: '#c53030',
                                                    fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {mt.toggle}
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.76rem', color: '#666', margin: '0 0 0.6rem', lineHeight: 1.5 }}>
                                            {mt.note}
                                        </p>
                                        <MeasurementFields
                                            compact
                                            groupIds={groupsForCartItem(item)}
                                            values={item.measurements}
                                            lang={measureLang}
                                            invalidKeys={showMeasureGaps ? blankKeys(item) : []}
                                            onChange={(key, value) => setMeasurement(item.lineId, key, value)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', width: 'fit-content' }}>
                                <button
                                    onClick={() => updateQuantity(item.lineId, -1)}
                                    style={{ padding: '0.25rem 0.75rem', background: '#f9f9f9', border: 'none', borderRight: '1px solid #ddd', cursor: 'pointer' }}
                                >-</button>
                                <span style={{ padding: '0.25rem 1rem', fontWeight: 500 }}>{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.lineId, 1)}
                                    style={{ padding: '0.25rem 0.75rem', background: '#f9f9f9', border: 'none', borderLeft: '1px solid #ddd', cursor: 'pointer' }}
                                >+</button>
                            </div>
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: '1rem', borderTop: '2px solid #eee', paddingTop: '1rem' }}>
                    {/* Ordered so the discount visibly comes off the products, with delivery
                        added afterwards at full price. */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#666' }}>Products subtotal:</span>
                        <span style={{ fontWeight: 500 }}>{total.toFixed(2)} BDT</span>
                    </div>
                    {voucher && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#1e7e34' }}>
                                <span>Discount on products ({voucher.code}):</span>
                                <span style={{ fontWeight: 600 }}>- {discount.toFixed(2)} BDT</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px dashed #e0e0e0' }}>
                                <span style={{ color: '#666' }}>Products after discount:</span>
                                <span style={{ fontWeight: 500 }}>{discountedProducts.toFixed(2)} BDT</span>
                            </div>
                        </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#666' }}>Shipping ({selectedLocation || 'Select Loc'}):</span>
                        <span style={{ fontWeight: 500 }}>{shippingCost.toFixed(2)} BDT</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
                        <span>Total:</span>
                        <span>{finalTotal.toFixed(2)} BDT</span>
                    </div>
                </div>

                {relatedProducts.length > 0 && (
                    <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>You Might Also Like</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                            {relatedProducts.map(prod => (
                                <div key={prod.id} style={{ border: '1px solid #eee', borderRadius: '4px', padding: '0.5rem', textAlign: 'center' }}>
                                    <img src={prod.imageUrl} alt={prod.name} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem' }} />
                                    <h5 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.name}</h5>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{prod.price}</p>
                                    <button
                                        onClick={() => handleAddRelated(prod)}
                                        style={{ width: '100%', padding: '0.4rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                                    >
                                        Customize
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Checkout Form */}
            <div style={{ flex: 1, minWidth: '300px', background: '#f9f9f9', padding: '2rem', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '1rem' }}>Shipping Details</h3>

                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                    {/* Name */}
                    <input
                        placeholder="Full Name"
                        value={user ? (user.name || '') : guestName}
                        onChange={user ? undefined : e => setGuestName(e.target.value)}
                        disabled={!!user}
                        style={{ padding: '0.8rem', background: user ? '#eee' : '#fff', border: '1px solid #ddd', borderRadius: '4px' }}
                    />

                    {/* Phone */}
                    <input
                        placeholder="Phone Number"
                        value={user ? (user.phone || '') : guestPhone}
                        onChange={user ? undefined : e => setGuestPhone(sanitizePhoneInput(e.target.value))}
                        disabled={!!user}
                        inputMode="tel"
                        style={{ padding: '0.8rem', background: user ? '#eee' : '#fff', border: '1px solid #ddd', borderRadius: '4px' }}
                    />

                    {/* Address */}
                    <textarea
                        placeholder="Full Address (House, Road, Area, City)"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        rows={3}
                        style={{ padding: '0.8rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit' }}
                    />

                    {/* Location */}
                    <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        style={{ padding: '0.8rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}
                    >
                        <option value="" disabled>Select Location</option>
                        <option value="Inside Dhaka">Inside Dhaka (Shipping: {settings?.deliveryChargeInside || 60} BDT)</option>
                        <option value="Outside Dhaka">Outside Dhaka (Shipping: {settings?.deliveryChargeOutside || 120} BDT)</option>
                    </select>

                    {(!shippingAddress || !selectedLocation) && (
                        <p style={{ color: 'red', fontSize: '0.9rem' }}>
                            Please enter your <strong>Address</strong> and select <strong>Location</strong> to proceed.
                        </p>
                    )}
                </div>

                {/* Promo Code */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Promo / Voucher Code</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            placeholder="Enter code"
                            value={voucherInput}
                            onChange={e => { setVoucherInput(e.target.value.toUpperCase()); setVoucher(null); setVoucherError(''); }}
                            disabled={!!voucher}
                            style={{ flex: 1, padding: '0.75rem', border: `1px solid ${voucher ? '#2ecc71' : '#ddd'}`, borderRadius: '4px', fontFamily: 'inherit', background: voucher ? '#f0fff4' : '#fff' }}
                        />
                        {voucher ? (
                            <button
                                onClick={() => { setVoucher(null); setVoucherInput(''); setVoucherError(''); }}
                                style={{ padding: '0.75rem 1rem', background: '#eee', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >Remove</button>
                        ) : (
                            <button
                                onClick={handleApplyVoucher}
                                disabled={voucherLoading || !voucherInput.trim()}
                                style={{ padding: '0.75rem 1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: voucherLoading || !voucherInput.trim() ? 0.6 : 1 }}
                            >{voucherLoading ? '...' : 'Apply'}</button>
                        )}
                    </div>
                    {voucher && (
                        <>
                            <p style={{ marginTop: '0.4rem', color: '#1e7e34', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.15rem' }}>
                                ✓ {voucher.discountType === 'percentage' ? `${voucher.discountValue}% off` : `${voucher.discountValue} BDT off`} applied!
                            </p>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.78rem' }}>
                                Applies to the product price only — the delivery charge is not discounted.
                            </p>
                        </>
                    )}
                    {voucherError && <p style={{ marginTop: '0.4rem', color: '#d62020', fontSize: '0.85rem' }}>{voucherError}</p>}
                </div>

                {/* Special Note */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Special Note</h4>
                    <textarea
                        placeholder="Special instructions for delivery..."
                        rows="3"
                        id="specialNote"
                        style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    ></textarea>
                </div>

                {/* Payment — manual MFS. No Cash on Delivery. */}
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Payment — Mobile Financial Service (MFS)</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#666', fontSize: '0.9rem' }}>Final price</span>
                        <strong style={{ fontSize: '1.15rem' }}>{finalTotal.toFixed(2)} BDT</strong>
                    </div>
                    {settings?.mfsNumbers && (
                        <p style={{ fontSize: '0.9rem', margin: '0 0 0.4rem' }}>
                            <span style={{ color: '#666' }}>Send money to:</span> <strong>{settings.mfsNumbers}</strong>
                        </p>
                    )}
                    {/* Highlighted in red — this is the instruction the buyer must not miss. */}
                    <p style={{ fontSize: '0.88rem', color: '#d62020', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                        {settings?.mfsInstructions
                            || 'A customer representative will call you to confirm this order and arrange payment. Cash on delivery is not available.'}
                    </p>
                </div>

                {itemsNeedingMeasurements.length > 0 && (
                    <p style={{ color: '#c53030', fontSize: '0.9rem', marginTop: '1rem', fontWeight: 500 }}>
                        {itemsNeedingMeasurements.length} item{itemsNeedingMeasurements.length > 1 ? 's' : ''} in
                        your bag still need{itemsNeedingMeasurements.length > 1 ? '' : 's'} measurements.
                        Fill them in beside the item{itemsNeedingMeasurements.length > 1 ? 's' : ''} above to confirm your order.
                    </p>
                )}

                {(() => {
                    const blocked = loading || !shippingAddress || !selectedLocation || itemsNeedingMeasurements.length > 0;
                    return (
                        <button
                            onClick={() => handleOrder(document.getElementById('specialNote').value)}
                            disabled={blocked}
                            style={{
                                width: '100%', marginTop: '1rem',
                                padding: '1rem', background: '#d62020',
                                color: '#fff', border: 'none',
                                fontSize: '1.1rem', fontWeight: 'bold',
                                cursor: blocked ? 'not-allowed' : 'pointer',
                                opacity: blocked ? 0.7 : 1
                            }}>
                            {loading ? 'Processing...' : 'CONFIRM ORDER'}
                        </button>
                    );
                })()}

                {/* Optional Login for guests */}
                {!user && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}>
                        <p style={{ fontSize: '0.9rem', marginBottom: showLoginPanel ? '1rem' : 0 }}>
                            Have an account?{' '}
                            <span
                                onClick={() => setShowLoginPanel(!showLoginPanel)}
                                style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
                            >
                                {showLoginPanel ? 'Hide' : 'Login for faster checkout'}
                            </span>
                        </p>

                        {showLoginPanel && (
                            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <p style={{ fontSize: '0.85rem', color: '#888', margin: 0 }}>
                                    {isLoginView ? 'Login' : 'Sign Up'} — your details will be filled automatically.
                                </p>
                                {!isLoginView && (
                                    <>
                                        <input
                                            placeholder="Full Name"
                                            value={authData.name}
                                            onChange={e => setAuthData({ ...authData, name: e.target.value })}
                                            style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                            required
                                        />
                                        <input
                                            placeholder="Phone"
                                            value={authData.phone}
                                            onChange={e => setAuthData({ ...authData, phone: sanitizePhoneInput(e.target.value) })}
                                            inputMode="tel"
                                            style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                            required
                                        />
                                    </>
                                )}
                                <input
                                    placeholder="Email"
                                    type="email"
                                    value={authData.email}
                                    onChange={e => setAuthData({ ...authData, email: e.target.value })}
                                    style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                    required
                                />
                                <input
                                    placeholder="Password"
                                    type="password"
                                    value={authData.password}
                                    onChange={e => setAuthData({ ...authData, password: e.target.value })}
                                    style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                    required
                                />
                                <button type="submit" style={{ padding: '0.75rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    {isLoginView ? 'LOGIN' : 'REGISTER'}
                                </button>
                                <p
                                    style={{ fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', margin: 0 }}
                                    onClick={() => setIsLoginView(!isLoginView)}
                                >
                                    {isLoginView ? 'Need an account? Register' : 'Already have an account? Login'}
                                </p>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Checkout;

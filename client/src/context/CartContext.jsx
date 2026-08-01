import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

// Measurements can be filled in later, at checkout, so a line's identity must NOT be
// derived from them — editing them would otherwise change the line's id mid-edit. Each
// line gets a stable id at add time instead.
let lineCounter = 0;
const newLineId = () => `line-${Date.now().toString(36)}-${(lineCounter += 1)}`;

// Used only to decide whether adding something should bump an existing line's quantity.
const variantSignature = (productId, size, color, measurements) =>
    [productId, size || '', color || '', JSON.stringify(measurements || null)].join('|');

const signatureOf = (item) =>
    variantSignature(item.id, item.selectedSize, item.selectedColor, item.measurements);

const withLineId = (item) => ({ ...item, lineId: item.lineId || newLineId() });

export const CartProvider = ({ children }) => {
    const { user, loading } = useAuth();
    const [cart, setCart] = useState([]);
    const isFirstRun = useRef(true);
    const userRef = useRef(user);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Initial Load (and on User Change)
    useEffect(() => {
        if (loading) return;
        const key = user ? `cart_${user.id}` : 'cart';
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                // Backfill lineId on carts saved before measurements existed.
                setCart(JSON.parse(saved).map(withLineId));
            } catch (e) {
                setCart([]);
            }
        } else {
            setCart([]); // Clear cart if nothing saved for this user
        }
    }, [user, loading]);

    // Save on Cart Change
    useEffect(() => {
        if (loading) return;
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        // Use ref to get current user without triggering effect on user change
        const currentUser = userRef.current;
        const key = currentUser ? `cart_${currentUser.id}` : 'cart';
        localStorage.setItem(key, JSON.stringify(cart));
    }, [cart, loading]); // Removed 'user' from dependencies

    const addToCart = (product, quantity, size, color, measurements = null) => {
        const signature = variantSignature(product.id, size, color, measurements);
        setCart(prev => {
            // Same product, same variants AND same measurements -> bump the quantity.
            const existing = prev.find(item => signatureOf(item) === signature);
            if (existing) {
                return prev.map(item =>
                    item.lineId === existing.lineId ? { ...item, quantity: item.quantity + quantity } : item
                );
            }
            return [...prev, {
                ...product, quantity, selectedSize: size, selectedColor: color, measurements, lineId: newLineId(),
            }];
        });
    };

    const removeFromCart = (lineId) => {
        setCart(prev => prev.filter(item => item.lineId !== lineId));
    };

    const updateQuantity = (lineId, delta) => {
        setCart(prev => prev.map(item =>
            item.lineId === lineId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        ));
    };

    // Lets checkout collect measurements that were skipped when the item went into the bag.
    const setMeasurement = (lineId, key, value) => {
        setCart(prev => prev.map(item =>
            item.lineId === lineId
                ? { ...item, measurements: { ...(item.measurements || {}), [key]: value } }
                : item
        ));
    };

    const clearCart = () => setCart([]);

    const total = cart.reduce((sum, item) => {
        // Parse "999 BDT" -> 999
        let price = 0;
        if (typeof item.price === 'string') {
            price = parseFloat(item.price.replace(/[^\d.]/g, '')) || 0;
        } else {
            price = item.price;
        }
        return sum + (price * item.quantity);
    }, 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, setMeasurement, clearCart, total }}>
            {children}
        </CartContext.Provider>
    );
};

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const api = axios.create({ baseURL: BASE_URL });

export const ADMIN_TOKEN_KEY = 'adminToken';
export const CUSTOMER_TOKEN_KEY = 'userToken';

// The storefront and the admin panel share this instance, so the token has to be
// picked per request rather than by localStorage precedence. When both sessions
// exist in one browser, precedence sent the wrong token: the admin panel received
// the customer's token (403 -> "No orders found") and checkout received the
// admin's token, which carries no customer id, so the order was rejected outright.
// Admin pages all live under /admin; everything else is the storefront.
const isAdminArea = () => window.location.pathname.startsWith('/admin');

api.interceptors.request.use((config) => {
    // An explicitly supplied header always wins.
    if (config.headers['Authorization'] || config.headers['authorization']) return config;

    const token = localStorage.getItem(isAdminArea() ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY);
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
});

export default api;

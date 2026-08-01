import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { applySeo } from '../utils/seo';

// Route-level SEO defaults, applied on every navigation. Pages with dynamic data
// (ProductDetails, CategoryProducts) refine these via useSeo once their data loads.
const STATIC_ROUTES = {
    '/': {
        title: 'Home',
        description:
            'Shop the latest collections at Gorur Gari. Quality clothing and fashion in Bangladesh with nationwide home delivery, easy returns and secure payment.',
    },
    '/terms': { title: 'Terms & Conditions', description: 'Read the terms and conditions for shopping at Gorur Gari.' },
    '/privacy': { title: 'Privacy Policy', description: 'How Gorur Gari collects, uses and protects your personal information.' },
    '/cancellation': { title: 'Cancellation & Returns', description: 'Gorur Gari cancellation, return and refund policy.' },
    '/faqs': { title: 'FAQs', description: 'Frequently asked questions about ordering, delivery and payments at Gorur Gari.' },
    '/free-delivery': { title: 'Free Delivery Products', description: 'Browse products with free home delivery at Gorur Gari.' },
    '/search': { title: 'Search', noindex: true },
    '/checkout': { title: 'Checkout', noindex: true },
    '/account': { title: 'My Account', noindex: true },
    '/login': { title: 'Login', noindex: true },
};

const usePageTitle = () => {
    const location = useLocation();

    useEffect(() => {
        const path = location.pathname;

        if (STATIC_ROUTES[path]) {
            applySeo(STATIC_ROUTES[path]);
        } else if (path.startsWith('/products/')) {
            // Fallback until ProductDetails loads and sets the real product SEO.
            applySeo({ title: 'Product Details' });
        } else if (path.startsWith('/category/') || path.startsWith('/subcategory/')) {
            applySeo({ title: 'Category' });
        } else if (path.startsWith('/admin')) {
            applySeo({ title: 'Admin', noindex: true });
        } else {
            applySeo({});
        }
    }, [location]);
};

export default usePageTitle;

import { useEffect } from 'react';
import { applySeo } from '../utils/seo';

// Per-page SEO for pages with dynamic data (product, category). Pass null/undefined
// while the data is still loading — the route-level defaults from usePageTitle stay
// in place until real values arrive.
const useSeo = (opts) => {
    const serialized = opts ? JSON.stringify(opts) : null;

    useEffect(() => {
        if (serialized) applySeo(JSON.parse(serialized));
    }, [serialized]);
};

export default useSeo;

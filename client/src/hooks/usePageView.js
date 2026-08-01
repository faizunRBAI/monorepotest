import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { trackPageView } from '../utils/analytics';

// Virtual pageviews for the SPA. GTM's built-in Page View trigger fires only on the
// initial document load, so without this every route after the landing page is invisible
// to GA4 and to any ad platform's pageview-based audiences.
//
// Must be called after usePageTitle so document.title is already the new page's.
const usePageView = () => {
    const { pathname, search } = useLocation();
    const lastPath = useRef(null);

    useEffect(() => {
        const path = pathname + search;
        // A re-render with the same URL is not a new pageview. This also absorbs
        // StrictMode's double effect invocation in dev.
        if (lastPath.current === path) return;
        lastPath.current = path;
        trackPageView(path);
    }, [pathname, search]);
};

export default usePageView;

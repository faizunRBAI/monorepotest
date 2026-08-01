import React from 'react';
import { Outlet, useLocation } from 'react-router';
import Header from './Header';
import Footer from './Footer';

const Layout = () => {
    const location = useLocation();
    const isHome = location.pathname === '/';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <main className={`main-content${isHome ? '' : ' main-content-narrow'}`} style={{ flex: 1 }}>
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

export default Layout;

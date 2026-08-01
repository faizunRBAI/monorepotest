import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LayoutDashboard, ShoppingBag, Layers, ShoppingCart, Users, Settings, LogOut, Tag, ShieldCheck, Menu, X } from 'lucide-react';

const AdminLayout = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/login');
    };

    const menuItems = [
        { path: '/admin', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { path: '/admin/products', icon: <ShoppingBag size={20} />, label: 'Products' },
        { path: '/admin/categories', icon: <Layers size={20} />, label: 'Categories' },
        { path: '/admin/orders', icon: <ShoppingCart size={20} />, label: 'Orders' },
        { path: '/admin/customers', icon: <Users size={20} />, label: 'Customers' },
        { path: '/admin/size-charts', icon: <Layers size={20} />, label: 'Size Charts' },
        { path: '/admin/vouchers', icon: <Tag size={20} />, label: 'Vouchers' },
        { path: '/admin/admin-accounts', icon: <ShieldCheck size={20} />, label: 'Admin Accounts' },
        { path: '/admin/settings', icon: <Settings size={20} />, label: 'Settings' },
    ];

    const navLinkStyle = (isActive) => ({
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.75rem 1rem',
        color: isActive ? '#fff' : '#637381',
        background: isActive ? '#000' : 'transparent',
        borderRadius: '8px', textDecoration: 'none',
        fontWeight: 500, transition: 'all 0.2s'
    });

    const sidebar = (
        <aside style={{
            width: '250px', background: '#fff', borderRight: '1px solid #e0e0e0',
            display: 'flex', flexDirection: 'column', height: '100vh',
            position: 'sticky', top: 0, flexShrink: 0
        }}>
            <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#000', margin: 0 }}>Gorur Gari Admin</h2>
                <button onClick={() => setSidebarOpen(false)} className="admin-close-btn"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'none' }}>
                    <X size={22} />
                </button>
            </div>
            <nav style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {menuItems.map((item) => (
                        <li key={item.path} style={{ marginBottom: '0.5rem' }}>
                            <NavLink to={item.path} end={item.path === '/admin'}
                                style={({ isActive }) => navLinkStyle(isActive)}
                                onClick={() => setSidebarOpen(false)}>
                                {item.icon}{item.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            <div style={{ padding: '1rem', borderTop: '1px solid #f0f0f0' }}>
                <button onClick={handleLogout} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', width: '100%',
                    padding: '0.75rem 1rem', background: 'transparent', border: 'none',
                    color: '#d62020', cursor: 'pointer', fontWeight: 500
                }}>
                    <LogOut size={20} />Logout
                </button>
            </div>
        </aside>
    );

    return (
        <>
            <style>{`
                @media (max-width: 768px) {
                    .admin-sidebar-desktop { display: none !important; }
                    .admin-mobile-overlay { display: flex !important; }
                    .admin-close-btn { display: flex !important; }
                    .admin-header-pad { padding: 0.75rem 1rem !important; }
                    .admin-content-pad { padding: 1rem !important; }
                }
                @media (min-width: 769px) {
                    .admin-hamburger { display: none !important; }
                }
                .admin-mobile-overlay {
                    display: none;
                    position: fixed; inset: 0; z-index: 500;
                }
                .admin-mobile-overlay-bg {
                    position: absolute; inset: 0; background: rgba(0,0,0,0.4);
                }
                .admin-mobile-sidebar {
                    position: relative; z-index: 1; height: 100vh;
                }
            `}</style>

            <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f8' }}>

                {/* Desktop Sidebar */}
                <div className="admin-sidebar-desktop">
                    {sidebar}
                </div>

                {/* Mobile Overlay Sidebar */}
                {sidebarOpen && (
                    <div className="admin-mobile-overlay" style={{ display: 'flex' }}>
                        <div className="admin-mobile-overlay-bg" onClick={() => setSidebarOpen(false)} />
                        <div className="admin-mobile-sidebar">{sidebar}</div>
                    </div>
                )}

                {/* Main Content */}
                <main style={{ flex: 1, minHeight: '100vh', overflowY: 'auto', minWidth: 0 }}>
                    <header className="admin-header-pad" style={{
                        background: '#fff', padding: '1rem 2rem',
                        borderBottom: '1px solid #e0e0e0', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center',
                        position: 'sticky', top: 0, zIndex: 100
                    }}>
                        <button className="admin-hamburger" onClick={() => setSidebarOpen(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Menu size={24} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>Admin</span>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ddd' }} />
                        </div>
                    </header>
                    <div className="admin-content-pad" style={{ padding: '2rem' }}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </>
    );
};

export default AdminLayout;

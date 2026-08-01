import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import logo from '../assets/logo.png';
import { Search, ShoppingBag, User, Menu, X, ChevronDown } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import api from '../api';

const Header = () => {
    const { cart } = useCart();
    const { user, logout } = useAuth();
    const [categories, setCategories] = useState([]);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [expandedCat, setExpandedCat] = useState(null); // For mobile accordion

    const [scrolled, setScrolled] = useState(false);
    const [showSearchOverlay, setShowSearchOverlay] = useState(false);
    const [logoUrl, setLogoUrl] = useState(logo);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    const isHome = location.pathname === '/';

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim()) {
                api.get(`/products/search?q=${encodeURIComponent(searchQuery.trim())}`)
                    .then(res => {
                        // Limit to 5 results
                        setSearchResults(res.data.slice(0, 5));
                    })
                    .catch(console.error);
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setSearchQuery(''); // Optional: clear after search
        }
    };

    useEffect(() => {
        const onScroll = () => {
            const isScrolled = window.scrollY > 50;
            setScrolled(isScrolled);
            if (isScrolled) {
                document.body.classList.add('search-scrolled');
            } else {
                document.body.classList.remove('search-scrolled');
                setShowSearchOverlay(false);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            document.body.classList.remove('search-scrolled');
        };
    }, []);

    useEffect(() => {
        api.get('/categories').then(res => setCategories(res.data)).catch(console.error);
        api.get('/site-settings').then(res => {
            if (res.data.logoUrl) setLogoUrl(res.data.logoUrl);
        }).catch(console.error);
    }, []); logo

    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const userDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
                setIsUserDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    return (
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #e0e0e0' }}>
            <div style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.8rem 1rem', // Default padding
                maxWidth: '1400px',
                margin: '0 auto'
            }} className="header-container">

                {/* 1. Mobile Menu Button (Left) */}
                <div className="mobile-only" style={{ display: 'none', alignItems: 'center' }}>
                    <button
                        onClick={toggleMobileMenu}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                        <Menu size={24} color="#333" />
                    </button>
                </div>

                {/* Logo */}
                <div className="logo-container">
                    <Link to="/"><img src={logoUrl} alt="Gorur Gari" style={{ height: '35px', display: 'block', objectFit: 'contain' }} /></Link>
                </div>

                {/* 2. Desktop Navigation (Center) */}
                <nav className="desktop-only" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>

                    <Link to="/free-delivery" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none', color: '#28a745', fontWeight: 600, fontSize: '0.9rem' }}>
                        Free Delivery
                    </Link>

                    {categories.map((cat) => (
                        <div
                            key={cat.id}
                            className="nav-item"
                            style={{ position: 'relative', cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={() => setExpandedCat(cat.id)}
                            onMouseLeave={() => setExpandedCat(null)}
                        >
                            <Link
                                to={`/category/${cat.id}`}
                                style={{ fontWeight: 600, fontSize: '0.9rem', color: '#000', textDecoration: 'none' }}
                            >
                                {cat.name}
                            </Link>

                            {/* Desktop Dropdown */}
                            {expandedCat === cat.id && cat.subCategories && cat.subCategories.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    background: '#fff',
                                    border: '1px solid #eee',
                                    borderRadius: '4px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    minWidth: '200px',
                                    padding: '0.5rem 0',
                                    zIndex: 200
                                }}>
                                    {cat.subCategories.map(sub => (
                                        <Link
                                            key={sub.id}
                                            to={`/subcategory/${sub.id}`}
                                            style={{
                                                display: 'block',
                                                padding: '0.5rem 1rem',
                                                color: '#333',
                                                textDecoration: 'none',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            {sub.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* 3. Right Icons (Search, Cart, Auth) */}
                <div className="right-icons" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginRight: '0.0rem' }}>
                    {/* Desktop Search Icon — opens the same overlay the mobile icon uses.
                        The below-header search bar is display:none above 768px, so this
                        is the only way to search on desktop. */}
                    <button
                        className="desktop-search-icon"
                        onClick={() => setShowSearchOverlay(true)}
                        aria-label="Search products"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <Search size={22} color="#333" />
                    </button>

                    {/* Mobile Search Icon — only visible on home when scrolled */}
                    {isHome && scrolled && (
                        <button
                            className="mobile-only mobile-search-icon"
                            onClick={() => setShowSearchOverlay(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                            <Search size={22} color="#333" />
                        </button>
                    )}

                    <Link to="/checkout" style={{ position: 'relative', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                        <ShoppingBag size={22} />
                        {cart.length > 0 && (
                            <span style={{
                                position: 'absolute', top: '-8px', right: '-8px',
                                background: '#d62020', color: '#fff', fontSize: '0.7rem',
                                fontWeight: 'bold', width: '18px', height: '18px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {cart.length}
                            </span>
                        )}
                    </Link>

                    {/* Desktop User Auth */}
                    <div
                        ref={userDropdownRef}
                        className="desktop-only"
                        style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => user ? setIsUserDropdownOpen(!isUserDropdownOpen) : setIsAuthModalOpen(true)}
                    >
                        <User size={22} />
                        {/* Dropdown logic for desktop */}
                        {user && isUserDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                background: '#fff',
                                border: '1px solid #eee',
                                borderRadius: '4px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                minWidth: '150px',
                                padding: '0.5rem 0',
                                zIndex: 200
                            }}>
                                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #f0f0f0', color: '#888', fontSize: '0.8rem' }}>
                                    Hi, {user.name}
                                </div>
                                <Link to="/account" style={{ display: 'block', padding: '0.5rem 1rem', color: '#333', textDecoration: 'none', fontSize: '0.9rem' }}>My Account</Link>
                                <button
                                    onClick={(e) => { e.stopPropagation(); logout(); setIsUserDropdownOpen(false); }}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', background: 'none', border: 'none', color: '#d62020', cursor: 'pointer', fontSize: '0.9rem' }}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Search Overlay (when scrolled and icon tapped) */}
            {showSearchOverlay && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
                    background: '#fff', padding: '0.75rem 1rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f4f4f4', borderRadius: '50px', padding: '0.6rem 1rem', position: 'relative' }}>
                        <Search
                            size={18}
                            color="#666"
                            onClick={() => { handleSearch(); setShowSearchOverlay(false); }}
                            style={{ marginRight: '0.5rem', flexShrink: 0, cursor: 'pointer' }}
                        />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search for products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { handleSearch(); setShowSearchOverlay(false); } }}
                            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.95rem' }}
                        />
                        {searchQuery && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                                background: '#fff', border: '1px solid #eee', borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 300, overflow: 'hidden', maxHeight: '60vh', overflowY: 'auto'
                            }}>
                                {searchResults.length > 0 ? searchResults.map(prod => (
                                    <div key={prod.id}
                                        onClick={() => { navigate(`/products/${prod.id}`); setSearchQuery(''); setSearchResults([]); setShowSearchOverlay(false); }}
                                        style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                    >
                                        <img src={prod.imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{prod.name}</span>
                                            <span style={{ fontSize: '0.8rem', color: '#888' }}>{prod.price}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ padding: '1rem', fontSize: '0.9rem', color: '#888', textAlign: 'center' }}>No results found</div>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={() => { setShowSearchOverlay(false); setSearchQuery(''); setSearchResults([]); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#333', flexShrink: 0 }}>
                        Cancel
                    </button>
                </div>
            )}

            {/* Search Bar Below Header — mobile only, home page only */}
            {isHome && <div className="below-header-search" style={{
                background: '#f9f9f9',
                borderBottom: '1px solid #e0e0e0',
                padding: '.1rem',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#fff',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '50px',
                    border: '1px solid #ddd',
                    maxWidth: '600px',
                    width: '100%',
                    position: 'relative'
                }}>
                    <Search size={20} color="#666" style={{ cursor: 'pointer', marginRight: '0.75rem' }} onClick={handleSearch} />
                    <input
                        type="text"
                        placeholder="Search for products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '0.95rem',
                            background: 'transparent'
                        }}
                    />
                    {/* Search Autocomplete Dropdown */}
                    {searchQuery && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#fff',
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 300,
                            marginTop: '8px',
                            overflow: 'hidden',
                            maxHeight: '400px',
                            overflowY: 'auto'
                        }}>
                            {searchResults.length > 0 ? (
                                searchResults.map(prod => (
                                    <div
                                        key={prod.id}
                                        onClick={() => {
                                            navigate(`/products/${prod.id}`);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                        }}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderBottom: '1px solid #f0f0f0',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                    >
                                        <img src={prod.imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{prod.name}</span>
                                            <span style={{ fontSize: '0.8rem', color: '#888' }}>{prod.price}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '1rem', fontSize: '0.9rem', color: '#888', textAlign: 'center' }}>
                                    No results found
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>}

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh',
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000
                }} onClick={toggleMobileMenu}>
                    <div style={{
                        width: '80%', maxWidth: '300px', height: '100%',
                        background: '#fff', padding: '1rem',
                        transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
                        transition: 'transform 0.3s ease-in-out'
                    }} onClick={e => e.stopPropagation()}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>Menu</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {/* User Icon in Sidebar */}
                                <div
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    onClick={(e) => { e.stopPropagation(); user ? setIsUserDropdownOpen(!isUserDropdownOpen) : setIsAuthModalOpen(true); }}
                                >
                                    <User size={24} />
                                </div>
                                <X size={24} onClick={toggleMobileMenu} cursor="pointer" />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <Link to="/" onClick={toggleMobileMenu} style={{ fontSize: '1rem', fontWeight: 600, color: '#000', textDecoration: 'none' }}>Shop Now</Link>
                            {categories.map(cat => (
                                <div key={cat.id}>
                                    <div
                                        onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                    >
                                        <span style={{ fontSize: '1rem' }}>{cat.name}</span>
                                        {cat.subCategories && cat.subCategories.length > 0 && <ChevronDown size={16} />}
                                    </div>

                                    {/* Mobile Submenu */}
                                    {expandedCat === cat.id && cat.subCategories && (
                                        <div style={{ paddingLeft: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '2px solid #eee' }}>
                                            {cat.subCategories.map(sub => (
                                                <span key={sub.id} style={{ color: '#555', fontSize: '0.9rem' }}>{sub.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {user ? (
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                <p>Hi, {user.name}</p>
                                <Link to="/account" onClick={toggleMobileMenu} style={{ display: 'block', margin: '0.5rem 0', color: '#000' }}>My Account</Link>
                                <button onClick={() => { logout(); toggleMobileMenu(); }} style={{ color: '#d62020', background: 'none', border: 'none', padding: 0, marginTop: '0.5rem' }}>Logout</button>
                            </div>
                        ) : (
                            <button onClick={() => { setIsAuthModalOpen(true); toggleMobileMenu(); }} style={{ marginTop: '2rem', width: '100%', padding: '0.8rem', background: '#000', color: '#fff' }}>Login / Signup</button>
                        )}

                    </div>
                </div>
            )}

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            {/* Inline Styles for Media Queries (In a real app, move to CSS) */}
            <style>{`
                @media (max-width: 768px) {
                    .desktop-only { display: none !important; }
                    .mobile-only { display: flex !important; }
                    .desktop-search-icon { display: none !important; }
                    .below-header-search {
                        display: flex !important;
                        max-height: 80px;
                        overflow: hidden;
                        transition: max-height 0.3s ease, opacity 0.3s ease;
                        opacity: 1;
                    }
                    .logo-container {
                        position: absolute;
                        left: 50%;
                        top: 35%;
                        transform: translate(-50%, -50%);
                    }
                    .header-container {
                        padding-right: 0.5rem !important;
                        padding-left: 0.5rem !important;
                    }
                    .right-icons {
                        gap: 0.6rem !important;
                        
                    }
                    /* Hide search bar when scrolled */
                    body.search-scrolled .below-header-search {
                        max-height: 0 !important;
                        opacity: 0 !important;
                        padding-top: 0 !important;
                        padding-bottom: 0 !important;
                        border: none !important;
                    }
                    /* Reduce main content top padding when search bar is hidden */
                    body.search-scrolled .main-content {
                        padding-top: 75px !important;
                    }
                }
                @media (min-width: 769px) {
                    .desktop-only { display: flex !important; }
                    .mobile-only { display: none !important; }
                    .mobile-search-icon { display: none !important; }
                    .desktop-search-icon { display: flex !important; }
                    .below-header-search { display: none !important; }
                    .logo-container { display: block; }
                    .right-icons { gap: 0.75rem; }
                }
            `}</style>
        </header>
    );
};

export default Header;

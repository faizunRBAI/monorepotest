import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';

import api from './api';
import usePageTitle from './hooks/usePageTitle';
import usePageView from './hooks/usePageView';

import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ScrollToTop from './components/ScrollToTop';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CategorySection from './components/CategorySection';
import OfferPopup from './components/OfferPopup';

import Login from './pages/Admin/Login';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminProducts from './pages/Admin/Products';
import AdminCategories from './pages/Admin/Categories';
import AdminOrders from './pages/Admin/Orders';
import AdminCustomers from './pages/Admin/Customers';
import AdminSizeCharts from './pages/Admin/SizeCharts';
import AdminVouchers from './pages/Admin/Vouchers';
import AdminManagement from './pages/Admin/AdminManagement';
import AdminSettings from './pages/Admin/Settings';

import ProductDetails from './pages/ProductDetails';
import Checkout from './pages/Checkout';
import MyAccount from './pages/MyAccount';
import CategoryProducts from './pages/CategoryProducts';
import SearchResults from './pages/SearchResults';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Cancellation from './pages/Cancellation';
import FAQs from './pages/FAQs';
import FreeDelivery from './pages/FreeDelivery';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

function Home() {
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        api.get('/categories')
            .then(res => setCategories(res.data.filter(c => c.showOnHome !== 0)))
            .catch(console.error);
    }, []);

    return (
        <>
            <Hero />
            <OfferPopup />
            <ProductGrid />
            {categories.map(cat => (
                <CategorySection key={cat.id} category={cat} />
            ))}
        </>
    );
}

function App() {
    usePageTitle();
    // After usePageTitle, so the pageview reports the title of the page just navigated to.
    usePageView();

    return (
        <>
            <ScrollToTop />
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/products/:id" element={<ProductDetails />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/account" element={<MyAccount />} />
                    <Route path="/category/:id" element={<CategoryProducts />} />
                    <Route path="/subcategory/:id" element={<CategoryProducts />} />
                    <Route path="/search" element={<SearchResults />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/cancellation" element={<Cancellation />} />
                    <Route path="/faqs" element={<FAQs />} />
                    <Route path="/free-delivery" element={<FreeDelivery />} />
                </Route>

                <Route path="/login" element={<Login />} />

                <Route path="/admin" element={
                    <ProtectedRoute>
                        <AdminLayout />
                    </ProtectedRoute>
                }>
                    <Route index element={<AdminDashboard />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="customers" element={<AdminCustomers />} />
                    <Route path="size-charts" element={<AdminSizeCharts />} />
                    <Route path="vouchers" element={<AdminVouchers />} />
                    <Route path="admin-accounts" element={<AdminManagement />} />
                    <Route path="settings" element={<AdminSettings />} />
                </Route>
            </Routes>
        </>
    );
}

export default App;

import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Plus, Trash2, X, Edit2, Copy, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { MEASUREMENT_GROUPS, normalizeGroups } from '../../utils/measurements';

const AdminProducts = () => {
    const { confirm } = useNotification();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sizeCharts, setSizeCharts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        originalPrice: '',
        imageUrl: '', // Stores string URL if editing
        categoryId: '',
        subCategoryId: '',
        isNewArrival: true,
        description: '',
        fullDescription: '',
        images: [], // Stores array of strings (URLs) if editing
        stock: 0,
        sizes: [],
        colors: '',
        sizeChartId: '',
        sizeStock: {},
        isFreeShipping: false,
        // Which made-to-measure groups the buyer must fill in for this product.
        measurementGroups: ['kameez', 'pajama']
    });

    // File State
    const [mainImageFile, setMainImageFile] = useState(null);
    const [additionalImageFiles, setAdditionalImageFiles] = useState([]);

    const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    // Age-based sizes for baby/kids items. Labels must not contain commas —
    // sizes are submitted to the backend as a comma-joined string.
    const AGE_SIZES = ['0-3 Months', '3-6 Months', '6-12 Months', '1-2 Years', '2-3 Years', '3-4 Years', '4-5 Years', '5-6 Years', '6-8 Years', '8-10 Years', '10-12 Years'];

    useEffect(() => {
        fetchProducts();
        fetchCategories();
        fetchSizeCharts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSizeCharts = async () => {
        try {
            const res = await api.get('/size-charts');
            setSizeCharts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleFileChange = (e) => {
        if (e.target.name === 'mainImage') {
            setMainImageFile(e.target.files[0]);
        } else if (e.target.name === 'additionalImages') {
            setAdditionalImageFiles(Array.from(e.target.files));
        }
    };

    const handleSizeChange = (size) => {
        setFormData(prev => {
            let newSizes;
            let newSizeStock = { ...prev.sizeStock };

            if (prev.sizes.includes(size)) {
                newSizes = prev.sizes.filter(s => s !== size);
                delete newSizeStock[size];
            } else {
                newSizes = [...prev.sizes, size];
                newSizeStock[size] = 0;
            }

            // Recalculate total stock
            const totalStock = Object.values(newSizeStock).reduce((sum, val) => sum + (parseInt(val) || 0), 0);

            return { ...prev, sizes: newSizes, sizeStock: newSizeStock, stock: totalStock };
        });
    };

    const handleSizeStockChange = (size, qty) => {
        const val = parseInt(qty) || 0;
        setFormData(prev => {
            const newSizeStock = { ...prev.sizeStock, [size]: val };
            const totalStock = Object.values(newSizeStock).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
            return { ...prev, sizeStock: newSizeStock, stock: totalStock };
        });
    };

    const resetForm = () => {
        setFormData({
            name: '', price: '', originalPrice: '', imageUrl: '', categoryId: '', subCategoryId: '', isNewArrival: true,
            description: '', fullDescription: '', images: [], stock: 0, sizes: [], colors: '', sizeChartId: '', sizeStock: {}, isFreeShipping: false, measurementGroups: ['kameez', 'pajama']
        });
        setMainImageFile(null);
        setAdditionalImageFiles([]);
        setIsEditing(false);
        setEditId(null);
    };

    const openEditModal = (product) => {
        setFormData({
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice || '',
            imageUrl: product.imageUrl,
            categoryId: product.categoryId,
            subCategoryId: product.subCategoryId || '',
            isNewArrival: product.isNewArrival == 1 || product.isNewArrival === true,
            description: product.description || '',
            fullDescription: product.fullDescription || '',
            images: product.images || [],
            stock: product.stock || 0,
            sizes: Array.isArray(product.sizes) ? product.sizes : [],
            colors: Array.isArray(product.colors) ? product.colors.join(', ') : (product.colors || ''),
            sizeChartId: product.sizeChartId || '',
            sizeStock: product.sizeStock || {},
            isFreeShipping: product.isFreeShipping == 1 || product.isFreeShipping === true,
            measurementGroups: normalizeGroups(product.measurementGroups)
        });
        setMainImageFile(null);
        setAdditionalImageFiles([]);
        setIsEditing(true);
        setEditId(product.id);
        setShowModal(true);
    };



    // Review State
    const [productReviews, setProductReviews] = useState([]);
    const [activeTab, setActiveTab] = useState('details'); // 'details' or 'reviews'

    const handleEdit = async (product) => {
        setFormData({
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice || '',
            imageUrl: product.imageUrl,
            categoryId: product.categoryId,
            subCategoryId: product.subCategoryId || '',
            isNewArrival: product.isNewArrival === 1 || product.isNewArrival === true,
            description: product.description || '',
            fullDescription: product.fullDescription || '',
            images: product.images || [],
            stock: product.stock,
            sizes: product.sizes || [],
            colors: Array.isArray(product.colors) ? product.colors.join(', ') : (product.colors || ''),
            sizeChartId: product.sizeChartId || '',
            sizeStock: product.sizeStock || {},
            isFreeShipping: product.isFreeShipping == 1 || product.isFreeShipping === true,
            measurementGroups: normalizeGroups(product.measurementGroups)
        });
        setMainImageFile(null);
        setAdditionalImageFiles([]);
        setIsEditing(true);
        setEditId(product.id);
        setShowModal(true);
        setActiveTab('details');

        // Fetch full details including reviews
        try {
            const res = await api.get(`/products/${product.id}`);
            const fullProduct = res.data;
            console.log("Full product details fetched:", fullProduct);
            // alert(`Debug: Free Shipping = ${fullProduct.isFreeShipping} (${typeof fullProduct.isFreeShipping})`);

            // Update form data with fresh details from server
            setFormData(prev => ({
                ...prev,
                name: fullProduct.name,
                price: fullProduct.price,
                originalPrice: fullProduct.originalPrice || '',
                imageUrl: fullProduct.imageUrl,
                categoryId: fullProduct.categoryId,
                subCategoryId: fullProduct.subCategoryId || '',
                isNewArrival: !!fullProduct.isNewArrival, // Robust boolean conversion
                description: fullProduct.description || '',
                fullDescription: fullProduct.fullDescription || '',
                images: fullProduct.images || [],
                stock: fullProduct.stock,
                sizes: fullProduct.sizes || [],
                colors: Array.isArray(fullProduct.colors) ? fullProduct.colors.join(', ') : (fullProduct.colors || ''),
                sizeChartId: fullProduct.sizeChartId || '',
                sizeStock: fullProduct.sizeStock || {},
                isFreeShipping: !!fullProduct.isFreeShipping, // Robust boolean conversion
                measurementGroups: normalizeGroups(fullProduct.measurementGroups)
            }));

            if (res.data.reviews) {
                setProductReviews(res.data.reviews);
            } else {
                setProductReviews([]);
            }
        } catch (err) {
            console.error("Failed to fetch product details", err);
            setProductReviews([]);
        }
    };

    const handleDeleteReview = async (reviewId) => {
        const shouldDelete = await confirm({
            title: 'Delete Review',
            message: 'Delete this review?',
            confirmLabel: 'Delete Review',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try {
            await api.delete(`/reviews/${reviewId}`);
            setProductReviews(prev => prev.filter(r => r.id !== reviewId));
        } catch (err) {
            alert("Failed to delete review");
        }
    };

    const handleReorderReviews = async (newOrder) => {
        // newOrder is array of reviews
        setProductReviews(newOrder); // Optimistic update

        const updates = newOrder.map((r, index) => ({ id: r.id, sortOrder: index }));
        try {
            await api.put('/reviews/reorder', { reviews: updates });
        } catch (err) {
            alert("Failed to save order");
            // Revert? For now just alert.
        }
    };

    const moveReview = (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === productReviews.length - 1) return;

        const newReviews = [...productReviews];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newReviews[index], newReviews[targetIndex]] = [newReviews[targetIndex], newReviews[index]];
        handleReorderReviews(newReviews);
    };

    const handleDuplicate = (product) => {
        setFormData({
            name: `${product.name} (Copy)`,
            price: product.price,
            originalPrice: product.originalPrice || '',
            imageUrl: product.imageUrl, // Will be sent as string if not changed
            categoryId: product.categoryId,
            subCategoryId: product.subCategoryId || '',
            isNewArrival: false, // Default to false for copy
            description: product.description || '',
            fullDescription: product.fullDescription || '',
            images: product.images || [], // Will be sent as existingImages
            stock: product.stock || 0,
            sizes: Array.isArray(product.sizes) ? product.sizes : [],
            colors: Array.isArray(product.colors) ? product.colors.join(', ') : (product.colors || ''),
            sizeChartId: product.sizeChartId || '',
            sizeStock: product.sizeStock || {},
            isFreeShipping: product.isFreeShipping == 1 || product.isFreeShipping === true,
            measurementGroups: normalizeGroups(product.measurementGroups)
        });
        setMainImageFile(null);
        setAdditionalImageFiles([]);
        setIsEditing(false); // Creating new
        setEditId(null);
        setShowModal(true);
        setActiveTab('details');
        setProductReviews([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (parseInt(formData.stock) < 0) {
            alert("Stock cannot be negative");
            return;
        }
        if (!formData.measurementGroups || formData.measurementGroups.length === 0) {
            alert("Choose at least one set of measurements the customer must submit for this product.");
            return;
        }

        const data = new FormData();
        data.append('name', formData.name);
        data.append('price', formData.price);
        data.append('originalPrice', formData.originalPrice);
        data.append('categoryId', formData.categoryId);
        if (formData.subCategoryId) data.append('subCategoryId', formData.subCategoryId);
        data.append('isNewArrival', formData.isNewArrival);
        data.append('description', formData.description);
        data.append('fullDescription', formData.fullDescription);
        data.append('stock', formData.stock);
        // data.append('sizes', JSON.stringify(formData.sizes)); // Backend expects string logic or array logic. 
        // Our backend splits by comma if string. Let's send comma separated string.
        data.append('sizes', formData.sizes.join(','));
        data.append('colors', formData.colors);
        if (formData.sizeChartId) data.append('sizeChartId', formData.sizeChartId);
        data.append('sizeStock', JSON.stringify(formData.sizeStock));
        data.append('isFreeShipping', formData.isFreeShipping);
        data.append('measurementGroups', JSON.stringify(formData.measurementGroups));

        // Images
        if (mainImageFile) {
            data.append('imageUrl', mainImageFile);
        } else {
            // Keep existing URL if editing
            data.append('imageUrl', formData.imageUrl);
        }

        additionalImageFiles.forEach(file => {
            data.append('images', file);
        });

        // Pass existing images so backend can append/merge if needed
        // Pass existing images so backend can append/merge if needed
        if ((isEditing || !mainImageFile) && formData.images.length > 0) {
            // Send as existingImages for duplication or update
            formData.images.forEach(imgUrl => data.append('existingImages', imgUrl));
        }

        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
            if (isEditing) {
                await api.put(`/products/${editId}`, data, config);
            } else {
                await api.post('/products', data, config);
            }
            setShowModal(false);
            resetForm();
            fetchProducts();
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.details || err.response?.data?.error || 'Failed to save product';
            alert(msg);
        }
    };

    const handleDelete = async (id) => {
        const shouldDelete = await confirm({
            title: 'Delete Product',
            message: 'Are you sure you want to delete this product?',
            confirmLabel: 'Delete Product',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try {
            await api.delete(`/products/${id}`);
            fetchProducts();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    // Derived state for subcategories based on selected category
    const selectedCategory = categories.find(c => c.id === parseInt(formData.categoryId));
    const subCategories = selectedCategory ? selectedCategory.subCategories : [];

    // Filter Logic
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory ? product.categoryId === parseInt(filterCategory) : true;
        return matchesSearch && matchesCategory;
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Products</h1>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    style={{
                        background: '#000', color: '#fff', padding: '0.75rem 1.5rem',
                        border: 'none', borderRadius: '4px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                    <Plus size={18} /> Add Product
                </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <input
                    type="text"
                    placeholder="Search by product name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' }}
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
            </div>

            {/* Product List Table */}
            <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f4f6f8', textAlign: 'left' }}>
                        <tr>
                            <th style={{ padding: '1rem' }}>ID</th>
                            <th style={{ padding: '1rem' }}>Image</th>
                            <th style={{ padding: '1rem' }}>Name</th>
                            <th style={{ padding: '1rem' }}>Price</th>
                            <th style={{ padding: '1rem' }}>Stock</th>
                            <th style={{ padding: '1rem' }}>Category</th>
                            <th style={{ padding: '1rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.length === 0 ? (
                            <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center' }}>No products found matching filters.</td></tr>
                        ) : (
                            filteredProducts.map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '1rem', color: '#888' }}>#{product.id}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <img src={product.imageUrl} alt={product.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{product.name}</td>
                                    <td style={{ padding: '1rem' }}>{product.price}</td>
                                    <td style={{ padding: '1rem' }}>{product.stock || 0}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {product.category?.name}
                                        {product.subCategory && <span style={{ color: '#888', fontSize: '0.85rem' }}> / {product.subCategory.name}</span>}
                                    </td>
                                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => openEditModal(product)} style={{ color: '#007bff', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(product.id)} style={{ color: '#d62020', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                            <Trash2 size={18} />
                                        </button>
                                        <button onClick={() => handleDuplicate(product)} title="Duplicate" style={{ color: '#28a745', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                            <Copy size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Product Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '700px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2>{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
                        </div>

                        {isEditing && (
                            <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '1.5rem' }}>
                                <button
                                    onClick={() => setActiveTab('details')}
                                    style={{ padding: '1rem', background: 'none', border: 'none', borderBottom: activeTab === 'details' ? '2px solid #000' : 'none', fontWeight: activeTab === 'details' ? 'bold' : 'normal', cursor: 'pointer' }}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => setActiveTab('reviews')}
                                    style={{ padding: '1rem', background: 'none', border: 'none', borderBottom: activeTab === 'reviews' ? '2px solid #000' : 'none', fontWeight: activeTab === 'reviews' ? 'bold' : 'normal', cursor: 'pointer' }}
                                >
                                    Reviews ({productReviews.length})
                                </button>
                            </div>
                        )}

                        {activeTab === 'details' ? (
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Basic Info */}
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Product Name</label>
                                        <input required name="name" value={formData.name} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ width: '150px' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Price</label>
                                        <input required name="price" value={formData.price} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="999 BDT" />
                                    </div>
                                    <div style={{ width: '150px' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Original Price</label>
                                        <input name="originalPrice" value={formData.originalPrice} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="Optional" />
                                    </div>
                                    <div style={{ width: '100px' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Stock</label>
                                        <input type="number" min="0" name="stock" value={formData.stock} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Short Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'inherit' }} />
                                </div>

                                {/* Full Description with Image Insert */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <label style={{ fontSize: '0.9rem' }}>Full Description (Displayed above reviews)</label>
                                        <label style={{
                                            cursor: 'pointer', background: '#e9ecef', padding: '0.25rem 0.5rem',
                                            borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem'
                                        }}>
                                            <Plus size={14} /> Insert Image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;

                                                    const data = new FormData();
                                                    data.append('image', file);

                                                    try {
                                                        const res = await api.post('/upload', data, {
                                                            headers: { 'Content-Type': 'multipart/form-data' }
                                                        });
                                                        const imgTag = `\n<img src="${res.data.imageUrl}" alt="Description Image" style="width: 100%; height: auto; margin: 1rem 0;" />\n`;

                                                        setFormData(prev => ({
                                                            ...prev,
                                                            fullDescription: (prev.fullDescription || '') + imgTag
                                                        }));
                                                    } catch (err) {
                                                        alert('Failed to upload image');
                                                        console.error(err);
                                                    }
                                                    e.target.value = null; // Reset
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <textarea
                                        name="fullDescription"
                                        value={formData.fullDescription}
                                        onChange={handleInputChange}
                                        rows="6"
                                        placeholder="Enter detailed description here. You can insert images using the button above."
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'inherit' }}
                                    />
                                </div>

                                {/* Images */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Main Image</label>
                                    <input type="file" name="mainImage" onChange={handleFileChange} accept=".jpg, .jpeg, .png, .webp" style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    {isEditing && formData.imageUrl && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>Current: {formData.imageUrl}</div>}
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Additional Images</label>
                                    <input type="file" name="additionalImages" onChange={handleFileChange} multiple accept=".jpg, .jpeg, .png, .webp" style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    {isEditing && formData.images.length > 0 && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>Current: {formData.images.length} images</div>}
                                </div>

                                {/* Category */}
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Category</label>
                                        <select required name="categoryId" value={formData.categoryId} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                                            <option value="">Select Category</option>
                                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Subcategory</label>
                                        <select name="subCategoryId" value={formData.subCategoryId} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} disabled={!formData.categoryId}>
                                            <option value="">Select Subcategory</option>
                                            {subCategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Size Chart Selector */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Size Chart (Optional)</label>
                                    <select name="sizeChartId" value={formData.sizeChartId} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                                        <option value="">None</option>
                                        {sizeCharts.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                                    </select>
                                </div>

                                {/* Which measurements the buyer is asked for. A kameez-only
                                    product should not demand pajama measurements. */}
                                <div style={{ padding: '1rem', border: '1px solid #e3e3e3', borderRadius: '6px', background: '#fbfbfb' }}>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                        Measurements required from the customer
                                    </label>
                                    <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 0.75rem' }}>
                                        Only the ticked sets appear on the product page. Tick both for a full set
                                        (kameez + pajama); tick just one for a single garment.
                                    </p>
                                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                        {MEASUREMENT_GROUPS.map(group => {
                                            const checked = formData.measurementGroups?.includes(group.id) || false;
                                            return (
                                                <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => setFormData(prev => {
                                                            const current = prev.measurementGroups || [];
                                                            const next = current.includes(group.id)
                                                                ? current.filter(g => g !== group.id)
                                                                : [...current, group.id];
                                                            // Canonical order, but an empty selection is left as-is so the
                                                            // warning below can show (normalizeGroups would expand [] to all).
                                                            return {
                                                                ...prev,
                                                                measurementGroups: MEASUREMENT_GROUPS.map(g => g.id).filter(id => next.includes(id)),
                                                            };
                                                        })}
                                                    />
                                                    <span style={{ fontSize: '0.9rem' }}>
                                                        {group.en} <span style={{ color: '#888' }}>({group.bn})</span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {(!formData.measurementGroups || formData.measurementGroups.length === 0) && (
                                        <p style={{ color: '#c53030', fontSize: '0.8rem', margin: '0.6rem 0 0' }}>
                                            Pick at least one — otherwise the customer would have nothing to submit.
                                        </p>
                                    )}
                                </div>

                                {/* Variants */}
                                <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Sizes & Stock</label>
                                        {[
                                            ['Standard Sizes', AVAILABLE_SIZES],
                                            ['Age Sizes (Baby / Kids)', AGE_SIZES],
                                            // Any size saved on this product that is no longer a preset
                                            // still has to be visible so it can be unselected.
                                            ['Other', formData.sizes.filter(s => !AVAILABLE_SIZES.includes(s) && !AGE_SIZES.includes(s))]
                                        ].map(([groupLabel, groupSizes]) => groupSizes.length > 0 && (
                                            <div key={groupLabel} style={{ marginBottom: '0.75rem' }}>
                                                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.35rem' }}>{groupLabel}</div>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    {groupSizes.map(size => {
                                                        const isSelected = formData.sizes.includes(size);
                                                        return (
                                                            <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSizeChange(size)}
                                                                    style={{
                                                                        padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: '4px',
                                                                        background: isSelected ? '#000' : '#fff',
                                                                        color: isSelected ? '#fff' : '#000',
                                                                        cursor: 'pointer', minWidth: '40px', whiteSpace: 'nowrap'
                                                                    }}>
                                                                    {size}
                                                                </button>
                                                                {isSelected && (
                                                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const currentVal = parseInt(formData.sizeStock?.[size] || 0);
                                                                                if (currentVal > 0) handleSizeStockChange(size, currentVal - 1);
                                                                            }}
                                                                            style={{
                                                                                background: '#eee', border: 'none', padding: '4px 8px', cursor: 'pointer',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                            }}
                                                                        >
                                                                            <ChevronDown size={14} />
                                                                        </button>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            placeholder="Qty"
                                                                            value={formData.sizeStock?.[size] || 0}
                                                                            onChange={(e) => handleSizeStockChange(size, e.target.value)}
                                                                            style={{
                                                                                width: '40px', padding: '0.25rem', fontSize: '0.8rem',
                                                                                border: 'none', textAlign: 'center', outline: 'none'
                                                                            }}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const currentVal = parseInt(formData.sizeStock?.[size] || 0);
                                                                                handleSizeStockChange(size, currentVal + 1);
                                                                            }}
                                                                            style={{
                                                                                background: '#eee', border: 'none', padding: '4px 8px', cursor: 'pointer',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                            }}
                                                                        >
                                                                            <ChevronUp size={14} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                            Total Calculated Stock: {formData.stock}
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Colors (Comma separated)</label>
                                        <input name="colors" value={formData.colors} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="Red, Blue, Green" />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <input type="checkbox" name="isNewArrival" checked={formData.isNewArrival} onChange={handleInputChange} id="newArrival" />
                                    <label htmlFor="newArrival">Mark as New Arrival</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <input type="checkbox" name="isFreeShipping" checked={formData.isFreeShipping || false} onChange={handleInputChange} id="freeShipping" />
                                    <label htmlFor="freeShipping">Free Shipping</label>
                                </div>

                                <button type="submit" style={{ marginTop: '1rem', padding: '1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                                    {isEditing ? 'Save Changes' : 'Create Product'}
                                </button>
                            </form>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3>Customer Reviews</h3>
                                </div>
                                {productReviews.length === 0 ? <p>No reviews yet.</p> : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {productReviews.map((review, index) => (
                                            <div key={review.id} style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '4px', background: '#f9f9f9', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                        <strong>{review.customer?.name || 'Customer'}</strong>
                                                        <span style={{ color: '#f1c40f' }}>{'★'.repeat(review.rating)}</span>
                                                    </div>
                                                    <p style={{ margin: 0, color: '#555' }}>{review.comment}</p>
                                                    <span style={{ fontSize: '0.8rem', color: '#999' }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                    <button onClick={() => moveReview(index, 'up')} disabled={index === 0} style={{ padding: '5px', cursor: 'pointer' }}>↑</button>
                                                    <button onClick={() => moveReview(index, 'down')} disabled={index === productReviews.length - 1} style={{ padding: '5px', cursor: 'pointer' }}>↓</button>
                                                    <button onClick={() => handleDeleteReview(review.id)} style={{ padding: '5px', color: 'red', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProducts;

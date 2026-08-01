import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Plus, Trash2, ChevronRight, Save, X, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const AdminCategories = () => {
    const { confirm, prompt } = useNotification();
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [newCatName, setNewCatName] = useState('');
    const [selectedCat, setSelectedCat] = useState(null);
    const [newSubName, setNewSubName] = useState('');

    // Editing State for Selected Category
    const [editName, setEditName] = useState('');
    const [editBannerProduct, setEditBannerProduct] = useState('');
    const [editGridProducts, setEditGridProducts] = useState([]); // List of IDs
    const [editImage, setEditImage] = useState(null);
    const [editShowOnHome, setEditShowOnHome] = useState(true);
    const [productSearch, setProductSearch] = useState('');
    const [bannerSearch, setBannerSearch] = useState('');

    useEffect(() => {
        fetchCategories();
        fetchProducts();
    }, []);

    useEffect(() => {
        if (selectedCat) {
            setEditName(selectedCat.name);
            setEditBannerProduct(selectedCat.featuredProductId || '');
            setEditGridProducts(selectedCat.featuredProductList ? JSON.parse(selectedCat.featuredProductList) : []);
            setEditImage(null);
            setEditShowOnHome(selectedCat.showOnHome !== 0); // 1 or true -> true, 0 -> false
        }
    }, [selectedCat]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddCategory = async () => {
        if (!newCatName) return;
        const formData = new FormData();
        formData.append('name', newCatName);

        try {
            await api.post('/categories', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setNewCatName('');
            fetchCategories();
        } catch (err) {
            alert('Failed to add category');
        }
    };

    const handleDeleteCategory = async (id) => {
        const userInput = await prompt({
            title: 'Delete Category',
            message: 'To delete this category and all its subcategories, type "delete".',
            placeholder: 'Type delete',
            confirmLabel: 'Delete Category',
            tone: 'danger'
        });
        if (userInput === null) {
            return;
        }

        if (userInput.trim().toLowerCase() !== 'delete') {
            alert('Deletion cancelled. You must type "delete".');
            return;
        }

        try {
            await api.delete(`/categories/${id}`);
            fetchCategories();
            if (selectedCat?.id === id) setSelectedCat(null);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete');
        }
    };

    const moveCategory = async (index, direction, e) => {
        e.stopPropagation();
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === categories.length - 1) return;

        const newCategories = [...categories];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap
        [newCategories[index], newCategories[swapIndex]] = [newCategories[swapIndex], newCategories[index]];

        setCategories(newCategories); // Optimistic update

        try {
            await api.put('/categories/reorder', { orderedIds: newCategories.map(c => c.id) });
        } catch (err) {
            console.error('Failed to save order', err);
            fetchCategories(); // Revert on error
            alert('Failed to save order');
        }
    };

    const handleDeleteSubCategory = async (subId) => {
        const shouldDelete = await confirm({
            title: 'Delete Subcategory',
            message: 'Delete this subcategory?',
            confirmLabel: 'Delete Subcategory',
            tone: 'danger'
        });
        if (!shouldDelete) return;
        try {
            await api.delete(`/subcategories/${subId}`);
            // Refresh
            fetchCategories();
            const updatedCats = await api.get('/categories');
            setCategories(updatedCats.data);
            const updatedSelected = updatedCats.data.find(c => c.id === selectedCat.id);
            setSelectedCat(updatedSelected);
        } catch (err) {
            console.error(err);
            alert('Failed to delete subcategory');
        }
    };

    const handleAddSubCategory = async () => {
        if (!newSubName || !selectedCat) return;
        try {
            await api.post('/subcategories', { name: newSubName, categoryId: selectedCat.id });
            setNewSubName('');
            fetchCategories(); // Refresh to show new sub
            // Update selected cat view locally
            const updatedCats = await api.get('/categories');
            setCategories(updatedCats.data);
            const updatedSelected = updatedCats.data.find(c => c.id === selectedCat.id);
            setSelectedCat(updatedSelected);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Failed to add subcategory');
        }
    };

    const handleSaveChanges = async () => {
        if (!selectedCat) return;

        const formData = new FormData();
        formData.append('name', editName);
        formData.append('showOnHome', editShowOnHome);
        if (editImage) {
            formData.append('image', editImage);
        }
        if (editBannerProduct) {
            formData.append('featuredProductId', editBannerProduct);
        } else {
            // Handle clearing? Backend needs to handle checking if undefined or null.
            // Our backend uses `if (featuredProductId !== undefined)` so if we send empty string it might be issue if cast to int.
            // Let's send 0 or null if emptied? Logic in backend `featuredProductId || null` handles empty string to null.
            formData.append('featuredProductId', '');
        }

        formData.append('featuredProductList', JSON.stringify(editGridProducts));

        try {
            await api.put(`/categories/${selectedCat.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Category updated!');
            fetchCategories();
            // Update selected to reflect new data
            const updatedCats = await api.get('/categories');
            const updatedSelected = updatedCats.data.find(c => c.id === selectedCat.id);
            setSelectedCat(updatedSelected);
        } catch (error) {
            console.error(error);
            alert('Failed to update category');
        }
    };

    const addProductToGrid = (productId) => {
        if (editGridProducts.length >= 8) {
            alert('Maximum 8 products allowed');
            return;
        }
        if (!editGridProducts.includes(productId)) {
            setEditGridProducts([...editGridProducts, productId]);
        }
        setProductSearch('');
    };

    const removeProductFromGrid = (productId) => {
        setEditGridProducts(editGridProducts.filter(id => id !== productId));
    };

    // Filter products for search
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

    return (
        <div style={{ display: 'flex', gap: '2rem', height: '85vh' }}>
            {/* Main Categories List */}
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Categories</h2>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                    <input
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="New Category Name"
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <button onClick={handleAddCategory} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                        <Plus size={18} />
                    </button>
                </div>

                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {categories.map(cat => (
                        <li key={cat.id}
                            onClick={() => setSelectedCat(cat)}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem',
                                borderBottom: '1px solid #f0f0f0',
                                cursor: 'pointer',
                                background: selectedCat?.id === cat.id ? '#f0f7ff' : 'transparent'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {cat.imageUrl && (
                                    <img src={cat.imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                )}
                                <span style={{ fontWeight: 500 }}>{cat.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <button
                                        onClick={(e) => moveCategory(categories.indexOf(cat), 'up', e)}
                                        disabled={categories.indexOf(cat) === 0}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: categories.indexOf(cat) === 0 ? '#ddd' : '#666' }}
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => moveCategory(categories.indexOf(cat), 'down', e)}
                                        disabled={categories.indexOf(cat) === categories.length - 1}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: categories.indexOf(cat) === categories.length - 1 ? '#ddd' : '#666' }}
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} style={{ color: '#d62020', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Selected Category Details */}
            <div style={{ flex: 2, background: '#fff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                    {selectedCat ? `Editing: ${selectedCat.name}` : 'Select a Category'}
                </h2>

                {selectedCat ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* 1. Basic Info */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>Category Name</label>
                                <input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={editShowOnHome}
                                            onChange={(e) => setEditShowOnHome(e.target.checked)}
                                        />
                                        Show on Home Page
                                    </label>
                                </div>
                            </div>
                            <button onClick={handleSaveChanges} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.6rem 1.5rem', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <Save size={18} /> Save Changes
                            </button>
                        </div>

                        {/* 2. Banner Settings */}
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Banner Settings</h3>
                            <div style={{ display: 'flex', gap: '2rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                        Category Image <span style={{ fontSize: '0.8rem', color: '#999' }}>(Recommended: 400x600px)</span>
                                    </label>
                                    <input
                                        key={selectedCat.id}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setEditImage(e.target.files[0])}
                                        style={{ width: '100%' }}
                                    />
                                    {selectedCat.imageUrl && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>Current: Uses Custom Image</div>}
                                    <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
                                        Upload a specific photo for this category if you don't want to use a product's image.
                                    </p>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>OR Use Product Image</label>

                                    {/* Selected Product Display */}
                                    {editBannerProduct ? (
                                        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#f9f9f9', marginBottom: '0.5rem' }}>
                                            {(() => {
                                                const p = products.find(prod => prod.id === parseInt(editBannerProduct));
                                                return p ? (
                                                    <>
                                                        <img src={p.imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                                                    </>
                                                ) : <span>Product ID: {editBannerProduct} (Not Found)</span>;
                                            })()}
                                            <X size={16} style={{ cursor: 'pointer', color: '#d62020', marginLeft: 'auto' }} onClick={() => setEditBannerProduct('')} />
                                        </div>
                                    ) : (
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', padding: '0.5rem' }}>
                                                <Search size={18} color="#888" />
                                                <input
                                                    value={bannerSearch}
                                                    onChange={(e) => setBannerSearch(e.target.value)}
                                                    placeholder="Search product..."
                                                    style={{ border: 'none', outline: 'none', marginLeft: '0.5rem', flex: 1 }}
                                                />
                                            </div>
                                            {/* Dropdown Results */}
                                            {bannerSearch && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', maxHeight: '200px', overflowY: 'auto', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10 }}>
                                                    {products
                                                        .filter(p => p.categoryId === selectedCat.id) // Filter by current category
                                                        .filter(p => p.name.toLowerCase().includes(bannerSearch.toLowerCase()))
                                                        .slice(0, 10).map(p => (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => {
                                                                    setEditBannerProduct(p.id);
                                                                    setBannerSearch('');
                                                                }}
                                                                style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                                            >
                                                                <img src={p.imageUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'cover' }} />
                                                                <span style={{ fontSize: '0.9rem' }}>{p.name}</span>
                                                            </div>
                                                        ))}
                                                    {products
                                                        .filter(p => p.categoryId === selectedCat.id)
                                                        .filter(p => p.name.toLowerCase().includes(bannerSearch.toLowerCase())).length === 0 && (
                                                            <div style={{ padding: '0.5rem', color: '#888', fontStyle: 'italic' }}>No products found in this category</div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>Selecting a product overrides custom image.</p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Featured Products Grid (Max 6) */}
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Home Page Grid Products (Max 8)</h3>

                            {/* Selected List */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                                {editGridProducts.map(id => {
                                    const prod = products.find(p => p.id === parseInt(id));
                                    if (!prod) return null;
                                    return (
                                        <div key={id} style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f9f9f9' }}>
                                            <img src={prod.imageUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px' }} />
                                            <span style={{ fontSize: '0.9rem' }}>{prod.name}</span>
                                            <X size={16} style={{ cursor: 'pointer', color: '#d62020' }} onClick={() => removeProductFromGrid(id)} />
                                        </div>
                                    );
                                })}
                                {editGridProducts.length === 0 && <span style={{ color: '#888', fontSize: '0.9rem' }}>No products selected. Will show latest.</span>}
                            </div>

                            {/* Add Product */}
                            <div style={{ position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', padding: '0.5rem', maxWidth: '400px' }}>
                                    <Search size={18} color="#888" />
                                    <input
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Search to add product..."
                                        style={{ border: 'none', outline: 'none', marginLeft: '0.5rem', flex: 1 }}
                                    />
                                </div>
                                {productSearch && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, width: '400px', maxHeight: '200px', overflowY: 'auto', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10 }}>
                                        {filteredProducts.slice(0, 10).map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => addProductToGrid(p.id)}
                                                style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                                onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                            >
                                                <img src={p.imageUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'cover' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{p.name}</span>
                                                {editGridProducts.includes(p.id) && <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'green' }}>Selected</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Subcategories (Existing) */}
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Subcategories</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <input
                                    value={newSubName}
                                    onChange={(e) => setNewSubName(e.target.value)}
                                    placeholder="New Subcategory (e.g. Shirt)"
                                    style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                                <button onClick={handleAddSubCategory} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 1rem', cursor: 'pointer' }}>
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {selectedCat.subCategories && selectedCat.subCategories.length > 0 ? (
                                    selectedCat.subCategories.map(sub => (
                                        <span key={sub.id} style={{ background: '#f0f0f0', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {sub.name}
                                            <Trash2 size={14} style={{ cursor: 'pointer', color: '#d62020' }} onClick={() => handleDeleteSubCategory(sub.id)} />
                                        </span>
                                    ))
                                ) : (
                                    <p style={{ color: '#888' }}>No subcategories yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', flexDirection: 'column' }}>
                        <ChevronRight size={48} />
                        <p>Select a category to manage items</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminCategories;



import React, { useState, useEffect } from 'react';
import '../styles/Products.css';

interface Product {
  _id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  gstRate: number;
  stock: number;
  minStock: number;
  unit: string;
}

interface ProductsPageProps {
  token: string;
}

const Products: React.FC<ProductsPageProps> = ({ token }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/products`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setProducts(data.data || []);
      } else if (data.products) {
        setProducts(data.products || []);
      }
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!deleteConfirm) return;

    try {
      const response = await fetch(`${API_BASE}/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setProducts(products.filter(p => p._id !== id));
        setDeleteConfirm(null);
      }
    } catch (err) {
      setError('Failed to delete product');
    }
  };

  const handleFormClose = (productAdded?: boolean) => {
    setShowForm(false);
    setEditingId(null);
    if (productAdded) {
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showForm) {
    return (
      <ProductForm
        token={token}
        productId={editingId}
        onClose={handleFormClose}
      />
    );
  }

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>📦 Products Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Add New Product
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {loading && <div className="loading">Loading products...</div>}

      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <p>No products found</p>
          <button onClick={() => setShowForm(true)} className="btn-secondary">
            Create your first product
          </button>
        </div>
      ) : (
        <div className="products-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Cost</th>
                <th>GST</th>
                <th>Stock</th>
                <th>Min Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product._id}>
                  <td>{product.name}</td>
                  <td className="sku">{product.sku}</td>
                  <td>{product.category}</td>
                  <td className="price">₹{product.price.toFixed(2)}</td>
                  <td className="cost">₹{product.cost.toFixed(2)}</td>
                  <td>{product.gstRate}%</td>
                  <td className={product.stock <= product.minStock ? 'low-stock' : ''}>
                    {product.stock}
                  </td>
                  <td>{product.minStock}</td>
                  <td className="actions">
                    <button
                      onClick={() => {
                        setEditingId(product._id);
                        setShowForm(true);
                      }}
                      className="btn-edit"
                      title="Edit product"
                    >
                      ✏️ Edit
                    </button>
                    {deleteConfirm === product._id ? (
                      <>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="btn-delete"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn-cancel"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(product._id)}
                        className="btn-delete"
                        title="Delete product"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface ProductFormProps {
  token: string;
  productId: string | null;
  onClose: (productAdded?: boolean) => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ token, productId, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    price: '',
    cost: '',
    gstRate: '18',
    stock: '',
    minStock: '',
    unit: 'piece',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  // Load product if editing
  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        const p = data.data;
        setFormData({
          name: p.name,
          sku: p.sku,
          description: p.description || '',
          category: p.category,
          price: p.price.toString(),
          cost: p.cost.toString(),
          gstRate: p.gstRate.toString(),
          stock: p.stock.toString(),
          minStock: p.minStock.toString(),
          unit: p.unit,
        });
      }
    } catch (err) {
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const url = productId
        ? `${API_BASE}/api/products/${productId}`
        : `${API_BASE}/api/products`;

      const method = productId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          cost: parseFloat(formData.cost),
          gstRate: parseInt(formData.gstRate),
          stock: parseInt(formData.stock),
          minStock: parseInt(formData.minStock),
        }),
      });

      const data = await response.json();
      console.log('Product save response:', data);

      if (data.success) {
        setSuccess(productId ? 'Product updated successfully!' : 'Product created successfully!');
        setTimeout(() => onClose(true), 1500);
      } else {
        setError(data.error || 'Failed to save product');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to save product: ${errorMsg}`);
      console.error('Product save error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-form-container">
      <div className="form-header">
        <h2>{productId ? '✏️ Edit Product' : '➕ Add New Product'}</h2>
        <button onClick={() => onClose()} className="close-btn">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="product-form">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="form-row">
          <div className="form-group">
            <label>Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Laptop"
              required
            />
          </div>
          <div className="form-group">
            <label>SKU *</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              placeholder="e.g., LAP001"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Product description..."
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Category *</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="e.g., Electronics"
              required
            />
          </div>
          <div className="form-group">
            <label>Unit</label>
            <select name="unit" value={formData.unit} onChange={handleChange}>
              <option value="piece">Piece</option>
              <option value="kg">KG</option>
              <option value="liter">Liter</option>
              <option value="meter">Meter</option>
              <option value="box">Box</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Price (₹) *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              placeholder="50000"
              step="0.01"
              required
            />
          </div>
          <div className="form-group">
            <label>Cost (₹) *</label>
            <input
              type="number"
              name="cost"
              value={formData.cost}
              onChange={handleChange}
              placeholder="35000"
              step="0.01"
              required
            />
          </div>
          <div className="form-group">
            <label>GST Rate (%)</label>
            <select name="gstRate" value={formData.gstRate} onChange={handleChange}>
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Stock Quantity *</label>
            <input
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleChange}
              placeholder="10"
              required
            />
          </div>
          <div className="form-group">
            <label>Minimum Stock Level *</label>
            <input
              type="number"
              name="minStock"
              value={formData.minStock}
              onChange={handleChange}
              placeholder="2"
              required
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (productId ? 'Update Product' : 'Create Product')}
          </button>
          <button type="button" onClick={() => onClose()} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default Products;

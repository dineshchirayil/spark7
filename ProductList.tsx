import React from 'react';
import { useProducts } from '../hooks/useProducts';

export const ProductList: React.FC = () => {
  const { products, loading, error, refetch } = useProducts();

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      refetch();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  if (loading) return <div className="p-6">Loading products...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Product List</h1>
      </div>
      
      <div className="overflow-x-auto shadow-md sm:rounded-lg border">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">SKU</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Price</th>
              <th className="px-6 py-3">Stock</th>
              <th className="px-6 py-3">Unit</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{product.name}</td>
                <td className="px-6 py-4">{product.sku}</td>
                <td className="px-6 py-4"><span className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">{product.category}</span></td>
                <td className="px-6 py-4">${product.price.toFixed(2)}</td>
                <td className="px-6 py-4"><span className={product.stock <= product.minStock ? 'text-red-600 font-bold' : 'text-green-600'}>{product.stock}</span></td>
                <td className="px-6 py-4">{product.unit}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-4 text-center">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
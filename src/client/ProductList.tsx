import React from 'react';
import { useProducts } from '../hooks/useProducts';

export const ProductList: React.FC = () => {
  const { products, loading, error } = useProducts();

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
            {currentProducts.map((product) => (
              <tr key={product._id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                  {product.name}
                </td>
                <td className="px-6 py-4">{product.sku}</td>
                <td className="px-6 py-4">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-4">${product.price.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={product.stock <= product.minStock ? 'text-red-600 font-bold' : 'text-green-600'}>
                    {product.stock}
                  </span>
                </td>
                <td className="px-6 py-4">{product.unit}</td>
              </tr>
            ))}
            {currentProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">No products found</td>
              </tr>
            )}
          </tbody>
        </table>

      </div>
          <div className="flex justify-center mt-4">
        {Array.from({ length: Math.ceil(filteredProducts.length / productsPerPage) }, (_, i) => i + 1).map(page => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={`mx-1 px-3 py-1 rounded-full ${currentPage === page ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {page}
          </button>
        ))}
    </div>
  );
};
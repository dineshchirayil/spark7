import React, { useState } from 'react';
import { useCategories } from '../hooks/useCategories';

export const Categories: React.FC = () => {
  const { categories, loading, error, refetch } = useCategories();
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCategory, description })
      });

      if (response.ok) {
        setNewCategory('');
        setDescription('');
        refetch();
      } else {
        alert('Failed to create category');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Categories</h1>
      
      <div className="mb-8 p-4 border rounded">
        <h2 className="text-xl mb-2">Add New Category</h2>
        <form onSubmit={handleSubmit} className="flex gap-4 items-end">
          <div>
            <label className="block text-sm">Name</label>
            <input 
              type="text" 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value)} 
              required 
              className="border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm">Description</label>
            <input 
              type="text" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="border p-2 rounded"
            />
          </div>
          <button 
            type="submit" 
            disabled={submitting}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {submitting ? 'Adding...' : 'Add Category'}
          </button>
        </form>
      </div>

      <div className="grid gap-2">
        <h2 className="text-xl">Existing Categories</h2>
        <ul className="border rounded divide-y">
          {categories.map(cat => (
            <li key={cat._id} className="p-3 flex justify-between items-center">
              <div>
                <span className="font-bold">{cat.name}</span>
                {cat.description && <span className="text-gray-500 ml-2">- {cat.description}</span>}
              </div>
              <button 
                onClick={() => handleDelete(cat._id)} 
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
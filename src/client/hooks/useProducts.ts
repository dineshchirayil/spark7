import { useState, useEffect, useCallback } from 'react';
import { apiUrl, fetchApiJson } from '../utils/api';

export interface Product {
  _id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  gstRate: number;
  description?: string;
  wholesalePrice?: number;
  taxType?: 'gst' | 'vat';
  hsnCode?: string;
  returnStock?: number;
  damagedStock?: number;
  allowNegativeStock?: boolean;
  batchTracking?: boolean;
  expiryRequired?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const data = await fetchApiJson(apiUrl('/api/products?limit=1000&skip=0'), { headers });
      setProducts(data.data || data.products || (Array.isArray(data) ? data : []));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
};

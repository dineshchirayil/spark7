import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <h1 className="text-2xl font-bold leading-7 text-white sm:truncate sm:text-3xl sm:tracking-tight">Sales Dashboard</h1>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg bg-white/5 border border-white/10 shadow hover:bg-white/10 cursor-pointer transition-all" onClick={() => navigate('/sales')}>
          <div className="p-5">
            <h3 className="text-lg font-medium leading-6 text-white">➕ New Sale (POS)</h3>
            <p className="mt-2 text-sm text-gray-400">Open Point of Sale terminal to create new invoices.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg bg-white/5 border border-white/10 shadow hover:bg-white/10 cursor-pointer transition-all" onClick={() => navigate('/orders')}>
          <div className="p-5">
            <h3 className="text-lg font-medium leading-6 text-white">📜 Sales History</h3>
            <p className="mt-2 text-sm text-gray-400">View and manage past orders and transactions.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg bg-white/5 border border-white/10 shadow hover:bg-white/10 cursor-pointer transition-all" onClick={() => navigate('/returns')}>
          <div className="p-5">
            <h3 className="text-lg font-medium leading-6 text-white">↩️ Returns</h3>
            <p className="mt-2 text-sm text-gray-400">Process and manage product returns.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg bg-white/5 border border-white/10 shadow hover:bg-white/10 cursor-pointer transition-all" onClick={() => navigate('/sales/analytics')}>
          <div className="p-5">
            <h3 className="text-lg font-medium leading-6 text-white">📊 Analytics</h3>
            <p className="mt-2 text-sm text-gray-400">View detailed sales reports and insights.</p>
          </div>
        </div>
      </div>
    </div>

  );
};
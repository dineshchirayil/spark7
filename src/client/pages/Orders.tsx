import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../config';
import { Table, Column } from '../components/Table';
import { apiUrl, fetchApiJson } from '../utils/api';

interface HistoryItem {
  productId?: string;
  name: string;
  quantity: number;
  amount: number;
  unitPrice?: number;
  gstRate?: number;
}

interface HistoryRow {
  _id: string;
  number: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  invoiceType?: 'cash' | 'credit';
  invoiceStatus?: 'draft' | 'posted' | 'cancelled';
  outstandingAmount?: number;
  notes?: string;
  discountAmount?: number;
  discountPercentage?: number;
  roundOffAmount?: number;
  items: HistoryItem[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  source: 'sales' | 'orders';
}

interface ProductOption {
  _id: string;
  name: string;
  sku?: string;
  price: number;
  gstRate?: number;
}

interface EditItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

interface EditFormState {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  paymentMethod: string;
  discountAmount: string;
  discountPercentage: string;
  applyRoundOff: boolean;
  items: EditItem[];
}

const normalizeSalesRows = (rows: any[]): HistoryRow[] =>
  rows.map((sale) => ({
    _id: sale._id,
    number: sale.invoiceNumber || sale.saleNumber || sale._id?.slice(-6)?.toUpperCase() || '-',
    createdAt: sale.createdAt,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerEmail: sale.customerEmail,
    invoiceType: sale.invoiceType || 'cash',
    invoiceStatus: sale.invoiceStatus || 'posted',
    outstandingAmount: Number(sale.outstandingAmount || 0),
    notes: sale.notes || '',
    discountAmount: Number(sale.discountAmount || 0),
    discountPercentage: Number(sale.discountPercentage || 0),
    roundOffAmount: Number(sale.roundOffAmount || 0),
    items: (sale.items || []).map((item: any) => ({
      productId: String(item.productId || ''),
      name: item.productName || item.sku || 'Item',
      quantity: Number(item.quantity || 0),
      amount: Number(item.lineTotal || item.unitPrice || 0),
      unitPrice: Number(item.unitPrice || 0),
      gstRate: Number(item.gstRate || 0),
    })),
    totalAmount: Number(sale.totalAmount || 0),
    paymentMethod: sale.paymentMethod || '-',
    paymentStatus: sale.paymentStatus || '-',
    status: sale.saleStatus || '-',
    source: 'sales',
  }));

const normalizeOrdersRows = (rows: any[]): HistoryRow[] =>
  rows.map((order) => ({
    _id: order._id,
    number: order.orderNumber || order._id?.slice(-6)?.toUpperCase() || '-',
    createdAt: order.createdAt,
    items: (order.items || []).map((item: any) => {
      const product = item.productId;
      const productName = typeof product === 'object' ? product?.name : '';
      return {
        name: productName || 'Item',
        quantity: Number(item.quantity || 0),
        amount: Number(item.price || 0),
      };
    }),
    totalAmount: Number(order.totalAmount || 0),
    paymentMethod: order.paymentMethod || '-',
    paymentStatus: order.paymentStatus || '-',
    status: order.orderStatus || '-',
    source: 'orders',
  }));

const emptyEditForm = (): EditFormState => ({
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  notes: '',
  paymentMethod: 'cash',
  discountAmount: '0',
  discountPercentage: '0',
  applyRoundOff: true,
  items: [],
});

export const Orders: React.FC = () => {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [editingRow, setEditingRow] = useState<HistoryRow | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm());
  const [addProductId, setAddProductId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchHistory = async () => {
    try {
      setError('');
      const headers = getAuthHeaders();

      try {
        const salesResp = await fetchApiJson(apiUrl('/api/sales?limit=200'), { headers });
        const salesRows = normalizeSalesRows(salesResp.data || []);
        setRows(salesRows);
        return;
      } catch {
        // fallback below
      }

      const ordersResp = await fetchApiJson(apiUrl('/api/orders?limit=200'), { headers });
      const orderRows = normalizeOrdersRows(ordersResp.data || []);
      setRows(orderRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales history');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetchApiJson(apiUrl('/api/products?limit=300'), { headers });
      setProducts(response.data || []);
    } catch {
      // optional list for edit dialog; ignore failure
    }
  };

  useEffect(() => {
    void fetchHistory();
    void fetchProducts();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        row.number.toLowerCase().includes(q)
        || (row.customerName || '').toLowerCase().includes(q)
        || (row.customerPhone || '').toLowerCase().includes(q)
        || (row.customerEmail || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const editedTotals = useMemo(() => {
    const subtotal = editForm.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const gst = editForm.items.reduce((sum, item) => {
      const lineBase = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      return sum + (lineBase * Number(item.gstRate || 0)) / 100;
    }, 0);
    let gross = subtotal + gst;

    const discountAmount = Number(editForm.discountAmount || 0);
    const discountPercentage = Number(editForm.discountPercentage || 0);
    if (discountAmount > 0) gross -= discountAmount;
    else if (discountPercentage > 0) gross -= (gross * discountPercentage) / 100;

    if (gross < 0) gross = 0;
    const total = editForm.applyRoundOff ? Math.round(gross) : gross;
    const roundOff = total - gross;
    return { subtotal, gst, gross, roundOff, total };
  }, [editForm]);

  const paidSoFar = useMemo(() => {
    if (!editingRow) return 0;
    return Math.max(0, Number(editingRow.totalAmount || 0) - Number(editingRow.outstandingAmount || 0));
  }, [editingRow]);

  const projectedOutstanding = useMemo(
    () => Math.max(0, Number(editedTotals.total || 0) - Number(paidSoFar || 0)),
    [editedTotals.total, paidSoFar]
  );

  const openEditModal = (row: HistoryRow) => {
    if (row.source !== 'sales') return;
    const mappedItems: EditItem[] = (row.items || [])
      .filter((item) => item.productId)
      .map((item) => ({
        productId: String(item.productId),
        productName: item.name,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        gstRate: Number(item.gstRate || 0),
      }));

    setEditingRow(row);
    setEditForm({
      customerName: row.customerName || '',
      customerPhone: row.customerPhone || '',
      customerEmail: row.customerEmail || '',
      notes: row.notes || '',
      paymentMethod: row.paymentMethod || 'cash',
      discountAmount: String(Number(row.discountAmount || 0)),
      discountPercentage: String(Number(row.discountPercentage || 0)),
      applyRoundOff: Math.abs(Number(row.roundOffAmount || 0)) > 0,
      items: mappedItems,
    });
    setAddProductId('');
    setEditError('');
  };

  const closeEditModal = () => {
    setEditingRow(null);
    setEditForm(emptyEditForm());
    setAddProductId('');
    setEditError('');
    setSavingEdit(false);
  };

  const updateEditItem = (index: number, field: keyof EditItem, value: string) => {
    setEditForm((prev) => {
      const updated = [...prev.items];
      const current = { ...updated[index] };
      if (field === 'quantity' || field === 'unitPrice' || field === 'gstRate') {
        const numeric = Number(value);
        (current as any)[field] = Number.isFinite(numeric) ? numeric : 0;
      } else {
        (current as any)[field] = value;
      }
      updated[index] = current;
      return { ...prev, items: updated };
    });
  };

  const removeEditItem = (index: number) => {
    setEditForm((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== index) }));
  };

  const addProductToEdit = () => {
    if (!addProductId) return;
    const product = products.find((p) => String(p._id) === String(addProductId));
    if (!product) return;

    const exists = editForm.items.some((item) => String(item.productId) === String(product._id));
    if (exists) {
      setEditError('Product already exists in invoice');
      return;
    }

    setEditError('');
    setEditForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: product._id,
          productName: product.name,
          quantity: 1,
          unitPrice: Number(product.price || 0),
          gstRate: Number(product.gstRate || 0),
        },
      ],
    }));
    setAddProductId('');
  };

  const saveInvoiceEdit = async () => {
    if (!editingRow) return;
    if (!editForm.items.length) {
      setEditError('At least one item is required');
      return;
    }
    if (editForm.items.some((item) => Number(item.quantity || 0) <= 0)) {
      setEditError('All item quantities must be greater than zero');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    setSuccessMessage('');

    try {
      const endpoint =
        editingRow.invoiceStatus === 'posted'
          ? apiUrl(`/api/sales/${editingRow._id}/edit-posted`)
          : apiUrl(`/api/sales/${editingRow._id}`);

      const payload = {
        items: editForm.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          gstRate: Number(item.gstRate || 0),
        })),
        customerName: editForm.customerName,
        customerPhone: editForm.customerPhone,
        customerEmail: editForm.customerEmail,
        notes: editForm.notes,
        paymentMethod: editForm.paymentMethod,
        discountAmount: Number(editForm.discountAmount || 0),
        discountPercentage: Number(editForm.discountPercentage || 0),
        applyRoundOff: Boolean(editForm.applyRoundOff),
      };

      const response = await fetchApiJson(endpoint, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const message = response.message || 'Invoice updated successfully';
      closeEditModal();
      await fetchHistory();
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update invoice');
    } finally {
      setSavingEdit(false);
    }
  };

  const statusClass = (value: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'completed') return 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20';
    if (normalized === 'pending' || normalized === 'processing') return 'bg-amber-400/10 text-amber-300 ring-amber-300/20';
    return 'bg-red-400/10 text-red-300 ring-red-300/20';
  };

  const columns: Column<HistoryRow>[] = [
    {
      header: 'Invoice',
      render: (row) => <span className="font-medium text-white">{row.number}</span>,
    },
    {
      header: 'Date',
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="text-white">{row.customerName || 'Walk-in Customer'}</p>
          {row.customerPhone && <p className="text-xs text-gray-400">{row.customerPhone}</p>}
        </div>
      ),
    },
    {
      header: 'Items',
      render: (row) => (
        <ul className="list-disc list-inside">
          {row.items.map((item, idx) => (
            <li key={`${row._id}-${idx}`} className="truncate max-w-xs">
              {item.quantity}x {item.name}
            </li>
          ))}
        </ul>
      ),
    },
    {
      header: 'Total',
      render: (row) => <span className="font-bold text-white">{formatCurrency(row.totalAmount)}</span>,
    },
    {
      header: 'Payment',
      render: (row) => (
        <div className="space-y-1">
          <div className="capitalize">{row.paymentMethod}</div>
          {row.invoiceType && <div className="text-xs text-blue-300 uppercase">{row.invoiceType}</div>}
          <div className="text-xs text-gray-400 capitalize">{row.paymentStatus}</div>
          {row.invoiceType === 'credit' && (
            <div className="text-xs text-amber-300">Outstanding: {formatCurrency(Number(row.outstandingAmount || 0))}</div>
          )}
        </div>
      ),
      className: 'capitalize',
    },
    {
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset capitalize ${statusClass(row.status)}`}>
          {row.status}
        </span>
      ),
    },
    {
      header: 'Action',
      render: (row) => (
        row.source === 'sales' ? (
          <button
            type="button"
            className="rounded-md bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/30"
            onClick={() => openEditModal(row)}
          >
            Edit Invoice
          </button>
        ) : (
          <span className="text-xs text-gray-500">-</span>
        )
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-gray-400">Loading sales history...</div>;
  if (error) return <div className="mx-auto max-w-7xl px-4 py-6 text-red-500">Error: {error}</div>;

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-2xl font-bold leading-7 text-white sm:text-3xl sm:tracking-tight">Sales History</h1>

        {successMessage && (
          <div className="mb-4 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice/customer/phone/email..."
          className="mb-4 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500"
        />
        <Table data={filteredRows} columns={columns} emptyMessage="No sales history found" />
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-white/10 bg-gray-900 p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Edit Invoice {editingRow.number}</h2>
                <p className="text-xs text-gray-400">
                  Update from sales history. Stock and totals will be adjusted.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/20"
                onClick={closeEditModal}
              >
                Close
              </button>
            </div>

            {editError && (
              <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{editError}</div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={editForm.customerName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, customerName: e.target.value }))}
                placeholder="Customer Name"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
              <input
                value={editForm.customerPhone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="Customer Phone"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
              <input
                value={editForm.customerEmail}
                onChange={(e) => setEditForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
                placeholder="Customer Email"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
              <select
                value={editForm.paymentMethod}
                onChange={(e) => setEditForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                {['cash', 'card', 'upi', 'cheque', 'online', 'bank_transfer'].map((method) => (
                  <option key={method} value={method} className="bg-gray-900">
                    {method}
                  </option>
                ))}
              </select>
              <input
                value={editForm.discountAmount}
                onChange={(e) => setEditForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                type="number"
                min="0"
                step="0.01"
                placeholder="Discount Amount"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
              <input
                value={editForm.discountPercentage}
                onChange={(e) => setEditForm((prev) => ({ ...prev, discountPercentage: e.target.value }))}
                type="number"
                min="0"
                step="0.01"
                placeholder="Discount Percentage"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>

            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Invoice Notes"
              rows={2}
              className="mt-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={editForm.applyRoundOff}
                onChange={(e) => setEditForm((prev) => ({ ...prev, applyRoundOff: e.target.checked }))}
              />
              Apply round-off
            </label>

            <div className="mt-4 rounded-lg border border-white/10">
              <div className="grid grid-cols-12 gap-2 border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
                <div className="col-span-4">Item</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2">GST %</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {editForm.items.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="grid grid-cols-12 gap-2 border-b border-white/10 px-3 py-2">
                  <div className="col-span-4 text-sm text-white">{item.productName}</div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateEditItem(idx, 'quantity', e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateEditItem(idx, 'unitPrice', e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.gstRate}
                      onChange={(e) => updateEditItem(idx, 'gstRate', e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      className="rounded-md bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30"
                      onClick={() => removeEditItem(idx)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={addProductId}
                onChange={(e) => setAddProductId(e.target.value)}
                className="min-w-[240px] rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="">Add product to invoice...</option>
                {products
                  .filter((p) => !editForm.items.some((it) => String(it.productId) === String(p._id)))
                  .map((product) => (
                    <option key={product._id} value={product._id} className="bg-gray-900">
                      {product.name} ({product.sku || product._id})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addProductToEdit}
                className="rounded-md bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
              >
                Add Item
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs text-gray-400">Subtotal</p>
                <p className="font-semibold text-white">{formatCurrency(editedTotals.subtotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">GST</p>
                <p className="font-semibold text-white">{formatCurrency(editedTotals.gst)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Round-off</p>
                <p className="font-semibold text-white">{formatCurrency(editedTotals.roundOff)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Grand Total</p>
                <p className="font-semibold text-emerald-300">{formatCurrency(editedTotals.total)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Paid So Far</p>
                <p className="font-semibold text-indigo-200">{formatCurrency(paidSoFar)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Projected Outstanding</p>
                <p className="font-semibold text-amber-300">{formatCurrency(projectedOutstanding)}</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
                onClick={closeEditModal}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                onClick={saveInvoiceEdit}
              >
                {savingEdit ? 'Saving...' : 'Update Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

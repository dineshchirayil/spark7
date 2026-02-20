import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../config';
import { IProduct } from '@shared/types';
import {
  GeneralSettings,
  getGeneralSettings,
} from '../utils/generalSettings';
import { printInvoice, PrintableSale } from '../utils/invoicePrint';

interface CartItem extends IProduct {
  quantity: number;
  cartId: string;
}

interface CompletedSale extends PrintableSale {
  _id?: string;
}

export const Sales = () => {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processing, setProcessing] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'cash' | 'credit'>('cash');
  const [invoiceStatus, setInvoiceStatus] = useState<'posted' | 'draft'>('posted');
  const [invoiceNumberMode, setInvoiceNumberMode] = useState<'auto' | 'manual'>('auto');
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [applyRoundOff, setApplyRoundOff] = useState(true);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [settings, setSettings] = useState<GeneralSettings>(() => getGeneralSettings());
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showInvoicePrompt, setShowInvoicePrompt] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  useEffect(() => {
    fetchProducts();
    setSettings(getGeneralSettings());
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/products?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: IProduct) => {
    if (product.stock <= 0) {
      alert('Out of stock!');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert('Cannot add more than available stock');
          return prev;
        }
        return prev.map((item) =>
          item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, cartId: Date.now().toString() }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item._id === productId) {
          const newQty = item.quantity + delta;
          if (newQty < 1) return item;
          if (newQty > item.stock) {
            alert('Stock limit reached');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item._id !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const gst = cart.reduce((acc, item) => {
      const itemTotal = item.price * item.quantity;
      return acc + (itemTotal * (item.gstRate || 18)) / 100;
    }, 0);
    const grossTotal = subtotal + gst;
    const parsedDiscount = Math.max(0, Number(discountValue || 0));

    let discountAmount = 0;
    let discountPercentage = 0;
    if (discountType === 'percentage') {
      discountPercentage = Math.min(100, parsedDiscount);
      discountAmount = (grossTotal * discountPercentage) / 100;
    } else {
      discountAmount = Math.min(grossTotal, parsedDiscount);
      discountPercentage = grossTotal > 0 ? (discountAmount / grossTotal) * 100 : 0;
    }

    const netTotal = Math.max(0, grossTotal - discountAmount);
    const roundedTotal = applyRoundOff ? Math.round(netTotal) : netTotal;
    const roundOffAmount = roundedTotal - netTotal;
    return {
      subtotal,
      gst,
      grossTotal,
      discountAmount,
      discountPercentage,
      netTotal,
      roundOffAmount,
      total: roundedTotal,
    };
  };

  const doPrintInvoice = (sale: CompletedSale) => {
    const latestSettings = getGeneralSettings();
    const ok = printInvoice(sale, latestSettings);
    if (!ok) {
      alert('Unable to open print window. Please allow popups and try again.');
      return;
    }
    setShowInvoicePrompt(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    setCheckoutMessage('');

    try {
      const token = localStorage.getItem('token');
      const totals = calculateTotals();

      const saleData = {
        items: cart.map((item) => ({
          productId: item._id,
          quantity: item.quantity,
          unitPrice: item.price,
          gstRate: item.gstRate,
        })),
        paymentMethod,
        invoiceType,
        invoiceStatus,
        invoiceNumber: invoiceNumberMode === 'manual' ? manualInvoiceNumber.trim() : undefined,
        autoInvoiceNumber: invoiceNumberMode === 'auto',
        applyRoundOff,
        paidAmount: paidAmount ? Number(paidAmount) : undefined,
        customerName,
        customerPhone,
        customerEmail,
        notes: saleNotes,
        subtotal: totals.subtotal,
        totalGst: totals.gst,
        discountAmount: totals.discountAmount,
        discountPercentage: totals.discountPercentage,
        totalAmount: totals.total,
      };

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(saleData),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Sale failed');
        return;
      }

      const completed: CompletedSale = {
        ...data.data,
        customerName,
        customerPhone,
        customerEmail,
        notes: saleNotes,
        invoiceNumber: data.data.invoiceNumber || data.data.saleNumber,
      };

      setCompletedSale(completed);

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setSaleNotes('');
      setInvoiceType('cash');
      setInvoiceStatus('posted');
      setInvoiceNumberMode('auto');
      setManualInvoiceNumber('');
      setPaidAmount('');
      setDiscountType('amount');
      setDiscountValue('');
      fetchProducts();

      if (invoiceStatus === 'draft') {
        setCheckoutMessage(`Draft invoice ${completed.invoiceNumber} saved successfully.`);
        return;
      }

      if (settings.printing.autoPrintAfterSale) {
        doPrintInvoice(completed);
        setCheckoutMessage(`Sale completed. Invoice ${completed.invoiceNumber} sent to print.`);
      } else if (settings.printing.promptAfterSale) {
        setShowInvoicePrompt(true);
        setCheckoutMessage(`Sale completed. Invoice ${completed.invoiceNumber} is ready.`);
      } else {
        setCheckoutMessage(`Sale completed successfully. Invoice ${completed.invoiceNumber} generated.`);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [products, searchTerm]
  );

  const { subtotal, gst, grossTotal, discountAmount, netTotal, roundOffAmount, total } = calculateTotals();
  const outstandingAmount = Math.max(0, total - Number(paidAmount || 0));

  return (
    <>
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-3 lg:px-6">
        <div className="rounded-lg border border-white/10 bg-white/5 p-5 lg:col-span-2">
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-5 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-indigo-400"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <p className="text-gray-300">Loading products...</p>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product._id}
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 p-4 text-left transition hover:bg-white/10"
                  onClick={() => addToCart(product)}
                >
                  <h3 className="text-base font-semibold text-white">{product.name}</h3>
                  <p className="text-sm text-gray-400">{product.sku}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-indigo-300">{formatCurrency(product.price)}</span>
                    <span className="rounded bg-white/10 px-2 py-1 text-xs text-gray-300">Stock: {product.stock}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">Current Sale</h2>

          <div className="mt-4 max-h-[32vh] space-y-3 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-center text-gray-400">Cart is empty</p>
            ) : (
              cart.map((item) => (
                <div key={item.cartId} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium text-white">{item.name}</h4>
                      <p className="text-xs text-gray-400">
                        {formatCurrency(item.price)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded border border-white/20 px-2 py-1 text-sm"
                        onClick={() => updateQuantity(item._id!, -1)}
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        className="rounded border border-white/20 px-2 py-1 text-sm"
                        onClick={() => updateQuantity(item._id!, 1)}
                      >
                        +
                      </button>
                      <button className="text-red-400" onClick={() => removeFromCart(item._id!)}>
                        x
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <input
              type="text"
              placeholder="Customer Name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500"
            />
            <input
              type="text"
              placeholder="Customer Phone (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500"
            />
            <input
              type="email"
              placeholder="Customer Email (optional)"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500"
            />
            <textarea
              placeholder="Invoice Notes (optional)"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${invoiceNumberMode === 'auto' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-300'}`}
                onClick={() => setInvoiceNumberMode('auto')}
              >
                Auto Number
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${invoiceNumberMode === 'manual' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-300'}`}
                onClick={() => setInvoiceNumberMode('manual')}
              >
                Manual Number
              </button>
            </div>
            {invoiceNumberMode === 'manual' && (
              <input
                type="text"
                placeholder="Manual Invoice Number"
                value={manualInvoiceNumber}
                onChange={(e) => setManualInvoiceNumber(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            )}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
              <span>GST</span>
              <span>{formatCurrency(gst)}</span>
            </div>
            <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
              <span>Gross Total</span>
              <span>{formatCurrency(grossTotal)}</span>
            </div>
            <div className="mb-2 grid grid-cols-[1fr_120px_120px] items-center gap-2">
              <span className="text-sm text-gray-300">Discount</span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percentage')}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white"
              >
                <option value="amount">Amount</option>
                <option value="percentage">%</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-gray-500"
              />
            </div>
            <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
              <span>Discount Applied</span>
              <span>- {formatCurrency(discountAmount)}</span>
            </div>
            <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
              <span>Net Total</span>
              <span>{formatCurrency(netTotal)}</span>
            </div>
            <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
              <span>Round-off</span>
              <span>{formatCurrency(roundOffAmount)}</span>
            </div>
            <div className="mb-4 flex items-center justify-between text-lg font-semibold text-white">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <div className="mb-4 flex gap-2">
              {['cash', 'card', 'upi', 'bank_transfer'].map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${
                    paymentMethod === method ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-300'
                  }`}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method}
                </button>
              ))}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${invoiceType === 'cash' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-300'}`}
                onClick={() => setInvoiceType('cash')}
              >
                Cash Invoice
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${invoiceType === 'credit' ? 'bg-amber-500 text-white' : 'bg-white/10 text-gray-300'}`}
                onClick={() => setInvoiceType('credit')}
              >
                Credit Invoice
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${invoiceStatus === 'posted' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-300'}`}
                onClick={() => setInvoiceStatus('posted')}
              >
                Post Invoice
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${invoiceStatus === 'draft' ? 'bg-slate-500 text-white' : 'bg-white/10 text-gray-300'}`}
                onClick={() => setInvoiceStatus('draft')}
              >
                Save Draft
              </button>
            </div>
            {invoiceType === 'credit' && (
              <>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Paid Amount (optional)"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500"
                />
                <div className="mb-3 rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  Outstanding: <span className="font-semibold">{formatCurrency(outstandingAmount)}</span>
                </div>
              </>
            )}
            <label className="mb-3 flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={applyRoundOff} onChange={(e) => setApplyRoundOff(e.target.checked)} />
              Apply round-off
            </label>

            <button
              className="w-full rounded-md bg-indigo-500 px-4 py-2 font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={cart.length === 0 || processing}
              onClick={handleCheckout}
            >
              {processing ? 'Processing...' : invoiceStatus === 'draft' ? 'Save Draft Invoice' : `Create Invoice ${formatCurrency(total)}`}
            </button>

            {checkoutMessage && (
              <p className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {checkoutMessage}
              </p>
            )}

            {settings.printing.showPrintPreviewHint && (
              <p className="mt-2 text-xs text-gray-400">
                Print profile: {settings.printing.profile}. You can change invoice and print settings in Settings.
              </p>
            )}
          </div>
        </div>
      </div>

      {showInvoicePrompt && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-gray-900 p-6">
            <h3 className="text-xl font-semibold text-white">Sale Completed</h3>
            <p className="mt-2 text-sm text-gray-300">
              Invoice <span className="font-semibold text-white">{completedSale.invoiceNumber || completedSale.saleNumber}</span> is ready.
            </p>
            <p className="mt-1 text-sm text-gray-300">
              Total: <span className="font-semibold text-white">{formatCurrency(completedSale.totalAmount)}</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Printing uses system dialog and supports all installed printers (A4/Thermal/Network).
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
                onClick={() => setShowInvoicePrompt(false)}
              >
                Skip for Now
              </button>
              <button
                type="button"
                className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
                onClick={() => doPrintInvoice(completedSale)}
              >
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

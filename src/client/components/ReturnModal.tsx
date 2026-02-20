import React, { useState } from 'react';
import '../styles/Modals.css';

interface SaleItemBrief {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstRate?: number;
}

interface ReturnModalProps {
  open: boolean;
  saleId: string;
  items: SaleItemBrief[];
  token: string;
  onClose: (created?: boolean) => void;
}

const ReturnModal: React.FC<ReturnModalProps> = ({ open, saleId, items, token, onClose }) => {
  const [quantities, setQuantities] = useState<number[]>(items.map(() => 0));
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'upi' | 'original_payment'>('original_payment');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleQtyChange = (index: number, val: number) => {
    const q = Math.max(0, Math.min(items[index].quantity, Math.floor(val)));
    const next = [...quantities];
    next[index] = q;
    setQuantities(next);
  };

  const handleSubmit = async () => {
    setError('');
    const selected = items
      .map((it, i) => ({ ...it, returnQuantity: quantities[i] }))
      .filter(x => x.returnQuantity > 0);

    if (selected.length === 0) {
      setError('Select at least one item and quantity to return');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        saleId,
        items: selected.map(s => ({
          productId: s.productId,
          originalQuantity: s.quantity,
          returnQuantity: s.returnQuantity,
          unitPrice: s.unitPrice,
          gstRate: s.gstRate || 0,
          returnReason: reason || undefined,
        })),
        reason,
        refundMethod,
      };

      const resp = await fetch(`/api/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data.success) {
        onClose(true);
      } else {
        setError(data.error || 'Failed to create return');
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide">
        <h3 className="modal-title">Create Return for Invoice {saleId}</h3>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-body">
          <table className="return-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Sold Qty</th>
                <th>Return Qty</th>
                <th>Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.productId}>
                  <td>{it.productName}</td>
                  <td>{it.quantity}</td>
                  <td>
                    <input type="number" min={0} max={it.quantity} value={quantities[i]} onChange={(e) => handleQtyChange(i, Number(e.target.value))} />
                  </td>
                  <td>₹{it.unitPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="form-row">
            <div className="form-group">
              <label>Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Refund Method</label>
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as any)}>
                <option value="original_payment">Original Payment</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn-primary" disabled={loading} onClick={handleSubmit}>{loading ? 'Processing...' : 'Create Return'}</button>
        </div>
      </div>
    </div>
  );
};

export default ReturnModal;
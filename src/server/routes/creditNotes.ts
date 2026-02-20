import { Router, Response } from 'express';
import { CreditNote } from '../models/CreditNote.js';
import { Sale } from '../models/Sale.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { generateNumber } from '../services/numbering.js';
import { recalculateCreditNoteStatus } from '../services/creditNotes.js';

const router = Router();

const roundTo2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toCustomerFilter = (query: any) => {
  const filter: any = {};
  if (query.customerPhone) filter.customerPhone = String(query.customerPhone);
  if (query.customerEmail) filter.customerEmail = String(query.customerEmail).toLowerCase();
  if (query.customerName) filter.customerName = { $regex: String(query.customerName), $options: 'i' };
  return filter;
};

// Manual credit note creation
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      reason,
      subtotal,
      taxAmount,
      totalAmount,
      sourceSaleId,
      notes,
    } = req.body;

    const noteReason = String(reason || '').trim();
    if (!noteReason) {
      return res.status(400).json({ success: false, error: 'reason is required' });
    }

    const parsedSubtotal = Number(subtotal || 0);
    const parsedTax = Number(taxAmount || 0);
    const parsedTotal = Number(totalAmount ?? parsedSubtotal + parsedTax);
    if (parsedTotal <= 0) {
      return res.status(400).json({ success: false, error: 'totalAmount must be greater than zero' });
    }

    const noteNumber = await generateNumber('credit_note', { prefix: 'CN-', datePart: true, padTo: 5 });
    const note = await CreditNote.create({
      noteNumber,
      customerName,
      customerPhone,
      customerEmail,
      sourceSaleId,
      reason: noteReason,
      subtotal: roundTo2(parsedSubtotal),
      taxAmount: roundTo2(parsedTax),
      totalAmount: roundTo2(parsedTotal),
      balanceAmount: roundTo2(parsedTotal),
      status: 'open',
      entries: [],
      issuedBy: req.userId,
      notes,
    });

    res.status(201).json({ success: true, message: 'Credit note created', data: note });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create credit note' });
  }
});

// List credit notes
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, skip = 0, limit = 50 } = req.query;
    const filter: any = { ...toCustomerFilter(req.query) };
    if (status) filter.status = status;

    const notes = await CreditNote.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit));
    const total = await CreditNote.countDocuments(filter);

    res.json({ success: true, data: notes, pagination: { total, skip: Number(skip), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch credit notes' });
  }
});

// Customer credit balance
router.get('/customer/balance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerFilter = toCustomerFilter(req.query);
    if (Object.keys(customerFilter).length === 0) {
      return res.status(400).json({ success: false, error: 'Provide customerName or customerPhone or customerEmail' });
    }

    const rows = await CreditNote.find(customerFilter);
    const totals = rows.reduce(
      (acc, row) => {
        acc.issued += Number(row.totalAmount || 0);
        acc.balance += Number(row.balanceAmount || 0);
        return acc;
      },
      { issued: 0, balance: 0 }
    );

    res.json({ success: true, data: { totalIssued: roundTo2(totals.issued), balance: roundTo2(totals.balance), notes: rows } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch customer credit balance' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const note = await CreditNote.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, error: 'Credit note not found' });
    res.json({ success: true, data: note });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch credit note' });
  }
});

// Adjust against future invoice
router.post('/:id/adjust', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { saleId, amount, note } = req.body;
    const creditNote = await CreditNote.findById(req.params.id);
    if (!creditNote) return res.status(404).json({ success: false, error: 'Credit note not found' });

    const adjustmentAmount = Number(amount || 0);
    if (adjustmentAmount <= 0) return res.status(400).json({ success: false, error: 'amount must be greater than zero' });
    if (adjustmentAmount > creditNote.balanceAmount) {
      return res.status(400).json({ success: false, error: 'Adjustment exceeds available credit balance' });
    }

    if (saleId) {
      const sale = await Sale.findById(saleId);
      if (!sale) return res.status(404).json({ success: false, error: 'Sale not found for adjustment' });
      sale.outstandingAmount = Math.max(0, Number(sale.outstandingAmount || 0) - adjustmentAmount);
      if (sale.outstandingAmount === 0 && sale.paymentStatus === 'pending') {
        sale.paymentStatus = 'completed';
      }
      await sale.save();
    }

    creditNote.balanceAmount = roundTo2(creditNote.balanceAmount - adjustmentAmount);
    creditNote.entries.push({
      type: 'adjustment',
      amount: adjustmentAmount,
      referenceSaleId: saleId,
      note,
      byUserId: req.userId,
      createdAt: new Date(),
    } as any);
    creditNote.status = recalculateCreditNoteStatus(creditNote as any) as any;

    await creditNote.save();
    res.json({ success: true, message: 'Credit note adjusted successfully', data: creditNote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to adjust credit note' });
  }
});

// Direct refund from credit note balance
router.post('/:id/refund', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, paymentMethod = 'bank_transfer', note } = req.body;
    const creditNote = await CreditNote.findById(req.params.id);
    if (!creditNote) return res.status(404).json({ success: false, error: 'Credit note not found' });

    const refundAmount = Number(amount || 0);
    if (refundAmount <= 0) return res.status(400).json({ success: false, error: 'amount must be greater than zero' });
    if (refundAmount > creditNote.balanceAmount) {
      return res.status(400).json({ success: false, error: 'Refund exceeds available credit balance' });
    }

    creditNote.balanceAmount = roundTo2(creditNote.balanceAmount - refundAmount);
    creditNote.entries.push({
      type: 'refund',
      amount: refundAmount,
      paymentMethod,
      note,
      byUserId: req.userId,
      createdAt: new Date(),
    } as any);
    creditNote.status = recalculateCreditNoteStatus(creditNote as any) as any;

    await creditNote.save();
    res.json({ success: true, message: 'Credit note refund processed', data: creditNote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to process refund' });
  }
});

export default router;


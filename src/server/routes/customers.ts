import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Customer } from '../models/Customer.js';
import { CustomerLedgerEntry } from '../models/CustomerLedgerEntry.js';
import { Sale } from '../models/Sale.js';
import { generateNumber } from '../services/numbering.js';
import { writeAuditLog } from '../services/audit.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, accountType, isBlocked } = req.query;
    const filter: any = {};

    if (accountType) filter.accountType = accountType;
    if (isBlocked !== undefined) filter.isBlocked = String(isBlocked) === 'true';
    if (q) {
      filter.$or = [
        { customerCode: { $regex: String(q), $options: 'i' } },
        { name: { $regex: String(q), $options: 'i' } },
        { phone: { $regex: String(q), $options: 'i' } },
        { email: { $regex: String(q), $options: 'i' } },
      ];
    }

    const rows = await Customer.find(filter).sort({ name: 1 });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch customers' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customerCode,
      name,
      phone,
      email,
      gstin,
      address,
      accountType = 'cash',
      creditLimit = 0,
      creditDays = 0,
      openingBalance = 0,
      notes,
      priceOverrides = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    const finalCode = String(customerCode || '').trim().toUpperCase()
      || await generateNumber('customer_code', { prefix: 'CUST-', padTo: 5 });

    const existing = await Customer.findOne({ customerCode: finalCode });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Customer code already exists' });
    }

    const customer = await Customer.create({
      customerCode: finalCode,
      name,
      phone,
      email,
      gstin,
      address,
      accountType: String(accountType) === 'credit' ? 'credit' : 'cash',
      creditLimit: Number(creditLimit || 0),
      creditDays: Number(creditDays || 0),
      openingBalance: Number(openingBalance || 0),
      outstandingBalance: Number(openingBalance || 0),
      notes,
      priceOverrides: Array.isArray(priceOverrides) ? priceOverrides : [],
      createdBy: req.userId,
    });

    if (Number(openingBalance || 0) !== 0) {
      await CustomerLedgerEntry.create({
        customerId: customer._id,
        entryType: 'opening',
        entryDate: new Date(),
        debit: Number(openingBalance || 0) > 0 ? Number(openingBalance) : 0,
        credit: Number(openingBalance || 0) < 0 ? Math.abs(Number(openingBalance)) : 0,
        balanceAfter: Number(openingBalance || 0),
        narration: 'Opening balance',
        createdBy: req.userId,
      });
    }

    await writeAuditLog({
      module: 'customer',
      action: 'create',
      entityType: 'customer',
      entityId: customer._id.toString(),
      referenceNo: customer.customerCode,
      userId: req.userId,
      after: customer.toObject(),
    });

    res.status(201).json({ success: true, data: customer, message: 'Customer created' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create customer' });
  }
});

router.get('/outstanding/summary', authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await Customer.aggregate([
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          blockedCustomers: { $sum: { $cond: ['$isBlocked', 1, 0] } },
          totalOutstanding: { $sum: '$outstandingBalance' },
        },
      },
    ]);

    res.json({
      success: true,
      data: result[0] || { totalCustomers: 0, blockedCustomers: 0, totalOutstanding: 0 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch outstanding summary' });
  }
});

router.get('/aging/report', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const asOn = req.query.asOnDate ? new Date(String(req.query.asOnDate)) : new Date();
    asOn.setHours(23, 59, 59, 999);

    const invoices = await Sale.find({
      invoiceType: 'credit',
      invoiceStatus: 'posted',
      outstandingAmount: { $gt: 0 },
    }).sort({ dueDate: 1, createdAt: 1 });

    const report = invoices.map((invoice: any) => {
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const daysPastDue =
        dueDate ? Math.max(Math.floor((asOn.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)), 0) : 0;

      let bucket: 'current' | '30' | '60' | '90' = 'current';
      if (daysPastDue > 90) bucket = '90';
      else if (daysPastDue > 60) bucket = '60';
      else if (daysPastDue > 30) bucket = '30';

      return {
        saleId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || invoice.saleNumber,
        customerId: invoice.customerId || null,
        customerCode: invoice.customerCode || '',
        customerName: invoice.customerName || 'Walk-in Customer',
        dueDate,
        outstandingAmount: Number(invoice.outstandingAmount || 0),
        daysPastDue,
        bucket,
      };
    });

    const summary = report.reduce(
      (acc, row) => {
        acc.total += row.outstandingAmount;
        if (row.bucket === 'current') acc.current += row.outstandingAmount;
        if (row.bucket === '30') acc.bucket30 += row.outstandingAmount;
        if (row.bucket === '60') acc.bucket60 += row.outstandingAmount;
        if (row.bucket === '90') acc.bucket90 += row.outstandingAmount;
        return acc;
      },
      { total: 0, current: 0, bucket30: 0, bucket60: 0, bucket90: 0 }
    );

    res.json({ success: true, data: { asOnDate: asOn, summary, rows: report } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate aging report' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch customer' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const current = await Customer.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, error: 'Customer not found' });

    const updates = {
      ...req.body,
      customerCode: req.body.customerCode ? String(req.body.customerCode).toUpperCase() : current.customerCode,
      accountType: req.body.accountType === 'credit' ? 'credit' : req.body.accountType === 'cash' ? 'cash' : current.accountType,
      creditLimit: req.body.creditLimit !== undefined ? Number(req.body.creditLimit) : current.creditLimit,
      creditDays: req.body.creditDays !== undefined ? Number(req.body.creditDays) : current.creditDays,
      priceOverrides: Array.isArray(req.body.priceOverrides) ? req.body.priceOverrides : current.priceOverrides,
    };

    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    await writeAuditLog({
      module: 'customer',
      action: 'update',
      entityType: 'customer',
      entityId: String(req.params.id),
      referenceNo: customer?.customerCode,
      userId: req.userId,
      before: current.toObject(),
      after: customer?.toObject(),
    });

    res.json({ success: true, data: customer, message: 'Customer updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update customer' });
  }
});

router.put('/:id/block', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isBlocked } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isBlocked: Boolean(isBlocked) },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    res.json({
      success: true,
      data: customer,
      message: customer.isBlocked ? 'Customer blocked successfully' : 'Customer unblocked successfully',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update customer block state' });
  }
});

router.get('/:id/ledger', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await CustomerLedgerEntry.find({ customerId: req.params.id }).sort({ entryDate: 1, createdAt: 1 });
    const totals = rows.reduce(
      (acc, row) => {
        acc.debit += Number(row.debit || 0);
        acc.credit += Number(row.credit || 0);
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    res.json({
      success: true,
      data: {
        totals: { ...totals, balance: Number((totals.debit - totals.credit).toFixed(2)) },
        rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch customer ledger' });
  }
});

router.get('/:id/invoices', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await Sale.find({ customerId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch customer invoices' });
  }
});

export default router;

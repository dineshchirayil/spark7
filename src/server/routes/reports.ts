import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Sale } from '../models/Sale.js';
import { Return } from '../models/Return.js';
import { Product } from '../models/Product.js';
import { AuditLog } from '../models/AuditLog.js';
import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';
import { deriveStoreScope, isAdminAuditViewerRole } from '../services/audit.js';

const router = Router();

const parseDateParam = (raw: string | undefined, fallback: Date, endOfDay = false): Date => {
  const value = String(raw || '').trim();
  let date: Date;

  if (!value) {
    date = new Date(fallback);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    const parsed = new Date(value);
    date = Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
};

const parseRange = (startDate?: string, endDate?: string) => {
  const today = new Date();
  const start = parseDateParam(startDate, today, false);
  const end = parseDateParam(endDate, today, true);
  if (start > end) {
    const normalizedStart = new Date(end);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(start);
    normalizedEnd.setHours(23, 59, 59, 999);
    return { start: normalizedStart, end: normalizedEnd };
  }
  return { start, end };
};

const saleMatch = (start: Date, end: Date) => ({
  createdAt: { $gte: start, $lte: end },
  $or: [
    { invoiceStatus: 'posted' },
    { invoiceStatus: null },
    { invoiceStatus: { $exists: false } },
  ],
  saleStatus: { $in: ['completed', 'returned'] },
});

router.get('/daily-sales-summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Sale.aggregate([
      { $match: saleMatch(start, end) },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          invoices: { $sum: 1 },
          salesAmount: { $sum: '$totalAmount' },
          taxAmount: { $sum: '$totalGst' },
          outstanding: { $sum: '$outstandingAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate daily sales summary' });
  }
});

router.get('/item-wise-sales', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Sale.aggregate([
      { $match: saleMatch(start, end) },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          sku: { $first: '$items.sku' },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.lineTotal' },
          taxableValue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
          tax: { $sum: '$items.gstAmount' },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate item-wise sales report' });
  }
});

router.get('/customer-wise-sales', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Sale.aggregate([
      { $match: saleMatch(start, end) },
      {
        $group: {
          _id: {
            customerId: '$customerId',
            customerCode: '$customerCode',
            customerName: '$customerName',
            customerPhone: '$customerPhone',
          },
          invoices: { $sum: 1 },
          amount: { $sum: '$totalAmount' },
          outstanding: { $sum: '$outstandingAmount' },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate customer-wise sales report' });
  }
});

router.get('/sales-returns', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Return.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 });
    const summary = rows.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.returnedAmount += Number(row.returnedAmount || 0);
        acc.returnedTax += Number(row.returnedGst || 0);
        acc.refundAmount += Number(row.refundAmount || 0);
        return acc;
      },
      { count: 0, returnedAmount: 0, returnedTax: 0, refundAmount: 0 }
    );

    res.json({ success: true, data: { summary, rows } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate returns report' });
  }
});

router.get('/gross-profit', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);
    const sales = await Sale.find(saleMatch(start, end));

    const productIds = Array.from(
      new Set(
        sales.flatMap((sale) => sale.items.map((item: any) => String(item.productId)))
      )
    );
    const products = await Product.find({ _id: { $in: productIds } });
    const costMap = new Map(products.map((p: any) => [String(p._id), Number(p.cost || 0)]));

    let revenue = 0;
    let costOfGoods = 0;

    for (const sale of sales) {
      revenue += Number(sale.totalAmount || 0);
      for (const item of sale.items as any[]) {
        const qty = Number(item.quantity || 0);
        const unitCost = Number(item.costPrice ?? costMap.get(String(item.productId)) ?? 0);
        costOfGoods += qty * unitCost;
      }
    }

    const grossProfit = revenue - costOfGoods;
    const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        revenue: Number(revenue.toFixed(2)),
        costOfGoods: Number(costOfGoods.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        marginPercent: Number(marginPercent.toFixed(2)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate gross profit report' });
  }
});

router.get('/outstanding-receivables', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Sale.find({
      createdAt: { $gte: start, $lte: end },
      invoiceType: 'credit',
      $or: [
        { invoiceStatus: 'posted' },
        { invoiceStatus: null },
        { invoiceStatus: { $exists: false } },
      ],
      outstandingAmount: { $gt: 0 },
    }).sort({ dueDate: 1, createdAt: 1 });

    const totalOutstanding = rows.reduce((sum, row: any) => sum + Number(row.outstandingAmount || 0), 0);
    res.json({ success: true, data: { totalOutstanding, rows } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate outstanding receivables report' });
  }
});

router.get('/attendance-summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Attendance.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$employeeId',
          totalMarked: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0],
            },
          },
          halfDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0],
            },
          },
          leaveDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'leave'] }, 1, 0],
            },
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'absent'] }, 1, 0],
            },
          },
          overtimeHours: { $sum: '$overtimeHours' },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          employeeId: '$_id',
          employeeCode: '$employee.employeeCode',
          employeeName: '$employee.name',
          designation: '$employee.designation',
          totalMarked: 1,
          presentDays: 1,
          halfDays: 1,
          leaveDays: 1,
          absentDays: 1,
          overtimeHours: { $round: ['$overtimeHours', 2] },
        },
      },
      { $sort: { employeeName: 1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate attendance report' });
  }
});

router.get('/cash-vs-credit', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Sale.aggregate([
      { $match: saleMatch(start, end) },
      {
        $group: {
          _id: '$invoiceType',
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' },
        },
      },
    ]);

    const mapped = rows.reduce(
      (acc, row) => {
        if (row._id === 'cash') acc.cash = row;
        if (row._id === 'credit') acc.credit = row;
        return acc;
      },
      { cash: { count: 0, amount: 0 }, credit: { count: 0, amount: 0 } }
    );

    res.json({ success: true, data: mapped });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate cash vs credit report' });
  }
});

router.get('/user-wise-sales', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const rows = await Sale.aggregate([
      { $match: saleMatch(start, end) },
      {
        $group: {
          _id: '$userId',
          invoices: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          cash: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0] } },
          card: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0] } },
          upi: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalAmount', 0] } },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate user-wise sales report' });
  }
});

router.get('/tax-summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseRange(startDate as string, endDate as string);

    const salesTax = await Sale.aggregate([
      { $match: saleMatch(start, end) },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.gstRate',
          taxableValue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
          taxAmount: { $sum: '$items.gstAmount' },
          cgstAmount: { $sum: '$items.cgstAmount' },
          sgstAmount: { $sum: '$items.sgstAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const returnTax = await Return.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, returnStatus: 'approved' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.gstRate',
          taxableValue: { $sum: '$items.lineSubtotal' },
          taxAmount: { $sum: '$items.lineTax' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: { salesTax, returnTax } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate tax summary report' });
  }
});

router.get('/audit-logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.userId ? await User.findById(req.userId).select('role businessName gstin') : null;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    if (!isAdminAuditViewerRole(currentUser.role)) {
      return res.status(403).json({ success: false, error: 'Only admin users can view audit logs' });
    }

    const { module, action, entityType, userId, limit = 200, skip = 0 } = req.query;
    const { storeKey } = deriveStoreScope(currentUser, currentUser._id.toString());
    const filter: any = {};
    filter.storeKey = storeKey;
    if (module) filter.module = String(module);
    if (action) filter.action = String(action);
    if (entityType) filter.entityType = String(entityType);
    if (userId) filter.userId = String(userId);

    const parsedLimit = Math.min(500, Math.max(1, Number(limit) || 200));
    const parsedSkip = Math.max(0, Number(skip) || 0);

    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit);

    const total = await AuditLog.countDocuments(filter);
    res.json({ success: true, data: rows, pagination: { total, skip: parsedSkip, limit: parsedLimit } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch audit logs' });
  }
});

export default router;

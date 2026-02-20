import { Router, Response } from 'express';
import { Return } from '../models/Return.js';
import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { generateNumber } from '../services/numbering.js';
import { createCreditNoteFromReturn } from '../services/creditNotes.js';
import { writeAuditLog } from '../services/audit.js';

const router = Router();

const roundTo2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const approvedReturnedQtyForSaleItem = async (saleId: string, productId: string): Promise<number> => {
  const rows = await Return.aggregate([
    { $match: { saleId, returnStatus: 'approved' } },
    { $unwind: '$items' },
    { $match: { 'items.productId': productId } },
    { $group: { _id: null, qty: { $sum: '$items.returnQuantity' } } },
  ]);
  return Number(rows[0]?.qty || 0);
};

// Create a return (linked or manual)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      saleId,
      sourceInvoiceNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      items,
      reason,
      notes,
      refundMethod,
      qualityCheckRequired,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Return must have at least one item' });
    }

    const overallReason = String(reason || '').trim();
    if (!overallReason) {
      return res.status(400).json({ success: false, error: 'Return reason is required' });
    }

    const linkedSale = saleId ? await Sale.findById(saleId) : null;
    if (saleId && !linkedSale) {
      return res.status(404).json({ success: false, error: 'Original sale not found' });
    }

    let returnedAmount = 0;
    let returnedGst = 0;
    const processedItems: any[] = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ success: false, error: `Product not found: ${item.productId}` });
      }

      const returnQuantity = Number(item.returnQuantity || 0);
      if (returnQuantity <= 0) {
        return res.status(400).json({ success: false, error: `Invalid return quantity for ${product.name}` });
      }

      let originalQuantity = Number(item.originalQuantity || 0);
      let unitPrice = Number(item.unitPrice ?? 0);
      let gstRate = Number(item.gstRate ?? 0);

      if (linkedSale) {
        const soldItem = linkedSale.items.find((s: any) => String(s.productId) === String(item.productId));
        if (!soldItem) {
          return res.status(400).json({
            success: false,
            error: `Product ${product.name} not found in linked invoice`,
          });
        }

        const alreadyReturned = await approvedReturnedQtyForSaleItem(linkedSale._id.toString(), String(item.productId));
        const soldQty = Number(soldItem.quantity || 0);
        const availableToReturn = Math.max(0, soldQty - alreadyReturned);
        if (returnQuantity > availableToReturn) {
          return res.status(400).json({
            success: false,
            error: `Return qty exceeds available for ${product.name}. Available: ${availableToReturn}`,
          });
        }

        originalQuantity = soldQty;
        unitPrice = Number(item.unitPrice ?? soldItem.unitPrice ?? 0);
        gstRate = Number(item.gstRate ?? soldItem.gstRate ?? 0);
      } else {
        if (unitPrice <= 0) unitPrice = Number(product.price || 0);
        if (gstRate < 0) gstRate = Number(product.gstRate || 0);
      }

      const itemReason = String(item.returnReason || overallReason).trim();
      if (!itemReason) {
        return res.status(400).json({ success: false, error: `Return reason required for ${product.name}` });
      }

      const lineSubtotal = roundTo2(unitPrice * returnQuantity);
      const lineTax = roundTo2((lineSubtotal * gstRate) / 100);
      const lineTotal = roundTo2(lineSubtotal + lineTax);

      processedItems.push({
        saleId: saleId || undefined,
        productId: String(product._id),
        productName: product.name,
        sku: product.sku,
        originalQuantity: originalQuantity || undefined,
        returnQuantity,
        unitPrice,
        gstRate,
        returnReason: itemReason,
        lineSubtotal,
        lineTax,
        lineTotal,
        qualityStatus: 'pending',
      });

      returnedAmount += lineSubtotal;
      returnedGst += lineTax;
    }

    const returnNumber = await generateNumber('return_number', { prefix: 'RET-', datePart: true, padTo: 5 });
    const refundAmount = roundTo2(returnedAmount + returnedGst);

    const returnRecord = new Return({
      returnNumber,
      userId: req.userId || req.body.userId,
      saleId: saleId || undefined,
      sourceInvoiceNumber: sourceInvoiceNumber || linkedSale?.invoiceNumber || linkedSale?.saleNumber,
      customerId: customerId || undefined,
      customerName: customerName || linkedSale?.customerName || undefined,
      customerPhone: customerPhone || linkedSale?.customerPhone || undefined,
      customerEmail: customerEmail || linkedSale?.customerEmail || undefined,
      isManualReturn: !saleId,
      items: processedItems,
      returnedAmount: roundTo2(returnedAmount),
      returnedGst: roundTo2(returnedGst),
      refundAmount,
      refundMethod: refundMethod || 'original_payment',
      refundStatus: 'pending',
      returnStatus: 'draft',
      reason: overallReason,
      notes,
      qualityCheckRequired: Boolean(qualityCheckRequired),
      qualityCheck: { status: 'pending' },
      restockStatus: 'pending',
    });

    await returnRecord.save();

    await writeAuditLog({
      module: 'refunds',
      action: 'return_created',
      entityType: 'return',
      entityId: returnRecord._id.toString(),
      referenceNo: returnRecord.returnNumber,
      userId: req.userId,
      after: returnRecord.toObject(),
    });

    res.status(201).json({
      success: true,
      message: 'Return created successfully (pending approval)',
      data: returnRecord,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create return' });
  }
});

// Get returns list
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      status,
      refundStatus,
      saleId,
      customerName,
      customerPhone,
      customerEmail,
      skip = 0,
      limit = 20,
    } = req.query;

    const filter: any = {};
    if (status) filter.returnStatus = status;
    if (refundStatus) filter.refundStatus = refundStatus;
    if (saleId) filter.saleId = saleId;
    if (customerName) filter.customerName = { $regex: String(customerName), $options: 'i' };
    if (customerPhone) filter.customerPhone = { $regex: String(customerPhone), $options: 'i' };
    if (customerEmail) filter.customerEmail = { $regex: String(customerEmail), $options: 'i' };

    const returns = await Return.find(filter)
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Return.countDocuments(filter);
    res.json({
      success: true,
      data: returns,
      pagination: { total, skip: Number(skip), limit: Number(limit) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to get returns' });
  }
});

// Get return by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const returnRecord = await Return.findById(req.params.id);
    if (!returnRecord) return res.status(404).json({ success: false, error: 'Return not found' });
    res.json({ success: true, data: returnRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to get return' });
  }
});

// Approve return (optional quality check, optional direct refund, optional credit note)
router.put('/:id/approve', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refundStatus, qualityCheck, processDirectRefund, generateCreditNote } = req.body;
    const returnRecord = await Return.findById(req.params.id);
    if (!returnRecord) return res.status(404).json({ success: false, error: 'Return not found' });
    if (returnRecord.returnStatus === 'approved') {
      return res.status(400).json({ success: false, error: 'Return already approved' });
    }
    const before = returnRecord.toObject();

    const qualityStatus = String(qualityCheck?.status || 'pending').toLowerCase();
    const qualityFailed = qualityStatus === 'failed';
    const restockAllowed = !qualityFailed;

    if (restockAllowed) {
      for (const item of returnRecord.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: Number(item.returnQuantity || 0) } });
      }
    }

    returnRecord.returnStatus = 'approved';
    returnRecord.approvedBy = req.userId;
    returnRecord.approvedAt = new Date();
    returnRecord.qualityCheck = {
      status: qualityStatus === 'passed' || qualityStatus === 'failed' ? (qualityStatus as any) : 'pending',
      notes: qualityCheck?.notes,
      checkedBy: req.userId,
      checkedAt: new Date(),
    };
    returnRecord.items = returnRecord.items.map((item: any) => ({
      ...item,
      qualityStatus: returnRecord.qualityCheck?.status || 'pending',
    })) as any;
    returnRecord.restockStatus = restockAllowed ? 'completed' : 'skipped';

    const needsCreditNote = returnRecord.refundMethod === 'credit_note' || Boolean(generateCreditNote);
    if (needsCreditNote) {
      const note = await createCreditNoteFromReturn(returnRecord, req.userId || 'system');
      returnRecord.creditNoteId = note._id.toString();
      returnRecord.refundStatus = 'completed';
    } else {
      returnRecord.refundStatus = processDirectRefund ? (refundStatus || 'completed') : (refundStatus || 'pending');
    }

    await returnRecord.save();

    await writeAuditLog({
      module: 'refunds',
      action: 'return_approved',
      entityType: 'return',
      entityId: returnRecord._id.toString(),
      referenceNo: returnRecord.returnNumber,
      userId: req.userId,
      metadata: {
        qualityStatus: returnRecord.qualityCheck?.status,
        restockStatus: returnRecord.restockStatus,
        refundStatus: returnRecord.refundStatus,
      },
      before,
      after: returnRecord.toObject(),
    });

    res.json({
      success: true,
      message: 'Return approved successfully',
      data: returnRecord,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to approve return' });
  }
});

// Reject return
router.put('/:id/reject', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const returnRecord = await Return.findById(req.params.id);
    if (!returnRecord) return res.status(404).json({ success: false, error: 'Return not found' });
    const before = returnRecord.toObject();

    returnRecord.returnStatus = 'rejected';
    returnRecord.refundStatus = 'rejected';
    returnRecord.notes = req.body?.reason || req.body?.rejectionReason || returnRecord.notes;
    returnRecord.restockStatus = 'skipped';
    await returnRecord.save();

    await writeAuditLog({
      module: 'refunds',
      action: 'return_rejected',
      entityType: 'return',
      entityId: returnRecord._id.toString(),
      referenceNo: returnRecord.returnNumber,
      userId: req.userId,
      metadata: {
        reason: req.body?.reason || req.body?.rejectionReason,
      },
      before,
      after: returnRecord.toObject(),
    });

    res.json({
      success: true,
      message: 'Return rejected successfully',
      data: returnRecord,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to reject return' });
  }
});

// Delete draft/rejected return
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const returnRecord = await Return.findById(req.params.id);
    if (!returnRecord) return res.status(404).json({ success: false, error: 'Return not found' });
    if (returnRecord.returnStatus === 'approved') {
      return res.status(400).json({ success: false, error: 'Approved returns cannot be deleted' });
    }

    const before = returnRecord.toObject();
    await Return.findByIdAndDelete(req.params.id);

    await writeAuditLog({
      module: 'refunds',
      action: 'return_deleted',
      entityType: 'return',
      entityId: String(req.params.id),
      referenceNo: returnRecord.returnNumber,
      userId: req.userId,
      before,
    });

    res.json({ success: true, message: 'Return deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to delete return' });
  }
});

export default router;

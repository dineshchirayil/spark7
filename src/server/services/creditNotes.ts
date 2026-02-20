import { CreditNote } from '../models/CreditNote.js';
import { IReturnDocument } from '../models/Return.js';
import { generateNumber } from './numbering.js';

export const createCreditNoteFromReturn = async (
  returnRecord: IReturnDocument,
  issuedBy: string,
  notes?: string
) => {
  const existing = returnRecord.creditNoteId
    ? await CreditNote.findById(returnRecord.creditNoteId)
    : await CreditNote.findOne({ sourceReturnId: returnRecord._id.toString() });

  if (existing) return existing;

  const noteNumber = await generateNumber('credit_note', { prefix: 'CN-', datePart: true, padTo: 5 });
  const subtotal = Number(returnRecord.returnedAmount || 0);
  const taxAmount = Number(returnRecord.returnedGst || 0);
  const totalAmount = Number(returnRecord.refundAmount || 0);

  const note = await CreditNote.create({
    noteNumber,
    customerName: (returnRecord as any).customerName,
    customerPhone: (returnRecord as any).customerPhone,
    customerEmail: (returnRecord as any).customerEmail,
    sourceReturnId: returnRecord._id.toString(),
    sourceSaleId: returnRecord.saleId || undefined,
    reason: returnRecord.reason || 'Sales return credit',
    subtotal,
    taxAmount,
    totalAmount,
    balanceAmount: totalAmount,
    status: 'open',
    entries: [],
    issuedBy,
    notes: notes || returnRecord.notes,
  });

  return note;
};

export const recalculateCreditNoteStatus = (note: {
  totalAmount: number;
  balanceAmount: number;
  entries: Array<{ type: 'adjustment' | 'refund'; amount: number }>;
}) => {
  const balance = Number(note.balanceAmount || 0);
  const total = Number(note.totalAmount || 0);
  const hasRefund = note.entries.some((entry) => entry.type === 'refund');
  const hasAdjustment = note.entries.some((entry) => entry.type === 'adjustment');

  if (balance <= 0) {
    if (hasRefund && hasAdjustment) return 'adjusted';
    if (hasRefund) return 'refunded';
    if (hasAdjustment) return 'adjusted';
    return 'adjusted';
  }

  if (balance < total) {
    if (hasRefund) return 'partially_refunded';
    if (hasAdjustment) return 'partially_adjusted';
  }

  return 'open';
};


import mongoose, { Document, Schema } from 'mongoose';

export interface ICreditNoteEntry {
  type: 'adjustment' | 'refund';
  amount: number;
  referenceSaleId?: string;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'online' | 'cheque';
  note?: string;
  byUserId?: string;
  createdAt?: Date;
}

export interface ICreditNote {
  _id?: string;
  noteNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  sourceReturnId?: string;
  sourceSaleId?: string;
  reason: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  balanceAmount: number;
  status: 'open' | 'partially_adjusted' | 'adjusted' | 'partially_refunded' | 'refunded' | 'cancelled';
  entries: ICreditNoteEntry[];
  issuedBy: string;
  issuedAt?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ICreditNoteDocument extends Document, Omit<ICreditNote, '_id'> {}

const CreditNoteEntrySchema = new Schema<ICreditNoteEntry>(
  {
    type: {
      type: String,
      enum: ['adjustment', 'refund'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    referenceSaleId: String,
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'online', 'cheque'],
    },
    note: String,
    byUserId: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CreditNoteSchema = new Schema<ICreditNoteDocument>(
  {
    noteNumber: { type: String, unique: true, required: true, index: true },
    customerName: String,
    customerPhone: String,
    customerEmail: String,
    sourceReturnId: { type: String, index: true },
    sourceSaleId: { type: String, index: true },
    reason: { type: String, required: true, trim: true },
    subtotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['open', 'partially_adjusted', 'adjusted', 'partially_refunded', 'refunded', 'cancelled'],
      default: 'open',
    },
    entries: [CreditNoteEntrySchema],
    issuedBy: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

export type { ICreditNoteDocument };
export const CreditNote = mongoose.model<ICreditNoteDocument>('CreditNote', CreditNoteSchema);


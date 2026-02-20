import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomerLedgerEntry extends Document {
  customerId: mongoose.Types.ObjectId;
  entryDate: Date;
  entryType: 'opening' | 'invoice' | 'payment' | 'credit_note' | 'adjustment' | 'refund' | 'advance';
  referenceType?: 'sale' | 'return' | 'receipt' | 'credit_note' | 'manual';
  referenceId?: string;
  referenceNo?: string;
  narration?: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  dueDate?: Date;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CustomerLedgerEntrySchema = new Schema<ICustomerLedgerEntry>(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    entryDate: { type: Date, default: Date.now, index: true },
    entryType: {
      type: String,
      enum: ['opening', 'invoice', 'payment', 'credit_note', 'adjustment', 'refund', 'advance'],
      required: true,
      index: true,
    },
    referenceType: {
      type: String,
      enum: ['sale', 'return', 'receipt', 'credit_note', 'manual'],
    },
    referenceId: { type: String, index: true },
    referenceNo: { type: String, trim: true },
    narration: { type: String, trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, default: 0 },
    dueDate: { type: Date, index: true },
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

CustomerLedgerEntrySchema.index({ customerId: 1, entryDate: 1, createdAt: 1 });

export const CustomerLedgerEntry = mongoose.model<ICustomerLedgerEntry>('CustomerLedgerEntry', CustomerLedgerEntrySchema);

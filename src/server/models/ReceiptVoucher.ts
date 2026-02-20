import mongoose, { Document, Schema } from 'mongoose';

export interface IReceiptAllocation {
  saleId?: string;
  saleNumber?: string;
  amount: number;
}

export interface IReceiptVoucher extends Document {
  voucherNumber: string;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  entryDate: Date;
  amount: number;
  unappliedAmount: number;
  mode: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  isAdvance: boolean;
  allocations: IReceiptAllocation[];
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ReceiptAllocationSchema = new Schema<IReceiptAllocation>(
  {
    saleId: { type: String, index: true },
    saleNumber: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ReceiptVoucherSchema = new Schema<IReceiptVoucher>(
  {
    voucherNumber: { type: String, required: true, unique: true, index: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    customerName: { type: String, trim: true, index: true },
    entryDate: { type: Date, default: Date.now, index: true },
    amount: { type: Number, required: true, min: 0 },
    unappliedAmount: { type: Number, required: true, min: 0 },
    mode: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'cheque'],
      default: 'cash',
      index: true,
    },
    isAdvance: { type: Boolean, default: false, index: true },
    allocations: [ReceiptAllocationSchema],
    notes: { type: String, trim: true },
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

ReceiptVoucherSchema.index({ entryDate: 1, mode: 1 });

export const ReceiptVoucher = mongoose.model<IReceiptVoucher>('ReceiptVoucher', ReceiptVoucherSchema);

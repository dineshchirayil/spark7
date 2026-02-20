import mongoose, { Schema, Document } from 'mongoose';

export interface IContractPayment extends Document {
  contractorName: string;
  contractTitle: string;
  paymentDate: Date;
  amount: number;
  status: 'pending' | 'partial' | 'paid';
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank' | 'cheque';
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ContractPaymentSchema = new Schema<IContractPayment>(
  {
    contractorName: { type: String, required: true, trim: true },
    contractTitle: { type: String, required: true, trim: true },
    paymentDate: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'paid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank', 'cheque'],
      default: 'bank',
    },
    notes: { type: String, trim: true },
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

ContractPaymentSchema.index({ paymentDate: -1 });

export const ContractPayment = mongoose.model<IContractPayment>('ContractPayment', ContractPaymentSchema);

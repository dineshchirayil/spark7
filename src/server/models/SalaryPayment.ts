import mongoose, { Schema, Document } from 'mongoose';

export interface ISalaryPayment extends Document {
  employeeId?: mongoose.Types.ObjectId;
  employeeName: string;
  designation?: string;
  month: string; // YYYY-MM
  payDate: Date;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank' | 'cheque';
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SalaryPaymentSchema = new Schema<ISalaryPayment>(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      index: true,
    },
    employeeName: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    payDate: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
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

SalaryPaymentSchema.index({ month: 1, payDate: -1 });

export const SalaryPayment = mongoose.model<ISalaryPayment>('SalaryPayment', SalaryPaymentSchema);

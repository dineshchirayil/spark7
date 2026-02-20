import mongoose, { Document, Schema } from 'mongoose';

export interface IDayEndClosing extends Document {
  dateKey: string;
  businessDate: Date;
  openingCash: number;
  cashSales: number;
  cashReceipts: number;
  cashExpenses: number;
  systemClosingCash: number;
  physicalClosingCash: number;
  variance: number;
  notes?: string;
  closedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const DayEndClosingSchema = new Schema<IDayEndClosing>(
  {
    dateKey: { type: String, required: true, unique: true, index: true },
    businessDate: { type: Date, required: true, index: true },
    openingCash: { type: Number, default: 0 },
    cashSales: { type: Number, default: 0 },
    cashReceipts: { type: Number, default: 0 },
    cashExpenses: { type: Number, default: 0 },
    systemClosingCash: { type: Number, default: 0 },
    physicalClosingCash: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    closedBy: { type: String, index: true },
  },
  { timestamps: true }
);

export const DayEndClosing = mongoose.model<IDayEndClosing>('DayEndClosing', DayEndClosingSchema);

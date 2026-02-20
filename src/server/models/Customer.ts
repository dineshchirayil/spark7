import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomerPriceOverride {
  productId: string;
  priceType: 'retail' | 'wholesale' | 'custom';
  unitPrice: number;
}

export interface ICustomer extends Document {
  customerCode: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  accountType: 'cash' | 'credit';
  creditLimit: number;
  creditDays: number;
  outstandingBalance: number;
  isBlocked: boolean;
  openingBalance: number;
  priceOverrides: ICustomerPriceOverride[];
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CustomerPriceOverrideSchema = new Schema<ICustomerPriceOverride>(
  {
    productId: { type: String, required: true, index: true },
    priceType: {
      type: String,
      enum: ['retail', 'wholesale', 'custom'],
      default: 'custom',
    },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    customerCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    gstin: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true },
    accountType: {
      type: String,
      enum: ['cash', 'credit'],
      default: 'cash',
      index: true,
    },
    creditLimit: { type: Number, min: 0, default: 0 },
    creditDays: { type: Number, min: 0, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false, index: true },
    openingBalance: { type: Number, default: 0 },
    priceOverrides: [CustomerPriceOverrideSchema],
    notes: { type: String, trim: true },
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ phone: 1, email: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);

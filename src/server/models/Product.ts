import mongoose, { Schema, Document } from 'mongoose';
import { IProduct } from '@shared/types';

type IProductDocument = IProduct & Document;

const productSchema = new Schema<IProductDocument>(
  {
    name: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    description: String,
    category: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    wholesalePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    taxType: {
      type: String,
      enum: ['gst', 'vat'],
      default: 'gst',
    },
    gstRate: {
      type: Number,
      enum: [0, 5, 12, 18, 28],
      default: 18,
    },
    hsnCode: {
      type: String,
      default: '',
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    returnStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    damagedStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowNegativeStock: {
      type: Boolean,
      default: false,
    },
    batchTracking: {
      type: Boolean,
      default: false,
    },
    expiryRequired: {
      type: Boolean,
      default: false,
    },
    minStock: {
      type: Number,
      default: 10,
    },
    unit: {
      type: String,
      enum: ['piece', 'kg', 'liter', 'meter'],
      default: 'piece',
    },
    imageUrl: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProductDocument>('Product', productSchema);
export type { IProductDocument };

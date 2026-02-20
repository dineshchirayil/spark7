import mongoose, { Schema, Document } from 'mongoose';
import { IOrder } from '@shared/types';

// Mongoose document interfaces (use ObjectId for relational fields)
interface IOrderItemDoc {
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
  price: number;
  gstAmount: number;
}

interface IOrderDocument extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId | string;
  items: IOrderItemDoc[];
  totalAmount: number;
  gstAmount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'check';
  paymentStatus: 'pending' | 'completed' | 'failed';
  orderStatus: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const orderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        gstAmount: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    gstAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'check'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: String,
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrderDocument>('Order', orderSchema);
export type { IOrderDocument };

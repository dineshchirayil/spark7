import mongoose, { Schema, Document } from 'mongoose';
import { IInventory } from '@shared/types';

// Mongoose document interface (use ObjectId for relational fields)
interface IInventoryDocument extends Document {
  productId: mongoose.Types.ObjectId | string;
  warehouseLocation?: string;
  quantity: number;
  reservedQuantity: number;
  lastRestockDate?: Date;
  expiryDate?: Date;
  batchNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const inventorySchema = new Schema<IInventoryDocument>(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
    },
    warehouseLocation: String,
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRestockDate: Date,
    expiryDate: Date,
    batchNumber: String,
  },
  { timestamps: true }
);

export const Inventory = mongoose.model<IInventoryDocument>('Inventory', inventorySchema);
export type { IInventoryDocument };

import mongoose from 'mongoose';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
}

export interface IOrder extends mongoose.Document {
  items: IOrderItem[];
  totalAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: Date;
}

const orderSchema = new mongoose.Schema({
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, default: 'cash' },
  status: { type: String, default: 'completed' },
}, {
  timestamps: true
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);
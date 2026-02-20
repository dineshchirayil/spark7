import express from 'express';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Create a new order
router.post('/', authenticate, async (req, res) => {
  try {
    const { items, paymentMethod } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    let totalAmount = 0;
    const orderItems = [];

    // Validate and process items
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ error: `Product not found: ${item.product}` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
      }

      // Deduct stock
      product.stock -= item.quantity;
      await product.save();

      orderItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price
      });
      
      totalAmount += product.price * item.quantity;
    }

    const order = new Order({
      items: orderItems,
      totalAmount,
      paymentMethod: paymentMethod || 'cash'
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error creating order' });
  }
});

export default router;
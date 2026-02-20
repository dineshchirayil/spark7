import { Router, Response } from 'express';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Generate order number
const generateOrderNumber = (): string => {
  const date = new Date();
  const timestamp = date.getTime();
  return `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${timestamp.toString().slice(-6)}`;
};

// Create order
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, paymentMethod, notes } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty',
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required',
      });
    }

    let totalAmount = 0;
    let totalGstAmount = 0;
    const orderItems = [];

    // Process items
    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product with ID ${item.productId} not found`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for product ${product.name}`,
        });
      }

      const itemPrice = product.price * item.quantity;
      const gstAmount = (itemPrice * product.gstRate) / 100;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: itemPrice,
        gstAmount,
      });

      totalAmount += itemPrice;
      totalGstAmount += gstAmount;
    }

    // Create order
    const order = new Order({
      orderNumber: generateOrderNumber(),
      userId: req.userId,
      items: orderItems,
      totalAmount,
      gstAmount: totalGstAmount,
      paymentMethod,
      notes,
    });

    await order.save();

    // Deduct from stock
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order',
    });
  }
});

// Get orders for current user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderStatus, paymentStatus, skip = 0, limit = 20 } = req.query;

    const filter: any = { userId: req.userId };
    if (orderStatus) filter.orderStatus = orderStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const orders = await Order.find(filter)
      .populate('items.productId', 'name sku price')
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        skip: Number(skip),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get orders',
    });
  }
});

// Get order by ID
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'email firstName lastName businessName')
      .populate('items.productId', 'name sku price');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view this order',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get order',
    });
  }
});

// Update order status
router.put('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderStatus, paymentStatus } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to update this order',
      });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error: any) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update order status',
    });
  }
});

export default router;

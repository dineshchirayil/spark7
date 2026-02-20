import { Router, Response } from 'express';
import { Inventory } from '../models/Inventory.js';
import { Product } from '../models/Product.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const toNumber = (value: any): number => Number(value || 0);

const buildInventoryRow = (product: any, inventoryDoc?: any) => ({
  _id: inventoryDoc?._id?.toString?.() || `product-${product._id.toString()}`,
  productId: {
    _id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    minStock: toNumber(product.minStock),
    unit: product.unit || 'piece',
    stock: toNumber(product.stock),
  },
  quantity: toNumber(product.stock),
  warehouseLocation: inventoryDoc?.warehouseLocation || 'Main Store',
  batchNumber: inventoryDoc?.batchNumber || '',
  lastRestockDate: inventoryDoc?.lastRestockDate || product.updatedAt || product.createdAt || new Date(),
});

const listInventoryRows = async (args: {
  skip?: number;
  limit?: number;
  includeInactive?: boolean;
  onlyLowStock?: boolean;
}) => {
  const skip = Math.max(0, Number(args.skip || 0));
  const limit = Math.max(1, Number(args.limit || 50));
  const includeInactive = Boolean(args.includeInactive);
  const onlyLowStock = Boolean(args.onlyLowStock);

  const filter: any = {};
  if (!includeInactive) filter.isActive = true;

  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const productIds = products.map((p) => p._id);
  const inventoryDocs = await Inventory.find({ productId: { $in: productIds } });
  const inventoryByProductId = new Map(
    inventoryDocs.map((doc: any) => [String(doc.productId), doc])
  );

  let rows = products.map((product: any) =>
    buildInventoryRow(product, inventoryByProductId.get(String(product._id)))
  );

  if (onlyLowStock) {
    rows = rows.filter((row: any) => Number(row.quantity || 0) <= Number(row.productId?.minStock || 0));
  }

  const total = await Product.countDocuments(filter);
  return { rows, total, skip, limit };
};

// Get inventory for all products (source of truth: Product.stock)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { skip = 0, limit = 1000, includeInactive = false } = req.query;
    const result = await listInventoryRows({
      skip: Number(skip),
      limit: Number(limit),
      includeInactive: String(includeInactive) === 'true',
      onlyLowStock: false,
    });

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total: result.total,
        skip: result.skip,
        limit: result.limit,
      },
    });
  } catch (error: any) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get inventory',
    });
  }
});

// Get low stock items
router.get('/status/low-stock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { skip = 0, limit = 1000, includeInactive = false } = req.query;
    const result = await listInventoryRows({
      skip: Number(skip),
      limit: Number(limit),
      includeInactive: String(includeInactive) === 'true',
      onlyLowStock: true,
    });

    res.status(200).json({
      success: true,
      message: `Found ${result.rows.length} low stock items`,
      data: result.rows,
      pagination: {
        total: result.rows.length,
        skip: result.skip,
        limit: result.limit,
      },
    });
  } catch (error: any) {
    console.error('Get low stock items error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get low stock items',
    });
  }
});

// Get inventory for specific product
router.get('/:productId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const inventoryDoc = await Inventory.findOne({ productId: req.params.productId });
    const row = buildInventoryRow(product, inventoryDoc || undefined);

    res.status(200).json({
      success: true,
      data: row,
    });
  } catch (error: any) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get inventory',
    });
  }
});

// Initialize inventory for product and sync Product.stock
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, quantity, warehouseLocation, batchNumber } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and quantity are required',
      });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a non-negative number',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    product.stock = qty;
    await product.save();

    const inventory = await Inventory.findOneAndUpdate(
      { productId },
      {
        productId,
        quantity: qty,
        ...(warehouseLocation !== undefined && { warehouseLocation }),
        ...(batchNumber !== undefined && { batchNumber }),
        lastRestockDate: new Date(),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      success: true,
      message: 'Inventory initialized successfully',
      data: buildInventoryRow(product, inventory),
    });
  } catch (error: any) {
    console.error('Create inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create inventory',
    });
  }
});

// Update inventory quantity and sync Product.stock
router.put('/:productId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { quantity, action = 'set', warehouseLocation, expiryDate, batchNumber } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Quantity is required',
      });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a non-negative number',
      });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const current = toNumber(product.stock);
    let next = current;
    const normalizedAction = String(action || 'set').toLowerCase();

    if (normalizedAction === 'add') {
      next = current + qty;
    } else if (normalizedAction === 'subtract') {
      if (current < qty) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient inventory',
        });
      }
      next = current - qty;
    } else {
      next = qty;
    }

    if (next < 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock cannot be negative',
      });
    }

    product.stock = next;
    await product.save();

    const inventory = await Inventory.findOneAndUpdate(
      { productId: req.params.productId },
      {
        productId: req.params.productId,
        quantity: next,
        ...(warehouseLocation !== undefined && { warehouseLocation }),
        ...(expiryDate !== undefined && { expiryDate }),
        ...(batchNumber !== undefined && { batchNumber }),
        lastRestockDate: new Date(),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      data: buildInventoryRow(product, inventory),
    });
  } catch (error: any) {
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update inventory',
    });
  }
});

export default router;

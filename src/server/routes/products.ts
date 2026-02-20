import { Router, Response } from 'express';
import { Product } from '../models/Product.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Get all products
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, isActive = true, skip = 0, limit = 20 } = req.query;

    const filter: any = { isActive: String(isActive) !== 'false' };
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        skip: Number(skip),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get products',
    });
  }
});

// Get product by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get product',
    });
  }
});

// Create product (requires authentication)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      sku,
      description,
      category,
      price,
      wholesalePrice,
      cost,
      gstRate,
      taxType,
      stock,
      minStock,
      unit,
      hsnCode,
      allowNegativeStock,
      batchTracking,
      expiryRequired,
      returnStock,
      damagedStock,
    } = req.body;

    // Validation
    if (!name || !sku || !category || price === undefined || cost === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, sku, category, price, cost',
      });
    }

    // Check if product with same SKU exists
    const existingProduct = await Product.findOne({ sku: sku.toUpperCase() });
    if (existingProduct) {
      return res.status(409).json({
        success: false,
        error: 'Product with this SKU already exists',
      });
    }

    const product = new Product({
      name,
      sku: sku.toUpperCase(),
      description,
      category,
      price,
      wholesalePrice: wholesalePrice || 0,
      cost,
      gstRate: gstRate || 18,
      taxType: taxType || 'gst',
      stock: stock || 0,
      returnStock: returnStock || 0,
      damagedStock: damagedStock || 0,
      minStock: minStock || 10,
      unit: unit || 'piece',
      hsnCode: hsnCode || '',
      allowNegativeStock: Boolean(allowNegativeStock),
      batchTracking: Boolean(batchTracking),
      expiryRequired: Boolean(expiryRequired),
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create product',
    });
  }
});

// Update product (requires authentication)
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      description,
      category,
      price,
      wholesalePrice,
      cost,
      gstRate,
      taxType,
      stock,
      returnStock,
      damagedStock,
      minStock,
      unit,
      isActive,
      hsnCode,
      allowNegativeStock,
      batchTracking,
      expiryRequired,
    } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(description && { description }),
        ...(category && { category }),
        ...(price !== undefined && { price }),
        ...(wholesalePrice !== undefined && { wholesalePrice }),
        ...(cost !== undefined && { cost }),
        ...(gstRate && { gstRate }),
        ...(taxType && { taxType }),
        ...(stock !== undefined && { stock }),
        ...(returnStock !== undefined && { returnStock }),
        ...(damagedStock !== undefined && { damagedStock }),
        ...(minStock !== undefined && { minStock }),
        ...(unit && { unit }),
        ...(isActive !== undefined && { isActive }),
        ...(hsnCode !== undefined && { hsnCode }),
        ...(allowNegativeStock !== undefined && { allowNegativeStock: Boolean(allowNegativeStock) }),
        ...(batchTracking !== undefined && { batchTracking: Boolean(batchTracking) }),
        ...(expiryRequired !== undefined && { expiryRequired: Boolean(expiryRequired) }),
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error: any) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update product',
    });
  }
});

// Delete product (requires authentication)
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: product,
    });
  } catch (error: any) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete product',
    });
  }
});

export default router;

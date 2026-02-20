import express from 'express';
import { Category } from '../models/Category.js';
import { authMiddleware as authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all active categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching categories' });
  }
});

// Create a new category
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const category = new Category({ name, description });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Error creating category' });
  }
});

export default router;

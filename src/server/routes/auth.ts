import { Router, Response } from 'express';
import { User } from '../models/User.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { AuthResponse, ErrorResponse } from '@shared/types';
import { getPermissionsForRole, normalizeRoleName, roleExists } from '../services/rbac.js';
import { writeAuditLog } from '../services/audit.js';

const router = Router();

// Register endpoint
router.post('/register', async (req: AuthenticatedRequest, res: Response<AuthResponse | ErrorResponse>) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, businessName, gstin } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, firstName, lastName',
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists with this email',
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    const usersCount = await User.countDocuments();
    const defaultRole = usersCount === 0 ? 'admin' : 'receptionist';
    const normalizedRole = normalizeRoleName(defaultRole);
    if (!(await roleExists(normalizedRole))) {
      return res.status(500).json({
        success: false,
        error: `Default role "${normalizedRole}" is not configured`,
      });
    }

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      businessName,
      gstin,
      role: normalizedRole,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id!.toString());
    const permissions = await getPermissionsForRole(user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

// Login endpoint
router.post('/login', async (req: AuthenticatedRequest, res: Response<AuthResponse | ErrorResponse>) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Validation
    if (!normalizedEmail || !password) {
      await writeAuditLog({
        module: 'auth',
        action: 'login_failed',
        entityType: 'session',
        metadata: {
          email: normalizedEmail || undefined,
          reason: 'missing_credentials',
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Find user with password field
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      await writeAuditLog({
        module: 'auth',
        action: 'login_failed',
        entityType: 'session',
        metadata: {
          email: normalizedEmail,
          reason: 'user_not_found',
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Compare password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      await writeAuditLog({
        module: 'auth',
        action: 'login_failed',
        entityType: 'session',
        userId: user._id.toString(),
        metadata: {
          email: normalizedEmail,
          reason: 'invalid_password',
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await writeAuditLog({
        module: 'auth',
        action: 'login_failed',
        entityType: 'session',
        userId: user._id.toString(),
        metadata: {
          email: normalizedEmail,
          reason: 'inactive_user',
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      return res.status(403).json({
        success: false,
        error: 'User account is inactive',
      });
    }

    // Generate token
    const token = generateToken(user._id!.toString());
    const permissions = await getPermissionsForRole(user.role);
    await writeAuditLog({
      module: 'auth',
      action: 'login',
      entityType: 'session',
      userId: user._id.toString(),
      metadata: {
        email: normalizedEmail,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        businessName: user.businessName,
        permissions,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
});

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const user = userId ? await User.findById(userId) : null;

    await writeAuditLog({
      module: 'auth',
      action: 'logout',
      entityType: 'session',
      userId: userId || undefined,
      metadata: {
        email: user?.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Logout failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const permissions = await getPermissionsForRole(user.role);

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      user: {
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        businessName: user.businessName,
        gstin: user.gstin,
        permissions,
      },
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user',
    });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { firstName, lastName, phoneNumber, businessName, gstin, address } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phoneNumber && { phoneNumber }),
        ...(businessName && { businessName }),
        ...(gstin && { gstin }),
        ...(address && { address }),
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessName: user.businessName,
        gstin: user.gstin,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile',
    });
  }
});

export default router;

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';
import { IUserDocument } from '../models/User.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: IUserDocument | null;
  userRole?: string;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const { userId } = verifyToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const { userId } = verifyToken(token);
      req.userId = userId;
    }
  } catch {
    // Optional auth, so we don't throw error
  }

  next();
};

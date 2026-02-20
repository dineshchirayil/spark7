import { NextFunction, Response } from 'express';
import { PageKey } from '@shared/rbac';
import { AuthenticatedRequest } from './auth.js';
import { User } from '../models/User.js';
import { canAccessPage } from '../services/rbac.js';

const loadRequestUser = async (req: AuthenticatedRequest) => {
  if (req.user) return req.user;
  if (!req.userId) return null;

  const user = await User.findById(req.userId);
  req.user = user;
  req.userRole = user?.role;
  return user;
};

export const requirePageAccess = (page: PageKey) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await loadRequestUser(req);

      if (!user || !user.isActive) {
        return res.status(403).json({ success: false, error: 'User is inactive or not found' });
      }

      const allowed = await canAccessPage(user.role, page);
      if (!allowed) {
        return res.status(403).json({ success: false, error: `Role "${user.role}" cannot access ${page}` });
      }

      next();
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Authorization failed' });
    }
  };
};

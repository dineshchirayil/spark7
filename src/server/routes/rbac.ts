import { Router, Response } from 'express';
import { PAGE_KEYS, PAGE_META, PageKey } from '../../shared/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createRole,
  deleteRole,
  listRolePermissions,
  normalizePermissions,
  normalizeRoleName,
  updateRolePermissions,
} from '../services/rbac.js';
import { User } from '../models/User.js';

const router = Router();

router.get('/pages', async (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: PAGE_KEYS.map((key) => ({
      key,
      title: PAGE_META[key].title,
      path: PAGE_META[key].path,
    })),
  });
});

router.get('/roles', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await listRolePermissions();
    res.json({ success: true, data: roles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load roles' });
  }
});

router.post('/roles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = String(req.body?.role || '');
    const permissions = req.body?.permissions;
    if (!role) {
      return res.status(400).json({ success: false, error: 'role is required' });
    }

    const created = await createRole(role, normalizePermissions(permissions));
    res.status(201).json({ success: true, data: created, message: 'Role created successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to create role' });
  }
});

router.put('/roles/:role/permissions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = normalizeRoleName(String(req.params.role || ''));
    const permissions = normalizePermissions(req.body?.permissions);
    const updated = await updateRolePermissions(role, permissions);
    res.json({ success: true, data: updated, message: 'Role permissions updated successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update role permissions' });
  }
});

router.delete('/roles/:role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = normalizeRoleName(String(req.params.role || ''));
    const roleInUse = await User.exists({ role });
    if (roleInUse) {
      return res.status(400).json({ success: false, error: 'Cannot delete role while users are assigned to it' });
    }
    await deleteRole(role);
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to delete role' });
  }
});

router.post('/roles/:role/clone', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sourceRole = normalizeRoleName(String(req.params.role || ''));
    const newRole = normalizeRoleName(String(req.body?.newRole || ''));
    if (!newRole) {
      return res.status(400).json({ success: false, error: 'newRole is required' });
    }

    const roles = await listRolePermissions();
    const source = roles.find((item) => item.role === sourceRole);
    if (!source) {
      return res.status(404).json({ success: false, error: 'Source role not found' });
    }

    const created = await createRole(newRole, source.permissions as Partial<Record<PageKey, boolean>>);
    res.status(201).json({ success: true, data: created, message: 'Role cloned successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to clone role' });
  }
});

export default router;

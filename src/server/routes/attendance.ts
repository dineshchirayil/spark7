import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Attendance } from '../models/Attendance.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';

const router = Router();

const toDateKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const parseDateInput = (value?: string): Date => {
  const source = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    const [year, month, day] = source.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = source ? new Date(source) : new Date();
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const isAdminRole = (role?: string): boolean => {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' || normalized === 'super_admin';
};

const loadRequestUser = async (req: AuthenticatedRequest) => {
  if (req.user) return req.user;
  if (!req.userId) return null;

  const user = await User.findById(req.userId);
  req.user = user;
  req.userRole = user?.role;
  return user;
};

router.post('/mark', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, date, status, checkIn, checkOut, overtimeHours, notes } = req.body;

    if (!employeeId || !status) {
      return res.status(400).json({ success: false, error: 'employeeId and status are required' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

    const requestUser = await loadRequestUser(req);
    const userIsAdmin = isAdminRole(requestUser?.role);
    const attendanceDate = parseDateInput(date);
    const dateKey = toDateKey(attendanceDate);
    const existingEntry = await Attendance.findOne({ employeeId, dateKey });

    const isLocked = Boolean(existingEntry && existingEntry.isLocked !== false);
    if (isLocked && !userIsAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Attendance for this employee and date is locked. Admin approval is required to edit.',
      });
    }

    const updateOps: Record<string, any> = {
      $set: {
        employeeId,
        date: attendanceDate,
        dateKey,
        status,
        checkIn,
        checkOut,
        overtimeHours: Number(overtimeHours || 0),
        notes,
        lastUpdatedBy: req.userId,
        isLocked: true,
        lockedAt: new Date(),
      },
      $unset: {
        unlockedAt: 1,
        unlockedBy: 1,
        unlockReason: 1,
      },
    };

    if (!existingEntry) {
      updateOps.$setOnInsert = {
        createdBy: req.userId,
      };
    }

    const entry = await Attendance.findOneAndUpdate(
      { employeeId, dateKey },
      updateOps,
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: entry,
      message: 'Attendance saved and locked. Admin approval is required for further edits.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save attendance' });
  }
});

router.get('/register', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await loadRequestUser(req);
    const date = parseDateInput(req.query.date as string);
    const dateKey = toDateKey(date);
    const userIsAdmin = isAdminRole(user?.role);

    const [employees, entries] = await Promise.all([
      Employee.find({ active: true }).sort({ name: 1 }),
      Attendance.find({ dateKey }).sort({ createdAt: 1 }),
    ]);

    const map = new Map(entries.map((e) => [String(e.employeeId), e]));

    const register = employees.map((emp) => ({
      employee: emp,
      attendance: map.get(String(emp._id)) || null,
      canUnlock: Boolean(map.get(String(emp._id)) && map.get(String(emp._id))?.isLocked !== false && userIsAdmin),
    }));

    res.json({ success: true, data: { date: dateKey, register } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load attendance register' });
  }
});

router.post('/unlock', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, date, reason } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ success: false, error: 'employeeId and date are required' });
    }

    const requestUser = await loadRequestUser(req);
    if (!isAdminRole(requestUser?.role)) {
      return res.status(403).json({ success: false, error: 'Only admin users can unlock attendance entries' });
    }

    const unlockDate = parseDateInput(date);
    const unlockDateKey = toDateKey(unlockDate);
    const entry = await Attendance.findOne({ employeeId, dateKey: unlockDateKey });

    if (!entry) {
      return res.status(404).json({ success: false, error: 'Attendance entry not found' });
    }

    entry.isLocked = false;
    entry.unlockedAt = new Date();
    entry.unlockedBy = req.userId;
    entry.unlockReason = reason ? String(reason).trim() : 'Approved for correction';
    entry.lastUpdatedBy = req.userId;
    await entry.save();

    res.json({ success: true, data: entry, message: 'Attendance unlocked for editing' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to unlock attendance' });
  }
});

router.get('/entries', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, month } = req.query;
    const filter: any = {};
    if (employeeId) filter.employeeId = employeeId;

    if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month as string)) {
      const [y, m] = (month as string).split('-').map(Number);
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0, 23, 59, 59, 999) };
    }

    const entries = await Attendance.find(filter).populate('employeeId', 'employeeCode name designation employmentType').sort({ date: -1 });
    res.json({ success: true, data: entries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load attendance entries' });
  }
});

export default router;

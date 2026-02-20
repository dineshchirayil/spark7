import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';

const router = Router();

router.get('/', authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await Employee.find().sort({ active: -1, name: 1 });
    res.json({ success: true, data: employees });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch employees' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      employeeCode,
      name,
      phone,
      email,
      designation,
      employmentType,
      monthlySalary,
      dailyRate,
      overtimeHourlyRate,
      paidLeave,
      active,
      joinDate,
    } = req.body;

    if (!employeeCode || !name || !employmentType) {
      return res.status(400).json({ success: false, error: 'employeeCode, name and employmentType are required' });
    }

    const existing = await Employee.findOne({ employeeCode: String(employeeCode).toUpperCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Employee code already exists' });
    }

    const employee = await Employee.create({
      employeeCode: String(employeeCode).toUpperCase(),
      name,
      phone,
      email,
      designation,
      employmentType,
      monthlySalary: Number(monthlySalary || 0),
      dailyRate: Number(dailyRate || 0),
      overtimeHourlyRate: Number(overtimeHourlyRate || 0),
      paidLeave: paidLeave !== undefined ? Boolean(paidLeave) : true,
      active: active !== undefined ? Boolean(active) : true,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      createdBy: req.userId,
    });

    res.status(201).json({ success: true, data: employee, message: 'Employee created' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create employee' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updates = { ...req.body };
    if (updates.employeeCode) updates.employeeCode = String(updates.employeeCode).toUpperCase();

    if (updates.employeeCode) {
      const duplicate = await Employee.findOne({
        employeeCode: updates.employeeCode,
        _id: { $ne: req.params.id as any },
      });
      if (duplicate) {
        return res.status(409).json({ success: false, error: 'Employee code already exists' });
      }
    }

    const employee = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

    res.json({ success: true, data: employee, message: 'Employee updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update employee' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

    res.json({ success: true, message: 'Employee deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to delete employee' });
  }
});

router.get('/:id/salary-summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, error: 'month must be YYYY-MM format' });
    }

    const [year, mon] = month.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(year, mon, 0).getDate();

    const attendance = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let payableDays = 0;
    let overtimeHours = 0;

    for (const record of attendance) {
      if (record.status === 'present') {
        presentDays += 1;
        payableDays += 1;
      } else if (record.status === 'half_day') {
        halfDays += 1;
        payableDays += 0.5;
      } else if (record.status === 'leave') {
        leaveDays += 1;
        payableDays += employee.paidLeave ? 1 : 0;
      } else {
        absentDays += 1;
      }

      overtimeHours += Number(record.overtimeHours || 0);
    }

    const monthlySalary = Number(employee.monthlySalary || 0);
    const dailyRate = Number(employee.dailyRate || 0);
    const overtimeRate = Number(employee.overtimeHourlyRate || 0);

    const basePay =
      employee.employmentType === 'salaried'
        ? (monthlySalary / Math.max(daysInMonth, 1)) * payableDays
        : dailyRate * payableDays;

    const overtimePay = overtimeHours * overtimeRate;
    const totalPayable = basePay + overtimePay;

    res.json({
      success: true,
      data: {
        employee,
        month,
        attendance: {
          totalMarkedDays: attendance.length,
          presentDays,
          halfDays,
          leaveDays,
          absentDays,
          payableDays,
          overtimeHours,
        },
        salary: {
          employmentType: employee.employmentType,
          monthlySalary,
          dailyRate,
          overtimeRate,
          basePay,
          overtimePay,
          totalPayable,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to compute salary summary' });
  }
});

export default router;

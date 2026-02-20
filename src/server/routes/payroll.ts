import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { ShiftSchedule } from '../models/ShiftSchedule.js';

const router = Router();

interface PayrollRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  employmentType: string;
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDays: number;
  weeklyOffDays: number;
  payableDays: number;
  overtimeHours: number;
  basePay: number;
  overtimePay: number;
  totalPayable: number;
}

const monthRange = (month: string) => {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: new Date(year, mon - 1, 1),
    end: new Date(year, mon, 0, 23, 59, 59, 999),
    daysInMonth: new Date(year, mon, 0).getDate(),
  };
};

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const generatePayroll = async (month: string): Promise<PayrollRow[]> => {
  const { start, end, daysInMonth } = monthRange(month);

  const [employees, attendance, shifts] = await Promise.all([
    Employee.find({ active: true }).sort({ employeeCode: 1 }),
    Attendance.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }),
    ShiftSchedule.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }),
  ]);

  const attendanceMap = new Map<string, any>();
  for (const a of attendance) {
    attendanceMap.set(`${String(a.employeeId)}_${a.dateKey}`, a);
  }

  const shiftMap = new Map<string, any>();
  for (const s of shifts) {
    shiftMap.set(`${String(s.employeeId)}_${s.dateKey}`, s);
  }

  const rows: PayrollRow[] = [];

  for (const emp of employees) {
    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let weeklyOffDays = 0;
    let payableDays = 0;
    let overtimeHours = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), day);
      const dKey = dateKey(d);

      const attendanceRec = attendanceMap.get(`${String(emp._id)}_${dKey}`);
      const shiftRec = shiftMap.get(`${String(emp._id)}_${dKey}`);

      if (attendanceRec) {
        if (attendanceRec.status === 'present') {
          presentDays += 1;
          payableDays += 1;
        } else if (attendanceRec.status === 'half_day') {
          halfDays += 1;
          payableDays += 0.5;
        } else if (attendanceRec.status === 'leave') {
          leaveDays += 1;
          if (emp.paidLeave) payableDays += 1;
        } else {
          absentDays += 1;
        }

        overtimeHours += Number(attendanceRec.overtimeHours || 0);
      } else if (shiftRec?.isWeeklyOff) {
        weeklyOffDays += 1;
        if (emp.employmentType === 'salaried') {
          payableDays += 1;
        }
      } else {
        absentDays += 1;
      }
    }

    const monthlySalary = Number(emp.monthlySalary || 0);
    const dailyRate = Number(emp.dailyRate || 0);
    const overtimeRate = Number(emp.overtimeHourlyRate || 0);

    const basePay =
      emp.employmentType === 'salaried'
        ? (monthlySalary / Math.max(daysInMonth, 1)) * payableDays
        : dailyRate * payableDays;

    const overtimePay = overtimeHours * overtimeRate;
    const totalPayable = +(basePay + overtimePay).toFixed(2);

    rows.push({
      employeeId: String(emp._id),
      employeeCode: emp.employeeCode,
      name: emp.name,
      employmentType: emp.employmentType,
      presentDays,
      halfDays,
      leaveDays,
      absentDays,
      weeklyOffDays,
      payableDays,
      overtimeHours,
      basePay: +basePay.toFixed(2),
      overtimePay: +overtimePay.toFixed(2),
      totalPayable,
    });
  }

  return rows;
};

router.get('/generate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, error: 'month must be YYYY-MM format' });
    }

    const rows = await generatePayroll(month);
    const totalPayout = rows.reduce((sum, row) => sum + row.totalPayable, 0);

    res.json({
      success: true,
      data: {
        month,
        totalEmployees: rows.length,
        totalPayout: +totalPayout.toFixed(2),
        rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate payroll' });
  }
});

router.get('/export/csv', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, error: 'month must be YYYY-MM format' });
    }

    const rows = await generatePayroll(month);

    const headers = [
      'Employee Code',
      'Name',
      'Type',
      'Present',
      'Half Day',
      'Leave',
      'Absent',
      'Weekly Off',
      'Payable Days',
      'OT Hours',
      'Base Pay',
      'OT Pay',
      'Total Payable',
    ];

    const csvRows = rows.map((r) => [
      r.employeeCode,
      r.name,
      r.employmentType,
      r.presentDays,
      r.halfDays,
      r.leaveDays,
      r.absentDays,
      r.weeklyOffDays,
      r.payableDays,
      r.overtimeHours,
      r.basePay,
      r.overtimePay,
      r.totalPayable,
    ]);

    const csv = [
      headers.join(','),
      ...csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=payroll_${month}.csv`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to export payroll CSV' });
  }
});

export default router;

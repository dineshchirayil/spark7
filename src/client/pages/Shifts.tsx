import React, { useEffect, useMemo, useState } from 'react';
import { apiUrl, fetchApiJson } from '../utils/api';

interface Employee {
  _id: string;
  employeeCode: string;
  name: string;
}

interface ShiftRecord {
  _id: string;
  shiftName: string;
  startTime?: string;
  endTime?: string;
  isWeeklyOff: boolean;
  notes?: string;
}

interface RegisterRow {
  employee: Employee;
  shift: ShiftRecord | null;
}

const SHIFT_OPTIONS = ['General', 'Morning', 'Evening', 'Night'];

export const Shifts: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = useMemo(() => {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, []);

  const loadRegister = async () => {
    setError('');
    try {
      const data = await fetchApiJson(apiUrl(`/api/shifts/register?date=${date}`), { headers });
      setRows(data.data?.register || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load shift register');
    }
  };

  useEffect(() => {
    loadRegister();
  }, [date]);

  const saveShift = async (employeeId: string, payload: any) => {
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl('/api/shifts/assign'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ employeeId, date, ...payload }),
      });
      setMessage('Shift updated');
      await loadRegister();
    } catch (e: any) {
      setError(e.message || 'Failed to save shift');
    }
  };

  const inputClass = 'w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white';

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Shift Scheduling</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-300">Date</label>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {message && <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      {error && <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
        <table className="min-w-full divide-y divide-white/10">
          <thead>
            <tr>
              {['Code', 'Employee', 'Shift', 'Start', 'End', 'Weekly Off', 'Notes', 'Action'].map((header) => (
                <th key={header} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => (
              <ShiftRow
                key={row.employee._id}
                row={row}
                inputClass={inputClass}
                onSave={(payload) => saveShift(row.employee._id, payload)}
              />
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-3 text-center text-sm text-gray-400">No active employees found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ShiftRow: React.FC<{
  row: RegisterRow;
  inputClass: string;
  onSave: (payload: any) => void;
}> = ({ row, inputClass, onSave }) => {
  const [local, setLocal] = useState({
    shiftName: row.shift?.shiftName || 'General',
    startTime: row.shift?.startTime || '',
    endTime: row.shift?.endTime || '',
    isWeeklyOff: Boolean(row.shift?.isWeeklyOff),
    notes: row.shift?.notes || '',
  });

  useEffect(() => {
    setLocal({
      shiftName: row.shift?.shiftName || 'General',
      startTime: row.shift?.startTime || '',
      endTime: row.shift?.endTime || '',
      isWeeklyOff: Boolean(row.shift?.isWeeklyOff),
      notes: row.shift?.notes || '',
    });
  }, [row.shift?._id, row.shift?.shiftName, row.shift?.startTime, row.shift?.endTime, row.shift?.isWeeklyOff, row.shift?.notes]);

  return (
    <tr>
      <td className="px-2 py-2 text-sm text-gray-300">{row.employee.employeeCode}</td>
      <td className="px-2 py-2 text-sm text-white">{row.employee.name}</td>
      <td className="px-2 py-2">
        <select className={inputClass} value={local.shiftName} onChange={(e) => setLocal({ ...local, shiftName: e.target.value })}>
          {SHIFT_OPTIONS.map((shift) => (
            <option key={shift} value={shift}>{shift}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2"><input className={inputClass} placeholder="09:00" value={local.startTime} onChange={(e) => setLocal({ ...local, startTime: e.target.value })} /></td>
      <td className="px-2 py-2"><input className={inputClass} placeholder="18:00" value={local.endTime} onChange={(e) => setLocal({ ...local, endTime: e.target.value })} /></td>
      <td className="px-2 py-2">
        <label className="flex items-center justify-center">
          <input type="checkbox" checked={local.isWeeklyOff} onChange={(e) => setLocal({ ...local, isWeeklyOff: e.target.checked })} />
        </label>
      </td>
      <td className="px-2 py-2"><input className={inputClass} placeholder="Optional" value={local.notes} onChange={(e) => setLocal({ ...local, notes: e.target.value })} /></td>
      <td className="px-2 py-2">
        <button
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
          onClick={() => onSave(local)}
        >
          Save
        </button>
      </td>
    </tr>
  );
};

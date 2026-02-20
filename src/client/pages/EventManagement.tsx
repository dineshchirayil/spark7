import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../config';
import { apiUrl, fetchApiJson } from '../utils/api';

interface Facility {
  _id: string;
  name: string;
  location?: string;
  hourlyRate: number;
  active: boolean;
}

interface EventBooking {
  _id: string;
  eventNumber?: string;
  eventName: string;
  organizerName: string;
  organizationName?: string;
  contactPhone?: string;
  contactEmail?: string;
  facilityIds: Array<{ _id: string; name: string; location?: string; hourlyRate?: number }>;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  totalAmount: number;
  advanceAmount: number;
  paidAmount: number;
  balanceAmount: number;
  remarks?: string;
  refundAmount?: number;
  cancellationReason?: string;
}

const toDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addHour = (time: string): string => {
  const [hours, minutes] = String(time || '10:00').split(':').map(Number);
  const date = new Date(2000, 0, 1, hours || 0, minutes || 0, 0, 0);
  date.setHours(date.getHours() + 1);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const toIsoDateTime = (dateValue: string, timeValue: string): string => {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const [hours, minutes] = String(timeValue).split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0).toISOString();
};

const displayDateTime = (isoValue: string): string =>
  new Date(isoValue).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const startOfMonth = (monthValue: string): Date => {
  const [year, month] = String(monthValue).split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1, 0, 0, 0, 0);
};

const endOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

const calendarCells = (monthDate: Date): Array<{ key: string; date: Date; inMonth: boolean }> => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startPadding = first.getDay();
  const cells: Array<{ key: string; date: Date; inMonth: boolean }> = [];
  for (let i = startPadding; i > 0; i -= 1) {
    const d = new Date(first);
    d.setDate(first.getDate() - i);
    cells.push({ key: `${d.toISOString()}_p`, date: d, inMonth: false });
  }
  const lastDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= lastDate; day += 1) {
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    cells.push({ key: `${d.toISOString()}_m`, date: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    cells.push({ key: `${d.toISOString()}_n`, date: d, inMonth: false });
  }
  return cells;
};

export const EventManagement: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(toDateInput(new Date()).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    eventName: '',
    organizerName: '',
    organizationName: '',
    contactPhone: '',
    contactEmail: '',
    facilityIds: [] as string[],
    eventDate: toDateInput(new Date()),
    startTime: '10:00',
    endTime: '11:00',
    status: 'pending',
    totalAmount: '',
    advanceAmount: '',
    remarks: '',
  });

  const headers = useMemo(() => {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, []);

  const monthDate = useMemo(() => startOfMonth(selectedMonth), [selectedMonth]);
  const grid = useMemo(() => calendarCells(monthDate), [monthDate]);
  const activeFacilities = useMemo(() => facilities.filter((f) => f.active), [facilities]);

  const durationHours = useMemo(() => {
    const [sh, sm] = form.startTime.split(':').map(Number);
    const [eh, em] = form.endTime.split(':').map(Number);
    const start = new Date(2000, 0, 1, sh || 0, sm || 0, 0, 0);
    const end = new Date(2000, 0, 1, eh || 0, em || 0, 0, 0);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diff > 0 ? diff : 0;
  }, [form.endTime, form.startTime]);

  const autoTotalAmount = useMemo(() => {
    const selectedFacilities = activeFacilities.filter((facility) => form.facilityIds.includes(facility._id));
    const hourlyTotal = selectedFacilities.reduce((sum, facility) => sum + Number(facility.hourlyRate || 0), 0);
    return Number((hourlyTotal * durationHours).toFixed(2));
  }, [activeFacilities, durationHours, form.facilityIds]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(start);
      const query = new URLSearchParams({
        startDate: toDateInput(start),
        endDate: toDateInput(end),
      });
      const [facilityRes, eventRes] = await Promise.all([
        fetchApiJson(apiUrl('/api/facilities'), { headers }),
        fetchApiJson(apiUrl(`/api/events/bookings/list?${query.toString()}`), { headers }),
      ]);
      setFacilities(Array.isArray(facilityRes?.data) ? facilityRes.data : []);
      setBookings(Array.isArray(eventRes?.data) ? eventRes.data : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedMonth]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, eventDate: selectedDate }));
  }, [selectedDate]);

  const toggleFacility = (facilityId: string) => {
    setForm((prev) => {
      const exists = prev.facilityIds.includes(facilityId);
      return {
        ...prev,
        facilityIds: exists
          ? prev.facilityIds.filter((id) => id !== facilityId)
          : [...prev.facilityIds, facilityId],
      };
    });
  };

  const createEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (!form.eventName.trim() || !form.organizerName.trim()) {
        setError('Event name and organizer are required');
        return;
      }
      if (form.facilityIds.length === 0) {
        setError('Select at least one facility');
        return;
      }

      const startIso = toIsoDateTime(form.eventDate, form.startTime);
      const endIso = toIsoDateTime(form.eventDate, form.endTime);
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        setError('End time must be greater than start time');
        return;
      }

      await fetchApiJson(apiUrl('/api/events/bookings'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          eventName: form.eventName,
          organizerName: form.organizerName,
          organizationName: form.organizationName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          facilityIds: form.facilityIds,
          startTime: startIso,
          endTime: endIso,
          status: form.status,
          totalAmount: form.totalAmount ? Number(form.totalAmount) : autoTotalAmount,
          advanceAmount: form.advanceAmount ? Number(form.advanceAmount) : 0,
          paidAmount: form.advanceAmount ? Number(form.advanceAmount) : 0,
          remarks: form.remarks,
        }),
      });

      setMessage('Event booking created successfully');
      setForm((prev) => ({
        ...prev,
        eventName: '',
        organizerName: '',
        organizationName: '',
        contactPhone: '',
        contactEmail: '',
        facilityIds: [],
        startTime: '10:00',
        endTime: '11:00',
        totalAmount: '',
        advanceAmount: '',
        remarks: '',
      }));
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to create event booking');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl(`/api/events/bookings/${id}/status`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });
      setMessage('Event status updated');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to update event status');
    }
  };

  const addPayment = async (id: string) => {
    const amount = Number(paymentDrafts[id] || 0);
    if (amount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl(`/api/events/bookings/${id}/payments`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount }),
      });
      setPaymentDrafts((prev) => ({ ...prev, [id]: '' }));
      setMessage('Payment recorded');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to record payment');
    }
  };

  const cancelEvent = async (id: string) => {
    const reason = window.prompt('Cancellation reason', 'Organizer cancelled event') || 'Organizer cancelled event';
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl(`/api/events/bookings/${id}/cancel`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ cancellationReason: reason }),
      });
      setMessage('Event cancelled and refund tracked');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to cancel event');
    }
  };

  const rescheduleEvent = async (booking: EventBooking) => {
    const nextDate = window.prompt('Enter new date (YYYY-MM-DD)', toDateInput(new Date(booking.startTime)));
    if (!nextDate) return;
    const nextStart = window.prompt('Enter new start time (HH:MM)', new Date(booking.startTime).toTimeString().slice(0, 5));
    if (!nextStart) return;
    const nextEnd = window.prompt('Enter new end time (HH:MM)', new Date(booking.endTime).toTimeString().slice(0, 5));
    if (!nextEnd) return;
    const reason = window.prompt('Reason (optional)', 'Organizer requested change') || '';

    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl(`/api/events/bookings/${booking._id}/reschedule`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          facilityIds: booking.facilityIds.map((facility) => facility._id),
          startTime: toIsoDateTime(nextDate, nextStart),
          endTime: toIsoDateTime(nextDate, nextEnd),
          reason,
        }),
      });
      setMessage('Event rescheduled');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to reschedule event');
    }
  };

  const printReceipt = async (id: string) => {
    setError('');
    try {
      const response = await fetchApiJson(apiUrl(`/api/events/bookings/${id}/receipt`), { headers });
      const data = response?.data;
      if (!data) {
        setError('Receipt data not available');
        return;
      }
      const facilitiesList = Array.isArray(data.facilities)
        ? data.facilities.map((f: any) => `${f.name}${f.location ? ` (${f.location})` : ''}`).join(', ')
        : '-';
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Event Receipt</title>
      <style>body{font-family:Arial,sans-serif;padding:16px;color:#111}.box{border:1px solid #ccc;border-radius:8px;padding:12px}.row{display:flex;justify-content:space-between;margin:6px 0}.label{color:#444}</style></head>
      <body><h1>Event Booking Confirmation</h1><div class="box">
      <div class="row"><span class="label">Receipt No</span><strong>${data.receiptNumber || '-'}</strong></div>
      <div class="row"><span class="label">Event</span><strong>${data.eventName || '-'}</strong></div>
      <div class="row"><span class="label">Organizer</span><strong>${data.organizerName || '-'}</strong></div>
      <div class="row"><span class="label">Organization</span><strong>${data.organizationName || '-'}</strong></div>
      <div class="row"><span class="label">Facilities</span><strong>${facilitiesList}</strong></div>
      <div class="row"><span class="label">Slot</span><strong>${displayDateTime(data.startTime)} - ${displayDateTime(data.endTime)}</strong></div>
      <div class="row"><span class="label">Total</span><strong>${formatCurrency(Number(data.totalAmount || 0))}</strong></div>
      <div class="row"><span class="label">Advance</span><strong>${formatCurrency(Number(data.advanceAmount || 0))}</strong></div>
      <div class="row"><span class="label">Paid</span><strong>${formatCurrency(Number(data.paidAmount || 0))}</strong></div>
      <div class="row"><span class="label">Balance</span><strong>${formatCurrency(Number(data.balanceAmount || 0))}</strong></div>
      </div><script>window.print();</script></body></html>`;
      const pop = window.open('', '_blank', 'width=900,height=700');
      if (!pop) {
        setError('Unable to open print window');
        return;
      }
      pop.document.write(html);
      pop.document.close();
    } catch (e: any) {
      setError(e.message || 'Failed to print receipt');
    }
  };

  const bookingsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((booking) => {
      const key = toDateInput(new Date(booking.startTime));
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const selectedDateBookings = useMemo(() => {
    const start = new Date(`${selectedDate}T00:00:00`);
    const end = new Date(`${selectedDate}T23:59:59`);
    return bookings
      .filter((booking) => {
        const d = new Date(booking.startTime);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [bookings, selectedDate]);

  const inputClass = 'w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white';

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Event Booking (Corporate / Organizers)</h1>
          <p className="text-sm text-gray-300">Single event can reserve multiple facilities with payment milestones and receipt.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Month</label>
          <input type="month" className={inputClass} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
        </div>
      </div>

      {message && <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      {error && <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
      {loading && <p className="text-sm text-gray-400">Loading...</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-white">Event Calendar</h2>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-300">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="rounded bg-white/5 px-2 py-2">{day}</div>
            ))}
            {grid.map((cell) => {
              const key = toDateInput(cell.date);
              const count = bookingsByDate[key] || 0;
              const selected = key === selectedDate;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={`rounded border px-2 py-2 text-left ${
                    selected
                      ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                      : cell.inMonth
                        ? 'border-white/10 bg-black/10 text-gray-200 hover:bg-white/10'
                        : 'border-white/5 bg-black/20 text-gray-500'
                  }`}
                >
                  <p className="text-xs">{cell.date.getDate()}</p>
                  <p className="mt-1 text-[10px]">{count ? `${count} event${count > 1 ? 's' : ''}` : 'No events'}</p>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={createEvent} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Create Event</h2>
          <input className={inputClass} placeholder="Event Name" required value={form.eventName} onChange={(e) => setForm((prev) => ({ ...prev, eventName: e.target.value }))} />
          <input className={inputClass} placeholder="Organizer Name" required value={form.organizerName} onChange={(e) => setForm((prev) => ({ ...prev, organizerName: e.target.value }))} />
          <input className={inputClass} placeholder="Organization (optional)" value={form.organizationName} onChange={(e) => setForm((prev) => ({ ...prev, organizationName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} placeholder="Phone" value={form.contactPhone} onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))} />
            <input className={inputClass} placeholder="Email" value={form.contactEmail} onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))} />
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-xs text-gray-300">Select multiple facilities for this event</p>
            <div className="grid grid-cols-1 gap-1">
              {activeFacilities.map((facility) => (
                <label key={facility._id} className="flex items-center gap-2 text-xs text-gray-200">
                  <input type="checkbox" checked={form.facilityIds.includes(facility._id)} onChange={() => toggleFacility(facility._id)} />
                  {facility.name} ({formatCurrency(Number(facility.hourlyRate || 0))}/hr)
                </label>
              ))}
            </div>
          </div>
          <input className={inputClass} type="date" value={form.eventDate} onChange={(e) => setForm((prev) => ({ ...prev, eventDate: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} type="time" value={form.startTime} onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value, endTime: addHour(e.target.value) }))} />
            <input className={inputClass} type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className={inputClass} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
            </select>
            <input className={inputClass} type="number" min="0" step="0.01" placeholder={`Total (Auto ${formatCurrency(autoTotalAmount)})`} value={form.totalAmount} onChange={(e) => setForm((prev) => ({ ...prev, totalAmount: e.target.value }))} />
          </div>
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Advance Payment" value={form.advanceAmount} onChange={(e) => setForm((prev) => ({ ...prev, advanceAmount: e.target.value }))} />
          <textarea className={`${inputClass} min-h-[70px]`} placeholder="Remarks" value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} />
          <div className="rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            Estimated total: <span className="font-semibold text-emerald-300">{formatCurrency(form.totalAmount ? Number(form.totalAmount) : autoTotalAmount)}</span>
          </div>
          <button className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400">Create Event Booking</button>
        </form>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Events on {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN')}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Event No', 'Event', 'Organizer', 'Facilities', 'Slot', 'Amount', 'Payment', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {selectedDateBookings.map((booking) => (
                <tr key={booking._id}>
                  <td className="px-2 py-2 text-xs text-indigo-200">{booking.eventNumber || booking._id.slice(-6)}</td>
                  <td className="px-2 py-2 text-xs text-gray-200">
                    <p className="text-sm text-white">{booking.eventName}</p>
                    <p>{booking.organizationName || '-'}</p>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-300">
                    <p>{booking.organizerName}</p>
                    <p>{booking.contactPhone || '-'}</p>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-300">{booking.facilityIds.map((facility) => facility.name).join(', ')}</td>
                  <td className="px-2 py-2 text-xs text-gray-300">
                    <p>{displayDateTime(booking.startTime)}</p>
                    <p>{displayDateTime(booking.endTime)}</p>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-300">
                    <p>Total: {formatCurrency(Number(booking.totalAmount || 0))}</p>
                    <p>Paid: <span className="text-emerald-300">{formatCurrency(Number(booking.paidAmount || 0))}</span></p>
                    <p>Balance: <span className="text-amber-300">{formatCurrency(Number(booking.balanceAmount || 0))}</span></p>
                    {Number(booking.refundAmount || 0) > 0 && <p>Refund: <span className="text-rose-300">{formatCurrency(Number(booking.refundAmount || 0))}</span></p>}
                  </td>
                  <td className="px-2 py-2 text-xs uppercase text-gray-300">{booking.paymentStatus}</td>
                  <td className="px-2 py-2 text-xs uppercase text-gray-300">{booking.status}</td>
                  <td className="px-2 py-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {booking.status === 'pending' && <button onClick={() => updateStatus(booking._id, 'confirmed')} className="rounded bg-indigo-500/20 px-2 py-1 text-indigo-200">Confirm</button>}
                        {['pending', 'confirmed'].includes(booking.status) && <button onClick={() => updateStatus(booking._id, 'completed')} className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-200">Complete</button>}
                        {booking.status !== 'cancelled' && <button onClick={() => cancelEvent(booking._id)} className="rounded bg-rose-500/20 px-2 py-1 text-rose-200">Cancel</button>}
                        {['pending', 'confirmed'].includes(booking.status) && <button onClick={() => rescheduleEvent(booking)} className="rounded bg-amber-500/20 px-2 py-1 text-amber-200">Reschedule</button>}
                        <button onClick={() => printReceipt(booking._id)} className="rounded bg-cyan-500/20 px-2 py-1 text-cyan-200">Receipt</button>
                      </div>
                      {booking.status !== 'cancelled' && Number(booking.balanceAmount || 0) > 0 && (
                        <div className="flex gap-1">
                          <input
                            className="w-24 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Pay"
                            value={paymentDrafts[booking._id] || ''}
                            onChange={(e) => setPaymentDrafts((prev) => ({ ...prev, [booking._id]: e.target.value }))}
                          />
                          <button onClick={() => addPayment(booking._id)} className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-200">Collect</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!selectedDateBookings.length && (
                <tr><td colSpan={9} className="px-2 py-3 text-center text-sm text-gray-400">No events on selected date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


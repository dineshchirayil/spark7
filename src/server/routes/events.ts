import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { EventBooking } from '../models/EventBooking.js';
import { Facility } from '../models/Facility.js';
import { FacilityBooking } from '../models/FacilityBooking.js';
import { generateNumber } from '../services/numbering.js';

const router = Router();
const ACTIVE_EVENT_STATUSES = ['pending', 'confirmed'] as const;
const ACTIVE_FACILITY_STATUSES = ['pending', 'confirmed', 'booked'] as const;

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const derivePaymentStatus = (paidAmount: number, totalAmount: number, refunded = false) => {
  if (refunded) return 'refunded';
  if (totalAmount <= 0) return 'paid';
  if (paidAmount <= 0) return 'pending';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
};

const applyCancellationRules = (startTime: Date, totalAmount: number, paidAmount: number) => {
  const diffHours = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  let chargePct = 0;
  if (diffHours < 2) chargePct = 100;
  else if (diffHours < 24) chargePct = 50;

  const cancellationCharge = round2((totalAmount * chargePct) / 100);
  const refundAmount = round2(Math.max(0, paidAmount - cancellationCharge));
  return { cancellationCharge, refundAmount };
};

const ensureNoBookingConflict = async (
  facilityIds: string[],
  startTime: Date,
  endTime: Date,
  excludeEventId?: string
) => {
  const facilityConflict = await FacilityBooking.findOne({
    facilityId: { $in: facilityIds },
    status: { $in: ACTIVE_FACILITY_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  }).populate('facilityId', 'name');

  if (facilityConflict) {
    const facilityName = (facilityConflict.facilityId as any)?.name || 'facility';
    throw new Error(`Conflict found: ${facilityName} already has a facility booking in selected time range`);
  }

  const eventConflictFilter: any = {
    facilityIds: { $in: facilityIds },
    status: { $in: ACTIVE_EVENT_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeEventId) {
    eventConflictFilter._id = { $ne: excludeEventId };
  }

  const eventConflict = await EventBooking.findOne(eventConflictFilter).populate('facilityIds', 'name');
  if (eventConflict) {
    throw new Error('Conflict found: selected facility is already reserved in another event');
  }
};

router.get('/bookings/list', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, startDate, endDate, facilityId, status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (facilityId) filter.facilityIds = { $in: [facilityId] };

    const rangeStart = startDate || date;
    if (rangeStart) {
      const start = new Date(rangeStart as string);
      start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate as string) : new Date(start);
      end.setHours(23, 59, 59, 999);
      filter.startTime = { $lte: end };
      filter.endTime = { $gte: start };
    }

    const rows = await EventBooking.find(filter)
      .populate('facilityIds', 'name location hourlyRate')
      .sort({ startTime: 1 });

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch events' });
  }
});

router.post('/bookings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      eventName,
      organizerName,
      organizationName,
      contactPhone,
      contactEmail,
      facilityIds,
      startTime,
      endTime,
      status = 'pending',
      totalAmount,
      advanceAmount,
      paidAmount,
      remarks,
      reminderAt,
    } = req.body;

    const selectedFacilities = Array.isArray(facilityIds) ? facilityIds.map((id) => String(id)) : [];
    if (!eventName || !organizerName || selectedFacilities.length === 0 || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'eventName, organizerName, facilityIds, startTime and endTime are required',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      return res.status(400).json({ success: false, error: 'endTime must be greater than startTime' });
    }

    const facilities = await Facility.find({ _id: { $in: selectedFacilities }, active: true });
    if (facilities.length !== selectedFacilities.length) {
      return res.status(400).json({ success: false, error: 'One or more selected facilities are invalid/inactive' });
    }

    await ensureNoBookingConflict(selectedFacilities, start, end);

    const hours = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60), 0);
    const autoTotal = round2(
      facilities.reduce((sum, facility) => sum + Number(facility.hourlyRate || 0) * hours, 0)
    );
    const finalTotal = Math.max(0, Number(totalAmount !== undefined ? totalAmount : autoTotal));
    const finalAdvance = Math.max(0, Number(advanceAmount || 0));
    const finalPaid = Math.min(finalTotal, Math.max(finalAdvance, Number(paidAmount ?? finalAdvance)));
    const finalBalance = round2(Math.max(0, finalTotal - finalPaid));
    const eventNumber = await generateNumber('corporate_event_booking_number', {
      prefix: 'EVT-',
      datePart: true,
      padTo: 5,
    });

    const row = await EventBooking.create({
      eventNumber,
      eventName,
      organizerName,
      organizationName,
      contactPhone,
      contactEmail,
      facilityIds: selectedFacilities,
      startTime: start,
      endTime: end,
      status,
      paymentStatus: derivePaymentStatus(finalPaid, finalTotal),
      totalAmount: finalTotal,
      advanceAmount: finalAdvance,
      paidAmount: finalPaid,
      balanceAmount: finalBalance,
      remarks,
      reminderAt: reminderAt ? new Date(reminderAt) : new Date(start.getTime() - 24 * 60 * 60 * 1000),
      createdBy: req.userId,
    });

    const created = await EventBooking.findById(row._id).populate('facilityIds', 'name location hourlyRate');
    res.status(201).json({ success: true, data: created, message: 'Event booking created' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create event booking' });
  }
});

router.put('/bookings/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await EventBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Event booking not found' });

    const { status, remarks } = req.body;
    if (status) booking.status = String(status).toLowerCase() as any;
    if (remarks !== undefined) booking.remarks = String(remarks || '').trim();
    await booking.save();

    const updated = await EventBooking.findById(booking._id).populate('facilityIds', 'name location hourlyRate');
    res.json({ success: true, data: updated, message: 'Event status updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update event status' });
  }
});

router.post('/bookings/:id/payments', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const amount = Number(req.body?.amount || 0);
    if (amount <= 0) return res.status(400).json({ success: false, error: 'amount must be greater than zero' });

    const booking = await EventBooking.findById(req.params.id).populate('facilityIds', 'name location hourlyRate');
    if (!booking) return res.status(404).json({ success: false, error: 'Event booking not found' });
    if (String(booking.status) === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Cancelled event cannot accept payments' });
    }

    booking.paidAmount = round2(Math.min(Number(booking.totalAmount || 0), Number(booking.paidAmount || 0) + amount));
    booking.balanceAmount = round2(Math.max(0, Number(booking.totalAmount || 0) - Number(booking.paidAmount || 0)));
    booking.paymentStatus = derivePaymentStatus(Number(booking.paidAmount || 0), Number(booking.totalAmount || 0)) as any;
    if (String(booking.status) === 'pending' && booking.paidAmount > 0) {
      booking.status = 'confirmed' as any;
    }
    await booking.save();

    res.json({ success: true, data: booking, message: 'Event payment recorded' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to record event payment' });
  }
});

router.put('/bookings/:id/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await EventBooking.findById(req.params.id).populate('facilityIds', 'name location hourlyRate');
    if (!booking) return res.status(404).json({ success: false, error: 'Event booking not found' });
    if (String(booking.status) === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Event already cancelled' });
    }

    const { cancellationReason, remarks } = req.body;
    const { cancellationCharge, refundAmount } = applyCancellationRules(
      new Date(booking.startTime),
      Number(booking.totalAmount || 0),
      Number(booking.paidAmount || 0)
    );

    booking.status = 'cancelled' as any;
    booking.cancelledAt = new Date();
    booking.cancellationReason = String(cancellationReason || '').trim() || 'Cancelled by user';
    booking.cancellationCharge = cancellationCharge;
    booking.refundAmount = refundAmount;
    booking.balanceAmount = 0;
    booking.paymentStatus = refundAmount > 0 ? ('refunded' as any) : derivePaymentStatus(Number(booking.paidAmount || 0), Number(booking.totalAmount || 0));
    if (remarks !== undefined) booking.remarks = String(remarks || '').trim();
    await booking.save();

    res.json({ success: true, data: booking, message: 'Event cancelled and refund tracked' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to cancel event booking' });
  }
});

router.put('/bookings/:id/reschedule', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startTime, endTime, facilityIds, reason } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'startTime and endTime are required' });
    }

    const booking = await EventBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Event booking not found' });

    const selectedFacilities = Array.isArray(facilityIds) && facilityIds.length > 0
      ? facilityIds.map((id: any) => String(id))
      : (booking.facilityIds || []).map((id: any) => String(id));

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) return res.status(400).json({ success: false, error: 'endTime must be greater than startTime' });

    await ensureNoBookingConflict(selectedFacilities, start, end, String(booking._id));

    const oldStart = new Date(booking.startTime);
    const oldEnd = new Date(booking.endTime);
    booking.facilityIds = selectedFacilities as any;
    booking.startTime = start;
    booking.endTime = end;
    booking.rescheduleCount = Number(booking.rescheduleCount || 0) + 1;
    const nextHistory = Array.isArray(booking.rescheduleHistory) ? booking.rescheduleHistory : [];
    nextHistory.push({
      fromStart: oldStart,
      fromEnd: oldEnd,
      toStart: start,
      toEnd: end,
      reason: String(reason || '').trim() || undefined,
      changedBy: req.userId,
      changedAt: new Date(),
    } as any);
    booking.rescheduleHistory = nextHistory as any;
    booking.reminderAt = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    await booking.save();

    const updated = await EventBooking.findById(booking._id).populate('facilityIds', 'name location hourlyRate');
    res.json({ success: true, data: updated, message: 'Event rescheduled successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to reschedule event' });
  }
});

router.get('/bookings/:id/receipt', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await EventBooking.findById(req.params.id).populate('facilityIds', 'name location hourlyRate');
    if (!booking) return res.status(404).json({ success: false, error: 'Event booking not found' });

    const data = {
      receiptNumber: booking.eventNumber || `EV-${String(booking._id).slice(-6).toUpperCase()}`,
      eventName: booking.eventName,
      organizerName: booking.organizerName,
      organizationName: booking.organizationName,
      contactPhone: booking.contactPhone,
      contactEmail: booking.contactEmail,
      facilities: (booking.facilityIds as any[]).map((facility) => ({
        name: facility.name,
        location: facility.location,
      })),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      totalAmount: booking.totalAmount,
      advanceAmount: booking.advanceAmount,
      paidAmount: booking.paidAmount,
      balanceAmount: booking.balanceAmount,
      cancellationCharge: booking.cancellationCharge,
      refundAmount: booking.refundAmount,
      remarks: booking.remarks,
      generatedAt: new Date(),
    };

    res.json({ success: true, data, message: 'Event confirmation receipt generated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate event receipt' });
  }
});

router.get('/reminders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = Math.max(1, Math.min(30, Number(req.query.days || 5)));
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const upcoming = await EventBooking.find({
      status: { $in: ACTIVE_EVENT_STATUSES },
      startTime: { $gte: now, $lte: until },
    })
      .populate('facilityIds', 'name location')
      .sort({ startTime: 1 })
      .limit(50);

    const paymentDue = await EventBooking.find({
      status: { $in: ACTIVE_EVENT_STATUSES },
      balanceAmount: { $gt: 0 },
    })
      .populate('facilityIds', 'name location')
      .sort({ startTime: 1 })
      .limit(50);

    res.json({ success: true, data: { upcoming, paymentDue } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch event reminders' });
  }
});

export default router;


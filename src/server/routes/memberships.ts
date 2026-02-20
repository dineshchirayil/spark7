import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { MembershipPlan } from '../models/MembershipPlan.js';
import { MemberSubscription } from '../models/MemberSubscription.js';
import { Facility } from '../models/Facility.js';
import { User } from '../models/User.js';

const router = Router();
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const requireMembershipAdmin = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return null;
  }
  const user = await User.findById(req.userId).select('role');
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return null;
  }
  const role = String(user.role || '').toLowerCase();
  if (!['admin', 'super_admin'].includes(role)) {
    res.status(403).json({ success: false, error: 'Only admin/super admin can manage membership plans' });
    return null;
  }
  return user;
};

const durationFromCycle = (cycle: string, customDays?: number): number => {
  const normalized = String(cycle || '').toLowerCase();
  if (normalized === 'monthly') return 30;
  if (normalized === 'quarterly') return 90;
  if (normalized === 'yearly') return 365;
  return Math.max(1, Number(customDays || 30));
};

router.get('/plan-options', authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const facilities = await Facility.find({ active: true })
      .select('name location active')
      .sort({ name: 1 });
    res.json({
      success: true,
      data: {
        billingCycles: ['monthly', 'quarterly', 'yearly', 'custom'],
        facilities,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load membership plan options' });
  }
});

router.get('/plans', authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const plans = await MembershipPlan.find()
      .populate('facilityIds', 'name location active')
      .sort({ active: -1, facilityType: 1, price: 1 });
    res.json({ success: true, data: plans });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch membership plans' });
  }
});

router.post('/plans', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUser = await requireMembershipAdmin(req, res);
    if (!adminUser) return;

    const {
      name,
      facilityType,
      facilityIds,
      billingCycle = 'monthly',
      durationDays,
      price,
      sessionsLimit,
      bookingDiscountPercentage,
      freezeAllowed,
      customizable,
      description,
      active,
    } = req.body;
    if (!name || !facilityType || price === undefined) {
      return res.status(400).json({ success: false, error: 'name, facilityType and price are required' });
    }

    const planDuration = durationFromCycle(String(billingCycle), Number(durationDays || 0));
    const selectedFacilities = Array.isArray(facilityIds) ? facilityIds : [];

    const plan = await MembershipPlan.create({
      name,
      facilityType,
      facilityIds: selectedFacilities,
      billingCycle: String(billingCycle).toLowerCase(),
      durationDays: planDuration,
      price: Number(price),
      bookingDiscountPercentage: Number(bookingDiscountPercentage || 0),
      sessionsLimit: Number(sessionsLimit || 0),
      freezeAllowed: freezeAllowed !== undefined ? Boolean(freezeAllowed) : true,
      customizable: customizable !== undefined ? Boolean(customizable) : true,
      description,
      active: active !== undefined ? Boolean(active) : true,
      createdBy: req.userId,
    });

    res.status(201).json({ success: true, data: plan, message: 'Membership plan created' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create membership plan' });
  }
});

router.put('/plans/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUser = await requireMembershipAdmin(req, res);
    if (!adminUser) return;

    const updates = { ...req.body };
    if (updates.billingCycle !== undefined || updates.durationDays !== undefined) {
      updates.durationDays = durationFromCycle(String(updates.billingCycle || 'custom'), Number(updates.durationDays || 0));
    }
    if (updates.bookingDiscountPercentage !== undefined) {
      updates.bookingDiscountPercentage = Math.max(0, Math.min(100, Number(updates.bookingDiscountPercentage || 0)));
    }
    if (updates.facilityIds !== undefined && !Array.isArray(updates.facilityIds)) {
      updates.facilityIds = [];
    }

    const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('facilityIds', 'name location active');
    if (!plan) return res.status(404).json({ success: false, error: 'Membership plan not found' });

    res.json({ success: true, data: plan, message: 'Membership plan updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update membership plan' });
  }
});

router.get('/subscriptions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, expiringInDays } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (expiringInDays !== undefined) {
      const days = Math.max(0, Math.min(120, Number(expiringInDays || 0)));
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      filter.endDate = { $lte: until };
      filter.status = { $in: ['active', 'frozen', 'suspended'] };
    }

    const items = await MemberSubscription.find(filter)
      .populate({
        path: 'planId',
        select: 'name facilityType facilityIds billingCycle durationDays price sessionsLimit bookingDiscountPercentage freezeAllowed',
        populate: { path: 'facilityIds', select: 'name location active' },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch subscriptions' });
  }
});

router.post('/subscriptions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      memberName,
      phone,
      email,
      address,
      emergencyContact,
      planId,
      startDate,
      amountPaid,
      bookingDiscountPercentage,
      validityReminderDays,
      notes,
    } = req.body;
    if (!memberName || !planId) {
      return res.status(400).json({ success: false, error: 'memberName and planId are required' });
    }

    const plan = await MembershipPlan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + Number(plan.durationDays));
    const totalPrice = Number(plan.price || 0);
    const paid = amountPaid !== undefined ? Number(amountPaid) : totalPrice;
    const due = round2(Math.max(0, totalPrice - paid));
    const memberCode = `MEM-${Date.now().toString().slice(-8)}`;
    const discount = Number(
      bookingDiscountPercentage !== undefined ? bookingDiscountPercentage : plan.bookingDiscountPercentage || 0
    );

    const subscription = await MemberSubscription.create({
      memberCode,
      memberName,
      phone,
      email,
      address,
      emergencyContact,
      planId,
      startDate: start,
      endDate: end,
      amountPaid: paid,
      amountDue: due,
      bookingDiscountPercentage: Math.max(0, Math.min(100, discount)),
      validityReminderDays: Math.max(0, Number(validityReminderDays ?? 7)),
      status: 'active',
      sessionsUsed: 0,
      notes,
      createdBy: req.userId,
    });

    res.status(201).json({ success: true, data: subscription, message: 'Subscription created' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create subscription' });
  }
});

router.put('/subscriptions/:id/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updates = { ...req.body };
    if (updates.bookingDiscountPercentage !== undefined) {
      updates.bookingDiscountPercentage = Math.max(0, Math.min(100, Number(updates.bookingDiscountPercentage || 0)));
    }
    if (updates.validityReminderDays !== undefined) {
      updates.validityReminderDays = Math.max(0, Number(updates.validityReminderDays || 0));
    }

    const sub = await MemberSubscription.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate({
      path: 'planId',
      select: 'name facilityType facilityIds billingCycle durationDays price sessionsLimit bookingDiscountPercentage',
      populate: { path: 'facilityIds', select: 'name location active' },
    });

    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });
    res.json({ success: true, data: sub, message: 'Member profile updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update member profile' });
  }
});

router.get('/subscriptions/expiry-alerts', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days || 15)));
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const expiring = await MemberSubscription.find({
      status: { $in: ['active', 'frozen', 'suspended'] },
      endDate: { $gte: now, $lte: until },
    })
      .populate('planId', 'name facilityType billingCycle')
      .sort({ endDate: 1 })
      .limit(100);

    const expired = await MemberSubscription.find({
      status: { $in: ['active', 'frozen', 'suspended'] },
      endDate: { $lt: now },
    }).limit(100);

    if (expired.length > 0) {
      await MemberSubscription.updateMany(
        { _id: { $in: expired.map((item) => item._id) } },
        { $set: { status: 'expired' } }
      );
    }

    res.json({ success: true, data: { expiring, days } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch expiry alerts' });
  }
});

router.post('/subscriptions/:id/consume-session', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscription = await MemberSubscription.findById(req.params.id).populate('planId');
    if (!subscription) return res.status(404).json({ success: false, error: 'Subscription not found' });

    const now = new Date();
    if (subscription.endDate < now) {
      subscription.status = 'expired';
      await subscription.save();
      return res.status(400).json({ success: false, error: 'Subscription expired' });
    }
    if (['frozen', 'suspended', 'cancelled'].includes(String(subscription.status))) {
      return res.status(400).json({ success: false, error: `Subscription is ${subscription.status}` });
    }

    const plan: any = subscription.planId as any;
    const sessionsLimit = Number(plan?.sessionsLimit || 0);

    if (sessionsLimit > 0 && subscription.sessionsUsed >= sessionsLimit) {
      return res.status(400).json({ success: false, error: 'No sessions left' });
    }

    subscription.sessionsUsed += 1;
    await subscription.save();

    res.json({ success: true, data: subscription, message: 'Session consumed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to consume session' });
  }
});

router.put('/subscriptions/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, freezeFrom, freezeTo, freezeReason } = req.body;
    const updates: any = { status };
    if (status === 'frozen') {
      updates.freezeFrom = freezeFrom ? new Date(freezeFrom) : new Date();
      updates.freezeTo = freezeTo ? new Date(freezeTo) : undefined;
      updates.freezeReason = freezeReason ? String(freezeReason) : undefined;
    }
    if (status !== 'frozen') {
      updates.freezeFrom = undefined;
      updates.freezeTo = undefined;
      updates.freezeReason = undefined;
    }

    const sub = await MemberSubscription.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('planId', 'name');

    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });

    res.json({ success: true, data: sub, message: 'Subscription status updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update subscription status' });
  }
});

export default router;

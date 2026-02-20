import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../config';
import { apiUrl, fetchApiJson } from '../utils/api';

interface FacilityOption {
  _id: string;
  name: string;
  location?: string;
  active?: boolean;
}

interface Plan {
  _id: string;
  name: string;
  facilityType: string;
  facilityIds?: FacilityOption[];
  billingCycle?: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  durationDays: number;
  price: number;
  bookingDiscountPercentage?: number;
  sessionsLimit: number;
  freezeAllowed?: boolean;
  active: boolean;
}

interface Subscription {
  _id: string;
  memberCode?: string;
  memberName: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  planId: Plan;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled' | 'frozen' | 'suspended';
  amountPaid: number;
  amountDue?: number;
  sessionsUsed: number;
  bookingDiscountPercentage?: number;
  validityReminderDays?: number;
}

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const cycleLabel = (value?: string) => {
  if (!value) return 'CUSTOM';
  return String(value).toUpperCase();
};

export const Memberships: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expiringAlerts, setExpiringAlerts] = useState<Subscription[]>([]);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingMember, setSavingMember] = useState(false);

  const [planForm, setPlanForm] = useState({
    name: '',
    facilityType: '',
    facilityIds: [] as string[],
    billingCycle: 'monthly',
    durationDays: '30',
    price: '',
    sessionsLimit: '0',
    bookingDiscountPercentage: '0',
    freezeAllowed: true,
    description: '',
    active: true,
  });

  const [subForm, setSubForm] = useState({
    editId: '',
    memberName: '',
    phone: '',
    email: '',
    address: '',
    emergencyContact: '',
    planId: '',
    startDate: toDateInput(new Date()),
    amountPaid: '',
    bookingDiscountPercentage: '',
    validityReminderDays: '7',
    notes: '',
  });

  const headers = useMemo(() => {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, []);

  const loadData = async () => {
    setError('');
    try {
      const [optionsData, plansData, subscriptionsData, alertsData] = await Promise.all([
        fetchApiJson(apiUrl('/api/memberships/plan-options'), { headers }),
        fetchApiJson(apiUrl('/api/memberships/plans'), { headers }),
        fetchApiJson(apiUrl('/api/memberships/subscriptions'), { headers }),
        fetchApiJson(apiUrl('/api/memberships/subscriptions/expiry-alerts?days=15'), { headers }),
      ]);

      const facilityRows = Array.isArray(optionsData?.data?.facilities) ? optionsData.data.facilities : [];
      const planRows = Array.isArray(plansData?.data) ? plansData.data : [];
      const subRows = Array.isArray(subscriptionsData?.data) ? subscriptionsData.data : [];
      const alertRows = Array.isArray(alertsData?.data?.expiring) ? alertsData.data.expiring : [];

      setFacilities(facilityRows);
      setPlans(planRows);
      setSubscriptions(subRows);
      setExpiringAlerts(alertRows);

      if (!planForm.facilityType && facilityRows[0]?.name) {
        setPlanForm((prev) => ({ ...prev, facilityType: facilityRows[0].name }));
      }
      if (!subForm.planId && planRows[0]?._id) {
        setSubForm((prev) => ({ ...prev, planId: planRows[0]._id }));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load memberships');
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const toggleFacility = (facilityId: string) => {
    setPlanForm((prev) => {
      const exists = prev.facilityIds.includes(facilityId);
      return {
        ...prev,
        facilityIds: exists
          ? prev.facilityIds.filter((id) => id !== facilityId)
          : [...prev.facilityIds, facilityId],
      };
    });
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl('/api/memberships/plans'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: planForm.name.trim(),
          facilityType: planForm.facilityType.trim() || 'custom',
          facilityIds: planForm.facilityIds,
          billingCycle: planForm.billingCycle,
          durationDays: Number(planForm.durationDays || 0),
          price: Number(planForm.price || 0),
          sessionsLimit: Number(planForm.sessionsLimit || 0),
          bookingDiscountPercentage: Number(planForm.bookingDiscountPercentage || 0),
          freezeAllowed: Boolean(planForm.freezeAllowed),
          description: planForm.description.trim(),
          active: Boolean(planForm.active),
        }),
      });
      setMessage('Membership plan created');
      setPlanForm((prev) => ({
        ...prev,
        name: '',
        price: '',
        sessionsLimit: '0',
        bookingDiscountPercentage: '0',
        description: '',
        facilityIds: [],
      }));
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to create plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const saveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMember(true);
    setError('');
    setMessage('');
    try {
      if (subForm.editId) {
        await fetchApiJson(apiUrl(`/api/memberships/subscriptions/${subForm.editId}/profile`), {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            memberName: subForm.memberName,
            phone: subForm.phone,
            email: subForm.email,
            address: subForm.address,
            emergencyContact: subForm.emergencyContact,
            bookingDiscountPercentage: subForm.bookingDiscountPercentage ? Number(subForm.bookingDiscountPercentage) : undefined,
            validityReminderDays: Number(subForm.validityReminderDays || 7),
            notes: subForm.notes,
          }),
        });
        setMessage('Member profile updated');
      } else {
        await fetchApiJson(apiUrl('/api/memberships/subscriptions'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            memberName: subForm.memberName,
            phone: subForm.phone,
            email: subForm.email,
            address: subForm.address,
            emergencyContact: subForm.emergencyContact,
            planId: subForm.planId,
            startDate: subForm.startDate,
            amountPaid: subForm.amountPaid ? Number(subForm.amountPaid) : undefined,
            bookingDiscountPercentage: subForm.bookingDiscountPercentage ? Number(subForm.bookingDiscountPercentage) : undefined,
            validityReminderDays: Number(subForm.validityReminderDays || 7),
            notes: subForm.notes,
          }),
        });
        setMessage('Subscription created');
      }

      setSubForm((prev) => ({
        ...prev,
        editId: '',
        memberName: '',
        phone: '',
        email: '',
        address: '',
        emergencyContact: '',
        amountPaid: '',
        bookingDiscountPercentage: '',
        validityReminderDays: '7',
        notes: '',
      }));
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to save member');
    } finally {
      setSavingMember(false);
    }
  };

  const consumeSession = async (id: string) => {
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl(`/api/memberships/subscriptions/${id}/consume-session`), {
        method: 'POST',
        headers,
      });
      setMessage('Session consumed');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to consume session');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl(`/api/memberships/subscriptions/${id}/status`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });
      setMessage(`Membership marked ${status}`);
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to update status');
    }
  };

  const startEditMember = (sub: Subscription) => {
    setSubForm({
      editId: sub._id,
      memberName: sub.memberName || '',
      phone: sub.phone || '',
      email: sub.email || '',
      address: sub.address || '',
      emergencyContact: sub.emergencyContact || '',
      planId: sub.planId?._id || '',
      startDate: toDateInput(new Date(sub.startDate)),
      amountPaid: String(sub.amountPaid || ''),
      bookingDiscountPercentage: String(sub.bookingDiscountPercentage ?? ''),
      validityReminderDays: String(sub.validityReminderDays ?? 7),
      notes: '',
    });
  };

  const resetMemberForm = () => {
    setSubForm((prev) => ({
      ...prev,
      editId: '',
      memberName: '',
      phone: '',
      email: '',
      address: '',
      emergencyContact: '',
      amountPaid: '',
      bookingDiscountPercentage: '',
      validityReminderDays: '7',
      notes: '',
    }));
  };

  const inputClass = 'w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white';

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Membership Management</h1>
        <p className="text-sm text-gray-300">
          Admin can create customizable plans (monthly/quarterly/yearly), map facilities, track validity, and manage freeze/suspend lifecycle.
        </p>
      </div>

      {message && <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      {error && <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

      {!!expiringAlerts.length && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Expiry Alerts</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {expiringAlerts.slice(0, 6).map((row) => (
              <div key={row._id} className="rounded border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <p className="font-semibold text-white">{row.memberName}</p>
                <p className="text-gray-300">{row.planId?.name || '-'}</p>
                <p className="text-amber-200">Expires: {new Date(row.endDate).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <form onSubmit={createPlan} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white">Create Plan (Admin)</h2>
          <input
            className={inputClass}
            required
            placeholder="Plan Name"
            value={planForm.name}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className={inputClass}
            required
            placeholder="Facility Type Label (e.g., badminton, swimming pool)"
            value={planForm.facilityType}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, facilityType: e.target.value }))}
          />
          <div className="rounded border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-xs text-gray-300">Facilities covered in this plan</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {facilities.map((facility) => (
                <label key={facility._id} className="flex items-center gap-2 text-xs text-gray-200">
                  <input
                    type="checkbox"
                    checked={planForm.facilityIds.includes(facility._id)}
                    onChange={() => toggleFacility(facility._id)}
                  />
                  {facility.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className={inputClass}
              value={planForm.billingCycle}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, billingCycle: e.target.value }))}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
            <input
              className={inputClass}
              type="number"
              min="1"
              placeholder="Duration Days"
              value={planForm.durationDays}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, durationDays: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              placeholder="Membership Fee"
              value={planForm.price}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, price: e.target.value }))}
            />
            <input
              className={inputClass}
              type="number"
              min="0"
              step="1"
              placeholder="Session Limit (0 unlimited)"
              value={planForm.sessionsLimit}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, sessionsLimit: e.target.value }))}
            />
          </div>
          <input
            className={inputClass}
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Discounted Booking Rate (%)"
            value={planForm.bookingDiscountPercentage}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, bookingDiscountPercentage: e.target.value }))}
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={planForm.freezeAllowed}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, freezeAllowed: e.target.checked }))}
            />
            Allow freeze/suspend option
          </label>
          <textarea
            className={`${inputClass} min-h-[72px]`}
            placeholder="Plan Notes"
            value={planForm.description}
            onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <button
            disabled={savingPlan}
            className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-70"
          >
            {savingPlan ? 'Saving Plan...' : 'Save Plan'}
          </button>
        </form>

        <form onSubmit={saveMember} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white">{subForm.editId ? 'Edit Member Profile' : 'Create Member Subscription'}</h2>
          <select
            className={inputClass}
            required
            value={subForm.planId}
            onChange={(e) => setSubForm((prev) => ({ ...prev, planId: e.target.value }))}
            disabled={Boolean(subForm.editId)}
          >
            <option value="">Select Plan</option>
            {plans.map((plan) => (
              <option key={plan._id} value={plan._id}>
                {plan.name} | {cycleLabel(plan.billingCycle)} | {formatCurrency(plan.price)}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            required
            placeholder="Member Name"
            value={subForm.memberName}
            onChange={(e) => setSubForm((prev) => ({ ...prev, memberName: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              placeholder="Phone"
              value={subForm.phone}
              onChange={(e) => setSubForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <input
              className={inputClass}
              type="email"
              placeholder="Email"
              value={subForm.email}
              onChange={(e) => setSubForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <textarea
            className={`${inputClass} min-h-[66px]`}
            placeholder="Address"
            value={subForm.address}
            onChange={(e) => setSubForm((prev) => ({ ...prev, address: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Emergency Contact"
            value={subForm.emergencyContact}
            onChange={(e) => setSubForm((prev) => ({ ...prev, emergencyContact: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              className={inputClass}
              type="date"
              value={subForm.startDate}
              onChange={(e) => setSubForm((prev) => ({ ...prev, startDate: e.target.value }))}
              disabled={Boolean(subForm.editId)}
            />
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              placeholder="Fee Paid"
              value={subForm.amountPaid}
              onChange={(e) => setSubForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
            />
            <input
              className={inputClass}
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Discount %"
              value={subForm.bookingDiscountPercentage}
              onChange={(e) => setSubForm((prev) => ({ ...prev, bookingDiscountPercentage: e.target.value }))}
            />
          </div>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="1"
            placeholder="Expiry Reminder Days"
            value={subForm.validityReminderDays}
            onChange={(e) => setSubForm((prev) => ({ ...prev, validityReminderDays: e.target.value }))}
          />
          <textarea
            className={`${inputClass} min-h-[66px]`}
            placeholder="Remarks"
            value={subForm.notes}
            onChange={(e) => setSubForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              disabled={savingMember}
              className="flex-1 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-70"
            >
              {savingMember ? 'Saving...' : subForm.editId ? 'Update Member' : 'Create Subscription'}
            </button>
            {subForm.editId && (
              <button
                type="button"
                onClick={resetMemberForm}
                className="rounded-md border border-white/20 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Plans</h2>
        <table className="min-w-full divide-y divide-white/10">
          <thead>
            <tr>
              {['Plan', 'Facilities', 'Cycle', 'Duration', 'Fee', 'Discount', 'Sessions', 'Status'].map((h) => (
                <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {plans.map((plan) => (
              <tr key={plan._id}>
                <td className="px-2 py-2 text-sm text-white">{plan.name}</td>
                <td className="px-2 py-2 text-xs text-gray-300">
                  {Array.isArray(plan.facilityIds) && plan.facilityIds.length > 0
                    ? plan.facilityIds.map((f) => f.name).join(', ')
                    : plan.facilityType}
                </td>
                <td className="px-2 py-2 text-xs text-gray-300">{cycleLabel(plan.billingCycle)}</td>
                <td className="px-2 py-2 text-xs text-gray-300">{plan.durationDays} days</td>
                <td className="px-2 py-2 text-sm text-white">{formatCurrency(plan.price)}</td>
                <td className="px-2 py-2 text-xs text-emerald-300">{Number(plan.bookingDiscountPercentage || 0)}%</td>
                <td className="px-2 py-2 text-xs text-gray-300">{Number(plan.sessionsLimit || 0) || 'Unlimited'}</td>
                <td className="px-2 py-2 text-xs text-gray-300">{plan.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
            {!plans.length && (
              <tr><td colSpan={8} className="px-2 py-3 text-center text-sm text-gray-400">No plans found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Member Subscriptions</h2>
        <table className="min-w-full divide-y divide-white/10">
          <thead>
            <tr>
              {['Member', 'Plan', 'Validity', 'Fee', 'Discount', 'Sessions', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {subscriptions.map((sub) => (
              <tr key={sub._id}>
                <td className="px-2 py-2 text-xs text-gray-200">
                  <p className="text-sm text-white">{sub.memberName}</p>
                  <p>{sub.memberCode || '-'}</p>
                  <p>{sub.phone || '-'}</p>
                </td>
                <td className="px-2 py-2 text-xs text-gray-300">{sub.planId?.name || '-'}</td>
                <td className="px-2 py-2 text-xs text-gray-300">
                  <p>{new Date(sub.startDate).toLocaleDateString('en-IN')}</p>
                  <p>{new Date(sub.endDate).toLocaleDateString('en-IN')}</p>
                </td>
                <td className="px-2 py-2 text-xs text-gray-300">
                  <p>Paid: {formatCurrency(Number(sub.amountPaid || 0))}</p>
                  <p>Due: {formatCurrency(Number(sub.amountDue || 0))}</p>
                </td>
                <td className="px-2 py-2 text-xs text-emerald-300">{Number(sub.bookingDiscountPercentage || 0)}%</td>
                <td className="px-2 py-2 text-xs text-gray-300">
                  {sub.sessionsUsed}/{Number(sub.planId?.sessionsLimit || 0) || 'Unlimited'}
                </td>
                <td className="px-2 py-2 text-xs uppercase text-gray-300">{sub.status}</td>
                <td className="px-2 py-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => consumeSession(sub._id)} className="rounded bg-indigo-500/20 px-2 py-1 text-indigo-200">Use</button>
                    <button onClick={() => startEditMember(sub)} className="rounded bg-cyan-500/20 px-2 py-1 text-cyan-200">Edit</button>
                    {sub.status !== 'frozen' && (
                      <button onClick={() => updateStatus(sub._id, 'frozen')} className="rounded bg-amber-500/20 px-2 py-1 text-amber-200">Freeze</button>
                    )}
                    {sub.status !== 'suspended' && (
                      <button onClick={() => updateStatus(sub._id, 'suspended')} className="rounded bg-rose-500/20 px-2 py-1 text-rose-200">Suspend</button>
                    )}
                    {sub.status !== 'active' && (
                      <button onClick={() => updateStatus(sub._id, 'active')} className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-200">Activate</button>
                    )}
                    {sub.status !== 'cancelled' && (
                      <button onClick={() => updateStatus(sub._id, 'cancelled')} className="rounded bg-red-500/20 px-2 py-1 text-red-200">Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!subscriptions.length && (
              <tr><td colSpan={8} className="px-2 py-3 text-center text-sm text-gray-400">No member subscriptions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


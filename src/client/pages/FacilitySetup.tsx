import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../config';
import { apiUrl, fetchApiJson } from '../utils/api';

interface Facility {
  _id: string;
  name: string;
  location?: string;
  hourlyRate: number;
  capacity?: number;
  description?: string;
  imageUrl?: string;
  active: boolean;
}

const normalizedName = (name: string): string => String(name || '').trim().toLowerCase();

const suggestedCapacityFromName = (name: string): number | null => {
  const value = normalizedName(name);
  if (value.includes('badminton')) return 8;
  if (value.includes('football') && value.includes('turf')) return 1;
  if (value.includes('swimming') && value.includes('pool')) return 1;
  return null;
};

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const FacilitySetup: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    location: '',
    hourlyRate: '',
    capacity: '',
    description: '',
    imageUrl: '',
    active: true,
  });

  const headers = useMemo(() => {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, []);

  const forcedCapacity = useMemo(() => suggestedCapacityFromName(form.name), [form.name]);

  useEffect(() => {
    if (forcedCapacity === null) return;
    setForm((prev) => {
      const next = String(forcedCapacity);
      if (prev.capacity === next) return prev;
      return { ...prev, capacity: next };
    });
  }, [forcedCapacity]);

  const loadFacilities = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApiJson(apiUrl('/api/facilities'), { headers });
      setFacilities(data.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load facilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFacilities();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      location: '',
      hourlyRate: '',
      capacity: '',
      description: '',
      imageUrl: '',
      active: true,
    });
  };

  const saveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      hourlyRate: Number(form.hourlyRate || 0),
      capacity: Number(form.capacity || 0),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      active: Boolean(form.active),
    };

    if (!payload.name || payload.hourlyRate < 0) {
      setError('Name and valid hourly rate are required');
      return;
    }

    if (!editingId && !payload.imageUrl) {
      setError('Facility image is required');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await fetchApiJson(apiUrl(`/api/facilities/${editingId}`), {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        setMessage('Facility updated successfully');
      } else {
        await fetchApiJson(apiUrl('/api/facilities'), {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        setMessage('Facility added successfully');
      }

      resetForm();
      await loadFacilities();
    } catch (e: any) {
      setError(e.message || 'Failed to save facility');
    } finally {
      setSaving(false);
    }
  };

  const onImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image should be less than 2MB');
      return;
    }

    try {
      const dataUrl = await toDataUrl(file);
      setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      setError('');
    } catch {
      setError('Failed to read image file');
    }
  };

  const startEdit = (facility: Facility) => {
    setEditingId(facility._id);
    setForm({
      name: facility.name || '',
      location: facility.location || '',
      hourlyRate: String(facility.hourlyRate || 0),
      capacity: String(facility.capacity || 0),
      description: facility.description || '',
      imageUrl: facility.imageUrl || '',
      active: facility.active !== false,
    });
  };

  const toggleActive = async (facility: Facility) => {
    setError('');
    setMessage('');
    try {
      await fetchApiJson(apiUrl(`/api/facilities/${facility._id}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ active: !facility.active }),
      });
      setMessage(`Facility ${facility.active ? 'deactivated' : 'activated'}`);
      await loadFacilities();
    } catch (e: any) {
      setError(e.message || 'Failed to update facility status');
    }
  };

  const filteredFacilities = facilities.filter((facility) => {
    const haystack = `${facility.name} ${facility.location || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const inputClass = 'w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white';

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Facility Setup</h1>
          <p className="text-sm text-gray-300">Create custom facilities with image, view existing facilities, and edit details.</p>
        </div>
        <div className="w-full max-w-sm">
          <label className="mb-1 block text-xs text-gray-400">Search Facilities</label>
          <input className={inputClass} placeholder="Search by name / location" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {message && <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      {error && <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      {loading && <div className="text-sm text-gray-400">Loading facilities...</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <form onSubmit={saveFacility} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5 xl:col-span-1">
          <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit Facility' : 'Add Facility'}</h2>

          <input
            className={inputClass}
            placeholder="Facility Name"
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />

          <input
            className={inputClass}
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              placeholder="Hourly Rate"
              required
              value={form.hourlyRate}
              onChange={(e) => setForm((prev) => ({ ...prev, hourlyRate: e.target.value }))}
            />
            <input
              className={inputClass}
              type="number"
              min="0"
              step="1"
              placeholder="Capacity"
              value={form.capacity}
              disabled={forcedCapacity !== null}
              onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
            />
          </div>
          {forcedCapacity !== null && (
            <p className="text-[11px] text-indigo-200">
              Capacity is fixed to {forcedCapacity} for this facility type.
            </p>
          )}

          <textarea
            className={`${inputClass} min-h-[90px]`}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />

          <div className="space-y-2 rounded border border-white/10 p-2">
            <label className="block text-xs text-gray-400">Facility Image {editingId ? '(optional on edit)' : '(required)'}</label>
            <input type="file" accept="image/*" className="w-full text-xs text-gray-300" onChange={onImageFileChange} />
            {form.imageUrl && (
              <div className="rounded border border-white/10 bg-black/20 p-2">
                <img src={form.imageUrl} alt="Facility preview" className="h-32 w-full rounded object-cover" />
                <button
                  type="button"
                  className="mt-2 rounded bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30"
                  onClick={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
                >
                  Remove Image
                </button>
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
            Active Facility
          </label>

          <div className="flex gap-2">
            <button disabled={saving} className="flex-1 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-70">
              {saving ? 'Saving...' : (editingId ? 'Update Facility' : 'Add Facility')}
            </button>
            {editingId && (
              <button type="button" className="rounded-md border border-white/15 px-3 py-2 text-sm text-gray-200 hover:bg-white/10" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-white">Existing Facilities</h2>
          {filteredFacilities.length === 0 ? (
            <div className="rounded border border-white/10 p-3 text-sm text-gray-400">No facilities found.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredFacilities.map((facility) => (
                <div
                  key={facility._id}
                  className={`rounded-lg border p-3 ${
                    editingId === facility._id
                      ? 'border-indigo-400/60 bg-indigo-500/10'
                      : 'border-white/10 bg-black/10'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{facility.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${facility.active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-gray-500/20 text-gray-300'}`}>
                      {facility.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mb-2 rounded border border-white/10 bg-black/20 p-2">
                    {facility.imageUrl ? (
                      <img src={facility.imageUrl} alt={facility.name} className="h-32 w-full rounded object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded border border-dashed border-white/20 text-xs text-gray-500">No image</div>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-gray-300">
                    <p>Rate: <span className="text-white">{formatCurrency(Number(facility.hourlyRate || 0))}/hr</span></p>
                    <p>Capacity: <span className="text-white">{Number(facility.capacity || 0)}</span></p>
                    <p>Location: <span className="text-white">{facility.location || '-'}</span></p>
                    {facility.description && <p>Description: <span className="text-white">{facility.description}</span></p>}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button className="rounded bg-indigo-500/20 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30" onClick={() => startEdit(facility)}>
                      Edit
                    </button>
                    <button
                      className={`rounded px-2 py-1 text-xs ${facility.active ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'}`}
                      onClick={() => toggleActive(facility)}
                    >
                      {facility.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

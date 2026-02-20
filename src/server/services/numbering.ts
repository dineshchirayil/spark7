import { NumberSequence } from '../models/NumberSequence.js';

const safePrefix = (value: string): string =>
  String(value || '')
    .replace(/[^A-Za-z0-9/_-]/g, '')
    .toUpperCase();

export const nextSequence = async (key: string): Promise<number> => {
  const doc = await NumberSequence.findOneAndUpdate(
    { key: String(key).toLowerCase().trim() },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return Number(doc.value || 0);
};

export const generateNumber = async (
  key: string,
  options: { prefix: string; padTo?: number; datePart?: boolean }
): Promise<string> => {
  const seq = await nextSequence(key);
  const padTo = Number(options.padTo || 6);
  const prefix = safePrefix(options.prefix);
  const datePart = options.datePart ? new Date().toISOString().slice(0, 10).replace(/-/g, '') : '';
  const serial = String(seq).padStart(padTo, '0');

  if (datePart) {
    return `${prefix}${datePart}-${serial}`;
  }
  return `${prefix}${serial}`;
};


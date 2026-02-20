import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { CustomerLedgerEntry } from '../models/CustomerLedgerEntry.js';

export const postCustomerLedgerEntry = async (input: {
  customerId: string | mongoose.Types.ObjectId;
  entryType: 'opening' | 'invoice' | 'payment' | 'credit_note' | 'adjustment' | 'refund' | 'advance';
  referenceType?: 'sale' | 'return' | 'receipt' | 'credit_note' | 'manual';
  referenceId?: string;
  referenceNo?: string;
  narration?: string;
  debit?: number;
  credit?: number;
  dueDate?: Date;
  createdBy?: string;
  entryDate?: Date;
}) => {
  const customer = await Customer.findById(input.customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const debit = Number(input.debit || 0);
  const credit = Number(input.credit || 0);
  const balanceAfter = Number(customer.outstandingBalance || 0) + debit - credit;

  customer.outstandingBalance = Number(balanceAfter.toFixed(2));
  await customer.save();

  const entry = await CustomerLedgerEntry.create({
    customerId: customer._id,
    entryDate: input.entryDate || new Date(),
    entryType: input.entryType,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceNo: input.referenceNo,
    narration: input.narration,
    debit: Number(debit.toFixed(2)),
    credit: Number(credit.toFixed(2)),
    balanceAfter: Number(balanceAfter.toFixed(2)),
    dueDate: input.dueDate,
    createdBy: input.createdBy,
  });

  return { customer, entry };
};

export const recalculateCustomerOutstanding = async (customerId: string | mongoose.Types.ObjectId) => {
  const rows = await CustomerLedgerEntry.find({ customerId }).sort({ entryDate: 1, createdAt: 1 });

  let running = 0;
  for (const row of rows) {
    running = running + Number(row.debit || 0) - Number(row.credit || 0);
    row.balanceAfter = Number(running.toFixed(2));
    await row.save();
  }

  const customer = await Customer.findById(customerId);
  if (customer) {
    customer.outstandingBalance = Number(running.toFixed(2));
    await customer.save();
  }

  return Number(running.toFixed(2));
};

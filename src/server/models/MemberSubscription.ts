import mongoose, { Schema, Document } from 'mongoose';

export interface IMemberSubscription extends Document {
  memberCode?: string;
  memberName: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  planId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'cancelled' | 'frozen' | 'suspended';
  amountPaid: number;
  amountDue?: number;
  bookingDiscountPercentage?: number;
  validityReminderDays?: number;
  freezeFrom?: Date;
  freezeTo?: Date;
  freezeReason?: string;
  sessionsUsed: number;
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const MemberSubscriptionSchema = new Schema<IMemberSubscription>(
  {
    memberCode: { type: String, trim: true, index: true },
    memberName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'frozen', 'suspended'],
      default: 'active',
      index: true,
    },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    amountDue: { type: Number, min: 0, default: 0 },
    bookingDiscountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    validityReminderDays: { type: Number, min: 0, default: 7 },
    freezeFrom: { type: Date },
    freezeTo: { type: Date },
    freezeReason: { type: String, trim: true },
    sessionsUsed: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true },
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

MemberSubscriptionSchema.index({ memberName: 1, status: 1 });
MemberSubscriptionSchema.index({ status: 1, endDate: 1 });

export const MemberSubscription = mongoose.model<IMemberSubscription>('MemberSubscription', MemberSubscriptionSchema);

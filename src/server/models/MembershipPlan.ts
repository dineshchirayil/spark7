import mongoose, { Schema, Document } from 'mongoose';

export interface IMembershipPlan extends Document {
  name: string;
  facilityType: string;
  facilityIds?: mongoose.Types.ObjectId[];
  billingCycle?: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  durationDays: number;
  price: number;
  bookingDiscountPercentage?: number;
  sessionsLimit: number;
  freezeAllowed?: boolean;
  customizable?: boolean;
  description?: string;
  active: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const MembershipPlanSchema = new Schema<IMembershipPlan>(
  {
    name: { type: String, required: true, trim: true },
    facilityType: { type: String, required: true, trim: true },
    facilityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility', index: true }],
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom'],
      default: 'monthly',
      index: true,
    },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    bookingDiscountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    sessionsLimit: { type: Number, required: true, min: 0, default: 0 },
    freezeAllowed: { type: Boolean, default: true },
    customizable: { type: Boolean, default: true },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

MembershipPlanSchema.index({ facilityType: 1, active: 1 });
MembershipPlanSchema.index({ billingCycle: 1, active: 1 });

export const MembershipPlan = mongoose.model<IMembershipPlan>('MembershipPlan', MembershipPlanSchema);

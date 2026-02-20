import mongoose, { Schema, Document } from 'mongoose';

export interface IEventBooking extends Document {
  eventNumber?: string;
  eventName: string;
  organizerName: string;
  organizationName?: string;
  contactPhone?: string;
  contactEmail?: string;
  facilityIds: mongoose.Types.ObjectId[];
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  totalAmount: number;
  advanceAmount: number;
  paidAmount: number;
  balanceAmount: number;
  cancellationCharge: number;
  refundAmount: number;
  cancellationReason?: string;
  cancelledAt?: Date;
  reminderAt?: Date;
  remarks?: string;
  rescheduleCount: number;
  rescheduleHistory?: Array<{
    fromStart: Date;
    fromEnd: Date;
    toStart: Date;
    toEnd: Date;
    reason?: string;
    changedBy?: string;
    changedAt: Date;
  }>;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const EventBookingSchema = new Schema<IEventBooking>(
  {
    eventNumber: { type: String, trim: true, index: true },
    eventName: { type: String, required: true, trim: true },
    organizerName: { type: String, required: true, trim: true },
    organizationName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    facilityIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Facility',
        required: true,
        index: true,
      },
    ],
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded'],
      default: 'pending',
      index: true,
    },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    advanceAmount: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    balanceAmount: { type: Number, min: 0, default: 0 },
    cancellationCharge: { type: Number, min: 0, default: 0 },
    refundAmount: { type: Number, min: 0, default: 0 },
    cancellationReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    reminderAt: { type: Date, index: true },
    remarks: { type: String, trim: true },
    rescheduleCount: { type: Number, min: 0, default: 0 },
    rescheduleHistory: [
      {
        fromStart: { type: Date, required: true },
        fromEnd: { type: Date, required: true },
        toStart: { type: Date, required: true },
        toEnd: { type: Date, required: true },
        reason: { type: String, trim: true },
        changedBy: { type: String, trim: true },
        changedAt: { type: Date, required: true, default: () => new Date() },
      },
    ],
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

EventBookingSchema.index({ startTime: 1, endTime: 1, status: 1 });
EventBookingSchema.index({ eventNumber: 1, createdAt: -1 });

export const EventBooking = mongoose.model<IEventBooking>('EventBooking', EventBookingSchema);


import mongoose, { Schema, Document } from 'mongoose';

export type EmploymentType = 'salaried' | 'daily' | 'contractor';

export interface IEmployee extends Document {
  employeeCode: string;
  name: string;
  phone?: string;
  email?: string;
  designation?: string;
  employmentType: EmploymentType;
  monthlySalary?: number;
  dailyRate?: number;
  overtimeHourlyRate?: number;
  paidLeave: boolean;
  active: boolean;
  joinDate?: Date;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    designation: { type: String, trim: true },
    employmentType: {
      type: String,
      enum: ['salaried', 'daily', 'contractor'],
      required: true,
      default: 'salaried',
    },
    monthlySalary: { type: Number, min: 0, default: 0 },
    dailyRate: { type: Number, min: 0, default: 0 },
    overtimeHourlyRate: { type: Number, min: 0, default: 0 },
    paidLeave: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    joinDate: { type: Date, default: Date.now },
    createdBy: { type: String, index: true },
  },
  { timestamps: true }
);

EmployeeSchema.index({ name: 1, active: 1 });

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);

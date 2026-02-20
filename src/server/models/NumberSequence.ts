import mongoose, { Document, Schema } from 'mongoose';

export interface INumberSequenceDocument extends Document {
  key: string;
  value: number;
  updatedAt?: Date;
}

const NumberSequenceSchema = new Schema<INumberSequenceDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export const NumberSequence = mongoose.model<INumberSequenceDocument>('NumberSequence', NumberSequenceSchema);


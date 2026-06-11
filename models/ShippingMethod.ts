import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IShippingMethod extends Document {
  name: string;
  code: string;
  description?: string | null;
  type: 'delivery' | 'pickup' | 'express' | 'standard';
  baseFee: number;
  freeShippingThreshold?: number | null;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
  branch?: Types.ObjectId | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShippingMethodSchema = new Schema<IShippingMethod>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: null },
    type: { type: String, enum: ['delivery', 'pickup', 'express', 'standard'], default: 'delivery' },
    baseFee: { type: Number, default: 0, min: 0 },
    freeShippingThreshold: { type: Number, default: null, min: 0 },
    estimatedDaysMin: { type: Number, default: null, min: 0 },
    estimatedDaysMax: { type: Number, default: null, min: 0 },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ShippingMethodSchema.pre('validate', function () {
  const doc = this as IShippingMethod;
  if (!doc.code && doc.name) {
    doc.code = String(doc.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
});

const ShippingMethod =
  mongoose.models.ShippingMethod || mongoose.model<IShippingMethod>('ShippingMethod', ShippingMethodSchema);

export default ShippingMethod;

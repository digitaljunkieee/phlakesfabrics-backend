import mongoose, { HydratedDocument, Schema, Document, Types } from 'mongoose';

export interface IBranchAddress {
  line1?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface IBranch extends Document {
  name: string;
  slug: string;
  code?: string | null;
  isActive: boolean;
  manager?: Types.ObjectId | null;
  address: IBranchAddress;
  phone?: string | null;
  email?: string | null;
  workloadScore?: number;
  deliveryRadiusKm?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const BranchAddressSchema = new Schema(
  {
    line1: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'Nigeria' },
    zip: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { _id: false }
);

const BranchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code: { type: String, default: null, trim: true },
    isActive: { type: Boolean, default: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    address: { type: BranchAddressSchema, default: {} },
    phone: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true },
    workloadScore: { type: Number, default: 0 },
    deliveryRadiusKm: { type: Number, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

type BranchDocument = HydratedDocument<IBranch> & {
  slug?: string;
  name?: string;
};

BranchSchema.pre('validate', function () {
  const doc = this as BranchDocument;
  if (!doc.slug && doc.name) {
    doc.slug = String(doc.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
});

const Branch = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema);

export default Branch;

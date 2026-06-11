import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWarranty extends Document {
  user?: Types.ObjectId | null;
  order?: Types.ObjectId | null;
  product?: Types.ObjectId | null;
  subject: string;
  issue: string;
  status: 'open' | 'in_review' | 'approved' | 'rejected' | 'closed';
  resolution?: string | null;
  photos?: string[];
  adminNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const WarrantySchema = new Schema<IWarranty>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    product: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    subject: { type: String, required: true, trim: true },
    issue: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'in_review', 'approved', 'rejected', 'closed'], default: 'open' },
    resolution: { type: String, default: null },
    photos: { type: [String], default: [] },
    adminNote: { type: String, default: null },
  },
  { timestamps: true }
);

WarrantySchema.index({ user: 1, createdAt: -1 });
WarrantySchema.index({ order: 1, createdAt: -1 });
WarrantySchema.index({ product: 1, createdAt: -1 });

const Warranty = mongoose.models.Warranty || mongoose.model<IWarranty>('Warranty', WarrantySchema);

export default Warranty;

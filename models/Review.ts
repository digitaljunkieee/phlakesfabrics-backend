import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  product: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId | null;
  rating: number;
  comment: string;
  photos?: string[];
  status?: 'pending' | 'approved' | 'rejected';
  adminNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    photos: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    adminNote: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);

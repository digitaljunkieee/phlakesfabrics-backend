import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  isActive: { type: Boolean, default: true },
  isComingSoon: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 999 },
}, { timestamps: true });

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);

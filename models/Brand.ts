import mongoose from 'mongoose';
const BrandSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  isComingSoon: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.models.Brand || mongoose.model('Brand', BrandSchema);

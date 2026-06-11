import mongoose from 'mongoose';
const CollectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  isComingSoon: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.models.Collection || mongoose.model('Collection', CollectionSchema);

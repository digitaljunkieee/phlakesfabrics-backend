  import mongoose from 'mongoose';

  const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional because Google OAuth users won't have a password
  role: {
    type: String,
    enum: ['customer', 'admin', 'super_admin', 'branch_manager', 'sales_staff', 'delivery'],
    default: 'customer',
  },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    disabledAt: { type: Date, default: null },
    disabledReason: { type: String, default: null },
    phone: { type: String },
    emailVerified: { type: Boolean, default: true },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    refreshTokenHash: { type: String, default: null },
    refreshTokenIssuedAt: { type: Date, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    address: {
      line1: String,
      city: String,
      state: String,
      country: String,
      zip: String
    },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  }, { timestamps: true });

  export default mongoose.models.User || mongoose.model('User', UserSchema);

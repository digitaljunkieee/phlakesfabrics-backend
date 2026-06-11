import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInventoryTransfer extends Document {
  product: Types.ObjectId;
  fromBranch: Types.ObjectId;
  toBranch: Types.ObjectId;
  quantity: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  reason?: string | null;
  notes?: string | null;
  requestedBy: Types.ObjectId | null;
  completedBy: Types.ObjectId | null;
  failureReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryTransferSchema = new Schema<IInventoryTransfer>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    fromBranch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    toBranch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    reason: { type: String, default: null },
    notes: { type: String, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    failureReason: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

InventoryTransferSchema.index({ fromBranch: 1, createdAt: -1 });
InventoryTransferSchema.index({ toBranch: 1, createdAt: -1 });
InventoryTransferSchema.index({ product: 1, createdAt: -1 });

const InventoryTransfer =
  mongoose.models.InventoryTransfer || mongoose.model<IInventoryTransfer>('InventoryTransfer', InventoryTransferSchema);

export default InventoryTransfer;

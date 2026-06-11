import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInventoryLog extends Document {
  inventory?: Types.ObjectId | null;
  product: Types.ObjectId;
  branch: Types.ObjectId;
  action: 'restock' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'refund' | 'reservation' | 'release';
  quantityBefore: number;
  quantityDelta: number;
  quantityAfter: number;
  performedBy: Types.ObjectId | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryLogSchema = new Schema<IInventoryLog>(
  {
    inventory: { type: Schema.Types.ObjectId, ref: 'Inventory', default: null },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    action: {
      type: String,
      enum: ['restock', 'sale', 'transfer_in', 'transfer_out', 'adjustment', 'refund', 'reservation', 'release'],
      required: true,
    },
    quantityBefore: { type: Number, required: true },
    quantityDelta: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    referenceType: { type: String, default: null },
    referenceId: { type: String, default: null },
    notes: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

InventoryLogSchema.index({ branch: 1, createdAt: -1 });
InventoryLogSchema.index({ product: 1, createdAt: -1 });
InventoryLogSchema.index({ action: 1, createdAt: -1 });

const InventoryLog = mongoose.models.InventoryLog || mongoose.model<IInventoryLog>('InventoryLog', InventoryLogSchema);

export default InventoryLog;

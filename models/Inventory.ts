import mongoose, { HydratedDocument, Schema, Document, Types } from 'mongoose';

export interface IInventory extends Document {
  product: Types.ObjectId;
  branch: Types.ObjectId;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'inactive';
  lastAdjustedBy?: Types.ObjectId | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative'],
    },
    lowStockThreshold: {
      type: Number,
      default: 0,
      min: [0, 'Low stock threshold cannot be negative'],
    },
    status: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock', 'inactive'],
      default: 'in_stock',
    },
    lastAdjustedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

InventorySchema.index({ product: 1, branch: 1 }, { unique: true });

type InventoryDocument = HydratedDocument<IInventory> & {
  quantity?: number;
  reservedQuantity?: number;
  lowStockThreshold?: number;
  status?: IInventory['status'];
};

InventorySchema.pre('validate', function () {
  const doc = this as InventoryDocument;
  const available = Math.max(0, Number(doc.quantity || 0) - Number(doc.reservedQuantity || 0));

  if (doc.status === 'inactive') return;
  if (available <= 0) {
    doc.status = 'out_of_stock';
    return;
  }

  if (Number(doc.lowStockThreshold || 0) > 0 && available <= Number(doc.lowStockThreshold || 0)) {
    doc.status = 'low_stock';
    return;
  }

  doc.status = 'in_stock';
});

const Inventory = mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', InventorySchema);

export default Inventory;

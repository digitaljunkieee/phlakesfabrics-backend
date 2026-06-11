import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IOrderItem {
  product: Types.ObjectId;
  name?: string;
  quantity: number;
  price: number;
  unit?: string | null;
  fulfillmentType?: 'pickup' | 'delivery' | null;
  pickupBranch?: Types.ObjectId | null;
  pickupBranchName?: string | null;
}

export interface IShippingAddress {
  street: string;
  city: string;
  state: string;
  lga?: string;
  country: string;
  phone: string;
}

export interface IOrder extends Document {
  user: Types.ObjectId | null;
  branch: Types.ObjectId | null;
  branchName: string | null;
  fulfillmentType: 'pickup' | 'delivery' | null;
  pickupBranch: Types.ObjectId | null;
  pickupBranchName: string | null;
  email: string;
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: IShippingAddress;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  fulfillmentStatus:
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'packed'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'unfulfilled'
    | 'fulfilled'
    | 'shipped';
  deliveryStatus:
    | 'pending'
    | 'queued'
    | 'assigned'
    | 'out_for_delivery'
    | 'delivered'
    | 'failed'
    | 'returned'
    | 'cancelled';
  deliveryAssignedTo: Types.ObjectId | null;
  deliveryAssignedAt: Date | null;
  deliveryQueuedAt: Date | null;
  deliveryOutForDeliveryAt: Date | null;
  deliveryFailureReason: string | null;
  deliveryNotes: string | null;
  deliveryUpdatedBy: Types.ObjectId | null;
  refundStatus: 'none' | 'requested' | 'processing' | 'completed' | 'failed';
  refundReference: string | null;
  refundAmount: number | null;
  refundRequestedAt: Date | null;
  refundProcessedAt: Date | null;
  refundReason: string | null;
  refundLastError: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  paystackReference: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShippingAddressSchema = new Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    lga: { type: String },
    country: { type: String, required: true, default: 'Nigeria' },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const OrderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    unit: {
      type: String,
      default: null,
      trim: true,
    },
    fulfillmentType: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: null,
    },
    pickupBranch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    pickupBranchName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const FULFILLMENT_STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];
const LEGACY_FULFILLMENT_STATUS_MAP: Record<string, string> = {
  unfulfilled: 'pending',
  fulfilled: 'packed',
  shipped: 'out_for_delivery',
};

function normalizeFulfillmentStatus(value: unknown) {
  const normalized = String(value || 'pending').trim().toLowerCase();
  return LEGACY_FULFILLMENT_STATUS_MAP[normalized] || normalized;
}

const OrderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    branchName: {
      type: String,
      default: null,
      trim: true,
    },
    fulfillmentType: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: null,
    },
    pickupBranch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    pickupBranchName: {
      type: String,
      default: null,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    items: {
      type: [OrderItemSchema],
      required: [true, 'Order items are required'],
      validate: [
        (arr: IOrderItem[]) => arr.length > 0,
        'Order must contain at least one item',
      ],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    shippingAddress: {
      type: ShippingAddressSchema,
      required: [true, 'Shipping address is required'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    fulfillmentStatus: {
      type: String,
      enum: FULFILLMENT_STATUSES,
      default: 'pending',
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'queued', 'assigned', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'],
      default: 'pending',
    },
    deliveryAssignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveryAssignedAt: {
      type: Date,
      default: null,
    },
    deliveryQueuedAt: {
      type: Date,
      default: null,
    },
    deliveryOutForDeliveryAt: {
      type: Date,
      default: null,
    },
    deliveryFailureReason: {
      type: String,
      default: null,
    },
    deliveryNotes: {
      type: String,
      default: null,
    },
    deliveryUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    refundStatus: {
      type: String,
      enum: ['none', 'requested', 'processing', 'completed', 'failed'],
      default: 'none',
    },
    refundReference: {
      type: String,
      default: null,
    },
    refundAmount: {
      type: Number,
      default: null,
    },
    refundRequestedAt: {
      type: Date,
      default: null,
    },
    refundProcessedAt: {
      type: Date,
      default: null,
    },
    refundReason: {
      type: String,
      default: null,
    },
    refundLastError: {
      type: String,
      default: null,
    },
    trackingNumber: {
      type: String,
      default: null,
    },
    carrier: {
      type: String,
      default: null,
    },
    shippedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    paystackReference: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

OrderSchema.pre('validate', function () {
  const doc = this as IOrder;
  doc.fulfillmentStatus = normalizeFulfillmentStatus(doc.fulfillmentStatus) as IOrder['fulfillmentStatus'];
});

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ branch: 1, createdAt: -1 });
OrderSchema.index({ email: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ fulfillmentStatus: 1 });
OrderSchema.index({ branch: 1, deliveryStatus: 1, createdAt: -1 });
OrderSchema.index({ deliveryAssignedTo: 1, deliveryStatus: 1, createdAt: -1 });

const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;

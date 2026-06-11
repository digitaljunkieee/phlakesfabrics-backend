import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISupportReply {
  message: string;
  isAdminReply: boolean;
  user?: Types.ObjectId | null;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  user?: Types.ObjectId | null;
  email?: string | null;
  subject: string;
  priority: 'low' | 'medium' | 'high';
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  replies: ISupportReply[];
  createdAt: Date;
  updatedAt: Date;
}

const SupportReplySchema = new Schema<ISupportReply>(
  {
    message: { type: String, required: true, trim: true },
    isAdminReply: { type: Boolean, default: false },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, lowercase: true, trim: true },
    subject: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
    replies: { type: [SupportReplySchema], default: [] },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ user: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

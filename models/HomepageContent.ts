import mongoose, { Schema, Document } from 'mongoose';

export interface IHomepageBanner {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  href?: string;
  image?: string;
  placement?: string;
  tone?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface IHomepageSection {
  title: string;
  key: string;
  hint?: string;
  collection?: string;
  category?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface IHomepageContent extends Document {
  key: string;
  banners: IHomepageBanner[];
  sections: IHomepageSection[];
  createdAt: Date;
  updatedAt: Date;
}

const HomepageBannerSchema = new Schema<IHomepageBanner>(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '', trim: true },
    ctaLabel: { type: String, default: 'Shop now', trim: true },
    href: { type: String, default: '/shop', trim: true },
    image: { type: String, default: '', trim: true },
    placement: { type: String, default: 'homepage_promo', trim: true },
    tone: { type: String, default: 'red', trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const HomepageSectionSchema = new Schema<IHomepageSection>(
  {
    title: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    hint: { type: String, default: '', trim: true },
    collection: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const HomepageContentSchema = new Schema<IHomepageContent>(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    banners: { type: [HomepageBannerSchema], default: [] },
    sections: { type: [HomepageSectionSchema], default: [] },
  },
  { timestamps: true }
);

const HomepageContent =
  mongoose.models.HomepageContent || mongoose.model<IHomepageContent>('HomepageContent', HomepageContentSchema);

export default HomepageContent;

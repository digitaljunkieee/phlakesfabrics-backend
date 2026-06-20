import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name?: string;
  title: string;
  slug: string;
  sku?: string;
  description: string;
  short_description?: string;
  price: number;
  discount?: number;
  compare_at_price?: number;
  old_price?: number;
  price_text?: string;
  old_price_text?: string;
  stock: number;
  images: string[];
  image?: string;
  category: string;
  category_id?: string;
  brand?: string;
  brand_id?: string;
  collection_id?: string;
  homepage_sections?: string[];
  isFeatured: boolean;
  is_featured?: boolean;
  specs?: Record<string, any>;
  details?: Record<string, any>;
  colors?: any[];
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'unpublished';
  rating:number;
  reviewCount:number;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [255, 'Name cannot exceed 255 characters'],
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: [255, 'Title cannot exceed 255 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    short_description: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    compare_at_price: {
      type: Number,
      default: null,
    },
    old_price: {
      type: Number,
      default: null,
    },
    price_text: {
      type: String,
      default: null,
    },
    old_price_text: {
      type: String,
      default: null,
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 100,
    },
    images: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    category_id: {
      type: String,
      trim: true,
      default: '',
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    brand_id: {
      type: String,
      trim: true,
      default: '',
    },
    collection_id: {
      type: String,
      trim: true,
      default: '',
    },
    homepage_sections: {
      type: [String],
      default: [],
      set: (values: unknown) => {
        const rawValues = Array.isArray(values)
          ? values
          : typeof values === 'string'
            ? values.split(',')
            : [];

        return Array.from(
          new Set(
            rawValues
              .map((value) => String(value ?? '').trim().toLowerCase())
              .filter(Boolean)
          )
        );
      },
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    is_featured: {
      type: Boolean,
      default: false,
    },
    specs: {
      type: Schema.Types.Mixed,
      default: {},
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    colors: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    status: { 
      type: String, 
      enum: ['draft', 'published', 'unpublished'], 
      default: 'draft' 
    },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

ProductSchema.pre('validate', function () {
  const doc = this as any;
  if (!doc.title && doc.name) doc.title = doc.name;
  if (!doc.name && doc.title) doc.name = doc.title;
  if (!doc.slug && doc.title) {
    doc.slug = String(doc.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  if (!doc.category && doc.category_id) doc.category = doc.category_id;
  if (!doc.category_id && doc.category) doc.category_id = doc.category;
  if (!doc.description) doc.description = 'No description provided.';
  if ((!doc.image || doc.image === null) && Array.isArray(doc.images) && doc.images[0]) doc.image = doc.images[0];
});

// Prevent model recompilation in development
const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;

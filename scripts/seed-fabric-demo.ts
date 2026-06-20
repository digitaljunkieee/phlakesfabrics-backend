import path from 'path';
import dotenv from 'dotenv';
import { fabricImage } from '../lib/fabricAssets';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function localAsset(fileName: string) {
  const asset = fabricImage(fileName);
  if (!asset) {
    throw new Error(`Missing Cloudinary asset for ${fileName}`);
  }
  return asset;
}

function inventoryStatus(quantity: number, lowStockThreshold: number) {
  if (quantity <= 0) return 'out_of_stock';
  if (lowStockThreshold > 0 && quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

const imagePool = {
  brocade: [
    localAsset('Brocade By First Lady pink.jpeg'),
    localAsset('Brocade By First Lady red.jpeg'),
    localAsset('Brocade By First Lady yellow.jpeg'),
  ],
  wool: [
    localAsset('Classic Wool by RichMondo black.jpeg'),
    localAsset('Classic Wool by RichMondo Camel Beige.jpeg'),
    localAsset('Classic Wool by RichMondo gray.jpeg'),
  ],
  stocks: [
    localAsset('Design Stocks purple.jpeg'),
    localAsset('Design Stocks red.jpeg'),
  ],
  vanetey: [
    localAsset('Exclusive Vanetey black.jpeg'),
    localAsset('Exclusive Vanetey light pink.jpeg'),
    localAsset('Exclusive Vanetey skyblue.jpeg'),
  ],
  isiAgu: [
    localAsset('isi agu black.jpeg'),
    localAsset('Isi Agu red.jpeg'),
  ],
  organdy: [
    localAsset('Organdy Brocade By first lady blue.jpeg'),
    localAsset('Organdy Brocade By first lady pink.jpeg'),
  ],
  tessile: [
    localAsset('Tessile Blue.jpeg'),
    localAsset('Tessile gray.jpeg'),
  ],
};

const categories = [
  { name: 'Brocade', slug: 'brocade', hint: 'Refined woven fabric for ceremony styling.' },
  { name: 'Wool', slug: 'wool', hint: 'Structured tailoring with a clean finish.' },
  { name: 'Design Stocks', slug: 'design-stocks', hint: 'Statement fabrics for elevated looks.' },
  { name: 'Vanetey', slug: 'vanetey', hint: 'Smooth occasion fabric with a soft drape.' },
  { name: 'Isi Agu', slug: 'isi-agu', hint: 'Traditional menswear fabric with presence.' },
  { name: 'Organdy Brocade', slug: 'organdy-brocade', hint: 'Sheer brocade for bridal and reception edits.' },
  { name: 'Tessile', slug: 'tessile', hint: 'Textured everyday tailoring fabric.' },
];

const branches = [
  {
    name: 'Branch A - lagos Flagship',
    slug: 'branch-a-lagos',
    code: 'BR-A',
    address: { line1: '12 Fabric Market Road', city: 'lagos', state: 'Imo', country: 'Nigeria' },
    phone: '+2348010001101',
    email: 'lagos@phlakesfabrics.local',
    workloadScore: 1,
    deliveryRadiusKm: 35,
    notes: 'Flagship branch for premium walk-in fabric consultations.',
  },
  {
    name: 'Branch B - Lagos Showroom',
    slug: 'branch-b-lagos',
    code: 'BR-B',
    address: { line1: '22 Balogun Street', city: 'Lagos Island', state: 'Lagos', country: 'Nigeria' },
    phone: '+2348010001102',
    email: 'lagos@phlakesfabrics.local',
    workloadScore: 2,
    deliveryRadiusKm: 45,
    notes: 'High-volume branch for weddings, luxury fabrics, and delivery dispatch.',
  },
  {
    name: 'Branch C - Abuja Pickup Hub',
    slug: 'branch-c-abuja',
    code: 'BR-C',
    address: { line1: '7 Garki Textile Plaza', city: 'Abuja', state: 'FCT', country: 'Nigeria' },
    phone: '+2348010001103',
    email: 'abuja@phlakesfabrics.local',
    workloadScore: 0,
    deliveryRadiusKm: 30,
    notes: 'Pickup-focused branch for northern customer orders.',
  },
];

const activeCategorySlugs = categories.map((category) => category.slug);

const collections = [
  ['New Arrivals', 'new-arrivals'],
  ['Best Sellers', 'best-sellers'],
  ['Trending Fabrics', 'trending-fabrics'],
  ['Wedding Collection', 'wedding-collection'],
  ['Luxury Collection', 'luxury-collection'],
  ['Affordable Picks', 'affordable-picks'],
  ['Staff Picks', 'staff-picks'],
  ['Seasonal Collections', 'seasonal-collections'],
];

const products = [
  {
    name: 'First Lady Brocade',
    category: 'Brocade',
    categorySlug: 'brocade',
    collection: 'new-arrivals',
    price: 18500,
    oldPrice: 22000,
    rating: 4.8,
    reviewCount: 32,
    images: imagePool.brocade,
    colors: [
      { name: 'Pink', hex: '#f472b6' },
      { name: 'Red', hex: '#dc2626' },
      { name: 'Yellow', hex: '#facc15' },
    ],
    patterns: ['Luminous brocade', 'Ceremony weave'],
    fabricType: 'Brocade',
    materialComposition: 'Premium woven brocade blend',
    usageSuggestions: ['Owambe styling', 'Statement wrappers', 'Elegant blouses'],
    inventory: [18, 14, 10],
    homepageSections: ['new-arrivals', 'campaign-shelf', 'seasonal-collections'],
  },
  {
    name: 'RichMondo Wool',
    category: 'Wool',
    categorySlug: 'wool',
    collection: 'best-sellers',
    price: 12500,
    oldPrice: 15000,
    rating: 4.7,
    reviewCount: 26,
    images: imagePool.wool,
    colors: [
      { name: 'Black', hex: '#111827' },
      { name: 'Camel Beige', hex: '#d6b48a' },
      { name: 'Gray', hex: '#9ca3af' },
    ],
    patterns: ['Tailored suiting', 'Soft weave'],
    fabricType: 'Classic wool',
    materialComposition: 'Wool-rich suiting blend',
    usageSuggestions: ['Trousers', 'Jackets', 'Corporate tailoring'],
    inventory: [9, 11, 8],
    homepageSections: ['best-sellers', 'affordable-picks', 'staff-picks'],
  },
  {
    name: 'Design Stocks Premium',
    category: 'Design Stocks',
    categorySlug: 'design-stocks',
    collection: 'trending-fabrics',
    price: 16500,
    oldPrice: 19500,
    rating: 4.6,
    reviewCount: 21,
    images: imagePool.stocks,
    colors: [
      { name: 'Purple', hex: '#7c3aed' },
      { name: 'Red', hex: '#dc2626' },
    ],
    patterns: ['Bold tonal weave', 'Smooth finish'],
    fabricType: 'Design stock fabric',
    materialComposition: 'Structured premium blend',
    usageSuggestions: ['Modern gowns', 'Tailored dresses', 'Asoebi looks'],
    inventory: [14, 12, 7],
    homepageSections: ['trending-fabrics', 'luxury-collection', 'campaign-shelf'],
  },
  {
    name: 'Exclusive Vanetey',
    category: 'Vanetey',
    categorySlug: 'vanetey',
    collection: 'staff-picks',
    price: 14500,
    oldPrice: 17200,
    rating: 4.5,
    reviewCount: 19,
    images: imagePool.vanetey,
    colors: [
      { name: 'Black', hex: '#111827' },
      { name: 'Light Pink', hex: '#f9c2d1' },
      { name: 'Sky Blue', hex: '#7dd3fc' },
    ],
    patterns: ['Soft drape', 'Matte finish'],
    fabricType: 'Vanetey fabric',
    materialComposition: 'Smooth fashion fabric blend',
    usageSuggestions: ['Event wear', 'Blouses', 'Minimal elegant dresses'],
    inventory: [12, 8, 6],
    homepageSections: ['staff-picks', 'new-arrivals', 'luxury-collection'],
  },
  {
    name: 'Isi Agu Regal',
    category: 'Isi Agu',
    categorySlug: 'isi-agu',
    collection: 'luxury-collection',
    price: 22000,
    oldPrice: 26000,
    rating: 4.9,
    reviewCount: 33,
    images: imagePool.isiAgu,
    colors: [
      { name: 'Black', hex: '#111827' },
      { name: 'Red', hex: '#b91c1c' },
    ],
    patterns: ['Regal motif', 'Traditional texture'],
    fabricType: 'Isi Agu',
    materialComposition: 'Premium ceremonial fabric blend',
    usageSuggestions: ['Traditional outfits', 'Occasion wear', 'Royal styling'],
    inventory: [8, 7, 5],
    homepageSections: ['best-sellers', 'luxury-collection', 'campaign-shelf'],
  },
  {
    name: 'First Lady Organdy Brocade',
    category: 'Organdy Brocade',
    categorySlug: 'organdy-brocade',
    collection: 'wedding-collection',
    price: 19500,
    oldPrice: 23500,
    rating: 4.8,
    reviewCount: 29,
    images: imagePool.organdy,
    colors: [
      { name: 'Blue', hex: '#3b82f6' },
      { name: 'Pink', hex: '#f472b6' },
    ],
    patterns: ['Airy organdy', 'Brocade shimmer'],
    fabricType: 'Organdy brocade',
    materialComposition: 'Sheer brocade blend',
    usageSuggestions: ['Bridal styling', 'Reception gowns', 'Ceremony accents'],
    inventory: [10, 9, 6],
    homepageSections: ['wedding-collection', 'luxury-collection', 'campaign-shelf'],
  },
  {
    name: 'Tessile Luxe',
    category: 'Tessile',
    categorySlug: 'tessile',
    collection: 'seasonal-collections',
    price: 9800,
    oldPrice: 11800,
    rating: 4.4,
    reviewCount: 17,
    images: imagePool.tessile,
    colors: [
      { name: 'Blue', hex: '#2563eb' },
      { name: 'Gray', hex: '#9ca3af' },
    ],
    patterns: ['Clean weave', 'Refined texture'],
    fabricType: 'Tessile',
    materialComposition: 'Breathable textured blend',
    usageSuggestions: ['Everyday tailoring', 'Shirts', 'Light jackets'],
    inventory: [13, 10, 9],
    homepageSections: ['seasonal-collections', 'affordable-picks', 'new-arrivals'],
  },
];

const targetProductSlugs = products.map((product) => slugify(product.name));

const homepageBanners = [
  {
    title: 'Wedding fabrics ready for branch pickup',
    subtitle: 'Shop brocade and organdy brocade pieces for ceremonies, receptions, and bridal styling.',
    ctaLabel: 'Shop wedding edit',
    href: '/shop?category=organdy-brocade',
    image: imagePool.organdy[0],
    placement: 'homepage_promo',
    tone: 'red',
    isActive: true,
    sortOrder: 10,
  },
  {
    title: 'Tailoring fabrics with clean structure and texture',
    subtitle: 'Wool, Tessile, and refined everyday fabrics for polished tailoring.',
    ctaLabel: 'Browse tailoring picks',
    href: '/shop?category=wool',
    image: imagePool.wool[2],
    placement: 'homepage_promo',
    tone: 'teal',
    isActive: true,
    sortOrder: 20,
  },
  {
    title: 'Color-rich fabrics for premium styling',
    subtitle: 'Bold colorways from Vanetey and design stocks curated by Phlakes.',
    ctaLabel: 'Explore luxury',
    href: '/shop?category=vanetey',
    image: imagePool.vanetey[2],
    placement: 'homepage_promo',
    tone: 'red',
    isActive: true,
    sortOrder: 30,
  },
];

const homepageSections = collections.map(([title, key], index) => ({
  title,
  key,
  hint:
    key === 'new-arrivals'
      ? 'Fresh bolts and new fabric drops'
      : key === 'best-sellers'
      ? 'Fast-moving customer favourites'
      : key === 'trending-fabrics'
      ? 'Styles customers are browsing now'
      : key === 'wedding-collection'
      ? 'Ceremony-ready brocade and organdy brocade'
      : key === 'luxury-collection'
      ? 'Premium textures and occasion fabrics'
      : key === 'affordable-picks'
      ? 'Good fabric, friendly price'
      : key === 'staff-picks'
      ? 'Curated by the Phlakes store team'
      : 'Built for current occasions and weather',
  collection: key,
  category: '',
  isActive: true,
  sortOrder: (index + 1) * 10,
}));

async function main() {
  const [{ default: mongoose }, { default: dbConnect }, { default: Product }, { default: Branch }, { default: Inventory }, { default: Collection }, { default: Category }, { default: HomepageContent }, { default: Review }] =
    await Promise.all([
      import('mongoose'),
      import('../lib/mongodb'),
      import('../models/Product'),
      import('../models/Branch'),
      import('../models/Inventory'),
      import('../models/Collection'),
      import('../models/Category'),
      import('../models/HomepageContent'),
      import('../models/Review'),
    ]);

  await dbConnect();

  await Category.updateMany(
    { slug: { $nin: activeCategorySlugs } },
    { $set: { isActive: false } }
  );

  for (const [index, category] of categories.entries()) {
    const slug = category.slug;
    await Category.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: category.name,
          slug,
          description: category.hint || `${category.name} fabrics curated for a premium multi-branch fabric marketplace.`,
          isComingSoon: false,
          sortOrder: (index + 1) * 10,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }

  const branchDocs = new Map<string, any>();
  for (const branch of branches) {
    const doc = await Branch.findOneAndUpdate(
      { slug: branch.slug },
      { $set: { ...branch, isActive: true } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    );
    branchDocs.set(branch.slug, doc);
  }

  for (const [name, slug] of collections) {
    await Collection.findOneAndUpdate(
      { slug },
      { $set: { name, slug, isComingSoon: false } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    );
  }

  await HomepageContent.findOneAndUpdate(
    { key: 'main' },
    { $set: { key: 'main', banners: homepageBanners, sections: homepageSections } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
  );

  const productIds: any[] = [];
  for (const product of products) {
    const slug = slugify(product.name);
    const stock = product.inventory.reduce((sum, qty) => sum + qty, 0);
    const oldPrice = product.oldPrice || null;
    const discount = oldPrice && oldPrice > product.price ? Math.round(((oldPrice - product.price) / oldPrice) * 100) : 0;
    const categorySlug = product.categorySlug || slugify(product.category);

    const doc = await Product.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: product.name,
          title: product.name,
          slug,
          sku: `PHF-${slug.toUpperCase().slice(0, 18)}`,
          description: `${product.name} is a premium ${product.fabricType.toLowerCase()} selected for fabric lovers who need reliable quality, clear branch availability, and flexible pickup or delivery.`,
          short_description: `${product.fabricType} with ${product.patterns.join(', ').toLowerCase()} styling.`,
          price: product.price,
          old_price: oldPrice,
          compare_at_price: oldPrice,
          discount,
          stock,
          images: product.images,
          image: product.images[0],
          category: product.category,
          category_id: categorySlug,
          brand: 'Phlakes Fabrics',
          brand_id: 'phlakes-fabrics',
          collection_id: product.collection,
          homepage_sections: Array.isArray(product.homepageSections) ? product.homepageSections : [],
          isFeatured: true,
          is_featured: true,
          status: 'published',
          rating: product.rating,
          reviewCount: product.reviewCount,
          colors: product.colors,
          specs: {
            fabricType: product.fabricType,
            materialComposition: product.materialComposition,
            availableColors: product.colors.map((color) => color.name),
            colors: product.colors.map((color) => color.name),
            patterns: product.patterns,
            careInstructions: ['Hand wash gently or dry clean', 'Do not bleach', 'Iron on low heat from reverse side'],
            usageSuggestions: product.usageSuggestions,
            pricePerUnit: 'Per Yard',
            units: ['Per Yard', 'Per Meter', 'Full Bundle'],
          },
          details: {
            fabricType: product.fabricType,
            materialComposition: product.materialComposition,
            availableColors: product.colors.map((color) => color.name),
            availablePatterns: product.patterns,
            careInstructions: ['Hand wash gently or dry clean', 'Do not bleach', 'Store folded in a cool dry place'],
            usageSuggestions: product.usageSuggestions,
            pricePerUnit: 'Per Yard',
            unitOptions: ['Per Yard', 'Per Meter', 'Full Bundle'],
            collection: product.collection,
          },
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    );

    productIds.push(doc._id);

    for (const [index, branchSlug] of ['branch-a-lagos', 'branch-b-lagos', 'branch-c-abuja'].entries()) {
      const branch = branchDocs.get(branchSlug);
      const quantity = product.inventory[index] || 0;
      const lowStockThreshold = product.price > 18000 ? 3 : 6;

      await Inventory.findOneAndUpdate(
        { product: doc._id, branch: branch._id },
        {
          $set: {
            product: doc._id,
            branch: branch._id,
            quantity,
            reservedQuantity: 0,
            lowStockThreshold,
            status: inventoryStatus(quantity, lowStockThreshold),
            notes: `Demo inventory for ${product.name} at ${branch.name}`,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
      );
    }
  }

  await Product.deleteMany({ slug: { $nin: targetProductSlugs } });
  await Inventory.deleteMany({ product: { $nin: productIds } });
  await Review.deleteMany({ product: { $nin: productIds } });
  await Review.deleteMany({ product: { $in: productIds }, comment: /^Demo:/ });

  const reviewSeeds = products.slice(0, 8).flatMap((product, index) => {
    const productId = productIds[index];
    return [
      {
        product: productId,
        rating: Math.min(5, Math.max(1, Math.round(product.rating))),
        comment: `Demo: Beautiful ${product.fabricType.toLowerCase()} quality. The branch stock indicator made pickup easy.`,
        photos: [product.images[0]],
      },
      {
        product: productId,
        rating: Math.min(5, Math.max(1, Math.floor(product.rating))),
        comment: `Demo: Fabric matched the photos and worked well for ${product.usageSuggestions[0].toLowerCase()}.`,
        photos: product.images[1] ? [product.images[1]] : [],
      },
    ];
  });

  await Review.insertMany(reviewSeeds);

  console.log(`Seeded ${categories.length} fabric categories.`);
  console.log(`Seeded ${branchDocs.size} branches.`);
  console.log(`Seeded ${collections.length} collections and ${homepageSections.length} homepage sections.`);
  console.log(`Seeded ${products.length} products with branch inventory across every homepage section.`);
  console.log(`Seeded ${reviewSeeds.length} demo reviews with customer photos.`);

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error('Fabric demo seed failed:', error);
  const mongoose = await import('mongoose');
  await mongoose.default.connection.close().catch(() => undefined);
  process.exit(1);
});

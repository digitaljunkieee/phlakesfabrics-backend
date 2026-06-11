import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function inventoryStatus(quantity: number, lowStockThreshold: number) {
  if (quantity <= 0) return 'out_of_stock';
  if (lowStockThreshold > 0 && quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

const imagePool = {
  ankara: [
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80',
  ],
  lace: [
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506629905607-d9ff2e6a6f67?auto=format&fit=crop&w=1200&q=80',
  ],
  silk: [
    'https://images.unsplash.com/photo-1603252109360-909baaf261c7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80',
  ],
  cotton: [
    'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1200&q=80',
  ],
};

const categories = [
  'Ankara',
  'Lace',
  'Aso Oke',
  'George',
  'Chiffon',
  'Silk',
  'Cotton',
  'Voile',
  'Bridal Fabrics',
  "Men's Fabrics",
  "Women's Fabrics",
];

const branches = [
  {
    name: 'Branch A - Owerri Flagship',
    slug: 'branch-a-owerri',
    code: 'BR-A',
    address: { line1: '12 Fabric Market Road', city: 'Owerri', state: 'Imo', country: 'Nigeria' },
    phone: '+2348010001101',
    email: 'owerri@phlakesfabrics.local',
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
    name: 'Ankara Bloom Wax Print',
    category: 'Ankara',
    collection: 'new-arrivals',
    price: 4500,
    oldPrice: 6000,
    rating: 4.8,
    reviewCount: 42,
    images: imagePool.ankara,
    colors: ['Sunflower Yellow', 'Cobalt Blue', 'Coral'],
    patterns: ['Floral', 'Geometric'],
    fabricType: 'Ankara wax print',
    materialComposition: '100% cotton wax',
    usageSuggestions: ['Everyday dresses', 'Skirts', 'Family occasion outfits'],
    inventory: [34, 20, 12],
  },
  {
    name: 'Royal Cord Lace Bridal Fabric',
    category: 'Lace',
    collection: 'wedding-collection',
    price: 18500,
    oldPrice: 22000,
    rating: 4.9,
    reviewCount: 58,
    images: imagePool.lace,
    colors: ['Ivory', 'Champagne', 'Rose Gold'],
    patterns: ['Cord lace', 'Embroidered floral'],
    fabricType: 'Cord lace',
    materialComposition: 'Poly-cotton lace with embroidered cord finish',
    usageSuggestions: ['Bridal gowns', 'Asoebi', 'Reception dresses'],
    inventory: [10, 8, 5],
  },
  {
    name: 'Heritage Aso Oke Stripe',
    category: 'Aso Oke',
    collection: 'staff-picks',
    price: 12500,
    oldPrice: 15000,
    rating: 4.7,
    reviewCount: 35,
    images: imagePool.ankara.slice().reverse(),
    colors: ['Wine', 'Gold', 'Cream'],
    patterns: ['Traditional stripe', 'Metallic accent'],
    fabricType: 'Aso Oke',
    materialComposition: 'Handwoven cotton blend with lurex detail',
    usageSuggestions: ['Gele', 'Agbada trims', 'Traditional ceremonies'],
    inventory: [14, 9, 11],
  },
  {
    name: 'Emerald George Wrapper Fabric',
    category: 'George',
    collection: 'luxury-collection',
    price: 26000,
    oldPrice: 31000,
    rating: 4.9,
    reviewCount: 31,
    images: imagePool.silk,
    colors: ['Emerald', 'Gold', 'Black'],
    patterns: ['Regal motif', 'Jacquard'],
    fabricType: 'George wrapper fabric',
    materialComposition: 'Premium viscose blend with woven motifs',
    usageSuggestions: ['Wrapper sets', 'Traditional occasions', 'Mother-of-the-bride styling'],
    inventory: [6, 10, 4],
  },
  {
    name: 'Pastel Chiffon Flow Fabric',
    category: 'Chiffon',
    collection: 'new-arrivals',
    price: 3800,
    oldPrice: 5200,
    rating: 4.4,
    reviewCount: 18,
    images: imagePool.silk.slice().reverse(),
    colors: ['Blush Pink', 'Mint', 'Sky Blue'],
    patterns: ['Plain', 'Soft drape'],
    fabricType: 'Chiffon',
    materialComposition: 'Lightweight polyester chiffon',
    usageSuggestions: ['Flowy gowns', 'Scarves', 'Layered occasion wear'],
    inventory: [26, 18, 16],
  },
  {
    name: 'Pure Silk Champagne Satin',
    category: 'Silk',
    collection: 'luxury-collection',
    price: 22000,
    oldPrice: 26500,
    rating: 4.8,
    reviewCount: 27,
    images: imagePool.silk,
    colors: ['Champagne', 'Pearl', 'Soft Gold'],
    patterns: ['Plain satin sheen'],
    fabricType: 'Silk satin',
    materialComposition: 'Silk-rich satin blend',
    usageSuggestions: ['Luxury gowns', 'Evening wear', 'Bridal robes'],
    inventory: [8, 7, 3],
  },
  {
    name: 'Everyday Cotton Adire Print',
    category: 'Cotton',
    collection: 'affordable-picks',
    price: 2800,
    oldPrice: 3500,
    rating: 4.5,
    reviewCount: 49,
    images: imagePool.cotton,
    colors: ['Indigo', 'White', 'Ocean Blue'],
    patterns: ['Adire', 'Tie-dye'],
    fabricType: 'Cotton print',
    materialComposition: 'Breathable cotton',
    usageSuggestions: ['Casual shirts', 'Dresses', 'Children outfits'],
    inventory: [45, 32, 25],
  },
  {
    name: 'Voile Summer Floral Fabric',
    category: 'Voile',
    collection: 'seasonal-collections',
    price: 3200,
    oldPrice: 4100,
    rating: 4.3,
    reviewCount: 16,
    images: imagePool.cotton.slice().reverse(),
    colors: ['Lilac', 'White', 'Leaf Green'],
    patterns: ['Summer floral'],
    fabricType: 'Voile',
    materialComposition: 'Soft cotton voile',
    usageSuggestions: ['Light kaftans', 'Blouses', 'Resort wear'],
    inventory: [22, 19, 14],
  },
  {
    name: "Men's Senator Brocade",
    category: "Men's Fabrics",
    collection: 'best-sellers',
    price: 9000,
    oldPrice: 12000,
    rating: 4.7,
    reviewCount: 64,
    images: imagePool.ankara,
    colors: ['Navy', 'Charcoal', 'Ivory'],
    patterns: ['Brocade texture', 'Subtle motif'],
    fabricType: 'Brocade',
    materialComposition: 'Cotton-poly brocade',
    usageSuggestions: ['Senator wear', 'Agbada', 'Traditional shirts'],
    inventory: [18, 26, 15],
  },
  {
    name: "Women's Luxury Organza Applique",
    category: "Women's Fabrics",
    collection: 'trending-fabrics',
    price: 14500,
    oldPrice: 18000,
    rating: 4.6,
    reviewCount: 37,
    images: imagePool.lace.slice().reverse(),
    colors: ['Dusty Rose', 'Silver', 'Mauve'],
    patterns: ['Applique', '3D floral'],
    fabricType: 'Organza applique',
    materialComposition: 'Sheer organza with applique embroidery',
    usageSuggestions: ['Statement sleeves', 'Dinner gowns', 'Asoebi styles'],
    inventory: [11, 13, 7],
  },
  {
    name: 'Bridal Pearl Lace',
    category: 'Bridal Fabrics',
    collection: 'wedding-collection',
    price: 30000,
    oldPrice: 36000,
    rating: 5,
    reviewCount: 21,
    images: imagePool.lace,
    colors: ['Pearl White', 'Ivory', 'Soft Nude'],
    patterns: ['Pearl beading', 'Floral lace'],
    fabricType: 'Pearl bridal lace',
    materialComposition: 'Beaded lace on soft mesh',
    usageSuggestions: ['Wedding gowns', 'Veils', 'Reception dresses'],
    inventory: [4, 6, 2],
  },
  {
    name: 'George and Lace Occasion Combo',
    category: 'George',
    collection: 'staff-picks',
    price: 19500,
    oldPrice: 24000,
    rating: 4.6,
    reviewCount: 24,
    images: [...imagePool.silk.slice(0, 2), imagePool.lace[0]],
    colors: ['Royal Purple', 'Gold', 'Cream'],
    patterns: ['Wrapper motif', 'Cord lace accent'],
    fabricType: 'George and lace combo',
    materialComposition: 'George wrapper with lace blouse fabric',
    usageSuggestions: ['Traditional sets', 'Owambe outfits', 'Family ceremonies'],
    inventory: [9, 7, 8],
  },
  {
    name: 'Affordable Ankara Combo Pack',
    category: 'Ankara',
    collection: 'affordable-picks',
    price: 6200,
    oldPrice: 8500,
    rating: 4.5,
    reviewCount: 44,
    images: imagePool.ankara.slice(1),
    colors: ['Orange', 'Teal', 'Chocolate'],
    patterns: ['Mixed print bundle'],
    fabricType: 'Ankara combo',
    materialComposition: 'Cotton wax print bundle',
    usageSuggestions: ['Family matching outfits', 'Quick tailoring', 'Resale bundles'],
    inventory: [28, 24, 18],
  },
  {
    name: 'Rainy Season Cotton Voile',
    category: 'Voile',
    collection: 'seasonal-collections',
    price: 3600,
    oldPrice: 4600,
    rating: 4.4,
    reviewCount: 13,
    images: imagePool.cotton,
    colors: ['Sage', 'Cream', 'Rust'],
    patterns: ['Botanical print'],
    fabricType: 'Cotton voile',
    materialComposition: 'Soft cotton voile blend',
    usageSuggestions: ['Loose dresses', 'Office blouses', 'Travel outfits'],
    inventory: [17, 12, 10],
  },
];

const homepageBanners = [
  {
    title: 'Wedding fabrics ready for branch pickup',
    subtitle: 'Shop pearl lace, George wrappers, and Aso Oke pieces for ceremonies.',
    ctaLabel: 'Shop wedding edit',
    href: '/shop?collection=wedding-collection',
    image: imagePool.lace[0],
    placement: 'homepage_promo',
    tone: 'red',
    isActive: true,
    sortOrder: 10,
  },
  {
    title: 'Affordable everyday fabrics under budget',
    subtitle: 'Cotton, voile, and Ankara picks for everyday tailoring.',
    ctaLabel: 'Browse affordable picks',
    href: '/shop?collection=affordable-picks',
    image: imagePool.cotton[0],
    placement: 'homepage_promo',
    tone: 'teal',
    isActive: true,
    sortOrder: 20,
  },
  {
    title: 'Luxury textures for premium styling',
    subtitle: 'Silk, chiffon, applique, and George fabrics curated by Phlakes.',
    ctaLabel: 'Explore luxury',
    href: '/shop?collection=luxury-collection',
    image: imagePool.silk[0],
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
      ? 'Ceremony-ready lace, George, and Aso Oke'
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

  for (const [index, name] of categories.entries()) {
    const slug = slugify(name);
    await Category.findOneAndUpdate(
      { slug },
      {
        $set: {
          name,
          slug,
          description: `${name} fabrics curated for a premium multi-branch fabric marketplace.`,
          isComingSoon: false,
          sortOrder: (index + 1) * 10,
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
    const categorySlug = slugify(product.category);

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
          isFeatured: true,
          is_featured: true,
          status: 'published',
          rating: product.rating,
          reviewCount: product.reviewCount,
          colors: product.colors.map((color) => ({ name: color, value: color })),
          specs: {
            fabricType: product.fabricType,
            materialComposition: product.materialComposition,
            availableColors: product.colors,
            colors: product.colors,
            patterns: product.patterns,
            careInstructions: ['Hand wash gently or dry clean', 'Do not bleach', 'Iron on low heat from reverse side'],
            usageSuggestions: product.usageSuggestions,
            pricePerUnit: 'Per Yard',
            units: ['Per Yard', 'Per Meter', 'Full Bundle'],
          },
          details: {
            fabricType: product.fabricType,
            materialComposition: product.materialComposition,
            availableColors: product.colors,
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

    for (const [index, branchSlug] of ['branch-a-owerri', 'branch-b-lagos', 'branch-c-abuja'].entries()) {
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

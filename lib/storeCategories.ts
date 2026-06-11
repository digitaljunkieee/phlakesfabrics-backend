export const STORE_CATEGORIES = [
  { name: 'Ankara', slug: 'ankara', isComingSoon: false, sortOrder: 10 },
  { name: 'Lace', slug: 'lace', isComingSoon: false, sortOrder: 20 },
  { name: 'Aso Oke', slug: 'aso-oke', isComingSoon: false, sortOrder: 30 },
  { name: 'George', slug: 'george', isComingSoon: false, sortOrder: 40 },
  { name: 'Chiffon', slug: 'chiffon', isComingSoon: false, sortOrder: 50 },
  { name: 'Silk', slug: 'silk', isComingSoon: false, sortOrder: 60 },
  { name: 'Cotton', slug: 'cotton', isComingSoon: false, sortOrder: 70 },
  { name: 'Voile', slug: 'voile', isComingSoon: false, sortOrder: 80 },
  { name: 'Bridal Fabrics', slug: 'bridal-fabrics', isComingSoon: false, sortOrder: 90 },
  { name: "Men's Fabrics", slug: 'mens-fabrics', isComingSoon: false, sortOrder: 100 },
  { name: "Women's Fabrics", slug: 'womens-fabrics', isComingSoon: false, sortOrder: 110 },
];

export const STORE_CATEGORY_SLUGS = STORE_CATEGORIES.map((category) => category.slug);

const STORE_CATEGORY_ALIASES: Record<string, string> = {
  ankara: 'ankara',
  lace: 'lace',
  'aso-oke': 'aso-oke',
  asooke: 'aso-oke',
  george: 'george',
  chiffon: 'chiffon',
  silk: 'silk',
  cotton: 'cotton',
  voile: 'voile',
  bridal: 'bridal-fabrics',
  'bridal-fabric': 'bridal-fabrics',
  'bridal-fabrics': 'bridal-fabrics',
  mens: 'mens-fabrics',
  'mens-fabric': 'mens-fabrics',
  'mens-fabrics': 'mens-fabrics',
  womens: 'womens-fabrics',
  'womens-fabric': 'womens-fabrics',
  'womens-fabrics': 'womens-fabrics',
};

export function normalizeStoreCategorySlug(value = '') {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  return STORE_CATEGORY_ALIASES[slug] || slug;
}

export function findStoreCategory(value = '') {
  const slug = normalizeStoreCategorySlug(value);
  return STORE_CATEGORIES.find((category) => category.slug === slug);
}

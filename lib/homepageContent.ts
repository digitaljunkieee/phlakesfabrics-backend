type AnyRecord = Record<string, any>;

export const DEFAULT_HOMEPAGE_BANNERS = [
  {
    title: 'Lace and George pieces for ceremonies, owambe, and bridal styling',
    subtitle: 'Promotional picks with branch pickup and delivery options.',
    ctaLabel: 'Shop the edit',
    href: '/shop?category=lace',
    image: '',
    placement: 'homepage_promo',
    tone: 'red',
    isActive: true,
    sortOrder: 10,
  },
  {
    title: 'Cotton, voile, and chiffon for daily tailoring',
    subtitle: 'Affordable fabrics for everyday outfits and quick tailoring needs.',
    ctaLabel: 'Browse affordable picks',
    href: '/shop?category=cotton',
    image: '',
    placement: 'homepage_promo',
    tone: 'teal',
    isActive: true,
    sortOrder: 20,
  },
];

export const DEFAULT_HOMEPAGE_SECTIONS = [
  { title: 'New Arrivals', key: 'new-arrivals', hint: 'Fresh bolts and new drops', collection: 'new-arrivals', category: '', isActive: true, sortOrder: 10 },
  { title: 'Best Sellers', key: 'best-sellers', hint: 'Customer favourites', collection: 'best-sellers', category: '', isActive: true, sortOrder: 20 },
  { title: 'Trending Fabrics', key: 'trending-fabrics', hint: 'Fast-moving styles', collection: 'trending-fabrics', category: '', isActive: true, sortOrder: 30 },
  { title: 'Wedding Collection', key: 'wedding-collection', hint: 'Ceremony-ready fabrics', collection: 'wedding-collection', category: '', isActive: true, sortOrder: 40 },
  { title: 'Luxury Collection', key: 'luxury-collection', hint: 'Premium textures and finishes', collection: 'luxury-collection', category: '', isActive: true, sortOrder: 50 },
  { title: 'Affordable Picks', key: 'affordable-picks', hint: 'Great fabric, friendly price', collection: 'affordable-picks', category: '', isActive: true, sortOrder: 60 },
  { title: 'Staff Picks', key: 'staff-picks', hint: 'Curated by the store team', collection: 'staff-picks', category: '', isActive: true, sortOrder: 70 },
  { title: 'Seasonal Collections', key: 'seasonal-collections', hint: 'Built for current occasions', collection: 'seasonal-collections', category: '', isActive: true, sortOrder: 80 },
];

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeHomepageBanner(value: unknown, index = 0) {
  const input = (value && typeof value === 'object' ? value : {}) as AnyRecord;
  return {
    title: cleanString(input.title) || 'Homepage banner',
    subtitle: cleanString(input.subtitle),
    ctaLabel: cleanString(input.ctaLabel) || cleanString(input.cta_label) || 'Shop now',
    href: cleanString(input.href) || '/shop',
    image: cleanString(input.image),
    placement: cleanString(input.placement) || 'homepage_promo',
    tone: cleanString(input.tone) || 'red',
    isActive: input.isActive === undefined ? true : Boolean(input.isActive),
    sortOrder: cleanNumber(input.sortOrder ?? input.sort_order, (index + 1) * 10),
  };
}

export function sanitizeHomepageSection(value: unknown, index = 0) {
  const input = (value && typeof value === 'object' ? value : {}) as AnyRecord;
  const title = cleanString(input.title) || 'Homepage Section';
  const key = cleanString(input.key) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  return {
    title,
    key,
    hint: cleanString(input.hint),
    collection: cleanString(input.collection),
    category: cleanString(input.category),
    isActive: input.isActive === undefined ? true : Boolean(input.isActive),
    sortOrder: cleanNumber(input.sortOrder ?? input.sort_order, (index + 1) * 10),
  };
}

export function formatHomepageContent(doc: AnyRecord | null | undefined) {
  const raw = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {};
  const bannersSource = Array.isArray(raw.banners) && raw.banners.length ? raw.banners : DEFAULT_HOMEPAGE_BANNERS;
  const sectionsSource = Array.isArray(raw.sections) && raw.sections.length ? raw.sections : DEFAULT_HOMEPAGE_SECTIONS;

  const banners = bannersSource
    .map((item: unknown, index: number) => sanitizeHomepageBanner(item, index))
    .sort((a: ReturnType<typeof sanitizeHomepageBanner>, b: ReturnType<typeof sanitizeHomepageBanner>) => a.sortOrder - b.sortOrder);

  const sections = sectionsSource
    .map((item: unknown, index: number) => sanitizeHomepageSection(item, index))
    .sort((a: ReturnType<typeof sanitizeHomepageSection>, b: ReturnType<typeof sanitizeHomepageSection>) => a.sortOrder - b.sortOrder);

  return {
    id: raw._id ? String(raw._id) : undefined,
    key: raw.key || 'main',
    banners,
    sections,
    updatedAt: raw.updatedAt || null,
  };
}

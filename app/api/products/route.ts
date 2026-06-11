import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Product from '../../../models/Product';
import Category from '../../../models/Category';
import Brand from '../../../models/Brand';
import Collection from '../../../models/Collection';
import mongoose from 'mongoose'; // Needed to access Brand and Collection models dynamically
import { formatProduct } from '../../../lib/adminProduct';
import Inventory from '../../../models/Inventory';
import Branch from '../../../models/Branch';

// Helper function to translate slugs to ObjectIds
async function translateSlugsToIds(modelName: string, slugs: string[]) {
  if (slugs.length === 0) return [];
  try {
    const Model = mongoose.models[modelName] || mongoose.model(modelName);
    const docs = await Model.find({ slug: { $in: slugs.map(s => new RegExp(`^${s}$`, 'i')) } });
    return docs.map(doc => doc._id.toString());
  } catch (e) {
    return [];
  }
}

// Helper to extract parameters
function extractParams(searchParams: URLSearchParams, keyPrefix: string, simpleKey: string) {
  const slugs: string[] = [];
  const pushValues = (value: string | null) => {
    if (!value || value === 'all') return;
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => slugs.push(entry));
  };

  pushValues(searchParams.get(simpleKey));
  pushValues(searchParams.get(`${simpleKey}s`));
  pushValues(searchParams.get(`filters[${simpleKey}]`));
  pushValues(searchParams.get(`filters[${simpleKey}s]`));

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith(keyPrefix)) pushValues(value);
  }

  return Array.from(new Set(slugs));
}

function getFirstParam(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null && value !== '') return value;
  }
  return null;
}

function getNumberParam(searchParams: URLSearchParams, keys: string[]) {
  const raw = getFirstParam(searchParams, keys);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function getBranchAddress(branch: Record<string, any>) {
  const address = asRecord(branch.address);
  return [address.line1, address.city, address.state, address.country].filter(Boolean).join(', ');
}

function formatBranchAvailability(entry: Record<string, any>) {
  const branch = asRecord(entry.branch);
  const quantity = Number(entry.quantity || 0);
  const reservedQuantity = Number(entry.reservedQuantity || 0);
  const availableQuantity = Math.max(0, quantity - reservedQuantity);

  return {
    id: cleanString(entry._id || entry.id),
    inventoryId: cleanString(entry._id || entry.id),
    branchId: cleanString(branch._id || branch.id || entry.branch),
    branchName: cleanString(branch.name) || 'Branch',
    branchSlug: cleanString(branch.slug),
    branchCode: cleanString(branch.code),
    branchAddress: getBranchAddress(branch),
    branchPhone: cleanString(branch.phone),
    branchIsActive: branch.isActive !== false,
    deliveryRadiusKm: branch.deliveryRadiusKm ?? null,
    quantity,
    reservedQuantity,
    availableQuantity,
    lowStockThreshold: Number(entry.lowStockThreshold || 0),
    status: entry.status || (availableQuantity > 0 ? 'in_stock' : 'out_of_stock'),
    canPickup: branch.isActive !== false && availableQuantity > 0,
    canDeliver: branch.isActive !== false && availableQuantity > 0,
  };
}

function summarizeAvailability(rows: Record<string, any>[], legacyStock: number) {
  const branchAvailability = rows.map((entry) => formatBranchAvailability(entry));
  const activeRows = branchAvailability.filter((entry) => entry.branchIsActive && entry.status !== 'inactive');
  const totalAvailable = activeRows.reduce((sum, entry) => sum + Number(entry.availableQuantity || 0), 0);
  const inStockBranchCount = activeRows.filter((entry) => Number(entry.availableQuantity || 0) > 0).length;
  const lowStockBranchCount = activeRows.filter((entry) => entry.status === 'low_stock').length;
  const outOfStockBranchCount = activeRows.filter((entry) => Number(entry.availableQuantity || 0) <= 0).length;
  const fallbackAvailable = branchAvailability.length === 0 ? Math.max(0, Number(legacyStock || 0)) : totalAvailable;
  const status = fallbackAvailable <= 0 ? 'out_of_stock' : lowStockBranchCount > 0 ? 'low_stock' : 'in_stock';

  return {
    branchAvailability,
    availability: {
      status,
      totalAvailable: fallbackAvailable,
      branchCount: activeRows.length,
      inStockBranchCount,
      lowStockBranchCount,
      outOfStockBranchCount,
      hasBranchInventory: branchAvailability.length > 0,
      estimatedAvailability:
        fallbackAvailable > 0
          ? branchAvailability.length > 0
            ? 'Available for pickup or delivery from selected branches'
            : 'Available from online stock'
          : 'Restock pending',
    },
    totalAvailable: fallbackAvailable,
    inStockBranchCount,
    branchCount: activeRows.length,
  };
}

async function buildAvailabilityByProduct(products: any[]) {
  const productIds = products.map((product) => String(product._id || product.id)).filter(Boolean);
  if (productIds.length === 0) return new Map<string, ReturnType<typeof summarizeAvailability>>();

  const inventoryRows = await Inventory.find({ product: { $in: productIds } })
    .populate({ path: 'branch', select: 'name slug code address phone isActive deliveryRadiusKm', model: Branch })
    .sort({ quantity: -1, updatedAt: -1 })
    .lean();

  const rowsByProduct = new Map<string, Record<string, any>[]>();
  for (const row of inventoryRows as any[]) {
    const productId = String(row.product?._id || row.product?.id || row.product || '');
    if (!productId) continue;
    const rows = rowsByProduct.get(productId) || [];
    rows.push(row);
    rowsByProduct.set(productId, rows);
  }

  return new Map(
    products.map((product) => {
      const productId = String(product._id || product.id);
      return [productId, summarizeAvailability(rowsByProduct.get(productId) || [], Number(product.stock || 0))];
    })
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    await dbConnect();
    let query: any = { status: 'published' };
    const textSearch = cleanString(
      getFirstParam(searchParams, ['q', 'search', 'filters[q]', 'filters[search]', 'filters[query]'])
    );

    if (textSearch) {
      const expression = new RegExp(escapeRegex(textSearch), 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: expression },
          { name: expression },
          { description: expression },
          { short_description: expression },
          { category: expression },
          { category_id: expression },
          { brand: expression },
          { brand_id: expression },
          { collection_id: expression },
          { sku: expression },
        ],
      });
    }

    // 1. Process Categories
    const categorySlugs = extractParams(searchParams, 'filters[categories]', 'category');
    if (categorySlugs.length > 0) {
      const ids = await translateSlugsToIds('Category', categorySlugs);
      const values = [...ids, ...categorySlugs.map(s => new RegExp(`^${s}$`, 'i'))];
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { category: { $in: values } },
          { category_id: { $in: values } },
        ],
      });
    }

    // 2. Process Brands
    const brandSlugs = extractParams(searchParams, 'filters[brands]', 'brand');
    if (brandSlugs.length > 0) {
      const ids = await translateSlugsToIds('Brand', brandSlugs);
      // Depending on your schema, it might be named brand or brand_id. We check both.
      const values = [...ids, ...brandSlugs.map(s => new RegExp(`^${s}$`, 'i'))];
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { brand: { $in: values } },
          { brand_id: { $in: values } }
        ],
      });
    }

    // 3. Process Collections
    const collectionSlugs = extractParams(searchParams, 'filters[collections]', 'collection');
    if (collectionSlugs.length > 0) {
      const ids = await translateSlugsToIds('Collection', collectionSlugs);
      query.collection_id = { $in: [...ids, ...collectionSlugs.map(s => new RegExp(`^${s}$`, 'i'))] };
    }

    // 4. Process Price and Rating
    const minPrice = getNumberParam(searchParams, ['min_price', 'minPrice', 'filters[minPrice]', 'filters[min_price]']);
    const maxPrice = getNumberParam(searchParams, ['max_price', 'maxPrice', 'filters[maxPrice]', 'filters[max_price]']);
    if (minPrice !== null || maxPrice !== null) {
      query.price = {};
      if (minPrice !== null) query.price.$gte = minPrice;
      if (maxPrice !== null) query.price.$lte = maxPrice;
    }

    const rating = getNumberParam(searchParams, ['min_rating', 'rating', 'filters[rating]', 'filters[minRating]']);
    if (rating !== null) query.rating = { $gte: rating };

    // Execute Query
    const products = await Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await Product.countDocuments(query); 
    const availabilityMap = await buildAvailabilityByProduct(products);
    const formattedProducts = products.map((product: any) => ({
      ...formatProduct(product),
      ...(availabilityMap.get(String(product._id || product.id)) || summarizeAvailability([], Number(product.stock || 0))),
    }));

    return NextResponse.json({ success: true, data: formattedProducts, count: total }, { status: 200 });
  } catch (error) {
    console.error("Product fetch error:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 });
  }
}


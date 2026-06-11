import dbConnect from './mongodb';
import Product from '../models/Product';

function formatProduct(product: any) {
  return {
    ...product,
    id: String(product._id || product.id),
    _id: undefined,
    name: product.name || product.title,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

export async function getRelatedProducts(id: string, limit = 8) {
  if (!id) throw new Error('missing product id');

  await dbConnect();
  const base = await Product.findById(id).lean();
  if (!base) return { success: false, error: 'Product not found', status: 404 };

  const query: any = {
    _id: { $ne: id },
    status: 'published',
  };

  const relatedClauses = [];
  if ((base as any).category) relatedClauses.push({ category: (base as any).category });
  if ((base as any).brand) relatedClauses.push({ brand: (base as any).brand });
  if ((base as any).collection_id) relatedClauses.push({ collection_id: (base as any).collection_id });
  if (relatedClauses.length > 0) query.$or = relatedClauses;

  let products = await Product.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  if (products.length < limit) {
    const existingIds = new Set([id, ...products.map((product: any) => String(product._id))]);
    const fallback = await Product.find({ _id: { $nin: Array.from(existingIds) }, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(limit - products.length)
      .lean();
    products = [...products, ...fallback];
  }

  return { success: true, data: products.map(formatProduct) };
}

export default getRelatedProducts;

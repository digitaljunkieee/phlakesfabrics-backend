import Header from '../../components/Header';
import ProductActions from '../../components/ProductActions';
import dbConnect from '../../../lib/mongodb';
import Product from '../../../models/Product';
import Review from '../../../models/Review';

interface Props { params: Promise<{ id: string }> }

export default async function ProductPage({ params }: Props) {
  try {
    const { id } = await params;
    await dbConnect();

    const [productRaw, reviewsRaw] = await Promise.all([
      Product.findById(id).lean(),
      Review.find({ product: id }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!productRaw) {
      return (
        <div>
          <Header />
          <main className="container mx-auto py-8">Product not found</main>
        </div>
      );
    }

    const product: any = {
      ...productRaw,
      id: String((productRaw as any)._id),
      name: (productRaw as any).name || (productRaw as any).title,
    };
    const reviews = reviewsRaw.map((review: any) => ({
      ...review,
      id: String(review._id),
      body: review.body || review.comment || '',
      created_at: review.createdAt,
    }));
    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0) / reviews.length) * 10) / 10
      : null;

    return (
      <div>
        <Header />
        <main className="container mx-auto py-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-100 h-80 flex items-center justify-center">{product.images?.[0] ? <img src={product.images[0]} alt={product.name} /> : 'No image'}</div>
            <div>
              <h1 className="text-2xl font-bold">{product.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-lg">NGN {product.price}</p>
                {avgRating !== null ? (
                  <div className="text-sm text-yellow-600">Rating {avgRating} ({reviews.length})</div>
                ) : null}
              </div>
              <p className="mt-4 text-gray-700">{product.description}</p>

              {product.specs && Object.keys(product.specs).length > 0 ? (
                <div className="mt-4 border p-3 rounded">
                  <h4 className="font-semibold mb-2">Specifications</h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="flex">
                        <dt className="w-32 text-gray-600">{key}</dt>
                        <dd className="flex-1">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <ProductActions product={product} />
            </div>
          </div>

          {reviews.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">Customer reviews</h2>
              <ul className="space-y-4">
                {reviews.map((review: any) => (
                  <li key={review.id} className="border p-3 rounded">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">Rating: {review.rating || '-'}</div>
                      <div className="text-xs text-gray-500">{new Date(review.created_at).toLocaleString()}</div>
                    </div>
                    <p className="mt-2 text-gray-800">{review.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>
      </div>
    );
  } catch (err: any) {
    return (
      <div>
        <Header />
        <main className="container mx-auto py-8">Error loading product: {String(err?.message ?? err)}</main>
      </div>
    );
  }
}

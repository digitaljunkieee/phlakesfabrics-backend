import { getRelatedProducts } from '../../lib/related';
import Product from '../../models/Product';

jest.mock('../../lib/mongodb', () => jest.fn());
jest.mock('../../models/Product', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

const mockProduct = Product as jest.Mocked<typeof Product>;

function mockLeanResult<T>(result: T) {
  return { lean: jest.fn().mockResolvedValue(result) };
}

function mockFindResult<T>(result: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe('getRelatedProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns related Mongo products and excludes the base product', async () => {
    mockProduct.findById.mockReturnValue(mockLeanResult({ _id: 'base-id', category: 'cat1', brand: 'phlakesfabrics' }) as any);
    mockProduct.find.mockReturnValueOnce(mockFindResult([
      { _id: 'd', price: 99, category: 'cat1', createdAt: new Date('2025-03-01') },
      { _id: 'b', price: 95, category: 'cat1', createdAt: new Date('2025-02-01') },
    ]) as any);

    const res = await getRelatedProducts('base-id', 2);

    expect(res.success).toBe(true);
    expect(res.data?.map((product: any) => product.id)).toEqual(['d', 'b']);
    expect(res.data?.find((product: any) => product.id === 'base-id')).toBeUndefined();
  });
});

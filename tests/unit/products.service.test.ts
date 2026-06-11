import { getProducts, getProductById, createProduct } from '../../lib/products'

describe('products service (unit)', () => {
  test('getProducts returns an array', async () => {
    const items = await getProducts()
    expect(Array.isArray(items)).toBe(true)
  })

  test('getProductById returns a product when exists', async () => {
    const created = await createProduct({ name: 'Test Item', price: 1234 })
    const found = await getProductById(created.id as number)
    expect(found).not.toBeNull()
    expect(found?.name).toBe('Test Item')
  })

  test('createProduct creates and returns a product', async () => {
    const p = await createProduct({ name: 'Another', price: 200 })
    const all = await getProducts()
    const found = all.find((x) => x.id === p.id)
    expect(found).toBeDefined()
    expect(p.name).toBe('Another')
  })
})

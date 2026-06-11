export type Product = {
  id: number
  name: string
  price: number
  description?: string
}

const sampleProducts: Product[] = [
  { id: 1, name: 'Sample product', price: 1000, description: 'A demo item' },
]

export async function getProducts(): Promise<Product[]> {
  return sampleProducts
}

export async function getProductById(id: number): Promise<Product | null> {
  return sampleProducts.find((p) => p.id === id) ?? null
}

export async function createProduct(payload: Partial<Product>): Promise<Product> {
  const next: Product = { id: Date.now(), name: payload.name || 'Untitled', price: payload.price || 0, description: payload.description }
  sampleProducts.push(next)
  return next
}

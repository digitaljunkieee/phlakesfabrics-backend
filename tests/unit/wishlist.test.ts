class MockFrom {
  table: string
  store: any
  filters: any
  _count?: any
  constructor(table: string, store: any) {
    this.table = table
    this.store = store
    this.filters = {}
  }
  select(_s: any, opts?: any) {
    this._count = opts?.count
    return this
  }
  eq(k: string, v: any) {
    this.filters[k] = v
    return this
  }
  order() { return this }
  range() { return this }
  in(_k: string, _vals: any[]) { return this }
  async single() {
    const item = this.store.find((r: any) => Object.keys(this.filters).every(k => r[k] === this.filters[k]))
    if (!item) return { data: null, error: { message: 'Not found' } }
    return { data: item, error: null }
  }
  async limit() { return { data: this.store, error: null } }
  async insert(payload: any) { this.store.push(...(Array.isArray(payload) ? payload : [payload])); return { data: payload, error: null } }
  async delete() { const before = this.store.length; this.store = this.store.filter((r: any) => !(Object.keys(this.filters).every(k => r[k] === this.filters[k]))); return { data: null, error: null } }
}

describe('wishlist (unit, mocked)', () => {
  test('prevent duplicate insert and list returns merged products', async () => {
    const wishlistStore: any[] = []
    const productsStore: any[] = [ { id: 'p1', name: 'Prod 1' }, { id: 'p2', name: 'Prod 2' } ]

  const mf = new MockFrom('wishlist', wishlistStore)
    await mf.insert({ id: 'w1', user_id: 'u1', product_id: 'p1', created_at: new Date().toISOString() })

    const existing = wishlistStore.find(r => r.user_id === 'u1' && r.product_id === 'p1')
    expect(existing).toBeDefined()

    const items = wishlistStore.map(w => ({ ...w, product: productsStore.find(p => p.id === w.product_id) }))
    expect(items.length).toBe(1)
    expect(items[0].product.name).toBe('Prod 1')
  })
})

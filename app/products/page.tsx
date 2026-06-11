import Header from '../components/Header'
import ProductsClient from '../components/ProductsClient'

export default async function ProductsPage() {
  return (
    <div>
      <Header />
      <main className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Products</h1>
        {}
        <ProductsClient />
      </main>
    </div>
  )
}

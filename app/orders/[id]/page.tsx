import Header from '../../components/Header'
import { getBaseUrl } from '../../../lib/getBaseUrl'

export default async function OrderPage({ params }: { params: { id: string } }) {
  const base = getBaseUrl()
  const res = await fetch(`${base}/api/orders/${params.id}`)
  const json = await res.json()
  const order = json?.data ?? null

  return (
    <div>
      <Header />
      <main className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Order {params.id}</h1>
        {order ? (
          <pre className="bg-gray-100 p-4">{JSON.stringify(order, null, 2)}</pre>
        ) : (
          <p>Order not found</p>
        )}
      </main>
    </div>
  )
}

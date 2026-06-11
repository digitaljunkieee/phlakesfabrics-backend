export default function Loading() {
  return (
    <div className="container mx-auto py-8">
      <h2 className="text-xl font-semibold mb-4">Loading products…</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="border rounded p-4 animate-pulse">
            <div className="h-40 bg-gray-200 mb-4" />
            <div className="h-6 bg-gray-200 w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="container mx-auto py-8">
      <div className="h-6 w-48 bg-gray-200 animate-pulse mb-4" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-200 animate-pulse" />
        <div>
          <div className="h-8 bg-gray-200 w-3/4 mb-3 animate-pulse" />
          <div className="h-4 bg-gray-200 w-full mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 w-full mb-2 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

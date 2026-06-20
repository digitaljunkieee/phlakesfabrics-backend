export interface Product {
  id: string
  sku?: string
  name: string
  title?: string
  slug?: string
  description?: string
  short_description?: string | null
  price: number
  compare_at_price?: number | null
  category_id?: string
  homepage_sections?: string[]
  images?: string[]
  specs?: Record<string, unknown>
  stock?: number
  status?: string
  created_at?: string
  updated_at?: string
}

export interface Branch {
  id: string
  name: string
  slug: string
  code?: string | null
  isActive?: boolean
  address?: {
    line1?: string
    city?: string
    state?: string
    country?: string
    zip?: string
  }
  phone?: string | null
  email?: string | null
  workloadScore?: number
  deliveryRadiusKm?: number | null
}

export interface InventoryItem {
  id: string
  branchId: string
  productId: string
  quantity: number
  reservedQuantity?: number
  lowStockThreshold?: number
  availableQuantity?: number
  status?: string
}

export interface CartItem {
  id: string
  name: string
  price: number
  qty: number
}

export interface Order {
  id: string
  items: Array<Record<string, unknown>>
  subtotal: number
  total: number
  payment_status: string
  branchId?: string | null
  branchName?: string | null
  deliveryStatus?: 'pending' | 'queued' | 'assigned' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned' | 'cancelled'
  deliveryAssignedTo?: string | null
  deliveryAssignedAt?: string | null
  deliveryQueuedAt?: string | null
  deliveryOutForDeliveryAt?: string | null
  deliveryFailureReason?: string | null
  deliveryNotes?: string | null
}

export interface User {
  id: string
  email: string
  name?: string
}

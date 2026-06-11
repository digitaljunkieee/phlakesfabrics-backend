type GigDispatchType = 'preshipment' | 'dropoff'

type GigOrderItem = {
  quantity?: number
  price?: number
  weight?: number
  name?: string
  title?: string
  product?: {
    title?: string
    weight?: number
    specs?: Record<string, any>
    details?: Record<string, any>
  }
}

type GigOrder = {
  email?: string
  user?: {
    name?: string
    phone?: string
  } | null
  items?: GigOrderItem[]
  shippingAddress?: {
    name?: string
    street?: string
    city?: string
    lga?: string
    state?: string
    phone?: string
  }
}

type GigJson = Record<string, any> | null

type GigStationProfile = {
  receiverStationId?: number
  destinationStationId?: number
  destinationServiceCenterId?: number
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}. Add the real GIG value to the backend environment.`)
  }
  return value
}

function readOptionalEnv(name: string) {
  return process.env[name]?.trim() || ''
}

function readRequiredNumber(name: string) {
  const value = readRequiredEnv(name)
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`)
  }

  return parsed
}

function readOptionalNumber(name: string) {
  const raw = process.env[name]?.trim()
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeLocationKey(value: string | undefined | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function buildLocationKeys(order: GigOrder) {
  const state = normalizeLocationKey(order.shippingAddress?.state)
  const lga = normalizeLocationKey(order.shippingAddress?.lga)
  const city = normalizeLocationKey(order.shippingAddress?.city)

  return Array.from(
    new Set(
      [
        state && lga ? `${state}::${lga}` : '',
        state && city ? `${state}::${city}` : '',
        lga,
        city,
        state,
      ].filter(Boolean)
    )
  )
}

function parseStationMap(rawValue: string) {
  if (!rawValue) return {}

  try {
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function pickStationValue(source: any, keys: string[]) {
  if (!source) return undefined
  if (typeof source === 'number' && Number.isFinite(source)) return source
  if (typeof source === 'string') {
    const parsed = Number(source)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  if (typeof source !== 'object') return undefined

  for (const key of keys) {
    const value = source[key]
    if (value == null || value === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return undefined
}

function resolveStationProfile(order: GigOrder, config: ReturnType<typeof getGigConfig>): GigStationProfile {
  const rawMap = process.env.GIG_STATION_MAP_JSON || process.env.GIG_STATE_LGA_STATION_MAP_JSON || process.env.GIG_LOCATION_STATION_MAP_JSON || ''
  const map = parseStationMap(rawMap)
  const keys = buildLocationKeys(order)

  for (const key of keys) {
    const entry = map[key] ?? map[normalizeLocationKey(key)]
    if (!entry) continue

    const receiverStationId = pickStationValue(entry, [
      'receiverStationId',
      'receiver_station_id',
      'receiverStation',
      'receiver_station',
    ])
    const destinationStationId = pickStationValue(entry, [
      'destinationStationId',
      'destination_station_id',
      'destinationStation',
      'destination_station',
    ])
    const destinationServiceCenterId = pickStationValue(entry, [
      'destinationServiceCenterId',
      'destination_service_center_id',
      'serviceCenterId',
      'service_center_id',
      'destinationServiceCenter',
      'service_center',
    ])

    return {
      receiverStationId: receiverStationId ?? config.receiverStationId,
      destinationStationId: destinationStationId ?? config.destinationStationId,
      destinationServiceCenterId: destinationServiceCenterId ?? config.destinationServiceCenterId,
    }
  }

  return {
    receiverStationId: config.receiverStationId,
    destinationStationId: config.destinationStationId,
    destinationServiceCenterId: config.destinationServiceCenterId,
  }
}

function getGigConfig() {
  return {
    baseUrl: readRequiredEnv('GIG_BASE_URL').replace(/\/+$/, ''),
    email: readRequiredEnv('GIG_EMAIL'),
    password: readRequiredEnv('GIG_PASSWORD'),
    userChannelCode: readOptionalEnv('GIG_USER_CHANNEL_CODE'),
    senderName: readOptionalEnv('GIG_SENDER_NAME') || readOptionalEnv('GIG_ORGANISATION') || 'Phlakes Fabrics',
    senderPhoneNumber: readRequiredEnv('GIG_SENDER_PHONE_NUMBER'),
    senderAddress: readRequiredEnv('GIG_SENDER_ADDRESS'),
    senderLocality: readRequiredEnv('GIG_SENDER_LOCALITY'),
    senderCity: readRequiredEnv('GIG_SENDER_CITY'),
    senderStationId: readRequiredNumber('GIG_SENDER_STATION_ID'),
    receiverStationId: readRequiredNumber('GIG_RECEIVER_STATION_ID'),
    destinationStationId: readRequiredNumber('GIG_DESTINATION_STATION_ID'),
    destinationServiceCenterId: readRequiredNumber('GIG_DESTINATION_SERVICE_CENTER_ID'),
    defaultItemWeight: readOptionalNumber('GIG_DEFAULT_ITEM_WEIGHT') ?? 1,
  }
}

function joinAddressParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ')
}

function extractGigToken(data: GigJson) {
  return (
    data?.data?.data?.['access-token'] ||
    data?.data?.['access-token'] ||
    data?.['access-token'] ||
    data?.access_token ||
    data?.Object?.access_token
  )
}

function extractGigPayload(data: GigJson) {
  return data?.data?.data || data?.data || data?.Object || data
}

function extractGigMessage(data: GigJson, fallback: string) {
  return (
    data?.message ||
    data?.error ||
    data?.data?.message ||
    data?.data?.error ||
    data?.data?.data?.message ||
    fallback
  )
}

async function parseGigResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return { data: null as GigJson, text: '' }
  }

  try {
    return { data: JSON.parse(text) as GigJson, text }
  } catch {
    return { data: null as GigJson, text }
  }
}

async function gigFetch(path: string, init: RequestInit, label: string) {
  const config = getGigConfig()
  const initHeaders = (init.headers || {}) as Record<string, string>
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...initHeaders,
  }

  if (config.userChannelCode) {
    headers.UserChannelCode = config.userChannelCode
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers,
  })

  const { data, text } = await parseGigResponse(response)

  if (!response.ok) {
    const fallback = text || `${label} failed`
    throw new Error(`GIG ${label} failed: HTTP ${response.status} - ${extractGigMessage(data, fallback)}`)
  }

  return data
}

function readNumberish(value: any) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function resolveItemWeight(item: GigOrderItem, defaultWeight: number) {
  const candidates = [
    item.weight,
    item.product?.weight,
    item.product?.specs?.weight,
    item.product?.specs?.Weight,
    item.product?.details?.weight,
    item.product?.details?.Weight,
  ]

  for (const candidate of candidates) {
    const weight = readNumberish(candidate)
    if (weight) return weight
  }

  const title = `${item.product?.title || item.name || item.title || ''}`.toLowerCase()
  if (/phone|headphone|earbud|watch/.test(title)) return 0.5
  if (/speaker|woofer|soundbar|subwoofer/.test(title)) return 2
  if (/tv|television|laptop/.test(title)) return 4

  return defaultWeight
}

function buildShipmentItems(order: GigOrder, dispatchType: GigDispatchType) {
  const items = order.items || []
  const defaultWeight = getGigConfig().defaultItemWeight

  if (items.length === 0) {
    throw new Error('Cannot create a GIG shipment without at least one order item.')
  }

  return items.map((item, index) => ({
    ItemName: item.product?.title || item.name || item.title || `Item ${index + 1}`,
    Description: item.product?.title || item.name || item.title || 'Phlakes Fabrics order item',
    ShipmentType: 0,
    Quantity: Math.max(1, Number(item.quantity) || 1),
    Weight: resolveItemWeight(item, defaultWeight),
    IsVolumetric: false,
    Length: 10,
    Width: 5,
    Height: 3,
    Value: Math.max(1, Number(item.price) || 1000),
    SpecialPackageId: dispatchType === 'dropoff' ? 10 : 1,
    ...(dispatchType === 'preshipment' ? { HaulageId: 0 } : { Nature: 'Normal' }),
  }))
}

function buildReceiverName(order: GigOrder) {
  return (
    order.shippingAddress?.name ||
    order.user?.name ||
    order.email?.split('@')[0] ||
    'Customer'
  )
}

function buildReceiverPhone(order: GigOrder) {
  return order.shippingAddress?.phone || order.user?.phone || '0000000000'
}

export const getGigToken = async () => {
  const config = getGigConfig()
  const data = await gigFetch(
    '/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: config.email,
        password: config.password,
      }),
    },
    'login'
  )

  const token = extractGigToken(data)

  if (!token) {
    throw new Error('GIG login succeeded but no access token was found in the response.')
  }

  return String(token).replace(/['"]+/g, '').trim()
}

export const createGigWaybill = async (
  order: GigOrder,
  dispatchType: GigDispatchType = 'preshipment'
) => {
  const config = getGigConfig()
  const token = await getGigToken()
  const endpointPath = dispatchType === 'preshipment' ? '/capture/preshipment' : '/create/dropOff'
  const stationProfile = resolveStationProfile(order, config)

  const receiverAddress =
    joinAddressParts([
      order.shippingAddress?.street,
      order.shippingAddress?.city,
      order.shippingAddress?.lga,
      order.shippingAddress?.state,
    ]) || 'N/A'

  const receiverCity =
    order.shippingAddress?.city ||
    order.shippingAddress?.lga ||
    order.shippingAddress?.state ||
    'N/A'

  const shipmentItems = buildShipmentItems(order, dispatchType)

  const payload =
    dispatchType === 'preshipment'
      ? {
          SenderDetails: {
            SenderName: config.senderName,
            SenderPhoneNumber: config.senderPhoneNumber,
            SenderStationId: config.senderStationId,
            SenderAddress: config.senderAddress,
            InputtedSenderAddress: config.senderAddress,
            SenderLocality: config.senderLocality,
            SenderLocation: {
              Latitude: 0,
              Longitude: 0,
              FormattedAddress: config.senderAddress,
              Name: config.senderLocality,
              LGA: '',
            },
          },
          ReceiverDetails: {
            ReceiverStationId: stationProfile.receiverStationId ?? config.receiverStationId,
            ReceiverName: buildReceiverName(order),
            ReceiverPhoneNumber: buildReceiverPhone(order),
            ReceiverAddress: receiverAddress,
            InputtedReceiverAddress: receiverAddress,
            ReceiverLocation: {
              Latitude: 0,
              Longitude: 0,
              FormattedAddress: receiverAddress,
              Name: receiverCity,
              LGA: order.shippingAddress?.lga || order.shippingAddress?.city || '',
            },
          },
          ShipmentDetails: {
            VehicleType: 0,
            IsBatchPickUp: 0,
            IsFromAgility: 0,
            IsCashOnDelivery: false,
            CashOnDeliveryAmount: 0,
          },
          ShipmentItems: shipmentItems,
        }
      : {
          SenderDetails: {
            SenderName: config.senderName,
            SenderPhoneNumber: config.senderPhoneNumber,
            SenderCity: config.senderCity,
            DepartureStationId: config.senderStationId,
          },
          ReceiverDetails: {
            ReceiverName: buildReceiverName(order),
            ReceiverPhoneNumber: buildReceiverPhone(order),
            ReceiverAddress: receiverAddress,
            ReceiverCity: receiverCity,
            DestinationStationId: stationProfile.destinationStationId ?? config.destinationStationId,
            DestinationServiceCenterId:
              stationProfile.destinationServiceCenterId ?? config.destinationServiceCenterId,
          },
          ShipmentDetails: {
            DeliveryType: 1,
            PickupOptions: 0,
            IsCashOnDelivery: 0,
            CashOnDeliveryAmount: 0,
          },
          ShipmentItems: shipmentItems,
        }

  const data = await gigFetch(
    endpointPath,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': token,
      },
      body: JSON.stringify(payload),
    },
    dispatchType === 'preshipment' ? 'preshipment capture' : 'dropoff creation'
  )

  const shipmentData = extractGigPayload(data)
  const waybill =
    shipmentData?.Waybill ||
    shipmentData?.WaybillNumber ||
    shipmentData?.TempCode

  if (!waybill) {
    throw new Error('GIG accepted the request but did not return a waybill or temp code.')
  }

  return String(waybill).trim()
}

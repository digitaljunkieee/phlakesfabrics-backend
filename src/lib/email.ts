import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY || ''

function getResendClient() {
  if (!resendApiKey) return null
  return new Resend(resendApiKey)
}

function formatCurrency(value: number | string | undefined | null) {
  const n = Number(value || 0)
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
}

function renderItemsRows(items: any[] = []) {
  if (!Array.isArray(items) || items.length === 0) return '<tr><td colspan="3">No items</td></tr>'
  return items
    .map((it) => {
      const name = it?.name || it?.title || 'Item'
      const qty = Number(it?.qty ?? it?.quantity ?? 1)
      const price = formatCurrency(it?.price ?? it?.amount ?? 0)
      return `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 12px">${name}</td>
          <td style="padding:8px 12px;text-align:center">${qty}</td>
          <td style="padding:8px 12px;text-align:right">${price}</td>
        </tr>`
    })
    .join('\n')
}

function renderShippingAddress(address: any) {
  if (!address) return ''
  if (typeof address === 'string') return address.replace(/\n/g, '<br/>')
  // assume object
  const parts: string[] = []
  if (address.street) parts.push(address.street)
  if (address.city) parts.push(address.city)
  if (address.state) parts.push(address.state)
  if (address.postal_code) parts.push(address.postal_code)
  return parts.join(', ')
}

export async function sendOrderCreatedEmail(order: any, items: any[] = []) {
  try {
    if (!order || !order.email) return
    if (!resendApiKey) {
      console.warn('sendOrderCreatedEmail: RESEND_API_KEY not configured; skipping email')
      return
    }
    const resend = getResendClient()
    if (!resend) return

    const orderNumber = order.order_number || order.orderNumber || order.id || 'Unknown'
    const total = formatCurrency(order.total ?? order.subtotal ?? 0)
    const itemsRows = renderItemsRows(items)
    const shipping = renderShippingAddress(order.shipping_address || order.shippingAddress || order.address)

    const html = `
      <div style="font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111827;">
        <h2 style="color:#111827">Thank you for your order</h2>
        <p>Order <strong>#${orderNumber}</strong></p>

        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:16px;">
          <thead>
            <tr style="background:#f9fafb; text-align:left">
              <th style="padding:8px 12px">Item</th>
              <th style="padding:8px 12px; text-align:center">Qty</th>
              <th style="padding:8px 12px; text-align:right">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <p style="margin:0"><strong>Shipping address</strong></p>
            <p style="margin:0">${shipping || 'Not provided'}</p>
          </div>
          <div style="text-align:right">
            <p style="margin:0"><strong>Total</strong></p>
            <p style="margin:0">${total}</p>
          </div>
        </div>

        <p style="margin-top:20px; color:#6b7280">If you have any questions reply to this email and our support team will help.</p>
      </div>
    `

    await resend.emails.send({
      from: 'Phlakes Fabrics <onboarding@resend.dev>',
      to: order.email,
      subject: `Your order ${orderNumber} — thank you!`,
      html,
    })
  } catch (err) {
    console.error('sendOrderCreatedEmail failed:', err)
    // swallow errors — email failure shouldn't block checkout
  }
}

export default sendOrderCreatedEmail

export async function sendOrderStatusEmail(order: any) {
  try {
    if (!order || !order.email) return
    if (!resendApiKey) {
      console.warn('sendOrderStatusEmail: RESEND_API_KEY not configured; skipping email')
      return
    }
    const resend = getResendClient()
    if (!resend) return

    const orderNumber = order.order_number || order.orderNumber || order.id || 'Unknown'
    const rawStatus = (order.fulfillmentStatus || order.status || '').toString().toLowerCase()
    const status = rawStatus === 'shipped' ? 'out_for_delivery' : rawStatus
    const tracking = order.tracking_number || order.trackingNumber || ''

    if (status === 'out_for_delivery') {
      const trackingUrl = tracking ? `https://giglogistics.com/track?id=${encodeURIComponent(tracking)}` : ''
      const html = `
        <div style="font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111827;">
          <h2>Your order is out for delivery</h2>
          <p>Good news, your order <strong>#${orderNumber}</strong> is on the way.</p>
          <p><strong>Tracking number:</strong> ${tracking || 'N/A'}</p>
          ${trackingUrl ? `<p><a href="${trackingUrl}" target="_blank" rel="noopener">Track your shipment</a></p>` : ''}
          <p style="margin-top:12px;color:#6b7280">If you have any questions reply to this email and our support team will help.</p>
        </div>
      `

      await resend.emails.send({
        from: 'Phlakes Fabrics <onboarding@resend.dev>',
        to: order.email,
        subject: 'Your order is out for delivery',
        html,
      })
      return
    }

    if (status === 'delivered') {
      const html = `
        <div style="font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111827;">
          <h2>Your Order has been Delivered! 🎉</h2>
          <p>We're happy to let you know that your order <strong>#${orderNumber}</strong> has been delivered.</p>
          <p style="margin-top:12px;color:#6b7280">If you have any issues with your delivery, reply to this email and our support team will help.</p>
        </div>
      `

      await resend.emails.send({
        from: 'Phlakes Fabrics <onboarding@resend.dev>',
        to: order.email,
        subject: 'Your Order has been Delivered! 🎉',
        html,
      })
      return
    }
  } catch (err) {
    console.error('sendOrderStatusEmail failed:', err)
  }
}

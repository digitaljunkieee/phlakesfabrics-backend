import { Resend } from 'resend'

const DEFAULT_BREVO_BASE_URL = 'https://api.brevo.com/v3'
const DEFAULT_RESEND_FROM = 'Phlakes Fabrics <onboarding@resend.dev>'
const DEFAULT_BRAND_NAME = 'Phlakes Fabrics'
const DEFAULT_SUPPORT_REPLY_NAME = 'Phlakes Fabrics Support'
const DEFAULT_VERIFICATION_OTP_TTL_MINUTES = 10

const resendApiKey = process.env.RESEND_API_KEY || ''
const brevoApiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || ''
const brevoFromRaw = process.env.BREVO_FROM || process.env.BREVO_SENDER || process.env.BREVO_SENDER_EMAIL || ''
const brevoSenderName = (process.env.BREVO_SENDER_NAME || DEFAULT_BRAND_NAME).trim() || DEFAULT_BRAND_NAME
const brevoReplyToEmail = (process.env.BREVO_REPLY_TO_EMAIL || '').trim()
const brevoReplyToName = (process.env.BREVO_REPLY_TO_NAME || DEFAULT_SUPPORT_REPLY_NAME).trim() || DEFAULT_SUPPORT_REPLY_NAME
const brevoApiBaseUrl = (process.env.BREVO_API_BASE_URL || DEFAULT_BREVO_BASE_URL).replace(/\/+$/, '')
const brevoTimeoutMs = Number(process.env.BREVO_TIMEOUT_MS || '30000') > 0 ? Number(process.env.BREVO_TIMEOUT_MS || '30000') : 30000
export const EMAIL_VERIFICATION_OTP_TTL_MINUTES = Number(process.env.EMAIL_VERIFICATION_OTP_TTL_MINUTES || `${DEFAULT_VERIFICATION_OTP_TTL_MINUTES}`) || DEFAULT_VERIFICATION_OTP_TTL_MINUTES

function getResendClient() {
  if (!resendApiKey) return null
  return new Resend(resendApiKey)
}

function parseDisplayAddress(value: string, fallbackName = DEFAULT_BRAND_NAME) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return { name: fallbackName, email: '' }
  }

  const match = normalized.match(/^(.*)<([^>]+)>$/)
  if (match) {
    return {
      name: String(match[1] || '').trim() || fallbackName,
      email: String(match[2] || '').trim().toLowerCase(),
    }
  }

  return {
    name: fallbackName,
    email: normalized.toLowerCase(),
  }
}

function getBrevoSender() {
  const parsed = parseDisplayAddress(brevoFromRaw, brevoSenderName)
  if (!parsed.email) return null
  return parsed
}

function getAdminEmail() {
  return (
    process.env.ADMIN_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.CONTACT_EMAIL ||
    ''
  ).trim()
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailTemplate({
  badge = DEFAULT_BRAND_NAME,
  headline,
  intro,
  bullets = [],
  ctaLabel = '',
  ctaUrl = '',
  footer = 'Phlakes Fabrics automated notification.',
  accent = '#ea580c',
}: {
  badge?: string
  headline: string
  intro: string
  bullets?: string[]
  ctaLabel?: string
  ctaUrl?: string
  footer?: string
  accent?: string
}) {
  const safeBadge = escapeHtml(badge)
  const safeHeadline = escapeHtml(headline)
  const safeIntro = escapeHtml(intro)
  const safeFooter = escapeHtml(footer)
  const bulletMarkup = Array.isArray(bullets) && bullets.length > 0
    ? `<ul style="margin:20px 0 0;padding-left:20px;color:#cbd5e1;">${bullets
        .map((item) => `<li style="margin:8px 0;">${escapeHtml(item)}</li>`)
        .join('')}</ul>`
    : ''
  const ctaMarkup = ctaLabel && ctaUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 18px;background:${accent};color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;">${escapeHtml(ctaLabel)}</a></p>`
    : ''

  const htmlContent = `
    <div style="background:#f8fafc;padding:32px 18px;font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:linear-gradient(180deg,#0f172a,#111827);border-radius:24px;padding:32px;border:1px solid rgba(148,163,184,0.16);box-shadow:0 24px 80px rgba(15,23,42,0.16);">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${accent};">${safeBadge}</p>
        <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;">${safeHeadline}</h1>
        <p style="margin:18px 0 0;font-size:15px;line-height:1.7;color:#cbd5e1;">${safeIntro}</p>
        ${bulletMarkup}
        ${ctaMarkup}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(148,163,184,0.18);font-size:12px;line-height:1.6;color:#94a3b8;">${safeFooter}</div>
      </div>
    </div>
  `

  const textContent = [headline, intro, ...bullets, ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : '', footer]
    .filter(Boolean)
    .join('\n\n')

  return { htmlContent, textContent }
}

async function sendViaBrevo({
  to,
  subject,
  htmlContent = '',
  textContent = '',
  replyTo,
  from,
  tags = [],
  headers = {},
}: {
  to: string
  subject: string
  htmlContent?: string
  textContent?: string
  replyTo?: { email: string; name?: string } | null
  from?: string
  tags?: string[]
  headers?: Record<string, string>
}) {
  const sender = getBrevoSender()
  if (!brevoApiKey || !sender || !to || !subject || (!htmlContent && !textContent)) {
    return {
      success: false,
      skipped: true,
      message: 'Brevo is not fully configured',
    }
  }

  const payload: Record<string, any> = {
    sender: parseDisplayAddress(from || `${sender.name} <${sender.email}>`, sender.name),
    to: [{ email: to }],
    subject,
  }

  if (htmlContent) payload.htmlContent = htmlContent
  if (textContent) payload.textContent = textContent
  if (Array.isArray(tags) && tags.length > 0) payload.tags = tags
  if (headers && typeof headers === 'object' && Object.keys(headers).length > 0) payload.headers = headers

  const replyEmail = replyTo?.email || brevoReplyToEmail
  if (replyEmail) {
    payload.replyTo = {
      email: replyEmail,
      name: replyTo?.name || brevoReplyToName,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), brevoTimeoutMs)

  let response: Response
  try {
    response = await fetch(`${brevoApiBaseUrl}/smtp/email`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (error: any) {
    clearTimeout(timeout)
    return {
      success: false,
      skipped: false,
      message: error?.name === 'AbortError'
        ? `Brevo request timed out after ${brevoTimeoutMs}ms`
        : error?.message || 'Brevo request failed',
    }
  }

  clearTimeout(timeout)

  const rawText = await response.text()
  let data: any = null
  try {
    data = rawText ? JSON.parse(rawText) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    return {
      success: false,
      skipped: false,
      status: response.status,
      message: data?.message || data?.code || rawText || `Brevo request failed (${response.status})`,
      data,
    }
  }

  return {
    success: true,
    skipped: false,
    status: response.status,
    messageId: data?.messageId || data?.messageIds?.[0] || '',
    data,
  }
}

async function sendViaResend({
  to,
  subject,
  htmlContent = '',
  textContent = '',
  replyTo,
  from,
}: {
  to: string
  subject: string
  htmlContent?: string
  textContent?: string
  replyTo?: string
  from?: string
}) {
  if (!resendApiKey || !to || !subject || (!htmlContent && !textContent)) {
    return {
      success: false,
      skipped: true,
      message: 'Resend is not configured',
    }
  }

  const resend = getResendClient()
  if (!resend) {
    return {
      success: false,
      skipped: true,
      message: 'Resend client unavailable',
    }
  }

  try {
    const payload: any = {
      from: from || DEFAULT_RESEND_FROM,
      to,
      subject,
      html: htmlContent || undefined,
      text: textContent || undefined,
      ...(replyTo ? { replyTo } : {}),
    }

    const result = await resend.emails.send(payload)

    return {
      success: true,
      skipped: false,
      messageId: (result as any)?.id || '',
      data: result,
    }
  } catch (error: any) {
    return {
      success: false,
      skipped: false,
      message: error?.message || 'Resend request failed',
    }
  }
}

async function sendEmail({
  to,
  subject,
  htmlContent,
  textContent = '',
  replyTo,
  from,
  tags = [],
  headers = {},
}: {
  to: string
  subject: string
  htmlContent: string
  textContent?: string
  replyTo?: { email: string; name?: string } | null
  from?: string
  tags?: string[]
  headers?: Record<string, string>
}) {
  if (brevoApiKey) {
    const result = await sendViaBrevo({
      to,
      subject,
      htmlContent,
      textContent,
      replyTo,
      from,
      tags,
      headers,
    })

    if (!result.skipped) return result
    console.warn('Brevo not fully configured, falling back to Resend if available:', result.message)
  }

  return sendViaResend({
    to,
    subject,
    htmlContent,
    textContent,
    replyTo: replyTo?.email,
    from,
  })
}

function formatCurrency(value: number | string | undefined | null) {
  const n = Number(value || 0)
  return `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
}

function renderItemsRows(items: any[] = []) {
  if (!Array.isArray(items) || items.length === 0) return '<tr><td colspan="3">No items</td></tr>'
  return items
    .map((it) => {
      const name = escapeHtml(it?.name || it?.title || 'Item')
      const qty = Number(it?.qty ?? it?.quantity ?? 1)
      const price = formatCurrency(it?.price ?? it?.amount ?? 0)
      const color = escapeHtml(it?.selectedColor || it?.selected_color || it?.color || '')
      const unit = escapeHtml(it?.selectedUnit || it?.unit || '')
      const meta = [color ? `Color: ${color}` : '', unit ? `Unit: ${unit}` : ''].filter(Boolean).join(' &middot; ')
      return `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 12px">${name}${meta ? `<div style="margin-top:4px;color:#6b7280;font-size:12px">${meta}</div>` : ''}</td>
          <td style="padding:8px 12px;text-align:center">${qty}</td>
          <td style="padding:8px 12px;text-align:right">${price}</td>
        </tr>`
    })
    .join('\n')
}

function renderShippingAddress(address: any) {
  if (!address) return ''
  if (typeof address === 'string') return escapeHtml(address).replace(/\n/g, '<br/>')

  const parts: string[] = []
  if (address.street) parts.push(address.street)
  if (address.city) parts.push(address.city)
  if (address.lga) parts.push(address.lga)
  if (address.state) parts.push(address.state)
  if (address.postal_code) parts.push(address.postal_code)
  return escapeHtml(parts.join(', '))
}

export async function sendOrderCreatedEmail(order: any, items: any[] = []) {
  try {
    if (!order || !order.email) return

    const orderNumber = order.order_number || order.orderNumber || order.id || 'Unknown'
    const total = formatCurrency(order.total ?? order.subtotal ?? 0)
    const itemsRows = renderItemsRows(items)
    const shipping = renderShippingAddress(order.shipping_address || order.shippingAddress || order.address)
    const branchName = order.branchName || order.branch?.name || order.branch?.label || ''

    const html = `
      <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; color:#111827;">
        <h2 style="color:#111827">Thank you for your order</h2>
        <p>Order <strong>#${escapeHtml(orderNumber)}</strong></p>

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

        <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
          <div>
            <p style="margin:0"><strong>Shipping address</strong></p>
            <p style="margin:0">${shipping || 'Not provided'}</p>
            ${branchName ? `<p style="margin:8px 0 0;"><strong>Fulfillment branch</strong></p><p style="margin:0">${escapeHtml(branchName)}</p>` : ''}
          </div>
          <div style="text-align:right">
            <p style="margin:0"><strong>Total</strong></p>
            <p style="margin:0">${total}</p>
          </div>
        </div>

        <p style="margin-top:20px; color:#6b7280">If you have any questions reply to this email and our support team will help.</p>
      </div>
    `

    await sendEmail({
      to: order.email,
      subject: `Your order ${orderNumber} - thank you!`,
      htmlContent: html,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendOrderCreatedEmail failed:', err)
  }
}

export async function sendAdminOrderAlertEmail(order: any, items: any[] = []) {
  try {
    const adminEmail = getAdminEmail()
    if (!adminEmail) {
      console.warn('sendAdminOrderAlertEmail: ADMIN_EMAIL not configured; skipping email')
      return
    }

    const orderNumber = order.order_number || order.orderNumber || order.id || 'Unknown'
    const itemsRows = renderItemsRows(items)
    const shipping = renderShippingAddress(order.shipping_address || order.shippingAddress || order.address)
    const total = formatCurrency(order.total ?? order.totalAmount ?? order.subtotal ?? 0)
    const customerEmail = escapeHtml(order.email || 'Unknown')
    const customerPhone = escapeHtml(order.customer?.phone || order.phone || 'N/A')
    const status = escapeHtml(order.status || order.paymentStatus || 'pending')
    const branchName = escapeHtml(order.branchName || order.branch?.name || order.branch?.label || '')

    const html = `
      <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; color:#111827;">
        <h2 style="margin:0 0 12px;">New Order Received</h2>
        <p style="margin:0 0 8px;">Order <strong>#${escapeHtml(orderNumber)}</strong> has been placed.</p>
        <p style="margin:0 0 8px;"><strong>Customer:</strong> ${customerEmail}</p>
        <p style="margin:0 0 8px;"><strong>Phone:</strong> ${customerPhone}</p>
        <p style="margin:0 0 8px;"><strong>Status:</strong> ${status}</p>
        ${branchName ? `<p style="margin:0 0 8px;"><strong>Branch:</strong> ${branchName}</p>` : ''}
        <p style="margin:0 0 8px;"><strong>Shipping:</strong> ${shipping || 'Not provided'}</p>

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

        <p style="margin-top:16px;"><strong>Total:</strong> ${total}</p>
      </div>
    `

    await sendEmail({
      to: adminEmail,
      subject: `New order received - #${orderNumber}`,
      htmlContent: html,
      replyTo: order.email ? { email: order.email, name: order.customer?.name || order.email } : undefined,
    })
  } catch (err) {
    console.error('sendAdminOrderAlertEmail failed:', err)
  }
}

export async function sendContactFormEmail(payload: {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
}) {
  try {
    const adminEmail = getAdminEmail()
    if (!adminEmail) {
      console.warn('sendContactFormEmail: ADMIN_EMAIL not configured; skipping email')
      return
    }

    const fullName = `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || 'Customer'
    const html = `
      <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; color:#111827;">
        <h2 style="margin:0 0 12px;">New Contact Form Submission</h2>
        <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(fullName)}</p>
        <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(payload.email || 'N/A')}</p>
        <p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(payload.phone || 'N/A')}</p>
        <p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeHtml(payload.subject || 'General inquiry')}</p>
        <div style="margin-top:16px; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; white-space:pre-wrap;">${escapeHtml(payload.message || '')}</div>
      </div>
    `

    await sendEmail({
      to: adminEmail,
      subject: `Contact form - ${payload.subject || 'General inquiry'}`,
      htmlContent: html,
      replyTo: payload.email ? { email: payload.email, name: fullName } : undefined,
    })
  } catch (err) {
    console.error('sendContactFormEmail failed:', err)
  }
}

export async function sendContactSubmissionConfirmationEmail(payload: {
  email?: string
  name?: string
  subject?: string
}) {
  try {
    if (!payload.email) return

    const html = buildEmailTemplate({
      badge: 'Contact Request',
      headline: 'We received your message',
      intro: 'Thanks for reaching out to Phlakes Fabrics. Our team has your message and will respond as soon as possible.',
      bullets: [
        `Name: ${payload.name || 'Customer'}`,
        `Subject: ${payload.subject || 'General inquiry'}`,
        `Email: ${payload.email}`,
      ],
      footer: 'If you need to add more details, simply reply to this email and our support team will review it.',
      accent: '#2563eb',
    })

    await sendEmail({
      to: payload.email,
      subject: 'We received your message',
      htmlContent: html.htmlContent,
      textContent: html.textContent,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendContactSubmissionConfirmationEmail failed:', err)
  }
}

export async function sendEmailVerificationOtpEmail(payload: {
  email?: string
  name?: string
  code?: string
  verificationUrl?: string
  expiresAt?: Date | string | null
}) {
  try {
    if (!payload.email || !payload.code) return

    const expiresText = payload.expiresAt
      ? new Date(payload.expiresAt).toLocaleString()
      : `in ${EMAIL_VERIFICATION_OTP_TTL_MINUTES} minutes`

    const html = buildEmailTemplate({
      badge: 'Email Verification',
      headline: 'Confirm your email address',
      intro: `Use the one-time code below to finish creating your Phlakes Fabrics account${payload.name ? `, ${payload.name}` : ''}.`,
      bullets: [
        `Verification code: ${payload.code}`,
        `Expires at: ${expiresText}`,
      ],
      ctaLabel: payload.verificationUrl ? 'Verify email' : '',
      ctaUrl: payload.verificationUrl || '',
      footer: 'If you did not request this code, you can safely ignore this email.',
      accent: '#0ea5e9',
    })

    return sendEmail({
      to: payload.email,
      subject: 'Verify your Phlakes Fabrics email',
      htmlContent: html.htmlContent,
      textContent: html.textContent,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendEmailVerificationOtpEmail failed:', err)
  }
}

export async function sendPasswordChangedEmail(payload: {
  email?: string
  name?: string
}) {
  try {
    if (!payload.email) return

    const html = buildEmailTemplate({
      badge: 'Security Alert',
      headline: 'Your password was changed',
      intro: `Hi ${payload.name || 'there'}, your Phlakes Fabrics account password was updated successfully.`,
      bullets: [
        'If this was you, no further action is needed.',
        'If you did not make this change, reset your password immediately and contact support.',
      ],
      footer: 'Protecting your account matters. Keep your password private and unique.',
      accent: '#dc2626',
    })

    await sendEmail({
      to: payload.email,
      subject: 'Your Phlakes Fabrics password was changed',
      htmlContent: html.htmlContent,
      textContent: html.textContent,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendPasswordChangedEmail failed:', err)
  }
}

export async function sendSupportTicketReceivedEmail(ticket: any) {
  try {
    if (!ticket?.email) return

    const subject = ticket.subject || 'Support Ticket'
    const html = buildEmailTemplate({
      badge: 'Support',
      headline: 'We received your support ticket',
      intro: 'Thanks for contacting Phlakes Fabrics support. Our team will review your request and reply as soon as possible.',
      bullets: [
        `Subject: ${subject}`,
        `Priority: ${ticket.priority || 'low'}`,
        `Ticket ID: ${ticket.id || ticket._id || 'pending'}`,
      ],
      footer: 'You can reply to this email if you need to add more details to the same issue.',
      accent: '#2563eb',
    })

    await sendEmail({
      to: ticket.email,
      subject: `We received your ticket: ${subject}`,
      htmlContent: html.htmlContent,
      textContent: html.textContent,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendSupportTicketReceivedEmail failed:', err)
  }
}

export async function sendSupportTicketNotificationEmail(ticket: any) {
  try {
    const adminEmail = getAdminEmail()
    if (!adminEmail) return

    const subject = ticket?.subject || 'Customer support request'
    const customerName = ticket?.users?.name || ticket?.user?.name || ticket?.name || 'Customer'
    const customerEmail = ticket?.users?.email || ticket?.email || ticket?.user?.email || 'N/A'
    const message = String(ticket?.message || '').trim().replace(/\s+/g, ' ').slice(0, 180) || 'No message provided'

    const html = buildEmailTemplate({
      badge: 'New Ticket',
      headline: 'A new support ticket was submitted',
      intro: 'A customer opened a new support request from Phlakes Fabrics. Review the details below and reply when ready.',
      bullets: [
        `Customer: ${customerName}`,
        `Email: ${customerEmail}`,
        `Priority: ${ticket?.priority || 'low'}`,
        `Message: ${message}`,
      ],
      footer: 'Reply from the admin dashboard to continue the conversation with the customer.',
      accent: '#ea580c',
    })

    await sendEmail({
      to: adminEmail,
      subject: `New support ticket: ${subject}`,
      htmlContent: html.htmlContent,
      textContent: html.textContent,
      replyTo: ticket?.email ? { email: ticket.email, name: customerName } : undefined,
    })
  } catch (err) {
    console.error('sendSupportTicketNotificationEmail failed:', err)
  }
}

export async function sendSupportTicketReplyNotificationEmail(ticket: any, reply: string) {
  try {
    const adminEmail = getAdminEmail()
    if (!adminEmail) return

    const subject = ticket?.subject || 'Customer support request'
    const customerName = ticket?.users?.name || ticket?.user?.name || ticket?.name || 'Customer'
    const customerEmail = ticket?.users?.email || ticket?.email || ticket?.user?.email || 'N/A'

    const html = buildEmailTemplate({
      badge: 'Support Reply',
      headline: 'A customer replied to a support ticket',
      intro: 'A customer has added a new message to an existing support conversation.',
      bullets: [
        `Customer: ${customerName}`,
        `Email: ${customerEmail}`,
        `Ticket: ${subject}`,
        `Reply: ${String(reply || '').trim().slice(0, 220) || 'No message provided'}`,
      ],
      footer: 'Open the admin dashboard to review the full thread and respond if needed.',
      accent: '#7c3aed',
    })

    await sendEmail({
      to: adminEmail,
      subject: `Support reply: ${subject}`,
      htmlContent: html.htmlContent,
      textContent: html.textContent,
      replyTo: ticket?.email ? { email: ticket.email, name: customerName } : undefined,
    })
  } catch (err) {
    console.error('sendSupportTicketReplyNotificationEmail failed:', err)
  }
}

export async function sendSupportTicketStatusUpdateEmail(ticket: any) {
  try {
    if (!ticket?.email) return

    const subject = ticket.subject || 'Support Ticket'
    const status = String(ticket.status || 'open').toLowerCase()
    const statusLabel = status === 'resolved'
      ? 'resolved'
      : status === 'in_progress'
        ? 'in progress'
        : 'open'

    const html = buildEmailTemplate({
      badge: 'Support Update',
      headline: 'Your support ticket was updated',
      intro: `Your support ticket "${subject}" is now marked as ${statusLabel}.`,
      bullets: [
        `Ticket: ${subject}`,
        `Status: ${statusLabel}`,
      ],
      footer: 'If you have additional details to share, reply to this message and our team will see it.',
      accent: '#0f766e',
    })

    await sendEmail({
      to: ticket.email,
      subject: `Update on your support ticket: ${subject}`,
      htmlContent: html.htmlContent,
      textContent: html.textContent,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendSupportTicketStatusUpdateEmail failed:', err)
  }
}

export async function sendPasswordResetEmail(payload: {
  email: string
  name?: string
  resetUrl: string
}) {
  try {
    if (!payload.email) return

    const html = `
      <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; color:#111827;">
        <h2 style="margin:0 0 12px;">Reset your password</h2>
        <p style="margin:0 0 12px;">Hi ${escapeHtml(payload.name || 'there')},</p>
        <p style="margin:0 0 12px;">We received a request to reset your password. Use the button below to choose a new password.</p>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(payload.resetUrl)}" style="display:inline-block;padding:12px 18px;background:#ea580c;color:#ffffff;text-decoration:none;border-radius:8px;">Reset Password</a>
        </p>
        <p style="margin:0;color:#6b7280;">If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break:break-all;">${escapeHtml(payload.resetUrl)}</p>
      </div>
    `

    return sendEmail({
      to: payload.email,
      subject: 'Reset your Phlakes Fabrics password',
      htmlContent: html,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendPasswordResetEmail failed:', err)
  }
}

export async function sendSupportReplyEmail(ticket: any, reply: string) {
  try {
    if (!ticket?.email) return

    const subject = ticket.subject || 'Support Ticket'
    const html = `
      <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; color:#111827;">
        <h2 style="margin:0 0 12px;">Update on your support ticket</h2>
        <p style="margin:0 0 8px;">Ticket: <strong>${escapeHtml(subject)}</strong></p>
        <div style="margin-top:16px; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; white-space:pre-wrap;">${escapeHtml(reply)}</div>
      </div>
    `

    await sendEmail({
      to: ticket.email,
      subject: `Re: ${subject}`,
      htmlContent: html,
      replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
    })
  } catch (err) {
    console.error('sendSupportReplyEmail failed:', err)
  }
}

export async function sendOrderStatusEmail(order: any) {
  try {
    if (!order || !order.email) return

    const orderNumber = order.order_number || order.orderNumber || order.id || 'Unknown'
    const rawStatus = (order.fulfillmentStatus || order.status || '').toString().toLowerCase()
    const status = rawStatus === 'shipped' ? 'out_for_delivery' : rawStatus
    const tracking = order.tracking_number || order.trackingNumber || ''

    if (status === 'out_for_delivery') {
      const trackingUrl = tracking ? `https://giglogistics.com/track?id=${encodeURIComponent(tracking)}` : ''
      const html = `
        <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; color:#111827;">
          <h2>Your order is out for delivery</h2>
          <p>Your order <strong>#${escapeHtml(orderNumber)}</strong> is on the way.</p>
          <p><strong>Tracking number:</strong> ${escapeHtml(tracking || 'N/A')}</p>
          ${trackingUrl ? `<p><a href="${trackingUrl}" target="_blank" rel="noopener">Track your shipment</a></p>` : ''}
        </div>
      `

      await sendEmail({
        to: order.email,
        subject: 'Your order is out for delivery',
        htmlContent: html,
        replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
      })
      return
    }

    if (status === 'delivered') {
      const html = `
        <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; color:#111827;">
          <h2>Your order has been delivered</h2>
          <p>We are happy to let you know that your order <strong>#${escapeHtml(orderNumber)}</strong> has been delivered.</p>
        </div>
      `

      await sendEmail({
        to: order.email,
        subject: 'Your order has been delivered',
        htmlContent: html,
        replyTo: getAdminEmail() ? { email: getAdminEmail(), name: `${DEFAULT_BRAND_NAME} Support` } : undefined,
      })
      return
    }
  } catch (err) {
    console.error('sendOrderStatusEmail failed:', err)
  }
}

export default sendOrderCreatedEmail

import { randomUUID } from 'crypto';
import { sendJson, sendEmpty, readBody, clean, escapeHtml, getParam } from '../lib/http.js';

const RECIPIENT = 'john.thompson@lostlimbriders.org';
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_ID_RE = /^[A-Z0-9]{8,32}$/i;
const AMOUNT_RE = /^(?:[1-9]\d{0,5})(?:\.\d{1,2})?$/;

function paypalConfig() {
  const environment = process.env.PAYPAL_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'live';
  return {
    environment,
    baseUrl: environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com',
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  };
}

function validAmount(value) {
  const amount = String(value ?? '').trim();
  if (!AMOUNT_RE.test(amount)) return '';
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > 10000000) return '';
  return (cents / 100).toFixed(2);
}

async function paypalAccessToken(config) {
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error('PayPal authentication failed.');
  return data.access_token;
}

async function paypalRequest(config, path, options = {}) {
  const accessToken = await paypalAccessToken(config);
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('PayPal could not complete the request.');
  return data;
}

async function handleContact(res, payload) {
  if (String(payload.website ?? '').trim()) return sendJson(res, { ok: true });
  const name = clean(payload.name, 120);
  const email = String(payload.email ?? '').trim().toLowerCase();
  const phone = clean(payload.phone, 40);
  const subject = clean(payload.subject, 150);
  const message = String(payload.message ?? '').trim();
  if (!name || !EMAIL_RE.test(email)) return sendJson(res, { error: 'A valid name and email are required.' }, 422);
  if (!subject) return sendJson(res, { error: 'A subject is required.' }, 422);
  if (!message) return sendJson(res, { error: 'A message is required.' }, 422);

  let attachment = null;
  if (payload.attachment) {
    const content = String(payload.attachment.content ?? '');
    if (!content) return sendJson(res, { error: 'Attachment is missing file data.' }, 422);
    if (Math.ceil((content.length * 3) / 4) > MAX_ATTACHMENT_BYTES) return sendJson(res, { error: 'Attachments must be under 3 MB.' }, 422);
    attachment = {
      filename: String(payload.attachment.filename || 'attachment'),
      content,
      content_type: String(payload.attachment.contentType || 'application/octet-stream'),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return sendJson(res, { error: 'Contact form is not configured on the server.' }, 500);
  const html = [
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`, `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
    phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : '', `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
    '<hr>', `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
  ].join('\n');
  const emailPayload = {
    from, to: [RECIPIENT], reply_to: email, subject: `[Lost Limb Riders Contact] ${subject}`,
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'not provided'}\nSubject: ${subject}\n\n${message}`, html,
  };
  if (attachment) emailPayload.attachments = [attachment];
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload),
    });
    if (response.ok) return sendJson(res, { ok: true, message: 'Message sent. Thank you for reaching out.' }, 201);
    console.error('Resend send failed:', response.status, await response.text());
  } catch (error) {
    console.error('Resend fetch error:', error instanceof Error ? error.message : 'unknown_error');
  }
  return sendJson(res, { error: 'The message could not be sent. Please try again.' }, 502);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  const action = getParam(req, 'action') || 'contact';
  if (action === 'paypal-config') {
    if (req.method !== 'GET') return sendJson(res, { error: 'GET required.' }, 405);
    const config = paypalConfig();
    return sendJson(res, { configured: Boolean(config.clientId && config.clientSecret), environment: config.environment, clientId: config.clientId });
  }
  if (req.method !== 'POST') return sendJson(res, { error: 'POST required.' }, 405);
  const payload = await readBody(req);
  try {
    if (action === 'contact') return await handleContact(res, payload);
    const config = paypalConfig();
    if (!config.clientId || !config.clientSecret) return sendJson(res, { error: 'Online donations are not configured.' }, 503);
    if (action === 'paypal-create-order') {
      const amount = validAmount(payload.amount);
      if (!amount) return sendJson(res, { error: 'Enter a donation amount between $1 and $100,000.' }, 422);
      const order = await paypalRequest(config, '/v2/checkout/orders', {
        method: 'POST', headers: { 'PayPal-Request-Id': randomUUID() },
        body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ description: 'Charitable donation to Lost Limb Riders', custom_id: 'LOST_LIMB_RIDERS_DONATION', amount: { currency_code: 'USD', value: amount } }], payment_source: { paypal: { experience_context: { user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' } } } }),
      });
      if (!ORDER_ID_RE.test(order.id || '')) throw new Error('PayPal returned an invalid order.');
      return sendJson(res, { orderId: order.id }, 201);
    }
    if (action === 'paypal-capture-order') {
      const orderId = clean(payload.orderId, 40);
      if (!ORDER_ID_RE.test(orderId)) return sendJson(res, { error: 'A valid PayPal order ID is required.' }, 422);
      const order = await paypalRequest(config, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { 'PayPal-Request-Id': `capture-${orderId}`.slice(0, 38) } });
      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      if (order.status !== 'COMPLETED' || capture?.status !== 'COMPLETED') return sendJson(res, { error: 'PayPal has not confirmed this donation as completed.' }, 409);
      return sendJson(res, { ok: true, orderId: order.id, status: order.status, captureId: capture.id });
    }
    return sendJson(res, { error: 'Unsupported support action.' }, 404);
  } catch (error) {
    console.error('Support API error:', error instanceof Error ? error.message : 'unknown_error');
    return sendJson(res, { error: 'The request could not be completed. Please try again.' }, 502);
  }
}

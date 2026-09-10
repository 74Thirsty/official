import { randomUUID } from 'crypto';
import { sendJson, sendEmpty, readBody, clean, escapeHtml, getParam } from '../lib/http.js';

const RECIPIENT = 'john.thompson@lostlimbriders.org';
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_ID_RE = /^[A-Z0-9]{8,32}$/i;
const SUBSCRIPTION_ID_RE = /^I-[A-Z0-9]+$/i;
const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function paypalConfig() {
  const environment = process.env.PAYPAL_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'live';
  return {
    environment,
    baseUrl: environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com',
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    monthlyPlanId: process.env.PAYPAL_MONTHLY_PLAN_ID || '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  };
}

async function paypalAccessToken(config) {
  if (!config.clientId || !config.clientSecret) throw new Error('PayPal is not configured.');
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`PayPal authentication failed (${response.status}).`);
  return data.access_token;
}

async function paypalRequest(config, path, options = {}) {
  const token = await paypalAccessToken(config);
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('PayPal request failed:', response.status, data.name || 'unknown_error');
    throw new Error('PayPal could not complete the request.');
  }
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

async function handlePaypal(req, res, action, payload) {
  const config = paypalConfig();
  if (action === 'paypal-config') return sendJson(res, {
    configured: Boolean(config.clientId && config.clientSecret), clientId: config.clientId,
    environment: config.environment, monthlyPlanId: config.monthlyPlanId, monthlyConfigured: Boolean(config.monthlyPlanId),
  });
  if (!config.clientId || !config.clientSecret) return sendJson(res, { error: 'Online donations are not configured yet.' }, 503);

  if (action === 'paypal-create-order') {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) return sendJson(res, { error: 'Enter a donation amount between $1 and $100,000.' }, 422);
    const suppliedRequestId = clean(payload.requestId, 36);
    const order = await paypalRequest(config, '/v2/checkout/orders', {
      method: 'POST', headers: { 'PayPal-Request-Id': REQUEST_ID_RE.test(suppliedRequestId) ? suppliedRequestId : randomUUID() },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ description: 'Donation to Lost Limb Riders', amount: { currency_code: 'USD', value: amount.toFixed(2) } }],
        payment_source: { paypal: { experience_context: { user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' } } },
      }),
    });
    return sendJson(res, { id: order.id, status: order.status }, 201);
  }
  if (action === 'paypal-capture-order') {
    const orderId = clean(payload.orderId, 40);
    if (!ORDER_ID_RE.test(orderId)) return sendJson(res, { error: 'A valid PayPal order ID is required.' }, 422);
    const order = await paypalRequest(config, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST', headers: { 'PayPal-Request-Id': `capture-${orderId}`.slice(0, 38) },
    });
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (order.status !== 'COMPLETED' || capture?.status !== 'COMPLETED') return sendJson(res, { error: 'PayPal has not confirmed this donation as completed.' }, 409);
    return sendJson(res, { ok: true, orderId: order.id, status: order.status, captureId: capture.id });
  }
  if (action === 'paypal-verify-subscription') {
    if (!config.monthlyPlanId) return sendJson(res, { error: 'Monthly donations are not configured yet.' }, 503);
    const subscriptionId = clean(payload.subscriptionId, 40);
    if (!SUBSCRIPTION_ID_RE.test(subscriptionId)) return sendJson(res, { error: 'A valid PayPal subscription ID is required.' }, 422);
    const subscription = await paypalRequest(config, `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (subscription.plan_id !== config.monthlyPlanId || subscription.status !== 'ACTIVE') return sendJson(res, { error: 'PayPal has not confirmed this monthly donation as active.' }, 409);
    return sendJson(res, { ok: true, subscriptionId: subscription.id, status: subscription.status });
  }
  if (action === 'paypal-webhook') {
    if (!config.webhookId) return sendJson(res, { error: 'PayPal webhook verification is not configured.' }, 503);
    const verification = await paypalRequest(config, '/v1/notifications/verify-webhook-signature', {
      method: 'POST', body: JSON.stringify({
        auth_algo: req.headers['paypal-auth-algo'], cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'], transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'], webhook_id: config.webhookId, webhook_event: payload,
      }),
    });
    if (verification.verification_status !== 'SUCCESS') return sendJson(res, { error: 'Invalid PayPal webhook signature.' }, 400);
    return sendJson(res, { ok: true });
  }
  return sendJson(res, { error: 'Unsupported support action.' }, 404);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  const action = getParam(req, 'action') || 'contact';
  if (action === 'paypal-config') {
    if (req.method !== 'GET') return sendJson(res, { error: 'GET required.' }, 405);
    return handlePaypal(req, res, action, {});
  }
  if (req.method !== 'POST') return sendJson(res, { error: 'POST required.' }, 405);
  const payload = await readBody(req);
  try {
    if (action === 'contact') return await handleContact(res, payload);
    return await handlePaypal(req, res, action, payload);
  } catch (error) {
    console.error('Support API error:', error instanceof Error ? error.message : 'unknown_error');
    return sendJson(res, { error: 'The request could not be completed. Please try again.' }, 502);
  }
}

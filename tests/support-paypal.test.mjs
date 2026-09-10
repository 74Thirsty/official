import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/support.js';

function request(method, action, body = {}) {
  return { method, query: { action }, url: `/api/support?action=${action}`, headers: {}, body };
}

function response() {
  return {
    headers: {}, statusCode: 200, payload: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
}

test('PayPal config exposes public identifiers but never the client secret', async () => {
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET, plan: process.env.PAYPAL_MONTHLY_PLAN_ID };
  process.env.PAYPAL_CLIENT_ID = 'public-client-id';
  process.env.PAYPAL_CLIENT_SECRET = 'server-secret';
  process.env.PAYPAL_MONTHLY_PLAN_ID = 'P-MONTHLY';
  try {
    const res = response();
    await handler(request('GET', 'paypal-config'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.clientId, 'public-client-id');
    assert.equal(res.payload.monthlyPlanId, 'P-MONTHLY');
    assert.equal(JSON.stringify(res.payload).includes('server-secret'), false);
  } finally {
    if (previous.id === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET; else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
    if (previous.plan === undefined) delete process.env.PAYPAL_MONTHLY_PLAN_ID; else process.env.PAYPAL_MONTHLY_PLAN_ID = previous.plan;
  }
});

test('capture reports success only for authoritative completed PayPal status', async () => {
  const previousFetch = global.fetch;
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET };
  process.env.PAYPAL_CLIENT_ID = 'public-client-id';
  process.env.PAYPAL_CLIENT_SECRET = 'server-secret';
  let paypalStatus = 'PENDING';
  global.fetch = async (url) => {
    if (String(url).endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'access-token' }) };
    return { ok: true, json: async () => ({ id: 'ORDER12345', status: paypalStatus, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE123', status: paypalStatus }] } }] }) };
  };
  try {
    const pending = response();
    await handler(request('POST', 'paypal-capture-order', { orderId: 'ORDER12345' }), pending);
    assert.equal(pending.statusCode, 409);
    assert.match(pending.payload.error, /not confirmed/i);
    paypalStatus = 'COMPLETED';
    const completed = response();
    await handler(request('POST', 'paypal-capture-order', { orderId: 'ORDER12345' }), completed);
    assert.equal(completed.statusCode, 200);
    assert.deepEqual(completed.payload, { ok: true, orderId: 'ORDER12345', status: 'COMPLETED', captureId: 'CAPTURE123' });
  } finally {
    global.fetch = previousFetch;
    if (previous.id === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET; else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
  }
});

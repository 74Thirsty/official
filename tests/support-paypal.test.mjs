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

test('PayPal config exposes the public client ID but never its matching secret', async () => {
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET, environment: process.env.PAYPAL_ENVIRONMENT };
  process.env.PAYPAL_CLIENT_ID = 'PUBLIC-CLIENT-ID';
  process.env.PAYPAL_CLIENT_SECRET = 'SERVER-SECRET';
  process.env.PAYPAL_ENVIRONMENT = 'sandbox';
  try {
    const res = response();
    await handler(request('GET', 'paypal-config'), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, { configured: true, environment: 'sandbox', clientId: 'PUBLIC-CLIENT-ID' });
    assert.doesNotMatch(JSON.stringify(res.payload), /SERVER-SECRET/);
  } finally {
    if (previous.id === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET; else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
    if (previous.environment === undefined) delete process.env.PAYPAL_ENVIRONMENT; else process.env.PAYPAL_ENVIRONMENT = previous.environment;
  }
});

test('PayPal config reports unavailable unless both credentials are installed', async () => {
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET };
  process.env.PAYPAL_CLIENT_ID = 'PUBLIC-CLIENT-ID';
  delete process.env.PAYPAL_CLIENT_SECRET;
  try {
    const res = response();
    await handler(request('GET', 'paypal-config'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.configured, false);
    assert.equal(res.payload.clientId, 'PUBLIC-CLIENT-ID');
  } finally {
    if (previous.id === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET; else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
  }
});

test('order creation validates and normalizes the donation amount server-side', async () => {
  const previousFetch = global.fetch;
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET };
  process.env.PAYPAL_CLIENT_ID = 'PUBLIC-CLIENT-ID';
  process.env.PAYPAL_CLIENT_SECRET = 'SERVER-SECRET';
  let orderBody;
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'TOKEN' }) };
    orderBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ id: 'ORDER12345' }) };
  };
  try {
    const invalid = response();
    await handler(request('POST', 'paypal-create-order', { amount: '0.01' }), invalid);
    assert.equal(invalid.statusCode, 422);
    const valid = response();
    await handler(request('POST', 'paypal-create-order', { amount: '25.5' }), valid);
    assert.equal(valid.statusCode, 201);
    assert.deepEqual(valid.payload, { orderId: 'ORDER12345' });
    assert.deepEqual(orderBody.purchase_units[0].amount, { currency_code: 'USD', value: '25.50' });
    assert.match(orderBody.purchase_units[0].description, /donation/i);
  } finally {
    global.fetch = previousFetch;
    if (previous.id === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET; else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
  }
});

test('capture succeeds only after authoritative PayPal completion', async () => {
  const previousFetch = global.fetch;
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET };
  process.env.PAYPAL_CLIENT_ID = 'PUBLIC-CLIENT-ID';
  process.env.PAYPAL_CLIENT_SECRET = 'SERVER-SECRET';
  let paymentStatus = 'PENDING';
  global.fetch = async (url) => String(url).endsWith('/v1/oauth2/token')
    ? { ok: true, json: async () => ({ access_token: 'TOKEN' }) }
    : { ok: true, json: async () => ({ id: 'ORDER12345', status: paymentStatus, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE123', status: paymentStatus }] } }] }) };
  try {
    const pending = response();
    await handler(request('POST', 'paypal-capture-order', { orderId: 'ORDER12345' }), pending);
    assert.equal(pending.statusCode, 409);
    paymentStatus = 'COMPLETED';
    const completed = response();
    await handler(request('POST', 'paypal-capture-order', { orderId: 'ORDER12345' }), completed);
    assert.deepEqual(completed.payload, { ok: true, orderId: 'ORDER12345', status: 'COMPLETED', captureId: 'CAPTURE123' });
  } finally {
    global.fetch = previousFetch;
    if (previous.id === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET; else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
  }
});

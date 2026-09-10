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

test('PayPal config exposes only the public hosted button identifier and environment', async () => {
  const previous = { id: process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID, environment: process.env.PAYPAL_DONATE_ENVIRONMENT };
  process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID = 'PUBLIC-HOSTED-ID';
  process.env.PAYPAL_DONATE_ENVIRONMENT = 'sandbox';
  try {
    const res = response();
    await handler(request('GET', 'paypal-config'), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, { configured: true, environment: 'sandbox', hostedButtonId: 'PUBLIC-HOSTED-ID' });
  } finally {
    if (previous.id === undefined) delete process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID; else process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID = previous.id;
    if (previous.environment === undefined) delete process.env.PAYPAL_DONATE_ENVIRONMENT; else process.env.PAYPAL_DONATE_ENVIRONMENT = previous.environment;
  }
});

test('PayPal config reports unavailable without a hosted button ID', async () => {
  const previous = process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID;
  delete process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID;
  try {
    const res = response();
    await handler(request('GET', 'paypal-config'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.configured, false);
    assert.equal(res.payload.hostedButtonId, '');
  } finally {
    if (previous === undefined) delete process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID; else process.env.PAYPAL_DONATE_HOSTED_BUTTON_ID = previous;
  }
});

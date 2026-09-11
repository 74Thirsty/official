import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/support.js';

function request() {
  return { method: 'GET', query: { action: 'paypal-config' }, url: '/api/support?action=paypal-config', headers: {}, body: {} };
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

test('PayPal config exposes the configured public HTTPS PayPal destination', async () => {
  const previous = process.env.PAYPAL_DONATION_URL;
  process.env.PAYPAL_DONATION_URL = 'https://www.paypal.com/donate/?hosted_button_id=OFFICIAL';
  try {
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, { configured: true, donationUrl: 'https://www.paypal.com/donate/?hosted_button_id=OFFICIAL' });
  } finally {
    if (previous === undefined) delete process.env.PAYPAL_DONATION_URL; else process.env.PAYPAL_DONATION_URL = previous;
  }
});

test('PayPal config rejects missing, non-HTTPS, and non-PayPal destinations', async () => {
  const previous = process.env.PAYPAL_DONATION_URL;
  try {
    for (const value of ['', 'http://paypal.com/donate', 'https://example.com/paypal']) {
      process.env.PAYPAL_DONATION_URL = value;
      const res = response();
      await handler(request(), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.payload, { configured: false, donationUrl: '' });
    }
  } finally {
    if (previous === undefined) delete process.env.PAYPAL_DONATION_URL; else process.env.PAYPAL_DONATION_URL = previous;
  }
});

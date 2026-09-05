import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { hashDocsKey, verifyDocsKey } from '../api/admin.js';

function request(action, options = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: options.method || 'GET',
      url: `/api/admin?action=${action}${options.query || ''}`,
      headers: options.headers || {},
      on() {},
    };
    const res = {
      statusCode: 200,
      headers: {},
      status(code) { this.statusCode = code; return this; },
      setHeader(name, value) { this.headers[name] = value; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
      end(body) {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch (error) { reject(error); return; }
        resolve({ status: this.statusCode, body: parsed });
      },
    };
    try { handler(req, res); } catch (error) { reject(error); }
  });
}

test('document keys are stored as salted hashes and verified safely', () => {
  const stored = hashDocsKey('long-example-access-key', 'fixed-test-salt');
  assert.match(stored, /^scrypt:/);
  assert.equal(stored.includes('long-example-access-key'), false);
  assert.equal(verifyDocsKey(stored, 'long-example-access-key'), true);
  assert.equal(verifyDocsKey(stored, 'wrong-key'), false);
});

test('internal document retrieval rejects anonymous direct access', async () => {
  const result = await request('docs-document', { query: '&code=GOV-POL-001' });
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'Document access required.');
});

test('document mutation rejects anonymous direct access', async () => {
  const result = await request('docs-validate', { method: 'POST' });
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'Administrator access required.');
});

test('unknown documents return not found without leaking source details', async () => {
  const result = await request('docs-document', { query: '&code=DOES-NOT-EXIST' });
  assert.equal(result.status, 404);
  assert.deepEqual(result.body, { error: 'Document not found.' });
});

test('compliance APIs reject anonymous access', async () => {
  const result = await request('compliance-workflows');
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'Document access required.');
});

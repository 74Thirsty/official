import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import adminHandler from '../api/admin.js';
import { initialSocialMediaConfig, validateSocialMediaConfig } from '../lib/social-media.js';

const adminPage = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

function anonymousRequest(action, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = { method, url: `/api/admin?action=${action}`, headers: {}, on() {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      setHeader() {},
      json(body) { resolve({ status: this.statusCode, body }); },
      end() { resolve({ status: this.statusCode, body: null }); },
    };
    try { adminHandler(req, res); } catch (error) { reject(error); }
  });
}

test('repository social-media source is valid and returned as an isolated copy', () => {
  const first = initialSocialMediaConfig();
  const second = initialSocialMediaConfig();
  assert.equal(validateSocialMediaConfig(first).ok, true);
  assert.notEqual(first, second);
  assert.ok(first.accounts.length > 0);
});

test('social-media validation rejects malformed schemas, duplicate platforms, and invalid statuses', () => {
  const missing = initialSocialMediaConfig();
  delete missing.organization;
  assert.equal(validateSocialMediaConfig(missing).ok, false);

  const duplicate = initialSocialMediaConfig();
  duplicate.accounts[1].platform = duplicate.accounts[0].platform;
  assert.match(validateSocialMediaConfig(duplicate).error, /Duplicate platform/);

  const badStatus = initialSocialMediaConfig();
  badStatus.accounts[0].status = 'public-by-accident';
  assert.match(validateSocialMediaConfig(badStatus).error, /Invalid status/);
});

test('anonymous clients cannot read or write social-media configuration through the admin API', async () => {
  const getResult = await anonymousRequest('social-media-config');
  const postResult = await anonymousRequest('social-media-config', 'POST');
  assert.equal(getResult.status, 403);
  assert.equal(postResult.status, 403);
  assert.equal(getResult.body.error, 'Admin access required.');
  assert.equal(postResult.body.error, 'Admin access required.');
});

test('admin panel provides hierarchical authenticated editing without fetching the raw static file', () => {
  assert.match(adminPage, /Social Media Configuration/);
  assert.match(adminPage, /apiUrl\('social-media-config'\)/);
  assert.match(adminPage, /renderSocialMediaNode/);
  assert.match(adminPage, /Validate &amp; Save/);
  assert.doesNotMatch(adminPage, /fetch\(['"]\/SOCIAL_MEDIA\.json/);
});

test('Vercel routes direct raw social-media JSON requests away from the file', () => {
  const rule = vercelConfig.redirects.find((entry) => entry.source === '/SOCIAL_MEDIA.json');
  assert.deepEqual(rule, {
    source: '/SOCIAL_MEDIA.json',
    destination: '/__blocked_social_media__',
    permanent: false,
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import adminHandler from '../api/admin.js';
import { initialSocialMediaConfig, patchSocialMediaConfig, validateSocialMediaConfig } from '../lib/social-media.js';

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

test('admin panel provides platform-aware authenticated editing without exposing a JSON tree', () => {
  assert.match(adminPage, /Social Media Configuration Center/);
  assert.match(adminPage, /apiUrl\('social-media-config'\)/);
  assert.match(adminPage, /Save YouTube Configuration/);
  assert.match(adminPage, /Channel Description/);
  assert.match(adminPage, /Configuration Checklist/);
  assert.match(adminPage, /Open YouTube Studio/);
  assert.doesNotMatch(adminPage, /renderSocialMediaNode/);
  assert.doesNotMatch(adminPage, /Validate &amp; Save/);
  assert.doesNotMatch(adminPage, /fetch\(['"]\/SOCIAL_MEDIA\.json/);
});

test('social-media fields have value-only copy controls and complete current-state JSON export', () => {
  assert.match(adminPage, /onclick="copySocialValue\(this,'\$\{id\}'\)">Copy<\/button>/);
  assert.match(adminPage, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(adminPage, /button\.textContent = 'Copied ✓'/);
  assert.match(adminPage, /function currentSocialMediaExport\(\)/);
  assert.match(adminPage, /JSON\.parse\(JSON\.stringify\(socialMediaConfig\)\)/);
  assert.match(adminPage, /account\.links = collectSocialLinks\(\)/);
  assert.match(adminPage, /JSON\.stringify\(currentConfig, null, 2\)/);
  assert.match(adminPage, /link\.download = 'lost-limb-riders-social-media\.json'/);
});

test('platform patches validate human-facing fields and preserve unrelated and legacy data', () => {
  const config = initialSocialMediaConfig();
  config.accounts[1].legacyIntegration = { retained: true };
  const result = patchSocialMediaConfig(config, {
    scope: 'platform',
    platform: 'youtube',
    changes: {
      description: 'A channel description.',
      links: [{ title: 'Lost Limb Riders', url: 'https://lostlimbriders.org/' }],
    },
  });
  assert.equal(result.ok, true);
  const youtube = result.config.accounts.find((account) => account.platform === 'youtube');
  assert.equal(youtube.description, 'A channel description.');
  assert.deepEqual(youtube.legacyIntegration, { retained: true });
  assert.equal(result.config.accounts.find((account) => account.platform === 'facebook').pageId, '1258862137317491');

  const badUrl = patchSocialMediaConfig(config, {
    scope: 'platform', platform: 'youtube', changes: { url: 'http://example.com' },
  });
  assert.equal(badUrl.error, 'Profile URL must be a valid HTTPS URL.');
  const badLink = patchSocialMediaConfig(config, {
    scope: 'platform', platform: 'youtube', changes: { links: [{ title: 'Missing URL', url: '' }] },
  });
  assert.equal(badLink.error, 'Website Link #1 must have a valid HTTPS URL.');
});

test('Vercel routes direct raw social-media JSON requests away from the file', () => {
  const rule = vercelConfig.redirects.find((entry) => entry.source === '/SOCIAL_MEDIA.json');
  assert.deepEqual(rule, {
    source: '/SOCIAL_MEDIA.json',
    destination: '/__blocked_social_media__',
    permanent: false,
  });
});

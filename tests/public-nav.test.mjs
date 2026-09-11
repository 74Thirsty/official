import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const pages = ['index.html', 'events.html', 'media.html', 'mission.html', 'community.html', 'sponsors.html',
  'documentation.html', 'peer-support.html', 'healthcare-partnerships.html', 'join.html',
  'volunteer-employment.html', 'donate.html'];

test('every standard public page loads the canonical navigation renderer', () => {
  for (const page of pages) {
    const html = readFileSync(resolve(root, page), 'utf8');
    assert.match(html, /<script src="assets\/public-nav\.js" defer><\/script>/, page);
    assert.match(html, /<nav class="[^"]*nav[^"]*" aria-label="Primary navigation">/, page);
  }
});

test('canonical navigation preserves homepage groups and verified destinations', () => {
  const script = readFileSync(resolve(root, 'assets/public-nav.js'), 'utf8');
  for (const label of ['Home', 'About', 'Programs', 'Get Involved', 'Community', 'Contact']) assert.match(script, new RegExp(`>${label}(?: |<)`));
  for (const destination of ['mission.html#story', 'peer-support.html', 'healthcare-partnerships.html', 'join.html',
    'volunteer-employment.html', 'sponsors.html', 'events.html', 'media.html', 'community.html', 'documentation.html']) {
    assert.match(script, new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('site-wide Donate CTA uses configured direct PayPal link without payment processing', () => {
  const script = readFileSync(resolve(root, 'assets/public-nav.js'), 'utf8');
  assert.match(script, /aria-label="Donate with PayPal"/);
  assert.match(script, /paypal-config/);
  assert.match(script, /paypal\.href = config\.donationUrl/);
  assert.match(script, /a\[href="donate\.html"\]/);
  assert.doesNotMatch(script, /web-sdk|paypal-create-order|paypal-capture-order|clientSecret|oauth/i);
});

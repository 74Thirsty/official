import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const pages = ['index.html', 'events.html', 'media.html', 'mission.html', 'community.html', 'sponsors.html',
  'documentation.html', 'documentation-viewer.html', 'peer-support.html', 'healthcare-partnerships.html', 'join.html',
  'volunteer-employment.html', 'donate.html'];

function hrefs(html) {
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return [...markup.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
}

test('required public pages exist and are directly routable', () => {
  for (const page of pages) assert.equal(existsSync(resolve(root, page)), true, `${page} must exist`);
});

test('public internal links resolve to files and valid static fragments', () => {
  for (const page of pages) {
    const html = readFileSync(resolve(root, page), 'utf8');
    for (const href of hrefs(html)) {
      if (/^(?:https?:|mailto:|tel:|\/api\/)/.test(href)) continue;
      assert.notEqual(href, '#', `${page} contains a placeholder href`);
      const [pathname, fragment] = href.split('#');
      const targetName = pathname || page;
      const target = resolve(root, targetName);
      assert.equal(existsSync(target), true, `${page} links to missing ${href}`);
      if (fragment && !href.includes('?')) {
        const targetHtml = readFileSync(target, 'utf8');
        assert.match(targetHtml, new RegExp(`id=["']${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), `${page} links to missing fragment ${href}`);
      }
    }
  }
});

test('homepage ends with book then footer and has no legacy tail', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const book = html.indexOf('<section id="book">');
  const bookEnd = html.indexOf('</section>', book);
  const mainEnd = html.indexOf('</main>', bookEnd);
  const footer = html.indexOf('<footer>', mainEnd);
  assert.ok(book > -1 && bookEnd < mainEnd && mainEnd < footer);
  assert.doesNotMatch(html.slice(bookEnd, mainEnd), /<section\b/i);
  assert.doesNotMatch(html, /id="(?:newsletter|contact)"/);
});

test('Where to Go Next tiles are full-card links to verified routes', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const start = html.indexOf('<section id="destinations">');
  const end = html.indexOf('</section>', start);
  const section = html.slice(start, end);
  const destinations = [...section.matchAll(/<a class="card-link" href="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(destinations, ['peer-support.html', 'healthcare-partnerships.html', 'join.html', 'volunteer-employment.html', 'donate.html', 'sponsors.html', 'events.html', 'community.html']);
  assert.equal((section.match(/<article class="card">/g) || []).length, destinations.length);
});

test('known placeholder and stale public links are absent', () => {
  const combined = pages.map((page) => readFileSync(resolve(root, page), 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '')).join('\n');
  assert.doesNotMatch(combined, /href=["'](?:#|\s*)["']/i);
  assert.doesNotMatch(combined, /javascript:void\(0\)|localhost|127\.0\.0\.1/i);
  assert.doesNotMatch(combined, /index\.html#(?:contact|newsletter|keynote)/i);
  assert.doesNotMatch(combined, /https:\/\/(?:open\.spotify\.com\/show|podcasts\.apple\.com\/us\/podcast)\/["']/i);
});

test('PayPal integration keeps secrets server-side and gates success on verified status', () => {
  const page = readFileSync(resolve(root, 'donate.html'), 'utf8');
  const api = readFileSync(resolve(root, 'api/support.js'), 'utf8');
  assert.doesNotMatch(page, /PAYPAL_CLIENT_SECRET|clientSecret/);
  assert.match(api, /process\.env\.PAYPAL_CLIENT_SECRET/);
  assert.match(api, /order\.status !== 'COMPLETED'/);
  assert.match(api, /capture\?\.status !== 'COMPLETED'/);
  assert.match(api, /subscription\.status !== 'ACTIVE'/);
  assert.match(api, /verify-webhook-signature/);
  assert.doesNotMatch(page, /success\.html|\/success/);
});

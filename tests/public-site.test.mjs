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
  assert.doesNotMatch(combined, /tel:15158905765/);
});

test('known placeholder media destination is never exposed as playable content', () => {
  const seed = readFileSync(resolve(root, 'lib/seed.js'), 'utf8');
  const media = readFileSync(resolve(root, 'media.html'), 'utf8');
  assert.doesNotMatch(seed, /dQw4w9WgXcQ/);
  assert.match(media, /videoId !== 'dQw4w9WgXcQ'/);
});

test('provided third-party YouTube video is seeded without displaying channel attribution', () => {
  const seed = readFileSync(resolve(root, 'lib/seed.js'), 'utf8');
  assert.match(seed, /title: 'LLR-FDPUBLIB-02'/);
  assert.match(seed, /videoId: '2ZGgAKdnOXo'/);
  assert.match(seed, /duration: '30:00'/);
  const media = readFileSync(resolve(root, 'media.html'), 'utf8');
  assert.match(media, /stream\.platform === 'youtube'/);
  assert.match(media, /youtubeEmbed/);
  assert.match(media, /youtube-nocookie\.com\/embed\/\$\{escapeHtml\(v\.videoId\)\}/);
  assert.doesNotMatch(media, /onclick="openVideoModal\('\$\{v\.id\}'\)"/);
  assert.match(media, /document\.getElementById\('liveTitle'\)\.textContent = isLive && stream\.title/);
});

test('PayPal donation uses a configured direct HTTPS link without SDK or payment APIs', () => {
  const page = readFileSync(resolve(root, 'donate.html'), 'utf8');
  const api = readFileSync(resolve(root, 'api/support.js'), 'utf8');
  assert.match(page, /<a id="paypalDonationLink" class="paypal-link" hidden><img[^>]+paypalobjects\.com[^>]*>Donate with PayPal<\/a>/);
  assert.match(page, /link\.href=config\.donationUrl/);
  assert.match(api, /process\.env\.PAYPAL_DONATION_URL/);
  assert.match(api, /url\.protocol !== 'https:'/);
  assert.doesNotMatch(`${page}\n${api}`, /web-sdk|paypal-create-order|paypal-capture-order|createPayPalOneTimePaymentSession|PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET|api-m\.paypal\.com/);
  assert.doesNotMatch(page, /success\.html|\/success/);
});

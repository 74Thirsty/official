import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'mission.html'), 'utf8');

const EXPECTED = [
  ['story', 'Our Story'],
  ['mission-statement', 'Our Mission'],
  ['vision', 'The Vision'],
  ['funds', 'How the Funds Will Help'],
  ['help', 'Why We’re Asking for Help'],
  ['involved', 'How People Can Get Involved'],
  ['closing', 'Closing'],
  ['org-info', 'Organization Info'],
];

test('mission page has exactly eight section-navigation tiles', () => {
  const links = [...html.matchAll(/class="toc-item" href="#([\w-]+)"/g)].map((m) => m[1]);
  assert.equal(links.length, 8, `expected 8 toc tiles, got ${links.length}`);
  assert.deepEqual(links, EXPECTED.map(([id]) => id), 'tile order/hrefs must match the eight sections');
});

test('every tile target has a matching section id on the same page', () => {
  for (const [id, label] of EXPECTED) {
    const section = html.match(new RegExp(`<section id="${id}"`));
    assert.ok(section, `section #${id} (${label}) is missing`);
  }
});

test('section-id scroll offset exists so destinations clear the sticky header', () => {
  assert.match(html, /section\[id\]\s*\{[^}]*scroll-margin-top\s*:\s*\d+px/, 'add section[id] { scroll-margin-top: <px>; } to mission.html');
});

test('toc tiles have an explicit smooth-scroll handler guarding the anchor default', () => {
  const scriptMatch = html.match(/<script>[\s\S]*?<\/script>/);
  assert.ok(scriptMatch, 'mission.html must contain the inline toc navigation script');
  const script = scriptMatch[0];
  assert.match(script, /\.toc-item/, 'script must reference the toc-item class');
  assert.match(script, /addEventListener\('click'/, 'script must attach click handlers');
  assert.match(script, /scrollIntoView\(\{ behavior:\s*'smooth'/, 'script must call scrollIntoView with smooth behavior');
  assert.match(script, /preventDefault\(\)/, 'script must prevent default fragment jump');
  assert.match(script, /history\.replaceState/, 'script must update the URL fragment');
});
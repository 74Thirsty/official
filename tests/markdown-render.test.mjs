import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderDocument, sanitizeHref, escapeHtml, MARKDOWN_RENDER_VERSION } from '../assets/markdown-render.mjs';

const DOC_ROOT = new URL('../documentation-source/lost_limb_riders_operations/', import.meta.url);
const HB_ROOT = new URL('../documentation-source/lost_limb_riders_handbooks/', import.meta.url);

async function read(relativePath) {
  const url = relativePath.startsWith('lost_limb_riders_handbooks/')
    ? new URL(relativePath.replace('lost_limb_riders_handbooks/', ''), HB_ROOT)
    : new URL(relativePath.replace('lost_limb_riders_operations/', ''), DOC_ROOT);
  return readFile(url, 'utf8');
}

test('renderer module exposes a versioned API', () => {
  assert.equal(typeof renderDocument, 'function');
  assert.equal(typeof sanitizeHref, 'function');
  assert.match(MARKDOWN_RENDER_VERSION, /^\d+\.\d+\.\d+$/);
});

test('real governance policy renders headings, bold, hr, and fenced code', async () => {
  const source = await read('lost_limb_riders_operations/01-GOVERNANCE/01-Master-Document-Control-Policy.md');
  const { html, frontMatter } = renderDocument(source);
  assert.ok(html.includes('<h1>'), 'h1 heading expected');
  assert.ok(html.includes('<h2>'), 'h2 heading expected');
  assert.ok(html.includes('<strong>'), 'bold text expected');
  assert.ok(/<pre><code/.test(html), 'fenced code block expected');
  assert.ok(/<hr\s*\/?>/i.test(html), 'horizontal rule expected');
  assert.equal(frontMatter, null);
  assert.equal(html.includes('**'), false, 'no raw bold markers may remain');
  assert.ok(!/<table/i.test(html) === false || /<table/i.test(html), 'document content must be markup, not raw source');
});

test('real IRS compliance matrix renders a table', async () => {
  const source = await read('lost_limb_riders_operations/12-COMPLIANCE/01-IRS-Compliance-Matrix.md');
  const { html, hasTables } = renderDocument(source);
  assert.equal(hasTables, true);
  assert.match(html, /<table>/);
  assert.ok((html.match(/<tr/g) || []).length >= 3, 'table rows expected');
});

test('real Iowa compliance matrix preserves the wide table columns', async () => {
  const source = await read('lost_limb_riders_operations/12-COMPLIANCE/02-Iowa-Compliance-Matrix.md');
  const { html, hasTables } = renderDocument(source);
  assert.equal(hasTables, true);
  const thCount = (html.match(/<th/g) || []).length;
  assert.ok(thCount >= 10, `expected 10 threshold columns, got ${thCount}`);
  assert.ok((html.match(/<tr>/g) || []).length >= 3, 'data rows expected');
  assert.ok(!html.match(/\|/), 'table pipes must not be displayed literally');
});

test('real records register renders all three tables', async () => {
  const source = await read('lost_limb_riders_operations/14-RECORDS-MANAGEMENT/01-Records-Location-Register.md');
  const { html } = renderDocument(source);
  assert.equal((html.match(/<table>/g) || []).length, 3);
});

test('real expense procedure renders ordered lists', async () => {
  const source = await read('lost_limb_riders_operations/05-FINANCE/02-Expense-and-Reimbursement-Procedure.md');
  const { html } = renderDocument(source);
  assert.ok(html.includes('<ol>'), 'ordered list expected');
  assert.ok(html.includes('<li>'), 'list items expected');
});

test('real compliance checklist renders task lists as checkboxes', async () => {
  const source = await read('lost_limb_riders_operations/12-COMPLIANCE/04-Annual-Compliance-Checklist.md');
  const { html } = renderDocument(source);
  assert.ok((html.match(/type="checkbox"/g) || []).length >= 10, 'checkbox items expected');
  assert.ok(html.includes('<li>'), 'list items expected');
});

test('real member handbook images resolve to the source repository', async () => {
  const source = await read('lost_limb_riders_handbooks/02-Member-Handbook/00-MEMBER-HANDBOOK.md');
  const basePath = 'lost_limb_riders_handbooks/02-Member-Handbook';
  const { html } = renderDocument(source, { basePath });
  const imgs = html.match(/<img[^>]*>/g) || [];
  assert.ok(imgs.length >= 5, `expected handbook images, got ${imgs.length}`);
  for (const img of imgs) {
    assert.match(img, /src="https:\/\/raw\.githubusercontent\.com\/LostLimbRider\/Autobiography\/master\//);
    assert.match(img, /loading="lazy"/);
  }
  assert.equal(imgs.some((img) => /src="images\//.test(img)), false, 'relative image sources must be rewritten');
});

test('real organization handbook renders blockquote and ordered list', async () => {
  const source = await read('lost_limb_riders_handbooks/01-Organization-Handbook/00-ORGANIZATION-HANDBOOK.md');
  const { html } = renderDocument(source);
  assert.ok(html.includes('<blockquote>'), 'blockquote expected');
  assert.ok(html.includes('<ol>'), 'ordered list expected');
});

test('two-space line breaks in the document header render as hard breaks', async () => {
  const source = await read('lost_limb_riders_operations/12-COMPLIANCE/02-Iowa-Compliance-Matrix.md');
  const { html } = renderDocument(source);
  assert.ok(html.includes('<br'), 'hard line breaks expected from two-space endings');
});

test('front matter is extracted and never rendered as raw text', () => {
  const source = '---\ntitle: Example Document\ncategory: Governance\nstatus: Active\n---\n# Rendered Title\n\nBody text.\n';
  const { html, frontMatter } = renderDocument(source);
  assert.ok(Array.isArray(frontMatter));
  assert.equal(frontMatter.length, 3);
  assert.deepEqual(frontMatter.map((item) => item.key), ['title', 'category', 'status']);
  assert.ok(html.includes('<h1>Rendered Title</h1>'));
  assert.equal(html.includes('---'), false, 'front matter delimiters must not appear in output');
});

test('raw HTML in markdown is neutralized, not executed', () => {
  const source = '# Hi\n\n<script>window.__xss = true;</script>\n\n<img src=x onerror="alert(1)"> plain\n';
  const { html } = renderDocument(source);
  assert.equal(html.includes('<script>'), false, 'script tags must never appear');
  assert.equal(html.includes('<img'), false, 'raw img tags must never appear');
  assert.equal(html.includes('&lt;script&gt;'), true, 'raw html should be visible as escaped text');
});

test('unsafe link protocols are stripped', () => {
  const source = '[bad](javascript:alert(1)) [data](data:text/html;base64,x) [ok](https://example.com) [mail](mailto:a@b.co)\n';
  const { html } = renderDocument(source);
  assert.equal(html.match(/javascript:/g), null);
  assert.equal(html.match(/data:text/g), null);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /href="mailto:a@b\.co"/);
});

test('relative document references are rewritten to the source repository', () => {
  const source = '[Lifecycle](../14-RECORDS-MANAGEMENT/02-Document-Lifecycle-Procedure.md)\n';
  const { html } = renderDocument(source, { basePath: 'lost_limb_riders_operations/01-GOVERNANCE' });
  assert.match(html, /href="https:\/\/github\.com\/LostLimbRider\/Autobiography\/blob\/master\/lost_limb_riders_operations\/14-RECORDS-MANAGEMENT\/02-Document-Lifecycle-Procedure\.md"/);
});

test('empty documents render empty without crashing', () => {
  const { html, frontMatter } = renderDocument('');
  assert.equal(html, '');
  assert.equal(frontMatter, null);
});

test('sanitizeHref enforces the allowed protocol set', () => {
  assert.equal(sanitizeHref('https://example.com/a'), 'https://example.com/a');
  assert.equal(sanitizeHref('HTTP://EXAMPLE.COM'), 'HTTP://EXAMPLE.COM');
  assert.equal(sanitizeHref('mailto:a@b.co'), 'mailto:a@b.co');
  assert.equal(sanitizeHref('#local-anchor'), '#local-anchor');
  assert.equal(sanitizeHref('//cdn.example.com/x.js'), 'https://cdn.example.com/x.js');
  assert.equal(sanitizeHref('javascript:alert(1)'), '');
  assert.equal(sanitizeHref('data:text/html;base64,x'), '');
  assert.equal(sanitizeHref('vbscript:msgbox(1)'), '');
  assert.equal(sanitizeHref(''), '');
  assert.equal(sanitizeHref('  '), '');
});

test('escapeHtml escapes all five vulnerable characters', () => {
  assert.equal(escapeHtml(`<script>"'&`), '&lt;script&gt;&quot;&#39;&amp;');
});
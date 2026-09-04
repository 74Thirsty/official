import { Marked } from './vendor/marked.esm.js';

export const MARKDOWN_RENDER_VERSION = '1.0.0';

const SOURCE_REPO = 'LostLimbRider/Autobiography';
const SOURCE_BRANCH = 'master';
const RAW_BASE = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/`;
const BLOB_BASE = `https://github.com/${SOURCE_REPO}/blob/${SOURCE_BRANCH}/`;

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function resolveRepoPath(basePath, rel) {
  const parts = String(basePath || '').split('/').filter(Boolean);
  for (const seg of String(rel || '').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { if (parts.length) parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}

export function sanitizeHref(value, options = {}) {
  const href = String(value || '').trim().replace(/[\u0000-\u001F\u007F]/g, '');
  if (!href) return '';
  const basePath = String(options.basePath || '');

  const scheme = (href.match(/^([a-z][a-z0-9+.-]*):/i) || [])[1];
  if (scheme) {
    const protocol = scheme.toLowerCase();
    if (protocol === 'http' || protocol === 'https' || protocol === 'mailto') return href;
    return '';
  }
  if (/^#/.test(href)) return href;
  if (/^\/\//.test(href)) return `https:${href}`;
  if (!basePath) return href;

  const resolved = resolveRepoPath(basePath, href);
  if (!resolved) return href;
  return /\.md$/i.test(resolved) ? `${BLOB_BASE}${resolved}` : `${RAW_BASE}${resolved}`;
}

function extractFrontMatter(source) {
  const match = String(source).match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { frontMatter: null, body: String(source) };
  const pairs = match[1].split(/\r?\n/).map((line) => {
    const parsed = line.match(/^\s*([^:]{1,80}?)\s*:\s*(.*)$/);
    return parsed ? { key: parsed[1].trim(), value: parsed[2].trim() } : null;
  }).filter(Boolean);
  return { frontMatter: pairs.length ? pairs : [], body: String(source).slice(match[0].length) };
}

function escapeHtmlOutsideFences(source) {
  const lines = String(source).split('\n');
  let fence = '';
  let fenceLength = 0;
  const escapeLine = (line) => {
    const quote = line.match(/^ {0,3}(?:> ?)+/);
    const body = quote ? line.slice(quote[0].length) : line;
    const escaped = body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return quote ? quote[0] + escaped : escaped;
  };
  return lines.map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence && marker[1].length >= fenceLength) {
        fence = '';
      }
      return line;
    }
    if (marker && marker[1].length >= 3) {
      fence = marker[1][0];
      fenceLength = marker[1].length;
      return line;
    }
    return escapeLine(line);
  }).join('\n');
}

function rewriteUrls(html, basePath) {
  html = String(html).replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/src="([^"]*)"/i) || [])[1];
    if (!src) return '';
    const safe = sanitizeHref(src, { basePath });
    if (!safe) return '';
    tag = tag.replace(/src="([^"]*)"/i, `src="${escapeHtml(safe)}"`);
    if (!/\bloading=/i.test(tag)) tag = tag.replace(/\/?>$/, ' loading="lazy">');
    return tag;
  });

  html = String(html).replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (anchor) => {
    const open = (anchor.match(/^<a\b[^>]*>/i) || [])[0];
    const href = (open.match(/href="([^"]*)"/i) || [])[1];
    if (!open || !href) return anchor;
    const safe = sanitizeHref(href, { basePath });
    if (!safe) return anchor.replace(/^<a\b[^>]*>/i, '').replace(/<\/a>\s*$/i, '');
    let newOpen = open.replace(/href="([^"]*)"/i, `href="${escapeHtml(safe)}"`);
    if (safe.startsWith('#')) {
      newOpen = newOpen.replace(/\s+target="[^"]*"/gi, '').replace(/\s+rel="[^"]*"/gi, '');
    } else if (!/\btarget=/i.test(newOpen)) {
      newOpen = newOpen.replace(/>$/, ' target="_blank" rel="noopener noreferrer">');
    }
    return newOpen + anchor.slice(open.length, -'</a>'.length) + '</a>';
  });

  return html;
}

const SANITIZER_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'strong', 'em', 's', 'del',
  'blockquote', 'hr', 'a', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'br', 'img', 'input',
]);

function sanitizeDom(root, basePath) {
  const elements = Array.from(root.querySelectorAll('*'));
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (!SANITIZER_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    if (tag === 'input') {
      if (el.getAttribute('type') !== 'checkbox') { el.remove(); continue; }
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (tag === 'a' && name === 'href') {
        const safe = sanitizeHref(value, { basePath });
        if (safe) {
          el.setAttribute('href', safe);
          if (safe.startsWith('#')) {
            el.removeAttribute('target');
          } else {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        } else {
          el.removeAttribute('href');
          el.removeAttribute('target');
          el.removeAttribute('rel');
        }
        continue;
      }
      if (tag === 'img' && (name === 'src' || name === 'alt' || name === 'title' || name === 'loading')) {
        if (name === 'src') {
          const safe = sanitizeHref(value, { basePath });
          if (safe) el.setAttribute('src', safe); else el.removeAttribute('src');
        }
        continue;
      }
      if (tag === 'code' && name === 'class' && /^language-[\w-]+$/.test(value)) continue;
      if ((tag === 'th' || tag === 'td') && name === 'align') continue;
      el.removeAttribute(name);
    }
    if (tag === 'img') el.setAttribute('loading', 'lazy');
  }
}

export function renderDocument(source, options = {}) {
  const { frontMatter, body } = extractFrontMatter(source);
  const basePath = String(options.basePath || '');

  const parser = new Marked({
    gfm: true,
    breaks: false,
    pedantic: false,
  });

  let html;
  try {
    html = parser.parse(escapeHtmlOutsideFences(body));
  } catch (err) {
    const error = new Error('Markdown rendering failed.');
    error.cause = err;
    throw error;
  }
  html = html == null ? '' : String(html);

  if (html) {
    try {
      if (typeof DOMParser !== 'undefined') {
        const dom = new DOMParser().parseFromString(html, 'text/html');
        sanitizeDom(dom.body, basePath);
        html = dom.body.innerHTML;
      } else {
        html = rewriteUrls(html, basePath);
      }
    } catch (err) {
      const error = new Error('Document sanitization failed.');
      error.cause = err;
      throw error;
    }
  }

  return {
    html,
    frontMatter,
    hasTables: /<table/i.test(html),
  };
}
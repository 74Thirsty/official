/**
 * @file        document-references.js
 * @description Document reference resolution and transclusion
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { DOCUMENT_REGISTRY, findDocumentByCode } from './document-registry.js';

export const EXPANSION_LIMITS = Object.freeze({
  maxDepth: 3,
  maxExpansions: 12,
  maxBytes: 512 * 1024,
  maxMilliseconds: 5000,
});

const ID_RE = /\b[A-Z]{2,5}-[A-Z]+-\d{3}\b/g;
const CONTEXT_RE = /\b(?:see|per|use|using|follow|complete|attach|required|requires|according to|in accordance with|pursuant to|approval|checklist|form|procedure|policy|register|reference)\b/i;

function normalizeHeading(value) {
  return String(value || '')
    .replace(/[*_`"“”']/g, '')
    .replace(/^section\s+/i, '')
    .replace(/^§\s*/, '')
    .replace(/^\d+(?:\.\d+)*[.:\s-]+/, '')
    .trim()
    .toLowerCase();
}

export function extractSection(markdown, requestedHeading) {
  const wanted = normalizeHeading(requestedHeading);
  if (!wanted) return null;
  const lines = String(markdown || '').split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!match || normalizeHeading(match[2]) !== wanted) continue;
    const level = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end].match(/^(#{1,6})\s+/);
      if (next && next[1].length <= level) break;
      end += 1;
    }
    return lines.slice(index, end).join('\n').trim();
  }
  return null;
}

function sectionHint(line, documentId) {
  const tail = line.slice(line.indexOf(documentId) + documentId.length);
  const section = tail.match(/(?:§|section\s+)["“]?([^"”.;,)\]]+)/i);
  return section ? section[1].trim() : '';
}

function findByPath(reference, sourcePath) {
  const clean = reference.split('#')[0].replace(/^<|>$/g, '');
  const base = sourcePath.split('/').slice(0, -1).join('/');
  const relative = new URL(clean, `https://source.invalid/${base}/`).pathname.slice(1);
  const exact = DOCUMENT_REGISTRY.find((document) => document.canonical_path === relative);
  if (exact) return exact;
  const basename = clean.split('/').at(-1);
  const matches = DOCUMENT_REGISTRY.filter((document) => document.canonical_path.endsWith(`/${basename}`));
  return matches.length === 1 ? matches[0] : null;
}

export function identifyContextualReferences(markdown, sourcePath = '') {
  const lines = String(markdown || '').split(/\n/);
  const references = [];
  let bodyStarted = !lines.slice(0, 90).some((line) => /^\*\*Document ID:\*\*/.test(line));
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    if (!bodyStarted) {
      if (/^---\s*$/.test(line)) bodyStarted = true;
      continue;
    }
    const linked = [...line.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/g)];
    for (const match of linked) {
      const document = findByPath(match[1], sourcePath);
      references.push({ line: lineNumber, token: match[1], document, section: decodeURIComponent(match[1].split('#')[1] || '').replace(/-/g, ' ') });
    }
    if (!CONTEXT_RE.test(line) && !/(?:§|section\s+)/i.test(line)) continue;
    for (const documentId of new Set(line.match(ID_RE) || [])) {
      if (references.some((reference) => reference.line === lineNumber && reference.document?.document_id === documentId)) continue;
      references.push({ line: lineNumber, token: documentId, document: findDocumentByCode(documentId), section: sectionHint(line, documentId) });
    }
  }
  return references;
}

export async function expandDocument(rootDocument, markdown, options = {}) {
  const authenticated = options.authenticated === true;
  const fetchMarkdown = options.fetchMarkdown;
  if (typeof fetchMarkdown !== 'function') throw new TypeError('fetchMarkdown is required');
  const limits = { ...EXPANSION_LIMITS, ...(options.limits || {}) };
  const started = Date.now();
  const state = { count: 0, bytes: Buffer.byteLength(markdown, 'utf8') };

  async function expand(sourceDocument, sourceMarkdown, depth, chain) {
    const output = [];
    for (const reference of identifyContextualReferences(sourceMarkdown, sourceDocument.canonical_path)) {
      const target = reference.document;
      if (!target) {
        output.push({ status: 'broken', token: reference.token, line: reference.line, children: [] });
        continue;
      }
      if (target.access !== 'public' && !authenticated) {
        output.push({ status: 'restricted', token: reference.token, line: reference.line, document: publicReference(target), children: [] });
        continue;
      }
      if (chain.includes(target.key)) {
        output.push({ status: 'cycle', token: reference.token, line: reference.line, document: publicReference(target), children: [] });
        continue;
      }
      if (depth >= limits.maxDepth || state.count >= limits.maxExpansions || state.bytes >= limits.maxBytes || Date.now() - started >= limits.maxMilliseconds) {
        output.push({ status: 'limited', token: reference.token, line: reference.line, document: publicReference(target), children: [] });
        continue;
      }
      let targetMarkdown;
      try {
        targetMarkdown = await fetchMarkdown(target);
      } catch {
        output.push({ status: 'broken', token: reference.token, line: reference.line, document: publicReference(target), children: [] });
        continue;
      }
      let content = targetMarkdown;
      let section = '';
      if (reference.section) {
        const excerpt = extractSection(targetMarkdown, reference.section);
        if (!excerpt) {
          output.push({ status: 'broken-section', token: reference.token, section: reference.section, line: reference.line, document: publicReference(target), children: [] });
          continue;
        }
        content = excerpt;
        section = reference.section;
      }
      const contentBytes = Buffer.byteLength(content, 'utf8');
      if (state.bytes + contentBytes > limits.maxBytes) {
        output.push({ status: 'limited', token: reference.token, line: reference.line, document: publicReference(target), children: [] });
        continue;
      }
      state.count += 1;
      state.bytes += contentBytes;
      output.push({
        status: 'included',
        token: reference.token,
        section,
        line: reference.line,
        document: publicReference(target),
        content,
        children: await expand(target, content, depth + 1, [...chain, target.key]),
      });
    }
    return output;
  }

  return {
    references: await expand(rootDocument, markdown, 0, [rootDocument.key]),
    expansion_count: state.count,
    rendered_bytes: state.bytes,
    limits,
  };
}

function publicReference(document) {
  return {
    document_code: document.document_code,
    document_id: document.document_id,
    title: document.title,
    canonical_path: document.canonical_path,
    source_url: document.source_url,
    access: document.access,
  };
}

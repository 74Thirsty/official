import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'documentation-source');
const OUTPUT = path.join(ROOT, 'lib', 'document-manifest.generated.js');
const ACCESS_REGISTER = 'lost_limb_riders_handbooks/transactional_operations/02-ADMINISTRATION/ADM-REG-003-Document-Access-Classification-Register.md';
const SOURCE_DIRS = ['lost_limb_riders_handbooks', 'employees'];
const ID_RE = /\b[A-Z]{2,5}-[A-Z]+-\d{3}\b/g;

function header(text) {
  const fields = {};
  for (const line of text.split(/\r?\n/).slice(0, 90)) {
    const match = line.match(/^\*\*(.+?):\*\*\s*(.*?)\s*$/);
    if (match) fields[match[1].trim()] = match[2].trim();
  }
  return fields;
}

function titleFrom(text, relativePath, fields) {
  if (fields['Document Title']) return fields['Document Title'].replace(/^Lost Limb Riders\s+[—-]\s+/, '').trim();
  const headings = text.split(/\r?\n/).filter((line) => /^#{1,3}\s+/.test(line));
  const heading = headings.find((line) => !/^#{1,3}\s+(?:\*\*)?Lost Limb Riders(?:\*\*)?\s*$/i.test(line)) || headings[0];
  if (heading) return heading.replace(/^#{1,3}\s+/, '').replace(/[*_`]/g, '').trim();
  return path.basename(relativePath, '.md').replace(/[-_]+/g, ' ');
}

function stableKey(relativePath, documentId) {
  if (documentId) return documentId;
  return `DOC-${createHash('sha256').update(relativePath).digest('hex').slice(0, 16).toUpperCase()}`;
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolute);
  }
  return files;
}

async function sourceRevision() {
  const marker = (await readFile(path.join(SOURCE, '.git'), 'utf8')).trim().replace(/^gitdir:\s*/, '');
  const metadata = path.resolve(SOURCE, marker);
  const head = (await readFile(path.join(metadata, 'HEAD'), 'utf8')).trim();
  if (!head.startsWith('ref: ')) return head;
  return (await readFile(path.join(metadata, head.slice(5)), 'utf8')).trim();
}

function accessPolicy(text) {
  const explicit = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([^`]+\.md)`\s*\|[^|]*\|\s*(PUBLIC|INTERNAL)\s*\|\s*$/);
    if (match) explicit.set(match[1], match[2].toLowerCase());
  }
  return explicit;
}

const accessText = await readFile(path.join(SOURCE, ACCESS_REGISTER), 'utf8');
const access = accessPolicy(accessText);
const sourceFiles = (await Promise.all(SOURCE_DIRS.map((dir) => walk(path.join(SOURCE, dir))))).flat().sort();
const records = [];

for (const absolute of sourceFiles) {
  const relativePath = path.relative(SOURCE, absolute).split(path.sep).join('/');
  const text = await readFile(absolute, 'utf8');
  const fields = header(text);
  const documentId = fields['Document ID'] || '';
  const title = titleFrom(text, relativePath, fields);
  records.push({
    key: stableKey(relativePath, documentId),
    document_id: documentId || null,
    canonical_name: title,
    title,
    canonical_path: relativePath,
    section: relativePath.split('/').slice(0, -1).join(' / '),
    type: fields['Document Type'] || 'Document',
    version: fields.Version || '',
    status: fields.Status || 'Active',
    effective_date: fields['Effective Date'] || '',
    responsible_area: fields.Department || '',
    approving_authority: fields['Approving Authority'] || '',
    access: access.get(relativePath) || 'internal',
    content_hash: createHash('sha256').update(text).digest('hex'),
    reference_tokens: [...new Set(text.match(ID_RE) || [])].filter((id) => id !== documentId).sort(),
    reference_links: [...new Set([...text.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/g)].map((match) => match[1]))].sort(),
  });
}

function duplicatesBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups.entries()].filter(([, matches]) => matches.length > 1);
}

const duplicateNames = duplicatesBy(records, (record) => record.canonical_name.toLocaleLowerCase());
if (duplicateNames.length) {
  throw new Error(`Duplicate canonical document names:\n${duplicateNames.map(([name, matches]) => `${name}: ${matches.map((item) => item.canonical_path).join(', ')}`).join('\n')}`);
}

const duplicateKeys = duplicatesBy(records, (record) => record.key);
if (duplicateKeys.length) throw new Error(`Duplicate canonical document identities: ${duplicateKeys.map(([key]) => key).join(', ')}`);

const knownIds = new Set(records.map((record) => record.document_id).filter(Boolean));
const byPath = new Map(records.map((record) => [record.canonical_path, record]));
for (const record of records) {
  const idReferences = record.reference_tokens.map((documentId) => ({ kind: 'document_id', target: documentId, resolved: knownIds.has(documentId) }));
  const linkReferences = record.reference_links.map((link) => {
    const clean = link.split('#')[0];
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(record.canonical_path), clean));
    const basenameMatches = records.filter((candidate) => path.posix.basename(candidate.canonical_path) === path.posix.basename(clean));
    const target = byPath.get(relative) || (basenameMatches.length === 1 ? basenameMatches[0] : null);
    return { kind: 'path', target: link, resolved: Boolean(target), resolved_key: target?.key || null };
  });
  record.references = [...idReferences, ...linkReferences];
  delete record.reference_tokens;
  delete record.reference_links;
}

const manifest = {
  schema_version: 1,
  source_repository: 'https://github.com/LostLimbRider/Autobiography',
  source_revision: await sourceRevision(),
  access_register: ACCESS_REGISTER,
  default_access: 'internal',
  documents: records,
};

await writeFile(OUTPUT, `// GENERATED FILE. Run npm run generate:documents; do not edit by hand.\nexport const DOCUMENT_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`, 'utf8');
console.log(`Generated ${records.length} canonical documents from ${manifest.source_revision}.`);

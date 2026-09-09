import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'documentation-source');
const EMPLOYEES = path.join(SOURCE, 'employees');
const OUTPUT = path.join(ROOT, 'lib', 'onboarding-references.generated.js');

function section(text, heading) {
  const match = text.match(new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |\\Z)`, 'm'));
  return match ? match[1].trim() : '';
}

function firstParagraph(text) {
  return text.split(/\n\s*\n/).map((value) => value.trim()).find((value) => value && !value.startsWith('#')) || '';
}

const files = (await readdir(EMPLOYEES)).filter((name) => /^\d{2}-.+\.md$/.test(name)).sort();
const positions = [];
for (const filename of files) {
  const text = await readFile(path.join(EMPLOYEES, filename), 'utf8');
  const title = text.match(/^# (.+?) — Position Manual$/m)?.[1];
  if (!title) throw new Error(`Position title missing from employees/${filename}`);
  positions.push({
    id: filename.slice(0, -3),
    title,
    description: firstParagraph(section(text, 'Position Overview')),
    purpose: firstParagraph(section(text, 'Core Purpose')),
    source_document: 'HR-REF-001',
    source_path: `employees/${filename}`,
    source_hash: createHash('sha256').update(text).digest('hex'),
  });
}
if (positions.length !== 42) throw new Error(`Expected 42 canonical positions; found ${positions.length}.`);

const locations = [{
  id: 'fort-dodge-iowa',
  name: 'Fort Dodge, Iowa',
  source_document: 'ORG-HBK-001',
  source_path: 'lost_limb_riders_handbooks/01-Organization-Handbook/00-ORGANIZATION-HANDBOOK.md',
  authority_note: 'Current primary Lost Limb Riders operating location; no additional active chapter/location register is published.',
}];

const banner = '// Generated from canonical Autobiography documents. Do not edit by hand.\n';
await writeFile(OUTPUT, `${banner}export const CANONICAL_POSITIONS = Object.freeze(${JSON.stringify(positions, null, 2)});\n\nexport const AUTHORIZED_LOCATIONS = Object.freeze(${JSON.stringify(locations, null, 2)});\n`);
console.log(`Generated ${positions.length} positions and ${locations.length} authorized location.`);

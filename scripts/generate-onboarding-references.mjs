import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'documentation-source');
const EMPLOYEES = path.join(SOURCE, 'employees');
const OUTPUT = path.join(ROOT, 'lib', 'onboarding-references.generated.js');
const PROGRAMS = path.join(SOURCE, 'lost_limb_riders_handbooks', '03-Program-Manuals');
const VOLUNTEER_APPROVAL = path.join(SOURCE, 'lost_limb_riders_handbooks', 'transactional_operations', '08-VOLUNTEERS', 'VOL-FORM-004-Volunteer-Approval-Record.md');
const PROGRAM_ENROLLMENT = path.join(SOURCE, 'lost_limb_riders_handbooks', '04-Forms-and-Templates', '03-Program-Enrollment-Form.md');

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

const programFiles = (await readdir(PROGRAMS)).filter((name) => /^\d{2}-.+-Program\.md$/.test(name)).sort();
const volunteerAreas = [];
for (const filename of programFiles) {
  const name = filename.replace(/^\d{2}-/, '').replace(/\.md$/, '').replaceAll('-', ' ');
  volunteerAreas.push({ value: name, label: name, source_path: `lost_limb_riders_handbooks/03-Program-Manuals/${filename}` });
}
const approvalText = await readFile(VOLUNTEER_APPROVAL, 'utf8');
const capacityLine = approvalText.split(/\r?\n/).find((line) => line.startsWith('**Approved volunteer capacity / program:**')) || '';
for (const raw of capacityLine.split('☐').slice(1)) {
  const name = raw.trim().replace(/\s+$/, '').replace(/Other:.*/, '').trim();
  if (name && !volunteerAreas.some((item) => item.value === name || item.value === `${name} Program`)) volunteerAreas.push({ value: name, label: name, source_path: 'lost_limb_riders_handbooks/transactional_operations/08-VOLUNTEERS/VOL-FORM-004-Volunteer-Approval-Record.md' });
}
if (!volunteerAreas.length) throw new Error('No canonical volunteer programs/areas were found.');

const enrollmentText = await readFile(PROGRAM_ENROLLMENT, 'utf8');
const memberPrograms = section(enrollmentText, 'PROGRAM INTEREST').split(/\r?\n/)
  .map((line) => line.match(/^☐ (.+?) \(/)?.[1])
  .filter(Boolean)
  .map((name) => ({
    value: name,
    label: name,
    source_path: 'lost_limb_riders_handbooks/04-Forms-and-Templates/03-Program-Enrollment-Form.md',
  }));
if (memberPrograms.length !== 6) throw new Error(`Expected 6 canonical member-applicable programs; found ${memberPrograms.length}.`);

const banner = '// Generated from canonical Autobiography documents. Do not edit by hand.\n';
await writeFile(OUTPUT, `${banner}export const CANONICAL_POSITIONS = Object.freeze(${JSON.stringify(positions, null, 2)});\n\nexport const AUTHORIZED_LOCATIONS = Object.freeze(${JSON.stringify(locations, null, 2)});\n\nexport const CANONICAL_VOLUNTEER_AREAS = Object.freeze(${JSON.stringify(volunteerAreas, null, 2)});\n\nexport const CANONICAL_MEMBER_PROGRAMS = Object.freeze(${JSON.stringify(memberPrograms, null, 2)});\n`);
console.log(`Generated ${positions.length} positions, ${locations.length} authorized location, ${volunteerAreas.length} volunteer areas, and ${memberPrograms.length} member programs.`);

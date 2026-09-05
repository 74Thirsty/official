import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = 'lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md';
const APPROVAL_PATH = 'lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md';
const SOURCE = path.join(ROOT, 'documentation-source', SOURCE_PATH);
const OUTPUT = path.join(ROOT, 'lib', 'compliance-workflows.generated.js');
const ID_RE = /\b[A-Z]{2,5}-[A-Z]+-\d{3}\b/g;

function documentIds(value) {
  const ids = [...(value.match(ID_RE) || [])];
  for (const match of value.matchAll(/\b([A-Z]{2,5}-[A-Z]+-)(\d{3})\/(\d{3})\b/g)) ids.push(`${match[1]}${match[3]}`);
  return [...new Set(ids)];
}

const text = await readFile(SOURCE, 'utf8');
const approvalText = await readFile(path.join(ROOT, 'documentation-source', APPROVAL_PATH), 'utf8');
const sourceId = text.match(/\*\*Document ID:\*\*\s*([^\n]+)/)?.[1]?.trim();
const sourceVersion = text.match(/\*\*Version:\*\*\s*([^\n]+)/)?.[1]?.trim();
if (!sourceId || !sourceVersion) throw new Error('Transaction Map is missing document-control metadata.');

const approvalRules = approvalText.split(/\r?\n/).flatMap((line) => {
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cells.length !== 3 || !cells[0] || /^Action$|^-+$/.test(cells[0])) return [];
  return [{
    id: `FIN-CTRL-001-${createHash('sha256').update(cells.join('|')).digest('hex').slice(0, 10).toUpperCase()}`,
    action: cells[0],
    authority: cells[1],
    condition: cells[2],
    source_document_id: 'FIN-CTRL-001',
    source_path: APPROVAL_PATH,
  }];
});
const approvalTerms = ['employee', 'compensation', 'payroll', 'contract', 'agreement', 'event', 'expense', 'purchase', 'reimbursement', 'grant', 'sponsorship', 'asset', 'disposal'];

const sections = [...text.matchAll(/^## (\d+)\. (.+)$/gm)];
const workflowSections = sections.filter((match) => Number(match[1]) >= 3 && Number(match[1]) <= 12);
const workflows = workflowSections.map((match, index) => {
  const start = match.index + match[0].length;
  const next = sections.find((candidate) => candidate.index > match.index);
  const body = text.slice(start, next?.index || text.length);
  const flow = body.match(/```text\s*\n([\s\S]*?)```/)?.[1];
  if (!flow) throw new Error(`Workflow ${match[2]} has no text flow.`);
  const normalized = flow.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const steps = normalized.split(/\s*→\s*/).map((step) => step.trim()).filter(Boolean);
  const supportingIds = documentIds(body);
  const slug = match[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: slug,
    intent: match[2],
    source_section: `${match[1]}. ${match[2]}`,
    source_document_id: sourceId,
    source_path: SOURCE_PATH,
    source_version: sourceVersion,
    source_hash: createHash('sha256').update(text).digest('hex'),
    supporting_document_ids: supportingIds,
    stages: steps.map((label, stageIndex) => {
      const referencedDocumentIds = documentIds(label);
      const approvalRequired = /\b(?:approval|authorization|authorized)\b/i.test(label);
      const approvalContext = steps.slice(Math.max(0, stageIndex - 1), stageIndex + 2).join(' ').toLowerCase();
      return {
        id: `${slug}-${stageIndex + 1}`,
        sequence: stageIndex + 1,
        label,
        document_ids: referencedDocumentIds,
        evidence_required: true,
        approval_required: approvalRequired,
        approval_rules: approvalRequired ? approvalRules.filter((rule) => approvalTerms.some((term) => approvalContext.includes(term) && rule.action.toLowerCase().includes(term))) : [],
      };
    }),
  };
});

if (workflows.length !== 10) throw new Error(`Expected 10 Transaction Map workflows; found ${workflows.length}.`);
if (workflows.some((workflow) => workflow.stages.length < 3)) throw new Error('Every workflow must contain at least three stages.');

const manifest = {
  schema_version: 1,
  generated_from: sourceId,
  source_path: SOURCE_PATH,
  source_version: sourceVersion,
  source_hash: createHash('sha256').update(text).digest('hex'),
  approval_source: {
    document_id: 'FIN-CTRL-001',
    source_path: APPROVAL_PATH,
    source_hash: createHash('sha256').update(approvalText).digest('hex'),
  },
  workflows,
};

await writeFile(OUTPUT, `// GENERATED FILE. Run npm run generate:compliance; do not edit by hand.\nexport const COMPLIANCE_WORKFLOW_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`, 'utf8');
console.log(`Generated ${workflows.length} compliance workflows from ${sourceId} v${sourceVersion}.`);

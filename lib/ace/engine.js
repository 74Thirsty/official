import { randomBytes } from 'node:crypto';
import { findDocumentByCode } from '../document-registry.js';
import { getWorkflow, getTemplate, workflowSourceRevision } from './catalog.js';

export const STATUS_ORDER = ['cancelled', 'archived', 'completed', 'awaiting_approval', 'active'];

function event(type, actor, details = {}) {
  return { id: randomBytes(8).toString('hex'), at: new Date().toISOString(), type, actor, ...details };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function instanceTemplate(instance, workflow) {
  return instance.templateDefinition || getTemplate(workflow.templateId);
}

function assertMutable(instance) {
  if (instance.status === 'completed') throw new Error('Completed workflows cannot be changed.');
  if (instance.status === 'cancelled') throw new Error('Cancelled workflows cannot be changed.');
  if (instance.status === 'archived') throw new Error('Archived workflows cannot be changed.');
}

function generateId(workflow) {
  if (!workflow) return `ACE-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const prefix = String(workflow.idPrefix || 'ACE').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 6);
  return `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function uniqueInstanceId(workflow, existingIds) {
  let id = generateId(workflow);
  let guard = 0;
  while (existingIds.has(id) && guard < 8) { id = generateId(workflow); guard += 1; }
  return id;
}

export function validateFieldValues(template, sectionId, payload) {
  const section = (template?.sections || []).find((item) => item.id === sectionId);
  if (!section) return { errors: [`Section ${sectionId} is not part of this template.`], values: {} };
  const errors = [];
  const values = {};
  for (const field of section.fields || []) {
    const raw = payload[field.name];
    const value = (typeof raw === 'string' ? raw : raw == null ? '' : String(raw)).trim();
    if (field.type === 'number') {
      const numeric = value === '' ? null : Number(value);
      if (field.required && (value === '' || numeric == null || !Number.isFinite(numeric))) {
        errors.push(`${field.label} is required.`);
        continue;
      }
      if (value !== '' && (numeric == null || !Number.isFinite(numeric))) {
        errors.push(`${field.label} must be a number.`);
        continue;
      }
      values[field.name] = numeric;
      continue;
    }
    if (field.required && value === '') {
      errors.push(`${field.label} is required.`);
      continue;
    }
    if (field.maxlen && value.length > field.maxlen) {
      errors.push(`${field.label} must be ${field.maxlen} characters or fewer.`);
      continue;
    }
    if (field.type === 'select' && value && Array.isArray(field.options) && field.options.length && !field.options.includes(value)) {
      errors.push(`${field.label} has an invalid option.`);
      continue;
    }
    if (value !== '') values[field.name] = value;
  }
  return errors.length ? { errors, values: {} } : { errors: [], values };
}

export function sectionIsSatisfied(instance, workflow, sectionId) {
  const template = instanceTemplate(instance, workflow);
  const section = (template?.sections || []).find((item) => item.id === sectionId);
  if (!section) return false;
  const stored = instance.fieldValues[sectionId] || {};
  for (const field of section.fields || []) {
    if (!field.required) continue;
    const value = stored[field.name];
    if (value == null || String(value).trim() === '') return false;
  }
  return true;
}

export function findDocumentInstance(instance, documentId) {
  return (instance.documents || []).find((document) => document.documentId === documentId);
}

export function documentSignatureApplied(instance, documentId, signatureId) {
  const document = findDocumentInstance(instance, documentId);
  if (!document) return false;
  return (document.signatures || []).some((signature) => signature.signatureId === signatureId);
}

function expandRegisterTemplate(template, instance) {
  return String(template).replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    if (path === 'id') return instance.id;
    if (path.startsWith('creationValues.')) {
      const key = path.slice('creationValues.'.length);
      const value = instance.creationValues && instance.creationValues[key];
      return value == null ? '' : String(value);
    }
    if (path.startsWith('fieldValues.')) {
      const tokens = path.slice('fieldValues.'.length).split('.');
      const sectionId = tokens[0];
      const fieldName = tokens.slice(1).join('.');
      const value = instance.fieldValues?.[sectionId]?.[fieldName];
      return value == null ? '' : String(value);
    }
    return match;
  });
}

export function buildRegisterRows(instance, workflow) {
  const rows = [];
  for (const stage of workflow.lifecycle || []) {
    if (!stage.autoRegister) continue;
    const columns = {};
    for (const header of Object.keys(stage.autoRegister.columns || {})) {
      columns[header] = expandRegisterTemplate(stage.autoRegister.columns[header], instance);
    }
    rows.push({ registerId: stage.autoRegister.register_id, stageId: stage.id, columns, closedAt: null });
  }
  return rows;
}

export function createInstance(workflow, input, actor, existingIds) {
  const template = getTemplate(workflow.templateId);
  if (!template) throw new Error('Controlled template is unavailable for this workflow.');
  const now = new Date().toISOString();
  const validation = validateFieldValues(template, workflow.creationSection, input);
  if (validation.errors.length) throw new Error(validation.errors.join(' '));
  const creationValues = validation.values;
  const titleField = workflow.titleField || {};
  const title = String(creationValues[titleField.fieldName] ?? '');
  if (!title) throw new Error(`${titleField.label || 'Title field'} is required.`);

  const instance = {
    schema: 'ace',
    schemaVersion: 1,
    id: uniqueInstanceId(workflow, existingIds),
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowVersion: workflow.workflowVersion,
    templateId: workflow.templateId,
    category: workflow.category,
    workflowDefinition: clone(workflow),
    templateDefinition: clone(template),
    title,
    status: 'active',
    currentStageIndex: 0,
    creationValues,
    fieldValues: { [workflow.creationSection]: { ...creationValues } },
    documents: [],
    registers: [],
    stageStates: [],
    audit: [event('instance_created', actor, { workflowId: workflow.id, templateId: workflow.templateId })],
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    workflow_source: { ...workflowSourceRevision(), sources: workflow.source || [] },
    legacy: Boolean(workflow.legacy),
  };
  instance.registers = buildRegisterRows(instance, workflow);

  for (const stage of workflow.lifecycle) {
    if (stage.satisfiedByIntake) {
      instance.stageStates.push({
        stageId: stage.id,
        status: 'complete',
        evidence: [{
          id: randomBytes(8).toString('hex'),
          at: now,
          actor,
          description: `${stage.evidenceLabel || 'Entered when the workflow was created.'}`,
          url: '',
          kind: 'intake',
          via: creationValues,
        }],
        approval: null,
      });
    } else {
      instance.stageStates.push({ stageId: stage.id, status: 'incomplete', evidence: [], approval: null });
    }
  }

  let index = 0;
  while (index < workflow.lifecycle.length && workflow.lifecycle[index].satisfiedByIntake) index += 1;
  instance.currentStageIndex = index;
  return instance;
}

export function saveFieldValues(instance, workflow, sectionId, payload, actor) {
  assertMutable(instance);
  const template = instanceTemplate(instance, workflow);
  const section = (template?.sections || []).some((item) => item.id === sectionId);
  if (!section) throw new Error(`Section ${sectionId} is not part of this template.`);
  const validation = validateFieldValues(template, sectionId, payload);
  if (validation.errors.length) throw new Error(validation.errors.join(' '));
  instance.fieldValues[sectionId] = { ...(instance.fieldValues[sectionId] || {}), ...validation.values };
  instance.updatedAt = new Date().toISOString();
  instance.audit.unshift(event('section_saved', actor, { sectionId }));
  return instance;
}

export function addEvidence(instance, workflow, actor, description, url = '') {
  assertMutable(instance);
  if (!String(description || '').trim().length) throw new Error('Evidence description is required.');
  const index = instance.currentStageIndex;
  const stage = workflow.lifecycle[index];
  if (!stage) throw new Error('No active stage to record evidence for.');
  if (stage.satisfiedByIntake) throw new Error('This stage is satisfied by the information entered when the workflow was created.');
  const state = instance.stageStates[index];
  const record = { id: randomBytes(8).toString('hex'), at: new Date().toISOString(), actor, description, url, kind: 'operator' };
  state.evidence.push(record);
  state.status = stage.approvalRequired ? 'awaiting_approval' : state.status;
  if (!instance.status || instance.status === 'active') {
    instance.status = stage.approvalRequired ? 'awaiting_approval' : 'active';
  }
  instance.updatedAt = record.at;
  instance.audit.unshift(event('evidence_added', actor, { stageId: stage.id, evidenceId: record.id }));
  return instance;
}

export function approveStage(instance, workflow, actor, approvalRuleId = '') {
  if (instance.status !== 'awaiting_approval' && instance.status !== 'active') throw new Error('Workflow is not awaiting approval.');
  const index = instance.currentStageIndex;
  const stage = workflow.lifecycle[index];
  const state = instance.stageStates[index];
  if (!stage || !stage.approvalRequired) throw new Error('The current stage does not require approval.');
  if (!state.evidence.length) throw new Error('Evidence is required before approval.');
  if (state.evidence.some((item) => item.actor === actor)) throw new Error('The evidence submitter cannot approve the same stage.');
  const rule = (stage.approvalRules || []).find((item) => item.id === approvalRuleId);
  if (stage.approvalRules && stage.approvalRules.length && !rule) throw new Error('Applicable canonical approval authority is required.');
  state.approval = {
    at: new Date().toISOString(),
    actor,
    ruleId: rule ? rule.id : null,
    authority: rule ? rule.authority : 'Approval authority documented in the referenced control record',
    condition: rule ? rule.condition : '',
    source_document_id: rule ? rule.source_document_id : (stage.source?.id || workflow.source[0]?.id || 'ADM-REF-002'),
  };
  state.status = 'complete';
  instance.status = 'active';
  instance.updatedAt = state.approval.at;
  instance.audit.unshift(event('stage_approved', actor, { stageId: stage.id }));
  return instance;
}

export function stageSatisfied(instance, workflow, index) {
  const stage = workflow.lifecycle[index];
  const state = instance.stageStates[index];
  if (!stage || !state) return { ok: false, errors: ['Stage not found.'] };
  if (stage.satisfiedByIntake) return state.status === 'complete' ? { ok: true } : { ok: false, errors: ['Stage not complete.'] };
  const errors = [];
  for (const sectionId of stage.sectionsRequired || []) {
    if (!sectionIsSatisfied(instance, workflow, sectionId)) errors.push(`Complete the required ${sectionId} section before advancing.`);
  }
  for (const required of stage.documentsRequired || []) {
    const document = findDocumentInstance(instance, required.documentId);
    if (!document || (document.status !== 'finalized' && document.status !== 'completed')) errors.push(`Finalize ${required.documentId} before advancing.`);
  }
  for (const signature of stage.signaturesRequired || []) {
    if (!documentSignatureApplied(instance, signature.documentId, signature.signatureId)) errors.push(`Signature ${signature.signatureId} is missing on ${signature.documentId}.`);
  }
  if (stage.evidenceRequired && !state.evidence.length) errors.push('Evidence is required for this stage.');
  if (stage.approvalRequired && !state.approval) errors.push('Approval is required for this stage.');
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function advanceStage(instance, workflow, actor) {
  if (instance.status === 'completed') throw new Error('Workflow is already complete.');
  if (instance.status === 'cancelled') throw new Error('Cancelled workflows cannot be advanced.');
  const index = instance.currentStageIndex;
  const stage = workflow.lifecycle[index];
  if (!stage) throw new Error('No active stage.');
  const check = stageSatisfied(instance, workflow, index);
  if (!check.ok) throw new Error(check.errors.join(' '));

  for (const required of stage.documentsRequired || []) {
    const document = findDocumentInstance(instance, required.documentId);
    if (document && document.status === 'finalized') {
      document.status = 'completed';
      document.completedAt = new Date().toISOString();
    }
  }
  for (const register of instance.registers || []) {
    if (register.closedAt) continue;
    if (register.stageId === stage.id) {
      for (const header of Object.keys(register.columns)) {
        if (String(register.columns[header]).toLowerCase() === 'open') {
          register.columns[header] = stage.autoRegisterClose?.status || 'Closed';
        }
      }
      register.closedAt = new Date().toISOString();
    }
  }

  const now = new Date().toISOString();
  if (index === workflow.lifecycle.length - 1) {
    instance.stageStates[index].status = 'complete';
    instance.status = 'completed';
    instance.completedAt = now;
    instance.updatedAt = now;
    instance.audit.unshift(event('instance_completed', actor, { completedStage: stage.id }));
    return instance;
  }

  let next = index + 1;
  instance.stageStates[index].status = 'complete';
  while (next < workflow.lifecycle.length && workflow.lifecycle[next].satisfiedByIntake) {
    instance.stageStates[next].status = 'complete';
    next += 1;
  }
  instance.currentStageIndex = next;
  instance.status = 'active';
  instance.updatedAt = now;
  instance.audit.unshift(event('stage_advanced', actor, { fromStage: stage.id, toStage: workflow.lifecycle[next]?.id || null }));
  return instance;
}

export function createDocumentInstance(instance, workflow, documentId, actor) {
  assertMutable(instance);
  const allowed = new Set([
    ...(workflow.workingDocuments || []),
    ...(workflow.lifecycle || []).flatMap((stage) => (stage.documentsRequired || []).map((entry) => entry.documentId)),
    ...(workflow.lifecycle || []).flatMap((stage) => (stage.signaturesRequired || []).map((signature) => signature.documentId)),
  ]);
  if (!allowed.has(documentId)) throw new Error(`${documentId} is not a working document for this workflow.`);
  if (findDocumentInstance(instance, documentId)) throw new Error(`${documentId} is already on this workflow.`);
  const template = instanceTemplate(instance, workflow);
  const registered = (template?.documents || []).find((document) => document.id === documentId)?.signatureDefinitions || [];
  const resolved = findDocumentByCode(documentId);
  instance.documents.push({
    id: randomBytes(6).toString('hex'),
    documentId,
    title: resolved ? resolved.title : documentId,
    role: 'working',
    status: 'open',
    signatureIds: Array.from(new Set((workflow.lifecycle || []).flatMap((stage) => (stage.signaturesRequired || []).filter((s) => s.documentId === documentId).map((s) => s.signatureId)).concat(registered.map((s) => s.signatureId || s.id)))),
    fieldValues: {},
    signatures: [],
    notes: '',
    createdBy: actor,
    createdAt: instance.updatedAt,
    updatedAt: instance.updatedAt,
    finalizedBy: null,
    finalizedAt: null,
    completedAt: null,
  });
  instance.audit.unshift(event('document_created', actor, { documentId }));
  return instance;
}

export function saveDocumentFieldValues(instance, documentInstanceId, payload, actor) {
  assertMutable(instance);
  const document = (instance.documents || []).find((item) => item.id === documentInstanceId);
  if (!document) throw new Error('Document not found.');
  if (document.status === 'finalized' || document.status === 'completed') throw new Error('Finalized documents cannot be edited.');
  const values = {};
  for (const key of Object.keys(payload || {})) {
    if (typeof payload[key] === 'object' && payload[key] !== null) continue;
    values[key] = String(payload[key]).slice(0, 5000);
  }
  document.fieldValues = { ...document.fieldValues, ...values };
  document.status = 'saved';
  document.updatedAt = new Date().toISOString();
  document.updatedBy = actor;
  instance.updatedAt = document.updatedAt;
  instance.audit.unshift(event('document_saved', actor, { documentId: document.documentId }));
  return instance;
}

export function applySignature(instance, documentInstanceId, signatureId, actor, name = '') {
  assertMutable(instance);
  const document = (instance.documents || []).find((item) => item.id === documentInstanceId);
  if (!document) throw new Error('Document not found.');
  if (!document.signatureIds.includes(signatureId)) throw new Error(`Signature ${signatureId} is not required on ${document.documentId}.`);
  if (document.signatures.some((signature) => signature.signatureId === signatureId && signature.actor === actor)) throw new Error('This person has already signed this signature line.');
  document.signatures.push({
    signatureId,
    label: (document.signatureIds.find((item) => item === signatureId) ? signatureId : signatureId),
    actor,
    name: String(name || actor).slice(0, 120),
    at: new Date().toISOString(),
  });
  document.updatedAt = new Date().toISOString();
  instance.updatedAt = document.updatedAt;
  instance.audit.unshift(event('document_signed', actor, { documentId: document.documentId, signatureId }));
  return instance;
}

export function finalizeDocument(instance, documentInstanceId, actor) {
  assertMutable(instance);
  const document = (instance.documents || []).find((item) => item.id === documentInstanceId);
  if (!document) throw new Error('Document not found.');
  if (document.status === 'finalized' || document.status === 'completed') throw new Error('Document is already finalized.');
  const missing = document.signatureIds.filter((signatureId) => !document.signatures.some((signature) => signature.signatureId === signatureId));
  if (missing.length) throw new Error(`Document cannot be finalized until signed: ${missing.join(', ')}.`);
  document.status = 'finalized';
  document.finalizedBy = actor;
  document.finalizedAt = new Date().toISOString();
  instance.updatedAt = document.finalizedAt;
  instance.audit.unshift(event('document_finalized', actor, { documentId: document.documentId }));
  return instance;
}

export function cancelInstance(instance, workflow, actor, reason = '') {
  if (instance.status === 'completed') throw new Error('Completed workflows cannot be cancelled.');
  instance.status = 'cancelled';
  instance.cancelReason = String(reason).slice(0, 500);
  instance.updatedAt = new Date().toISOString();
  instance.audit.unshift(event('instance_cancelled', actor, { reason: instance.cancelReason }));
  return instance;
}

export function isAceInstance(instance) {
  return instance && instance.schema === 'ace';
}

export function summarizeInstance(instance, workflow, template) {
  const stageStates = instance.stageStates || [];
  const completed = stageStates.filter((stage) => stage.status === 'complete').length;
  return {
    schema: instance.schema,
    id: instance.id,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    workflowVersion: instance.workflowVersion,
    templateId: instance.templateId,
    title: instance.title,
    status: instance.status,
    currentStageIndex: instance.currentStageIndex,
    currentStage: workflow.lifecycle?.[instance.currentStageIndex] ? publicStagePayload(workflow.lifecycle[instance.currentStageIndex]) : null,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
    completedAt: instance.completedAt,
    createdBy: instance.createdBy,
    legacy: Boolean(instance.legacy),
    workflow: publicWorkflowPayload(workflow),
    progress: { completed, total: stageStates.length },
  };
}

function publicStagePayload(stage) {
  return {
    id: stage.id,
    label: stage.label,
    role: stage.role,
    purpose: stage.purpose,
    source: stage.source || null,
    sectionsRequired: stage.sectionsRequired || [],
    documentsRequired: stage.documentsRequired || [],
    signaturesRequired: stage.signaturesRequired || [],
    evidenceRequired: Boolean(stage.evidenceRequired),
    evidenceLabel: stage.evidenceLabel || '',
    approvalRequired: Boolean(stage.approvalRequired),
    approvalRules: stage.approvalRules || [],
    referenceDocuments: stage.referenceDocuments || [],
    satisfiedByIntake: Boolean(stage.satisfiedByIntake),
  };
}

function publicWorkflowPayload(workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    category: workflow.category,
    categoryGroup: workflow.categoryGroup,
    idPrefix: workflow.idPrefix,
    workflowVersion: workflow.workflowVersion,
    legacy: Boolean(workflow.legacy),
    summary: workflow.summary,
    creationSection: workflow.creationSection,
    titleField: workflow.titleField,
    activeSections: workflow.activeSections,
    lifecycle: (workflow.lifecycle || []).map(publicStagePayload),
  };
}

export function detailInstance(instance, workflow, template) {
  return {
    ...summarizeInstance(instance, workflow, template),
    creationValues: instance.creationValues,
    fieldValues: instance.fieldValues,
    stageStates: instance.stageStates || [],
    documents: instance.documents || [],
    registers: instance.registers || [],
    audit: instance.audit || [],
    workflow_source: instance.workflow_source,
    cancelReason: instance.cancelReason || null,
    template: publicTemplatePayload(template),
  };
}

function publicTemplatePayload(template) {
  return template
    ? {
        id: template.id,
        name: template.name,
        controlled: template.controlled !== false && template.legacyGenerated !== true,
        legacyGenerated: Boolean(template.legacyGenerated),
        sections: (template.sections || []).map((section) => ({
          id: section.id,
          name: section.name || section.title || section.id,
          role: section.role || '',
          sectionFile: section.sectionFile || null,
          help: section.help || '',
          fields: (section.fields || []).map((field) => ({ ...field })),
        })),
        documents: (template.documents || []).map((document) => ({
          id: document.id,
          title: document.title,
          note: document.note || '',
          signatureDefinitions: (document.signatureDefinitions || []).map((signature) => ({ ...signature })),
        })),
      }
    : null;
}

export function buildInstanceExport(instance, workflow, template, format = 'json') {
  const detail = JSON.parse(JSON.stringify(detailInstance(instance, workflow, template)));
  if (format === 'json' || format === 'export') {
    return { detail };
  }
  if (format === 'html') {
    return { html: buildHtmlExport(detail, workflow) };
  }
  if (format === 'csv') {
    return { csv: buildCsvRows(detail) };
  }
  throw new Error('Unsupported export format.');
}

function buildHtmlExport(detail, workflow) {
  const stageRows = (detail.stageStates || []).map((state, index) => {
    const stage = workflow.lifecycle[index];
    const evidence = (state.evidence || []).map((entry) => `<li>${escapeHtml(entry.description)}${entry.url ? ` (<a href="${escapeHtml(entry.url)}">link</a>)` : ''} — ${escapeHtml(entry.actor)}, ${new Date(entry.at).toISOString()}</li>`).join('');
    const approval = state.approval ? `<p><strong>Approved by:</strong> ${escapeHtml(state.approval.actor)} — ${escapeHtml(state.approval.authority)} (${new Date(state.approval.at).toISOString()})</p>` : '';
    return `<tr><td>${index + 1}</td><td>${escapeHtml(stage?.label || state.stageId)}</td><td>${escapeHtml(state.status)}</td><td><ul>${evidence}</ul>${approval}</td></tr>`;
  }).join('');
  const documentRows = (detail.documents || []).map((document) => {
    const signatures = (document.signatures || []).map((signature) => `${escapeHtml(signature.name)} (${escapeHtml(signature.signatureId)}) — ${new Date(signature.at).toISOString()}`).join('; ');
    return `<tr><td>${escapeHtml(document.documentId)}</td><td>${escapeHtml(document.status)}</td><td>${escapeHtml(signatures)}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(detail.title)} — Compliance Record</title></head><body><h1>${escapeHtml(detail.title)}</h1><p><strong>Instance:</strong> ${escapeHtml(detail.id)} · <strong>Workflow:</strong> ${escapeHtml(detail.workflowName)} · <strong>Status:</strong> ${escapeHtml(detail.status)}</p><h2>Field values</h2><pre>${escapeHtml(JSON.stringify(detail.fieldValues, null, 2))}</pre><h2>Stages</h2><table border="1" cellpadding="6"><tr><th>#</th><th>Stage</th><th>Status</th><th>Evidence / Approval</th></tr>${stageRows}</table><h2>Documents</h2><table border="1" cellpadding="6"><tr><th>Document</th><th>Status</th><th>Signatures</th></tr>${documentRows}</table></body></html>`;
}

function buildCsvRows(detail) {
  const rows = [['instance_id', 'workflow', 'title', 'status', 'stage', 'evidence', 'approval']];
  (detail.stageStates || []).forEach((state, index) => {
    rows.push([
      detail.id,
      detail.workflowName,
      detail.title,
      state.status,
      detail.workflow.lifecycle[index]?.label || state.stageId,
      (state.evidence || []).map((entry) => entry.description).join(' | '),
      state.approval ? `${state.approval.actor} (${state.approval.authority})` : '',
    ]);
  });
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

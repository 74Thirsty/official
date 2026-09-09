import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { COMPLIANCE_WORKFLOW_MANIFEST } from '../lib/compliance-workflows.generated.js';
import {
  WORKFLOWS,
  TEMPLATES,
  WORKFLOW_PROVENANCE,
  getWorkflow,
  getTemplate,
  publicWorkflow,
  publicTemplate,
  resolveCategoryGroups,
  validateFieldValues,
  createInstance,
  saveFieldValues,
  addEvidence,
  approveStage,
  advanceStage,
  createDocumentInstance,
  saveDocumentFieldValues,
  applySignature,
  finalizeDocument,
  cancelInstance,
  stageSatisfied,
  sectionIsSatisfied,
  findDocumentInstance,
  documentSignatureApplied,
} from '../lib/compliance-engine.js';

const REFERENCE_WORKFLOW_COUNT = 6;
const LEGACY_WORKFLOW_COUNT = 24;

function startWorkflow(workflowId, values) {
  const workflow = getWorkflow(workflowId);
  assert.ok(workflow, `workflow ${workflowId}`);
  const instance = createInstance(workflow, values, 'operator', new Set());
  return { workflow, instance };
}

function fillSection(instance, workflow, sectionId, actor = 'operator') {
  const template = getTemplate(workflow.templateId);
  const section = template.sections.find((item) => item.id === sectionId);
  const values = {};
  for (const field of section.fields || []) {
    if (field.type === 'select') {
      const verified = field.options.find((option) => (typeof option === 'object' ? option.value : option) === 'Verified');
      const option = verified || field.options[0];
      values[field.name] = typeof option === 'object' ? option.value : option;
    }
    else if (field.type === 'number') values[field.name] = '1';
    else if (field.type === 'date') values[field.name] = '2026-09-05';
    else if (field.type === 'time') values[field.name] = '12:00';
    else values[field.name] = 'Test value';
  }
  return saveFieldValues(instance, workflow, sectionId, values, actor);
}

function fillDocument(instance, document, actor = 'operator') {
  const definition = instance.templateDefinition.documents.find((item) => item.id === document.documentId);
  const values = {};
  for (const field of definition.fields || []) {
    if (field.type === 'select') values[field.name] = field.options[0];
    else if (field.type === 'number') values[field.name] = '1';
    else if (field.type === 'date') values[field.name] = '2026-09-05';
    else if (field.type === 'time') values[field.name] = '12:00';
    else values[field.name] = 'Test value';
  }
  return saveDocumentFieldValues(instance, document.id, values, actor);
}

function completeWorkflow(workflowId, creationValues, options = {}) {
  const workflow = getWorkflow(workflowId);
  let instance;
  try {
    instance = createInstance(workflow, creationValues, 'operator', new Set());
  } catch (error) {
    throw new Error(`${workflowId}: ${error.message}`);
  }
  let guard = 0;
  while (instance.status !== 'completed' && guard < 200) {
    guard += 1;
    const index = instance.currentStageIndex;
    const stage = workflow.lifecycle[index];
    for (const sectionId of stage.sectionsRequired || []) {
      instance = fillSection(instance, workflow, sectionId);
    }
    for (const required of stage.documentsRequired || []) {
      if (!findDocumentInstance(instance, required.documentId)) {
        instance = createDocumentInstance(instance, workflow, required.documentId, 'operator');
      }
      const document = findDocumentInstance(instance, required.documentId);
      if (document.status !== 'finalized') {
        instance = fillDocument(instance, document);
        for (const signatureId of document.signatureIds) {
          const actor = `signer-${signatureId}`;
          instance = applySignature(instance, document.id, signatureId, actor, actor);
        }
        instance = finalizeDocument(instance, document.id, 'operator');
      }
    }
    if ((stage.evidenceRequired || stage.approvalRequired) && !instance.stageStates[index].evidence.length) {
      instance = addEvidence(instance, workflow, 'operator', `Evidence for ${stage.label}`, '');
    }
    if (stage.approvalRequired && !instance.stageStates[index].approval) {
      instance = approveStage(instance, workflow, options.approver || 'admin', options.approvalRuleId || (stage.approvalRules?.[0]?.id || ''));
    }
    const check = stageSatisfied(instance, workflow, index);
    assert.ok(check.ok, `${stage.id} gating failures: ${(check.errors || []).join('; ')}`);
    instance = advanceStage(instance, workflow, 'operator');
  }
  return instance;
}

test('catalog exposes reference and adapted legacy workflows with unique predefined definitions', () => {
  assert.equal(WORKFLOWS.length, REFERENCE_WORKFLOW_COUNT + LEGACY_WORKFLOW_COUNT);
  assert.equal(new Set(WORKFLOWS.map((workflow) => workflow.id)).size, WORKFLOWS.length);
  for (const workflow of WORKFLOWS) {
    assert.ok(workflow.id && workflow.name && workflow.idPrefix && workflow.summary);
    assert.ok(workflow.templateId && TEMPLATES[workflow.templateId]);
    assert.ok(workflow.titleField?.sectionId && workflow.titleField?.fieldName && workflow.titleField?.label);
    assert.ok(Array.isArray(workflow.lifecycle) && workflow.lifecycle.length);
    const template = TEMPLATES[workflow.templateId];
    for (const sectionId of workflow.activeSections || []) {
      assert.ok(template.sections.some((section) => section.id === sectionId), `${workflow.id} references unknown section ${sectionId}`);
    }
  }
  assert.equal(getWorkflow('pursue-grant').name, 'Pursue Grant');
  assert.equal(getWorkflow('onboard-volunteer').name, 'Onboard a Volunteer');
});

test('the six reference workflows are implemented to prove the engine', () => {
  const ids = new Set(['pursue-grant', 'onboard-member', 'onboard-volunteer', 'onboard-employee', 'host-event', 'safety-training']);
  const found = WORKFLOWS.filter((workflow) => ids.has(workflow.id));
  assert.equal(found.length, REFERENCE_WORKFLOW_COUNT);
  for (const workflow of found) assert.equal(workflow.legacy, false);
});

test('member, volunteer, and employee workflows use distinct relationship-specific schemas', () => {
  const shared = ['onboard-member', 'onboard-volunteer', 'onboard-employee']
    .map((id) => getWorkflow(id).templateId);
  assert.deepEqual(shared, ['MEMBER_ONBOARDING_TEMPLATE', 'VOLUNTEER_ONBOARDING_TEMPLATE', 'EMPLOYEE_ONBOARDING_TEMPLATE']);
  assert.deepEqual(getWorkflow('onboard-member').activeSections, ['A', 'B', 'C', 'F', 'I']);
  assert.deepEqual(getWorkflow('onboard-volunteer').activeSections, ['A', 'B', 'D', 'F', 'G', 'I']);
  assert.deepEqual(getWorkflow('onboard-employee').activeSections, ['A', 'B', 'E', 'F', 'G', 'H', 'I']);
  for (const workflow of ['onboard-member', 'onboard-volunteer', 'onboard-employee'].map((id) => getWorkflow(id))) {
    const template = getTemplate(workflow.templateId);
    assert.ok(workflow.lifecycle.every((stage) => (stage.sectionsRequired || []).every((sectionId) => template.sections.some((section) => section.id === sectionId))));
  }
});

test('employee onboarding derives immutable relationship and canonical position metadata without restricted PII fields', () => {
  const workflow = getWorkflow('onboard-employee');
  const template = getTemplate(workflow.templateId);
  const relationship = template.sections.find((section) => section.id === 'B');
  const employee = template.sections.find((section) => section.id === 'E');
  const restricted = template.sections.find((section) => section.id === 'H');
  assert.equal(relationship.fields.find((field) => field.name === 'relationship_type').derivedValue, 'Employee');
  assert.equal(relationship.fields.some((field) => field.name === 'program_area' || field.name === 'supervisor'), false);
  assert.equal(relationship.fields.find((field) => field.name === 'chapter_location').options.length, 1);
  assert.equal(employee.fields.find((field) => field.name === 'position_id').options.length, 42);
  assert.equal(employee.fields.some((field) => field.name === 'position_title'), false);
  assert.ok(restricted.fields.some((field) => field.name === 'w4_status'));
  assert.ok(restricted.fields.some((field) => field.name === 'i9_document_path'));
  assert.equal(restricted.fields.some((field) => /^(ssn|date_of_birth|w4|i9_contents)$/i.test(field.name)), false);
  const instance = createInstance(workflow, { full_name: 'Employee Test', email: 'employee@example.org', relationship_type: 'Volunteer' }, 'operator', new Set());
  assert.equal(instance.fieldValues.B.relationship_type, 'Employee');
  saveFieldValues(instance, workflow, 'E', { position_id: '07-Executive-Director', proposed_compensation: '50000', hiring_authority: 'Board' }, 'operator');
  assert.equal(instance.fieldValues.E.position_title, 'Executive Director');
  assert.match(instance.fieldValues.E.position_source_path, /^employees\/07-Executive-Director\.md$/);
  assert.match(instance.fieldValues.E.position_source_hash, /^[a-f0-9]{64}$/);
  saveFieldValues(instance, workflow, 'B', { relationship_type: 'Volunteer', chapter_location: 'fort-dodge-iowa', start_date: '2026-09-08' }, 'operator');
  assert.equal(instance.fieldValues.B.relationship_type, 'Employee');
  assert.throws(() => saveFieldValues(instance, workflow, 'H', { date_of_birth: '2000-01-01', ssn: '123-45-6789' }, 'operator'), /restricted information/);
  assert.equal(JSON.stringify(instance).includes('123-45-6789'), false);
  assert.equal(JSON.stringify(instance).includes('2000-01-01'), false);
  assert.equal(Object.hasOwn(instance.fieldValues.H || {}, 'ssn'), false);
  assert.equal(Object.hasOwn(instance.fieldValues.H || {}, 'date_of_birth'), false);
  saveFieldValues(instance, workflow, 'H', { date_of_birth_status: 'Pending', ssn_status: 'Pending', w4_status: 'Pending', i9_status: 'Pending', i9_document_path: 'List A', i9_identity_document_status: 'Pending', i9_employment_authorization_status: 'Pending', payroll_information_status: 'Pending', restricted_record_reference: 'HR-CASE-TEST' }, 'operator');
  const pending = stageSatisfied(instance, workflow, workflow.lifecycle.findIndex((stage) => stage.id === 'onboarding-payroll'));
  assert.equal(pending.ok, false);
  assert.ok(pending.errors.some((error) => /SSN must be recorded/.test(error)));
});

test('member and volunteer onboarding retain program assignment and exclude employee-only sections', () => {
  for (const id of ['onboard-member', 'onboard-volunteer']) {
    const template = getTemplate(getWorkflow(id).templateId);
    assert.ok(template.sections.some((section) => section.fields.some((field) => field.name === 'program_area' && field.type === 'select')));
    assert.equal(template.sections.some((section) => section.id === 'E' || section.id === 'H'), false);
  }
});

test('member onboarding is independently defined, canonically constrained, and data-minimized', () => {
  const workflow = getWorkflow('onboard-member');
  const template = getTemplate(workflow.templateId);
  const fields = template.sections.flatMap((section) => section.fields);
  const names = new Set(fields.map((field) => field.name));
  const relationship = template.sections.find((section) => section.id === 'B');
  const enrollment = template.sections.find((section) => section.id === 'C');
  assert.equal(relationship.fields.find((field) => field.name === 'relationship_type').derivedValue, 'Member');
  assert.equal(relationship.fields.find((field) => field.name === 'chapter_location').options.length, 1);
  assert.equal(enrollment.fields.find((field) => field.name === 'program_area').options.length, 6);
  for (const excluded of ['position_id', 'position_description', 'proposed_compensation', 'hiring_authority', 'ssn_status', 'w4_status', 'i9_status', 'payroll_information_status', 'assignment_title', 'responsible_supervisor', 'screening_status', 'volunteer_approval_status']) {
    assert.equal(names.has(excluded), false, excluded);
  }
  for (const unnecessary of ['date_of_birth', 'diagnosis', 'medical_history', 'medications', 'government_id', 'driver_license']) assert.equal(names.has(unnecessary), false, unnecessary);
  assert.notDeepEqual(template.sections.map((section) => section.fields.map((field) => field.name)), getTemplate(getWorkflow('onboard-volunteer').templateId).sections.map((section) => section.fields.map((field) => field.name)));
  const instance = createInstance(workflow, {
    full_name: 'Member Test', email: 'member@example.org', phone: '555', preferred_contact_method: 'Email',
    program_enrollment_record_reference: 'MEMBER-FILE-1', date_of_birth_record_status: 'Verified', minor_status: 'No', relationship_type: 'Employee',
  }, 'operator', new Set());
  assert.equal(instance.fieldValues.B.relationship_type, 'Member');
  saveFieldValues(instance, workflow, 'B', { relationship_type: 'Volunteer', chapter_location: 'fort-dodge-iowa', start_date: '2026-09-08' }, 'operator');
  assert.equal(instance.fieldValues.B.relationship_type, 'Member');
  assert.throws(() => saveFieldValues(instance, workflow, 'B', { chapter_location: 'invented-chapter', start_date: '2026-09-08' }, 'operator'), /invalid option/);
});

test('member onboarding enforces guardian, program-specific, and activation gates', () => {
  const workflow = getWorkflow('onboard-member');
  const instance = createInstance(workflow, {
    full_name: 'Minor Member', email: 'minor@example.org', phone: '555', preferred_contact_method: 'Email',
    program_enrollment_record_reference: 'MEMBER-FILE-2', date_of_birth_record_status: 'Verified', minor_status: 'Yes', guardian_name_reference: 'GUARDIAN-2', guardian_consent_status: 'Pending',
  }, 'operator', new Set());
  let check = stageSatisfied(instance, workflow, 0);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /guardian consent/.test(error)));
  saveFieldValues(instance, workflow, 'A', { ...instance.fieldValues.A, guardian_consent_status: 'Verified' }, 'operator');
  saveFieldValues(instance, workflow, 'B', { chapter_location: 'fort-dodge-iowa', start_date: '2026-09-08' }, 'operator');
  saveFieldValues(instance, workflow, 'C', {
    participant_population: 'Amputee or limb-different individual', eligibility_review_status: 'Verified', program_area: 'Ride Forward Program',
    program_enrollment_status: 'Approved', accessibility_request_status: 'None requested', emergency_contact_status: 'Verified', participant_safety_record_status: 'Verified', ride_forward_safety_status: 'Pending',
  }, 'operator');
  check = stageSatisfied(instance, workflow, 1);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /Ride Forward/.test(error)));
  saveFieldValues(instance, workflow, 'I', { membership_review_status: 'Declined', reviewed_by: 'Membership Coordinator', approval_reference: 'APP-2', approved_date: '2026-09-08', member_id: 'MBR-2026-002' }, 'operator');
  check = stageSatisfied(instance, workflow, 3);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /approved before activation/.test(error)));
});

test('every unconditional member onboarding field is server-required', () => {
  const workflow = getWorkflow('onboard-member');
  const template = getTemplate(workflow.templateId);
  for (const section of template.sections) {
    const payload = {};
    for (const field of section.fields) {
      if (field.type === 'derived' || field.type === 'derived-reference' || field.when) continue;
      if (field.type === 'select') payload[field.name] = typeof field.options[0] === 'object' ? field.options[0].value : field.options[0];
      else if (field.type === 'date') payload[field.name] = '2026-09-08';
      else payload[field.name] = 'Test value';
    }
    for (const field of section.fields.filter((item) => item.required && !item.when && item.type !== 'derived' && item.type !== 'derived-reference')) {
      const missing = { ...payload };
      delete missing[field.name];
      const result = validateFieldValues(template, section.id, missing);
      assert.ok(result.errors.some((error) => error.includes(`${field.label} is required`)), `${section.id}/${field.name}`);
    }
  }
});

test('legacy workflows are adapted into ACE definitions while only true duplicates are excluded', () => {
  const legacy = WORKFLOWS.filter((workflow) => workflow.legacy);
  assert.equal(legacy.length, LEGACY_WORKFLOW_COUNT);
  assert.equal(getWorkflow('report-incident').legacy, true);
  assert.ok(getWorkflow('hire-employee'));
  assert.equal(getWorkflow('administer-grant').category, 'grants');
  const incident = legacy.find((workflow) => workflow.id === 'report-incident');
  assert.ok(incident.lifecycle[0].satisfiedByIntake);
  const approval = legacy.find((workflow) => workflow.id === 'execute-sponsorship');
  assert.ok(approval.lifecycle.some((stage) => stage.approvalRequired));
});

test('workflow categories form the hierarchical catalog', () => {
  const categories = resolveCategoryGroups();
  assert.deepEqual(Object.keys(categories).sort(), ['assets', 'events', 'finance', 'grants', 'onboarding', 'people', 'safety']);
  assert.ok(categories.grants.workflows.some((workflow) => workflow.id === 'pursue-grant'));
  assert.ok(categories.onboarding.workflows.some((workflow) => workflow.id === 'onboard-volunteer'));
  assert.equal(categories.people.parent, 'People Operations');
  assert.equal(categories.finance.parent, 'Financial Stewardship');
  assert.equal(categories.events.parent, 'Programs & Service');
  assert.equal(categories.assets.parent, 'Organizational Operations');
  const allIds = Object.values(categories).flatMap((category) => category.workflows.map((workflow) => workflow.id));
  assert.equal(new Set(allIds).size, WORKFLOWS.length);
});

test('every workflow exposes a self-guided, source-traceable operational specification', () => {
  assert.ok(WORKFLOWS.length >= 29);
  for (const workflow of WORKFLOWS) {
    assert.ok(workflow.purpose, `${workflow.id}: purpose`);
    for (const property of ['whenToUse', 'whenNotToUse', 'prerequisites', 'beforeYouBegin', 'outputs', 'exceptions', 'followUp', 'completionCriteria']) {
      assert.ok(Array.isArray(workflow[property]) && workflow[property].length, `${workflow.id}: ${property}`);
    }
    assert.ok(workflow.retention, `${workflow.id}: retention`);
    assert.ok(workflow.source.length, `${workflow.id}: canonical source`);
    for (const stage of workflow.lifecycle) {
      assert.ok(stage.label && stage.instructions && stage.purpose && stage.role, `${workflow.id}/${stage.id}: guided stage`);
      assert.ok(stage.source?.id, `${workflow.id}/${stage.id}: source`);
    }
  }
});

test('the five reference-quality workflows have action-specific data and conditional requirements', () => {
  const expectedFields = {
    'hire-employee': ['candidate_contact', 'employment_classification', 'proposed_compensation', 'funding_confirmed'],
    'request-reimbursement': ['expense_category', 'vendor', 'allocation_reference', 'grant_funded', 'restricted_fund_reference'],
    'report-incident': ['medical_response_required', 'medical_response_details', 'law_enforcement_contacted', 'law_enforcement_details'],
    'pursue-grant': ['eligible', 'match_required', 'match_requirement', 'award_status', 'award_restrictions'],
    'onboard-volunteer': ['assignment_title', 'authorized_duties', 'screening_status', 'participant_transport', 'volunteer_agreement_status', 'role_training_status'],
  };
  for (const [workflowId, names] of Object.entries(expectedFields)) {
    const workflow = getWorkflow(workflowId);
    assert.ok(workflow, `${workflowId} must be independently selectable`);
    const template = getTemplate(workflow.templateId);
    const actual = new Set(template.sections.flatMap((section) => section.fields.map((field) => field.name)));
    names.forEach((name) => assert.ok(actual.has(name), `${workflowId}: ${name}`));
  }
});

test('conditional fields are required only when their workflow-specific condition applies', () => {
  const workflow = getWorkflow('request-reimbursement');
  const template = getTemplate(workflow.templateId);
  const base = legacyCreationValues(workflow);
  base.grant_funded = 'No';
  delete base.restricted_fund_reference;
  assert.deepEqual(validateFieldValues(template, 'intake', base).errors, []);
  base.grant_funded = 'Yes';
  assert.match(validateFieldValues(template, 'intake', base).errors.join(' '), /Grant \/ restricted-fund reference is required/);
});

test('new records keep initiation data in one authoritative field-value store', () => {
  const workflow = getWorkflow('performance-review');
  const instance = createInstance(workflow, legacyCreationValues(workflow), 'operator', new Set());
  assert.equal(instance.schemaVersion, 2);
  assert.equal(Object.hasOwn(instance, 'creationValues'), false);
  assert.ok(instance.fieldValues.intake.employee_name);
});

test('workflows retain ADM-REF-002 provenance versioned against the unchanged canonical source', async () => {
  assert.equal(WORKFLOW_PROVENANCE.document_id, 'ADM-REF-002');
  assert.equal(WORKFLOW_PROVENANCE.source_path, COMPLIANCE_WORKFLOW_MANIFEST.source_path);
  const source = await readFile(new URL(`../documentation-source/${COMPLIANCE_WORKFLOW_MANIFEST.source_path}`, import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), COMPLIANCE_WORKFLOW_MANIFEST.source_hash);
  const { instance } = startWorkflow('pursue-grant', {
    grant_name: 'Test grant',
    funder: 'A foundation',
    date_identified: '2026-09-05',
    application_deadline: '2026-12-01',
  });
  assert.equal(instance.workflow_source.document_id, 'ADM-REF-002');
  assert.equal(instance.workflow_source.source_path, COMPLIANCE_WORKFLOW_MANIFEST.source_path);
  assert.equal(instance.workflow_source.source_hash, COMPLIANCE_WORKFLOW_MANIFEST.source_hash);
  assert.ok(instance.workflow_source.sources.length >= 1);
  assert.equal(instance.category, getWorkflow('pursue-grant').category);
  assert.equal(instance.workflowDefinition.workflowVersion, instance.workflowVersion);
  assert.equal(instance.templateDefinition.id, instance.templateId);
});

test('new records atomically initialize identity, status, workflow snapshot, first stage, and audit metadata', () => {
  const { workflow, instance } = startWorkflow('performance-review', legacyCreationValues(getWorkflow('performance-review')));
  assert.match(instance.id, new RegExp(`^${workflow.idPrefix}-\\d{4}-[A-F0-9]{6}$`));
  assert.equal(instance.workflowId, workflow.id);
  assert.equal(instance.workflowVersion, workflow.workflowVersion);
  assert.equal(instance.status, 'active');
  assert.equal(instance.currentStageIndex, 0);
  assert.equal(instance.stageStates.length, workflow.lifecycle.length);
  assert.equal(instance.stageStates[0].stageId, workflow.lifecycle[0].id);
  assert.equal(instance.audit[0].type, 'instance_created');
  assert.deepEqual(instance.workflowDefinition, workflow);
  assert.ok(instance.templateDefinition.sections.length);
});

test('historical workflow snapshots do not change when the live definition changes', () => {
  const { workflow, instance } = startWorkflow('performance-review', legacyCreationValues(getWorkflow('performance-review')));
  const changed = JSON.parse(JSON.stringify(workflow));
  changed.workflowVersion = '99.0';
  changed.lifecycle[0].label = 'Changed later';
  assert.notEqual(instance.workflowDefinition.workflowVersion, changed.workflowVersion);
  assert.notEqual(instance.workflowDefinition.lifecycle[0].label, changed.lifecycle[0].label);
  assert.equal(instance.workflowDefinition.lifecycle[0].label, workflow.lifecycle[0].label);
});

test('workflow and document references resolve through the shared document registry', () => {
  const grant = publicWorkflow(getWorkflow('pursue-grant'));
  const budget = grant.workingDocuments.find((entry) => entry.document_id === 'GRT-FORM-002');
  assert.equal(budget.document_code, 'GRT-FORM-002');
  assert.ok(budget.title);
  const shorthand = publicWorkflow(getWorkflow('report-incident'));
  assert.ok(shorthand.governingDocuments.some((entry) => entry.document_code === 'SAF-POL-002'));
  const unknown = shorthand.source.filter((entry) => !entry.document_code);
  assert.ok(unknown.some((entry) => entry.id === 'SAF-INC-001'), 'canonical defects must remain visible (SAF-INC-001)');
});

test('public templates expose controlled sections, fields, and signature definitions', () => {
  const template = publicTemplate(getTemplate('VOLUNTEER_ONBOARDING_TEMPLATE'));
  assert.equal(template.controlled, true);
  const sectionA = template.sections.find((section) => section.id === 'A');
  assert.ok(sectionA.fields.some((field) => field.name === 'full_name'));
  const signatures = template.documents.flatMap((document) => document.signatureDefinitions);
  assert.ok(signatures.some((signature) => signature.documentId === 'VOL-FORM-001' && signature.id === 'applicant'));
  assert.ok(template.documents.find((document) => document.id === 'VOL-FORM-001').fields.some((field) => field.name === 'restricted_application_reference'));
});

test('intake validation rejects incomplete submissions and normalizes values', () => {
  const workflow = getWorkflow('request-reimbursement');
  const template = getTemplate(workflow.templateId);
  const section = template.sections.find((item) => item.id === 'intake');
  const empty = validateFieldValues(template, 'intake', {});
  assert.ok(empty.errors);
  assert.equal(empty.errors.length, section.fields.filter((field) => field.required && !field.when).length);
  const fields = Object.fromEntries(section.fields.map((field) => [field.name, field.type]));
  const good = validateFieldValues(template, 'intake', {
    reimbursement_title: 'Staff meeting coffee',
    requester: 'Jane Doe',
    expense_date: '2026-09-05',
    expense_category: 'Supplies',
    vendor: 'Local vendor',
    amount: '42.50',
    business_purpose: 'Refreshments for the coordination meeting.',
    allocation_reference: 'General operations',
    grant_funded: 'No',
    receipt_available: 'Yes',
  });
  assert.equal(good.errors.length, 0);
  assert.equal(good.values.amount, 42.5);
  assert.equal(good.values.requester, 'Jane Doe');
  const badOption = validateFieldValues(template, 'intake', { ...fields, ...good.values, receipt_available: 'Maybe' });
  assert.ok(badOption.errors.some((error) => /Receipt available has an invalid option/i.test(error)));
});

test('server engine blocks progression until evidence satisfies the current gate', () => {
  const { workflow, instance } = startWorkflow('contractor-1099-review', {
    review_year: '2026',
    prepared_by: 'Treasurer',
    approved_by: 'Executive Director',
  });
  assert.equal(instance.stageStates[0].status, 'incomplete');
  assert.throws(() => addEvidence(instance, workflow, 'operator', ''), /Evidence description is required/);
  assert.throws(() => advanceStage(instance, workflow, 'operator'), /Evidence is required for this stage/);
  addEvidence(instance, workflow, 'operator', 'Payment list and W-9 classifications compiled.');
  assert.equal(instance.stageStates[0].evidence.length, 1);
  advanceStage(instance, workflow, 'operator');
  assert.equal(instance.currentStageIndex, 1);
  assert.equal(instance.audit.some((item) => item.type === 'stage_advanced'), true);
});

test('approval gates require evidence, a canonical rule, and prohibit self-approval', () => {
  const { workflow } = startWorkflow('pursue-grant', {
    grant_name: 'Gate-test grant',
    funder: 'Funder',
    date_identified: '2026-09-05',
    application_deadline: '2026-12-01',
  });
  let current = createInstance(workflow, {
    grant_name: 'Gate-test grant',
    funder: 'Funder',
    date_identified: '2026-09-05',
    application_deadline: '2026-12-01',
  }, 'operator', new Set());
  current = fillSection(current, workflow, 'eligibility');
  advanceStage(current, workflow, 'operator');
  current = fillSection(current, workflow, 'application');
  current = fillSection(current, workflow, 'budget');
  current = createDocumentInstance(current, workflow, 'GRT-FORM-002', 'operator');
  const document = findDocumentInstance(current, 'GRT-FORM-002');
  current = fillDocument(current, document);
  current = applySignature(current, document.id, 'grant-officer', 'signer-A', 'Signer A');
  current = applySignature(current, document.id, 'finance-director', 'signer-B', 'Signer B');
  current = finalizeDocument(current, document.id, 'operator');
  current = addEvidence(current, workflow, 'operator', 'Budget certified and package drafted.');
  advanceStage(current, workflow, 'operator');
  current = addEvidence(current, workflow, 'operator', 'Package prepared and presented for approval.');
  advanceStage(current, workflow, 'operator');
  const stage = workflow.lifecycle[current.currentStageIndex];
  assert.equal(stage.approvalRequired, true);
  current = addEvidence(current, workflow, 'operator', 'Package sent to the Executive Director for approval.');
  assert.equal(current.status, 'awaiting_approval');
  assert.throws(() => approveStage(current, workflow, 'admin', ''), /Applicable canonical approval authority is required/);
  assert.throws(() => approveStage(current, workflow, 'operator', 'GRT-PROC-001-APPROVAL'), /evidence submitter cannot approve/);
  current = approveStage(current, workflow, 'exec', 'GRT-PROC-001-APPROVAL');
  assert.equal(current.stageStates[current.currentStageIndex].status, 'complete');
  assert.equal(current.stageStates[current.currentStageIndex].approval.authority, 'Executive Director (Board for major applications)');
});

test('a stage requiring a signed document cannot advance until it is finalized', () => {
  const { workflow, instance } = startWorkflow('host-event', {
    event_name: 'Fall Ride',
    event_type: 'Ride',
    date_of_request: '2026-09-05',
    dates: '2026-10-10',
    venue: 'Trailhead',
    purpose_mission_fit: 'Community outreach',
  });
  let current = instance;
  current = fillSection(current, workflow, 'identification');
  current = addEvidence(current, workflow, 'operator', 'Event identified and criteria met.');
  current = advanceStage(current, workflow, 'operator');
  assert.equal(current.currentStageIndex, 1);
  current = fillSection(current, workflow, 'budget_projection');
  current = fillSection(current, workflow, 'operations');
  current = fillSection(current, workflow, 'risk');
  current = createDocumentInstance(current, workflow, 'EVT-AUTH-001', 'operator');
  const document = findDocumentInstance(current, 'EVT-AUTH-001');
  assert.throws(() => finalizeDocument(current, document.id, 'operator'), /required fields are complete/);
  current = fillDocument(current, document);
  assert.throws(() => finalizeDocument(current, document.id, 'operator'), /cannot be finalized until signed/);
  assert.throws(() => advanceStage(current, workflow, 'operator'), /EVT-AUTH-001/);
  current = applySignature(current, document.id, 'events-director', 'signer-ED', 'Events Director');
  current = applySignature(current, document.id, 'executive-director', 'signer-EX', 'Executive Director');
  current = applySignature(current, document.id, 'board', 'signer-BD', 'Board Member');
  current = finalizeDocument(current, document.id, 'operator');
  const check = stageSatisfied(current, workflow, current.currentStageIndex);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /Approval is required/.test(error)));
});

test('the volunteer onboarding workflow completes only through predefined gated stages', () => {
  const { workflow, instance } = startWorkflow('onboard-volunteer', {
    full_name: 'Ava Rider',
    email: 'ava@example.com',
    phone: '555-0001',
    address: 'Restricted volunteer address',
    emergency_contact_reference: 'VOL-EMERGENCY-001',
    minor_status: 'No',
    relationship_type: 'Volunteer',
    program_area: 'Ride Forward',
    start_date: '2026-09-05',
  });
  assert.equal(instance.currentStageIndex, 0);
  assert.equal(instance.fieldValues.B.relationship_type, 'Volunteer');
  assert.throws(() => advanceStage(instance, workflow, 'operator'), /Finalize VOL-FORM-001/);
  const completed = completeWorkflow('onboard-volunteer', {
    full_name: 'Ava Rider',
    email: 'ava@example.com',
    phone: '555-0001',
    address: 'Restricted volunteer address',
    emergency_contact_reference: 'VOL-EMERGENCY-001',
    minor_status: 'No',
    relationship_type: 'Volunteer',
    program_area: 'Ride Forward',
    start_date: '2026-09-05',
  });
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt);
  assert.ok(completed.audit.some((item) => item.type === 'instance_completed'));
  assert.equal(completed.stageStates.every((stage) => stage.status === 'complete'), true);
});

test('volunteer onboarding is data-minimized and enforces assignment-specific screening', () => {
  const workflow = getWorkflow('onboard-volunteer');
  const template = getTemplate(workflow.templateId);
  const names = new Set(template.sections.flatMap((section) => section.fields.map((field) => field.name)));
  for (const employeeOnly of ['ssn_status', 'w4_status', 'i9_status', 'payroll_information_status', 'proposed_compensation', 'position_id', 'hiring_authority']) assert.equal(names.has(employeeOnly), false, employeeOnly);
  const relationship = template.sections.find((section) => section.id === 'B');
  assert.equal(relationship.fields.find((field) => field.name === 'relationship_type').derivedValue, 'Volunteer');
  assert.equal(relationship.fields.find((field) => field.name === 'program_area').options.length, 10);
  assert.equal(relationship.fields.find((field) => field.name === 'chapter_location').options.length, 1);
  const instance = createInstance(workflow, { full_name: 'Volunteer', email: 'v@example.org', phone: '555', address: 'Restricted', emergency_contact_reference: 'EC-1', minor_status: 'No' }, 'operator', new Set());
  fillSection(instance, workflow, 'D');
  saveFieldValues(instance, workflow, 'D', { ...instance.fieldValues.D, vulnerable_person_access: 'Yes', screening_status: 'Not Required' }, 'operator');
  const screening = stageSatisfied(instance, workflow, workflow.lifecycle.findIndex((stage) => stage.id === 'screening'));
  assert.equal(screening.ok, false);
  assert.ok(screening.errors.some((error) => /Vulnerable-person assignments require/.test(error)));
});

test('every unconditional volunteer onboarding field is server-required', () => {
  const workflow = getWorkflow('onboard-volunteer');
  const template = getTemplate(workflow.templateId);
  for (const section of template.sections) {
    const payload = {};
    for (const field of section.fields) {
      if (field.type === 'derived' || field.type === 'derived-reference' || field.when) continue;
      if (field.type === 'select') {
        const option = field.options.find((item) => (typeof item === 'object' ? item.value : item) === 'Verified') || field.options[0];
        payload[field.name] = typeof option === 'object' ? option.value : option;
      } else if (field.type === 'number') payload[field.name] = '1';
      else if (field.type === 'date') payload[field.name] = '2026-09-08';
      else payload[field.name] = 'Test value';
    }
    for (const field of section.fields.filter((item) => item.required && !item.when && item.type !== 'derived' && item.type !== 'derived-reference')) {
      const missing = { ...payload };
      delete missing[field.name];
      const result = validateFieldValues(template, section.id, missing);
      assert.ok(result.errors.some((error) => error.includes(`${field.label} is required`)), `${section.id}/${field.name}`);
    }
  }
});

test('all reference and legacy workflows complete through the gated engine', () => {
  const creationValues = {
    'pursue-grant': { grant_name: 'G', funder: 'F', date_identified: '2026-09-05', application_deadline: '2026-12-01' },
    'onboard-member': { full_name: 'M', email: 'm@x.com', phone: '555', preferred_contact_method: 'Email', program_enrollment_record_reference: 'MEMBER-1', date_of_birth_record_status: 'Verified', minor_status: 'No' },
    'onboard-volunteer': { full_name: 'V', email: 'v@x.com', phone: '555', address: 'Restricted', emergency_contact_reference: 'EC-1', minor_status: 'No' },
    'onboard-employee': { full_name: 'E', email: 'e@x.com' },
    'host-event': { event_name: 'Eve', event_type: 'Ride', date_of_request: '2026-09-05', dates: '2026-10-10', venue: 'V', purpose_mission_fit: 'p' },
    'safety-training': { participant_name: 'S', role: 'Road Guard', program: 'Ride Forward', training_date: '2026-09-05', trainer: 'Tr' },
  };
  for (const workflow of WORKFLOWS) {
    const values = creationValues[workflow.id] || legacyCreationValues(workflow);
    const completed = completeWorkflow(workflow.id, values, { approver: 'admin' });
    assert.equal(completed.status, 'completed', `${workflow.id} should complete`);
    assert.ok(completed.completedAt, `${workflow.id} completedAt`);
  }
});

test('grant decision branching skips award-only stages when no award exists', () => {
  const completed = completeWorkflow('pursue-grant', {
    grant_name: 'Decision branch test',
    funder: 'Test funder',
    date_identified: '2026-09-05',
    application_deadline: '2026-12-01',
  });
  const workflow = getWorkflow('pursue-grant');
  for (const id of ['award-setup', 'spend-track', 'reporting']) {
    const index = workflow.lifecycle.findIndex((stage) => stage.id === id);
    assert.equal(completed.stageStates[index].status, 'not_applicable', id);
  }
});

function legacyCreationValues(workflow) {
  const template = getTemplate(workflow.templateId);
  const intake = template.sections.find((section) => section.id === 'intake');
  const values = {};
  for (const field of intake.fields) {
    if (!field.required) continue;
    if (field.type === 'select') values[field.name] = field.options[0];
    else if (field.type === 'number') values[field.name] = '1';
    else if (field.type === 'date') values[field.name] = '2026-09-05';
    else if (field.type === 'time') values[field.name] = '12:00';
    else values[field.name] = 'T';
  }
  return values;
}

test('an incident instance auto-registers the controlled row and closes it at closeout', () => {
  const { workflow, instance } = startWorkflow('report-incident', {
    incident_title: 'Summit mishap',
    incident_date: '2026-09-05',
    incident_time: '14:30',
    location: 'Summit trailhead',
    event_reference: 'EVT-2026-012',
    incident_type: 'Accident',
    people_involved: 'Rider, medic',
    what_happened: 'Rider fell on loose gravel.',
    witnesses: 'Two other riders',
    injuries_damage: 'Minor abrasions',
    medical_response_required: 'No',
    law_enforcement_contacted: 'No',
    immediate_actions: 'First aid provided and supervisor notified.',
    reported_by: 'Trail lead',
  });
  assert.equal(instance.stageStates[0].status, 'complete');
  assert.equal(instance.stageStates[0].evidence[0].kind, 'intake');
  assert.equal(instance.registers.length, 1);
  assert.equal(instance.registers[0].registerId, 'SAF-REG-001');
  assert.equal(instance.registers[0].columns['Incident #'], instance.id);
  assert.equal(instance.registers[0].columns.Date, '2026-09-05');
  assert.equal(instance.registers[0].columns['Event/Activity'], 'EVT-2026-012');
  assert.equal(instance.registers[0].columns['Status (Open/Closed)'], 'Open');
  const completed = completeWorkflow('report-incident', {
    incident_title: 'Summit mishap',
    incident_date: '2026-09-05',
    incident_time: '14:30',
    location: 'Summit trailhead',
    event_reference: 'EVT-2026-012',
    incident_type: 'Accident',
    people_involved: 'Rider, medic',
    what_happened: 'Rider fell on loose gravel.',
    witnesses: 'Two other riders',
    injuries_damage: 'Minor abrasions',
    medical_response_required: 'No',
    law_enforcement_contacted: 'No',
    immediate_actions: 'First aid provided and supervisor notified.',
    reported_by: 'Trail lead',
  });
  assert.equal(completed.status, 'completed');
  assert.ok(completed.registers[0].closedAt);
  assert.equal(completed.registers[0].columns['Status (Open/Closed)'], 'Closed');
  assert.equal(completed.audit.some((item) => item.type === 'instance_completed'), true);
});

test('completed and cancelled instances reject further mutation', () => {
  const completed = completeWorkflow('request-reimbursement', legacyCreationValues(getWorkflow('request-reimbursement')));
  assert.equal(completed.status, 'completed');
  assert.throws(() => addEvidence(completed, getWorkflow('request-reimbursement'), 'operator', 'late'), /cannot/i);
  assert.throws(() => saveFieldValues(completed, getWorkflow('request-reimbursement'), 'intake', {}, 'operator'), /cannot be changed/i);
  const { workflow, instance } = startWorkflow('request-reimbursement', legacyCreationValues(getWorkflow('request-reimbursement')));
  cancelInstance(instance, workflow, 'operator', 'Duplicate submission.');
  assert.equal(instance.status, 'cancelled');
  assert.throws(() => advanceStage(instance, workflow, 'operator'), /Cancelled workflows cannot be advanced/);
});

test('document instances cannot be edited, signed, or finalized after completion', () => {
  const completed = completeWorkflow('pursue-grant', {
    grant_name: 'Doc-test grant',
    funder: 'F',
    date_identified: '2026-09-05',
    application_deadline: '2026-12-01',
  });
  const document = findDocumentInstance(completed, 'GRT-FORM-002');
  assert.equal(document.status, 'completed');
  assert.throws(() => applySignature(completed, document.id, 'grant-officer', 'late', 'Late'), /cannot be changed/i);
});

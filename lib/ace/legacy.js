import safetyReportIncident from '../workflows/01-safety-report-incident.workflow.js';
import peopleHireEmployee from '../workflows/02-people-hire-employee.workflow.js';
import peopleProcessPayroll from '../workflows/03-people-process-payroll.workflow.js';
import peopleChangeCompensation from '../workflows/04-people-change-compensation.workflow.js';
import peoplePerformanceReview from '../workflows/05-people-performance-review.workflow.js';
import peopleEmployeeDiscipline from '../workflows/06-people-employee-discipline.workflow.js';
import peopleTerminateEmployee from '../workflows/07-people-terminate-employee.workflow.js';
import peopleEngageContractor from '../workflows/08-people-engage-contractor.workflow.js';
import financeContractorPayment from '../workflows/09-finance-contractor-payment.workflow.js';
import financeContractor1099Review from '../workflows/10-finance-contractor-1099-review.workflow.js';
import peopleOnboardVolunteer from '../workflows/11-people-onboard-volunteer.workflow.js';
import peopleAssignVolunteer from '../workflows/12-people-assign-volunteer.workflow.js';
import peopleRecordVolunteerService from '../workflows/13-people-record-volunteer-service.workflow.js';
import peopleEndVolunteerAssignment from '../workflows/14-people-end-volunteer-assignment.workflow.js';
import eventsAuthorizeEvent from '../workflows/15-events-authorize-event.workflow.js';
import eventsCloseOutEvent from '../workflows/16-events-close-out-event.workflow.js';
import financeProcessPurchase from '../workflows/17-finance-process-purchase.workflow.js';
import financeRequestReimbursement from '../workflows/18-finance-request-reimbursement.workflow.js';
import financeAcceptDonation from '../workflows/19-finance-accept-donation.workflow.js';
import financeExecuteSponsorship from '../workflows/20-finance-execute-sponsorship.workflow.js';
import financeAdministerGrant from '../workflows/21-finance-administer-grant.workflow.js';
import assetsAcquireAsset from '../workflows/22-assets-acquire-asset.workflow.js';
import assetsDisposeAsset from '../workflows/23-assets-dispose-asset.workflow.js';
import peopleChangeVolunteerAssignment from '../workflows/24-people-change-volunteer-assignment.workflow.js';
import peopleSuspendVolunteer from '../workflows/25-people-suspend-volunteer.workflow.js';

const LEGACY_WORKFLOWS = [
  safetyReportIncident,
  peopleHireEmployee,
  peopleProcessPayroll,
  peopleChangeCompensation,
  peoplePerformanceReview,
  peopleEmployeeDiscipline,
  peopleTerminateEmployee,
  peopleEngageContractor,
  financeContractorPayment,
  financeContractor1099Review,
  peopleOnboardVolunteer,
  peopleAssignVolunteer,
  peopleRecordVolunteerService,
  peopleEndVolunteerAssignment,
  eventsAuthorizeEvent,
  eventsCloseOutEvent,
  financeProcessPurchase,
  financeRequestReimbursement,
  financeAcceptDonation,
  financeExecuteSponsorship,
  financeAdministerGrant,
  assetsAcquireAsset,
  assetsDisposeAsset,
  peopleChangeVolunteerAssignment,
  peopleSuspendVolunteer,
];

export const LEGACY_SUPERSEDED = Object.freeze({
  'hire-employee': { replacedBy: 'onboard-employee', note: 'Superseded by the reference Onboard an Employee workflow.' },
  'onboard-volunteer': { replacedBy: 'onboard-volunteer', note: 'Superseded by the reference Onboard a Volunteer workflow.' },
});

export const LEGACY_CATEGORY_OVERRIDES = Object.freeze({ 'administer-grant': 'grants' });

const LEGACY_DOMAIN_CATEGORY = Object.freeze({
  People: 'people',
  Finance: 'finance',
  Safety: 'safety',
  Events: 'events',
  Assets: 'assets',
});

function legacyTemplate(workflow) {
  return {
    id: `legacy-${workflow.id}`,
    name: `${workflow.intent}`,
    description: `Flattened ACE template for the legacy ${workflow.id} workflow. Built automatically from the legacy intake form; not a controlled document template.`,
    controlled: false,
    legacyGenerated: true,
    workflowId: workflow.id,
    sections: [
      {
        id: 'intake',
        name: 'Record Details',
        role: 'initial',
        fields: (workflow.intake || []).map((field) => ({ ...field, sectionId: 'intake' })),
      },
    ],
  };
}

function convertLegacyWorkflow(workflow) {
  const category = LEGACY_CATEGORY_OVERRIDES[workflow.id] || LEGACY_DOMAIN_CATEGORY[workflow.domain] || 'other';
  const governing = [];
  const seen = new Set();
  for (const entry of workflow.source) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    governing.push({ id: entry.id, note: entry.section });
  }
  const reference = [];
  for (const requirement of workflow.requirements || []) {
    for (const document of requirement.documents || []) {
      if (seen.has(document.id)) continue;
      seen.add(document.id);
      reference.push({ id: document.id, note: document.note || '' });
    }
  }
  const lifecycle = (workflow.requirements || []).map((requirement) => ({
    id: requirement.id,
    label: requirement.title,
    instructions: requirement.instructions,
    purpose: requirement.purpose,
    role: requirement.role,
    source: { id: requirement.source?.id || workflow.source[0]?.id || '', section: requirement.source?.section || '' },
    sectionsRequired: [],
    referenceDocuments: requirement.documents || [],
    evidenceRequired: Boolean(requirement.evidence),
    evidenceLabel: requirement.evidence?.label || '',
    approvalRequired: Boolean(requirement.approval_required),
    approvalRules: requirement.approval_rules || [],
    satisfiedByIntake: Boolean(requirement.satisfied_by_intake),
    autoRegister: requirement.auto_register ? { register_id: requirement.auto_register.register_id, columns: { ...requirement.auto_register.columns } } : null,
    autoRegisterClose: requirement.auto_register_close ? { status: requirement.auto_register_close.status } : null,
    legacyEvidenceType: requirement.evidence?.type || 'TEXT',
  }));
  return {
    id: workflow.id,
    name: workflow.intent,
    category,
    categoryGroup: workflow.domain,
    idPrefix: workflow.idPrefix,
    workflowVersion: 'legacy-1.0',
    legacy: true,
    summary: workflow.summary,
    templateId: `legacy-${workflow.id}`,
    creationSection: 'intake',
    titleField: { sectionId: 'intake', fieldName: workflow.titleField.name, label: workflow.titleField.label },
    source: workflow.source.map((entry) => ({ id: entry.id, section: entry.section })),
    activeSections: ['intake'],
    workingDocuments: [],
    governingDocuments: governing,
    referenceDocuments: reference,
    lifecycle,
  };
}

export function buildLegacyWorkflows() {
  return LEGACY_WORKFLOWS.filter((workflow) => !LEGACY_SUPERSEDED[workflow.id]).map(convertLegacyWorkflow);
}

export function buildLegacyTemplates() {
  const templates = {};
  for (const workflow of LEGACY_WORKFLOWS.filter((item) => !LEGACY_SUPERSEDED[item.id])) {
    templates[`legacy-${workflow.id}`] = legacyTemplate(workflow);
  }
  return templates;
}

export function isLegacyWorkflow(id) {
  return Boolean(LEGACY_SUPERSEDED[id]);
}

export function isLegacyTemplate(id) {
  return String(id).startsWith('legacy-');
}
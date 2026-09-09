// ACE — controlled reusable templates.
import { AUTHORIZED_LOCATIONS, CANONICAL_POSITIONS } from '../onboarding-references.generated.js';
// A template is a CONTROLLED, versioned document-control construct: sections,
// fields, fillable documents, and signatures defined once and reused by
// multiple workflow definitions through PREDEFINED applicability (activeSections).
// ACE never decides applicability at runtime — each workflow declares it.

function field(name, label, type, opts = {}) {
  return { name, label, type, ...opts };
}

function section(id, title, fields = [], description = '') {
  return { id, title, fields, description };
}

function workDocument(id, title, fields, signatureDefinitions = [], note = '') {
  return { id, title, fields, signatureDefinitions: signatureDefinitions.map((signature) => ({ ...signature, documentId: id })), note };
}

const ONBOARDING_TEMPLATE_COMPONENTS = Object.freeze({
  id: 'ONBOARDING_MASTER_TEMPLATE',
  name: 'Onboarding Master',
  version: '2.0',
  source: [{ id: 'VOL-PROC-001', section: 'Volunteer Assignment Process' }, { id: 'HR-EMP-001', section: 'Employee Lifecycle Map' }],
  governanceNote: 'Shared controlled onboarding template. Applicability (activeSections) is predefined per workflow definition; sections irrelevant to a workflow are never required.',
  sections: [
    section('A', 'Identity / Contact Information', [
      field('full_name', 'Full name', 'text', { required: true, maxlen: 120, help: 'The person being onboarded.' }),
      field('email', 'Email', 'text', { required: true, maxlen: 120 }),
      field('phone', 'Phone', 'text', { required: false, maxlen: 40 }),
      field('address', 'Address', 'textarea', { required: false, maxlen: 500 }),
    ]),
    section('B', 'Organizational Relationship', [
      field('relationship_type', 'Relationship type', 'select', { required: true, options: ['Member', 'Volunteer', 'Employee'] }),
      field('program_area', 'Program / area', 'text', { required: true, maxlen: 120 }),
      field('chapter_location', 'Chapter / location', 'text', { required: false, maxlen: 120 }),
      field('start_date', 'Start date', 'date', { required: true }),
      field('supervisor', 'Supervisor / coordinator', 'text', { required: false, maxlen: 120 }),
    ]),
    section('C', 'Member Information', [
      field('program_interest', 'Program interest', 'select', { required: true, options: ['Peer Connection', 'Family Support', 'Hospital & Prosthetic Outreach', 'Housing & Independence Advocacy', 'Community Resource & Assistance', 'Ride Forward', 'Chapter Development', 'Other Approved Program'] }),
      field('volunteer_service_interest', 'Volunteer service interest', 'textarea', { required: false, maxlen: 1000 }),
      field('member_notes', 'Member notes', 'textarea', { required: false, maxlen: 1000 }),
    ]),
    section('D', 'Volunteer Information', [
      field('role_interests', 'Role interests', 'textarea', { required: true, maxlen: 1000, help: 'Event support, ride support, outreach, office/administrative, fundraising, serving minors/vulnerable persons, financial handling, other.' }),
      field('experience_skills', 'Experience and skills', 'textarea', { required: false, maxlen: 2000 }),
      field('availability', 'Availability (days/times)', 'textarea', { required: true, maxlen: 1000 }),
      field('references', 'References (two, optional for event roles)', 'textarea', { required: false, maxlen: 1000 }),
      field('screening_consent', 'Screening consent (VOL-APP-001)', 'select', { required: true, options: ['Yes', 'Not required for this role'] }),
      field('driving_required', 'Will this volunteer assignment require driving?', 'select', { required: true, options: ['Yes', 'No'], help: 'Driving changes the screening and authorization needed before an assignment may begin.' }),
      field('driver_license_reference', 'Driver’s-license verification reference', 'text', { required: true, maxlen: 160, when: { field: 'driving_required', equals: 'Yes' }, help: 'Record the restricted verification reference; do not place unnecessary sensitive license data in this field.' }),
      field('vehicle_insurance_reference', 'Vehicle insurance verification reference', 'text', { required: true, maxlen: 160, when: { field: 'driving_required', equals: 'Yes' }, help: 'Identify where current insurance verification is retained.' }),
      field('driving_authorization_reference', 'Organizational driving authorization', 'text', { required: true, maxlen: 160, when: { field: 'driving_required', equals: 'Yes' }, help: 'Provide the approval reference authorizing driving for the volunteer role.' }),
      field('volunteer_acknowledgment', 'Volunteer acknowledgment', 'select', { required: true, options: ['I understand I am a volunteer, not an employee, and receive no wages or benefits.', 'I agree to follow the organization\u2019s policies, safety rules, and supervisors\u2019 instructions.'] }),
    ]),
    section('E', 'Employee Information', [
      field('position_title', 'Position title', 'text', { required: true, maxlen: 120 }),
      field('position_description_reference', 'Position description reference (HR-REF-001)', 'text', { required: true, maxlen: 120 }),
      field('proposed_compensation', 'Proposed compensation (USD)', 'number', { required: true }),
      field('hiring_authority', 'Hiring authority', 'text', { required: true, maxlen: 120 }),
    ]),
    section('F', 'Policies / Acknowledgments', [
      field('policies_acknowledged', 'Policies acknowledged', 'select', { required: true, options: ['Yes'] }),
      field('confidentiality_acknowledged', 'Confidentiality acknowledged', 'select', { required: true, options: ['Yes'] }),
      field('code_of_conduct_acknowledged', 'Code of conduct acknowledged', 'select', { required: true, options: ['Yes'] }),
      field('conflict_disclosure', 'Conflict-of-interest disclosure', 'textarea', { required: true, maxlen: 1000, help: 'Any relationship with a board member, officer, employee, or family member, or None.' }),
    ]),
    section('G', 'Training', [
      field('orientation_completed', 'Orientation completed', 'select', { required: true, options: ['Yes', 'No'] }),
      field('required_trainings', 'Required trainings (topics + dates)', 'textarea', { required: false, maxlen: 2000 }),
      field('training_records_reference', 'Training records reference', 'text', { required: false, maxlen: 160 }),
    ]),
    section('H', 'Employment / Tax Documentation', [
      field('employment_eligibility_verified', 'Employment eligibility verified', 'select', { required: true, options: ['Yes'] }),
      field('payroll_setup_reference', 'Payroll setup reference (HR-FORM-006)', 'text', { required: true, maxlen: 160 }),
      field('tax_documentation', 'Tax documentation (W-4 / I-9 and any state forms)', 'textarea', { required: true, maxlen: 500 }),
      field('employee_id', 'Employee ID (EMP-YYYY-NNN, HR-REG-001)', 'text', { required: false, maxlen: 40 }),
    ]),
    section('I', 'Signatures / Approval', [
      field('approving_authority', 'Approving authority', 'text', { required: true, maxlen: 120 }),
      field('approval_reference', 'Approval reference', 'text', { required: false, maxlen: 160 }),
      field('approved_date', 'Approval date', 'date', { required: true }),
    ]),
  ],
  documents: Object.freeze([
    workDocument('VOL-FORM-001', 'Volunteer Application', [
      field('applicant_name', 'Name', 'text', { required: true, maxlen: 120 }),
      field('date_of_birth', 'Date of birth (if needed for role)', 'date', { required: false }),
      field('address', 'Address', 'textarea', { required: true, maxlen: 500 }),
      field('phone', 'Phone', 'text', { required: true, maxlen: 40 }),
      field('email', 'Email', 'text', { required: true, maxlen: 120 }),
      field('emergency_contact', 'Emergency contact (name/phone)', 'text', { required: true, maxlen: 160 }),
      field('role_interests', 'Role interests', 'textarea', { required: true, maxlen: 1000 }),
      field('experience_skills', 'Experience and skills', 'textarea', { required: false, maxlen: 2000 }),
      field('availability', 'Availability', 'textarea', { required: true, maxlen: 1000 }),
      field('references', 'References (two, optional for event roles)', 'textarea', { required: false, maxlen: 1000 }),
      field('certification', 'Consent and certification', 'select', { required: true, options: ['I understand I am a volunteer, not an employee; I agree to follow policies and safety rules; I consent to applicable screening.'] }),
    ], [
      { id: 'applicant', label: 'Applicant signature', signerRole: 'Applicant' },
    ], 'Volunteer Application (VOL-FORM-001).'),
    workDocument('VOL-FORM-004', 'Volunteer Approval Record', [
      field('volunteer_name', 'Volunteer', 'text', { required: true, maxlen: 120 }),
      field('approving_authority', 'Approving authority', 'text', { required: true, maxlen: 120 }),
      field('approved_date', 'Date', 'date', { required: true }),
      field('approved_capacity', 'Approved capacity / program', 'text', { required: true, maxlen: 200 }),
      field('restrictions_conditions', 'Restrictions or conditions', 'textarea', { required: false, maxlen: 1000 }),
    ], [
      { id: 'authorizing', label: 'Authorizing authority signature', signerRole: 'Approving authority' },
    ], 'Volunteer Approval Record (VOL-FORM-004).'),
    workDocument('HR-FORM-005', 'Position Compensation Worksheet', [
      field('position_title', 'Position title', 'text', { required: true, maxlen: 120 }),
      field('proposed_rate', 'Proposed rate', 'text', { required: true, maxlen: 60 }),
      field('comparability_source', 'Comparability source', 'text', { required: true, maxlen: 200 }),
      field('effective_date', 'Effective date', 'date', { required: true }),
      field('approval_reference', 'Approval reference', 'text', { required: false, maxlen: 160 }),
    ], [
      { id: 'authorizing', label: 'Approval signature', signerRole: 'Authorizing authority' },
    ], 'Position Compensation Worksheet (HR-FORM-005).'),
    workDocument('HR-CHK-002', 'Employee Onboarding Checklist', [
      field('orientation_items', 'Orientation completed items', 'textarea', { required: true, maxlen: 2000 }),
      field('training_completed', 'Required training completed', 'select', { required: true, options: ['Yes', 'No'] }),
      field('payroll_setup_reference', 'Payroll setup reference (HR-FORM-006)', 'text', { required: true, maxlen: 160 }),
      field('employee_id', 'Employee ID (EMP-YYYY-NNN)', 'text', { required: true, maxlen: 40 }),
    ], [
      { id: 'supervisor', label: 'Supervisor signature', signerRole: 'Supervisor' },
      { id: 'employee', label: 'Employee signature', signerRole: 'Employee' },
    ], 'Employee Onboarding Checklist (HR-CHK-002).'),
  ]),
});

const PROGRAMS = Object.freeze([
  'Peer Connection',
  'Ride Forward',
  'Hospital and Prosthetic Outreach',
  'Housing and Independence Advocacy',
  'Community Resource and Assistance',
  'Family Support',
]);

function relationshipSection(relationship, assignmentFields) {
  return section('B', 'Organizational Relationship', [
    field('relationship_type', 'Relationship type', 'derived', {
      required: true,
      derivedValue: relationship,
      help: `This immutable value is established by the ${relationship} onboarding workflow.`,
    }),
    ...assignmentFields,
    field('start_date', 'Start date', 'date', { required: true }),
  ]);
}

function relationshipTemplate(id, name, relationship, sectionIds, replacements) {
  const replacementMap = new Map(replacements.map((item) => [item.id, item]));
  return Object.freeze({
    ...ONBOARDING_TEMPLATE_COMPONENTS,
    id,
    name,
    version: '3.0',
    relationship,
    sections: ONBOARDING_TEMPLATE_COMPONENTS.sections
      .filter((item) => sectionIds.includes(item.id))
      .map((item) => replacementMap.get(item.id) || item),
  });
}

const employeeIdentity = section('A', 'Employee Identity / Contact Information', [
  field('full_name', 'Legal name', 'text', { required: true, maxlen: 120, classification: 'restricted-personnel', help: 'Enter the employee’s legal name. Do not enter an SSN, government ID number, or tax-form content here.' }),
  field('email', 'Email', 'text', { required: true, maxlen: 120, classification: 'restricted-personnel' }),
  field('phone', 'Phone', 'text', { required: false, maxlen: 40, classification: 'restricted-personnel' }),
  field('address', 'Address', 'textarea', { required: false, maxlen: 500, classification: 'restricted-personnel' }),
]);

const employeeRelationship = relationshipSection('Employee', [
  field('chapter_location', 'Chapter / location', 'select', {
    required: true,
    options: AUTHORIZED_LOCATIONS.map((item) => ({ value: item.id, label: item.name })),
    classification: 'internal',
    source: { documentId: 'ORG-HBK-001', path: AUTHORIZED_LOCATIONS[0].source_path },
  }),
]);

const employeePosition = section('E', 'Position and Hiring Authorization', [
  field('position_id', 'Position', 'select', {
    required: true,
    options: CANONICAL_POSITIONS.map((item) => ({ value: item.id, label: item.title })),
    classification: 'internal',
    source: { documentId: 'HR-REF-001', path: 'lost_limb_riders_handbooks/transactional_operations/03-HUMAN-RESOURCES/HR-REF-001-Position-Descriptions-Index.md' },
    help: 'Choose an authorized position from HR-REF-001. Its title and description are derived and cannot be rewritten here.',
  }),
  field('position_description', 'Position description', 'derived-reference', { required: true, deriveFrom: 'position_id', classification: 'internal', references: CANONICAL_POSITIONS.map((item) => ({ value: item.id, description: `${item.description}\n\nCore purpose: ${item.purpose}`, title: item.title, sourcePath: item.source_path, sourceHash: item.source_hash })) }),
  field('proposed_compensation', 'Proposed compensation (USD)', 'number', { required: true, classification: 'restricted-personnel' }),
  field('hiring_authority', 'Hiring authority', 'text', { required: true, maxlen: 120, classification: 'internal' }),
]);

const employmentDocumentation = section('H', 'Employment, Tax, and Restricted Records', [
  field('date_of_birth_status', 'Date of birth recorded in restricted HR/payroll system', 'select', { required: true, options: ['Not Started', 'Pending', 'Completed', 'Verified'], classification: 'restricted-status', help: 'Track status only. Never enter the date of birth in this Compliance Engine record.' }),
  field('ssn_status', 'Social Security number recorded in restricted payroll system', 'select', { required: true, options: ['Not Started', 'Pending', 'Completed', 'Verified'], classification: 'restricted-status', help: 'Track status only. Never enter any part of the SSN in this Compliance Engine record.' }),
  field('w4_status', 'Federal Form W-4 status', 'select', { required: true, options: ['Not Started', 'Pending', 'Completed', 'Verified'], classification: 'restricted-status' }),
  field('i9_status', 'Form I-9 status', 'select', { required: true, options: ['Not Started', 'Pending', 'Completed', 'Verified'], classification: 'restricted-status' }),
  field('i9_document_path', 'I-9 acceptable-document path reviewed', 'select', { required: true, options: ['List A', 'List B and List C'], classification: 'restricted-status', help: 'Record only the permitted category path. The employer must not prescribe which acceptable documents the employee presents.' }),
  field('i9_identity_document_status', 'Identity documentation status', 'select', { required: true, options: ['Pending', 'Verified'], classification: 'restricted-status' }),
  field('i9_employment_authorization_status', 'Employment-authorization documentation status', 'select', { required: true, options: ['Pending', 'Verified'], classification: 'restricted-status' }),
  field('payroll_information_status', 'Payroll information status', 'select', { required: true, options: ['Not Started', 'Pending', 'Completed', 'Verified'], classification: 'restricted-status' }),
  field('restricted_record_reference', 'Restricted HR/payroll record reference', 'text', { required: true, maxlen: 160, classification: 'restricted-reference', help: 'Enter only an opaque file or case reference. Do not enter an SSN, birth date, bank data, government ID number, or tax-form contents.' }),
  field('employee_id', 'Employee ID (EMP-YYYY-NNN, HR-REG-001)', 'text', { required: false, maxlen: 40, classification: 'internal' }),
]);

export const EMPLOYEE_ONBOARDING_TEMPLATE = relationshipTemplate(
  'EMPLOYEE_ONBOARDING_TEMPLATE', 'Employee Onboarding', 'Employee', ['A', 'B', 'E', 'F', 'G', 'H', 'I'],
  [employeeIdentity, employeeRelationship, employeePosition, employmentDocumentation],
);

export const VOLUNTEER_ONBOARDING_TEMPLATE = relationshipTemplate(
  'VOLUNTEER_ONBOARDING_TEMPLATE', 'Volunteer Onboarding', 'Volunteer', ['A', 'B', 'D', 'F', 'G', 'I'],
  [relationshipSection('Volunteer', [field('program_area', 'Program / area', 'select', { required: true, options: PROGRAMS, classification: 'restricted-personnel' })])],
);

export const MEMBER_ONBOARDING_TEMPLATE = relationshipTemplate(
  'MEMBER_ONBOARDING_TEMPLATE', 'Member Onboarding', 'Member', ['A', 'B', 'C', 'F', 'I'],
  [relationshipSection('Member', [field('program_area', 'Program / area', 'select', { required: true, options: PROGRAMS, classification: 'restricted-personnel' })])],
);

export const GRANT_MASTER_TEMPLATE = Object.freeze({
  id: 'GRANT_MASTER_TEMPLATE',
  name: 'Grant Master',
  version: '2.0',
  source: [{ id: 'GRT-PROC-001', section: 'Grant Lifecycle Procedure' }],
  sections: [
    section('opportunity', 'Opportunity', [
      field('grant_name', 'Grant name', 'text', { required: true, maxlen: 140 }),
      field('funder', 'Funding organization / funder', 'text', { required: true, maxlen: 120 }),
      field('funding_program', 'Funding program', 'text', { required: false, maxlen: 120 }),
      field('opportunity_url', 'Opportunity URL', 'text', { required: false, maxlen: 500 }),
      field('opportunity_source', 'Opportunity source', 'text', { required: false, maxlen: 160 }),
      field('date_identified', 'Date opportunity identified', 'date', { required: true }),
      field('application_deadline', 'Application deadline', 'date', { required: true }),
    ]),
    section('eligibility', 'Eligibility', [
      field('eligible', 'Eligibility determination', 'select', { required: true, options: ['Eligible', 'Not eligible', 'To be determined'] }),
      field('eligibility_requirements', 'Eligibility requirements', 'textarea', { required: false, maxlen: 2000 }),
      field('geographic_restrictions', 'Geographic restrictions', 'textarea', { required: false, maxlen: 1000 }),
      field('program_restrictions', 'Program restrictions', 'textarea', { required: false, maxlen: 1000 }),
    ]),
    section('application', 'Application', [
      field('grant_contact_name', 'Grant contact name', 'text', { required: false, maxlen: 120 }),
      field('grant_contact_email', 'Grant contact email', 'text', { required: false, maxlen: 120 }),
      field('internal_owner', 'Internal owner', 'text', { required: true, maxlen: 120 }),
      field('grant_purpose', 'Grant purpose', 'textarea', { required: true, maxlen: 2000 }),
      field('proposed_project', 'Proposed project', 'textarea', { required: true, maxlen: 2000 }),
      field('proposed_use_of_funds', 'Proposed use of funds', 'textarea', { required: false, maxlen: 2000 }),
      field('required_attachments', 'Required attachments', 'textarea', { required: false, maxlen: 2000 }),
    ]),
    section('budget', 'Budget', [
      field('maximum_available', 'Maximum available amount (USD)', 'number', { required: false }),
      field('requested_amount', 'Requested amount (USD)', 'number', { required: true }),
      field('match_required', 'Does the opportunity require matching funds or in-kind support?', 'select', { required: true, options: ['Yes', 'No'] }),
      field('match_requirement', 'Match requirement and source', 'textarea', { required: true, maxlen: 1000, when: { field: 'match_required', equals: 'Yes' }, help: 'State the amount or percentage, eligible form of match, source, and who confirmed it is available.' }),
      field('amount_already_secured', 'Amount already secured (USD)', 'number', { required: false }),
    ]),
    section('submission', 'Submission', [
      field('submitted_date', 'Submitted date', 'date', { required: false }),
      field('submission_reference', 'Submission reference', 'text', { required: false, maxlen: 160 }),
      field('proof_of_submission', 'Proof of submission', 'textarea', { required: false, maxlen: 1000 }),
      field('reporting_requirements', 'Reporting requirements', 'textarea', { required: false, maxlen: 2000 }),
    ]),
    section('award', 'Award', [
      field('decision_date', 'Decision date', 'date', { required: false }),
      field('award_status', 'Award status', 'select', { required: true, options: ['Pending', 'Awarded', 'Denied'] }),
      field('award_amount', 'Award amount (USD)', 'number', { required: true, when: { field: 'award_status', equals: 'Awarded' } }),
      field('award_restrictions', 'Award restrictions', 'textarea', { required: true, maxlen: 2000, when: { field: 'award_status', equals: 'Awarded' }, help: 'State the purposes, budget limits, conditions, or other restrictions exactly as documented by the grantor.' }),
      field('grant_period', 'Grant period', 'text', { required: true, maxlen: 120, when: { field: 'award_status', equals: 'Awarded' } }),
      field('reporting_deadlines', 'Reporting deadlines', 'textarea', { required: true, maxlen: 2000, when: { field: 'award_status', equals: 'Awarded' } }),
      field('closeout_requirements', 'Closeout requirements', 'textarea', { required: true, maxlen: 2000, when: { field: 'award_status', equals: 'Awarded' } }),
    ]),
    section('tracking', 'Tracking', [
      field('current_stage', 'Current stage', 'text', { required: false, maxlen: 160 }),
      field('grant_status', 'Grant status', 'select', { required: true, options: ['Open', 'Closed'] }),
      field('notes', 'Notes', 'textarea', { required: false, maxlen: 2000 }),
    ]),
  ],
  documents: Object.freeze([
    workDocument('GRT-FORM-002', 'Grant Budget', [
      field('grant_id', 'Grant ID (GRT-YYYY-NNN)', 'text', { required: true, maxlen: 40 }),
      field('grantor', 'Grantor', 'text', { required: true, maxlen: 120 }),
      field('award_amount', 'Award amount (USD)', 'number', { required: true }),
      field('budget_period', 'Budget period', 'text', { required: true, maxlen: 80 }),
      field('prepared_by', 'Prepared by', 'text', { required: true, maxlen: 120 }),
      field('prepared_date', 'Date', 'date', { required: true }),
      field('budget_line_items', 'Budget lines (category | budgeted | spent YTD | remaining | variance notes)', 'textarea', { required: true, maxlen: 4000 }),
      field('total_budgeted', 'Total budgeted (USD)', 'number', { required: true }),
      field('indirect_cost_rate', 'Indirect cost rate', 'text', { required: false, maxlen: 160 }),
      field('budget_revisions', 'Budget revisions (date | change | approved by | reference)', 'textarea', { required: false, maxlen: 2000 }),
    ], [
      { id: 'finance-director', label: 'Finance Director signature', signerRole: 'Finance Director' },
      { id: 'grant-officer', label: 'Grants Officer signature', signerRole: 'Grants Officer' },
    ], 'Grant Budget form (GRT-FORM-002).'),
  ]),
});

export const EVENT_MASTER_TEMPLATE = Object.freeze({
  id: 'EVENT_MASTER_TEMPLATE',
  name: 'Event Master',
  version: '1.0',
  source: [{ id: 'EVT-POL-001', section: 'Event Authorization Policy' }, { id: 'EVT-AUTH-001', section: 'Event Authorization Form' }, { id: 'EVT-CLOSE-001', section: 'Event Closeout' }],
  sections: [
    section('identification', 'Event Identification', [
      field('event_name', 'Event name', 'text', { required: true, maxlen: 140 }),
      field('event_type', 'Event type', 'select', { required: true, options: ['Ride', 'Concert', 'Fundraiser', 'Meeting', 'Awareness ride', 'Family event', 'Training', 'Other'] }),
      field('date_of_request', 'Date of request', 'date', { required: true }),
      field('dates', 'Event dates', 'text', { required: true, maxlen: 80 }),
      field('venue', 'Venue / location', 'text', { required: true, maxlen: 200 }),
      field('purpose_mission_fit', 'Purpose / mission fit', 'textarea', { required: true, maxlen: 2000 }),
    ]),
    section('budget_projection', 'Budget and Financial Projection', [
      field('projected_expenses', 'Projected expenses (USD)', 'number', { required: true }),
      field('projected_revenue', 'Projected revenue (USD)', 'number', { required: true }),
      field('cash_flow_needed', 'Cash flow needed / advances (USD)', 'number', { required: false }),
      field('funding_source', 'Funding source', 'select', { required: true, options: ['Event budget line', 'Restricted / grant', 'General'] }),
    ]),
    section('operations', 'Operations', [
      field('staffing_plan', 'Staffing plan prepared (EVT-HR-001)', 'select', { required: true, options: ['Yes', 'No'] }),
      field('volunteer_plan', 'Volunteer plan (VOL-POL-001)', 'select', { required: true, options: ['Yes', 'No'] }),
      field('volunteers_needed', 'Volunteers needed', 'number', { required: false }),
      field('safety_risk_plan', 'Safety / risk plan (SAF-POL-001)', 'select', { required: true, options: ['Yes', 'No'] }),
      field('insurance_confirmed', 'Insurance confirmed', 'select', { required: true, options: ['Yes', 'No'] }),
      field('insurance_certificate', 'Insurance certificate #', 'text', { required: false, maxlen: 120 }),
      field('permits_required', 'Permits / licenses required (raffle, games of chance, noise, etc.)', 'textarea', { required: false, maxlen: 1000 }),
      field('contracts_identified', 'Contracts identified (venue, performers, vendors)', 'textarea', { required: false, maxlen: 1000 }),
    ]),
    section('risk', 'Attendance / Risk', [
      field('projected_attendance', 'Projected attendance', 'number', { required: false }),
      field('max_capacity', 'Max capacity', 'number', { required: false }),
      field('known_risks_mitigations', 'Known risks and mitigations', 'textarea', { required: true, maxlen: 2000 }),
    ]),
    section('approval', 'Approval', [
      field('approval_level', 'Approval level', 'select', { required: true, options: ['Events Director + Executive Director', 'Board required (material financial risk / unbudgeted)'] }),
      field('approving_authority', 'Approving authority', 'text', { required: true, maxlen: 120 }),
      field('approval_reference', 'Approval reference', 'text', { required: false, maxlen: 160 }),
    ]),
    section('closeout', 'Closeout', [
      field('financial_summary', 'Financial reconciliation (EVT-FORM-002)', 'textarea', { required: true, maxlen: 3000 }),
      field('personnel_settled', 'Personnel settled (time, contractors, volunteer hours)', 'select', { required: true, options: ['Yes', 'No'] }),
      field('incidents_reviewed', 'Incidents reviewed (SAF-REG-001)', 'select', { required: true, options: ['Yes', 'No incidents', 'No'] }),
      field('donor_sponsor_followup', 'Donor / sponsor follow-up complete', 'select', { required: true, options: ['Yes', 'N/A', 'No'] }),
      field('records_filed', 'Records filed per REC-MATRIX-001', 'select', { required: true, options: ['Yes', 'No'] }),
      field('lessons_learned', 'Lessons learned', 'textarea', { required: false, maxlen: 2000 }),
    ]),
  ],
  documents: Object.freeze([
    workDocument('EVT-AUTH-001', 'Event Authorization', [
      field('event_id', 'Event ID (EVT-YYYY-NNN)', 'text', { required: true, maxlen: 40 }),
      field('date_of_request', 'Date of request', 'date', { required: true }),
      field('event_name', 'Event name', 'text', { required: true, maxlen: 140 }),
      field('event_type', 'Event type', 'text', { required: true, maxlen: 120 }),
      field('dates', 'Dates', 'text', { required: true, maxlen: 80 }),
      field('venue', 'Venue / location', 'text', { required: true, maxlen: 200 }),
      field('purpose', 'Purpose / mission fit', 'textarea', { required: true, maxlen: 2000 }),
      field('projected_expenses', 'Projected expenses (USD)', 'number', { required: true }),
      field('projected_revenue', 'Projected revenue (USD)', 'number', { required: true }),
      field('funding_source', 'Funding source', 'text', { required: true, maxlen: 200 }),
      field('post_approval_routing', 'Post-approval routing (register, contracts, closeout)', 'textarea', { required: false, maxlen: 1000 }),
    ], [
      { id: 'events-director', label: 'Events Director signature', signerRole: 'Events Director' },
      { id: 'executive-director', label: 'Executive Director signature', signerRole: 'Executive Director' },
      { id: 'board', label: 'Board signature (material financial risk / unbudgeted)', signerRole: 'Board' },
    ], 'Event Authorization form (EVT-AUTH-001).'),
    workDocument('EVT-CLOSE-001', 'Event Closeout', [
      field('event_id', 'Event ID (EVT-YYYY-NNN)', 'text', { required: true, maxlen: 40 }),
      field('event_name', 'Event name', 'text', { required: true, maxlen: 140 }),
      field('closeout_date', 'Closeout date', 'date', { required: true }),
      field('financial_reconciliation', 'Revenue recorded/deposited; expenses approved and paid', 'textarea', { required: true, maxlen: 3000 }),
      field('personnel_settled', 'Personnel settled', 'select', { required: true, options: ['Yes', 'No'] }),
      field('incidents_reviewed', 'Incidents reviewed', 'select', { required: true, options: ['Yes', 'No incidents', 'No'] }),
      field('donor_sponsor_followup', 'Donor / sponsor follow-up', 'select', { required: true, options: ['Yes', 'N/A', 'No'] }),
      field('records_filed', 'Records filed', 'select', { required: true, options: ['Yes', 'No'] }),
      field('register_marked_closed', 'Event marked closed in EVT-REG-001 / ADM-REG-001', 'select', { required: true, options: ['Yes', 'No'] }),
      field('lessons_learned', 'Lessons learned', 'textarea', { required: false, maxlen: 2000 }),
    ], [
      { id: 'events-director', label: 'Events Director signature', signerRole: 'Events Director' },
    ], 'Event Closeout (EVT-CLOSE-001).'),
  ]),
});

export const SAFETY_TRAINING_TEMPLATE = Object.freeze({
  id: 'SAFETY_TRAINING_TEMPLATE',
  name: 'Safety Training',
  version: '1.0',
  source: [{ id: 'RF-PGM-002', section: 'Ride Forward Program Manual \u00a7 39 Volunteer Orientation and Annual Training' }, { id: 'RF-PGM-002', section: 'Ride Forward Program Manual \u00a7 H Volunteer Emergency Response Training' }],
  sections: [
    section('participant', 'Participant', [
      field('participant_name', 'Participant name', 'text', { required: true, maxlen: 120 }),
      field('role', 'Role', 'select', { required: true, options: ['All volunteers', 'Road Guard', 'Sweep Rider', 'First Aid', 'Registration', 'Family Zone', 'Merchandise / Fundraising'] }),
      field('program', 'Program / event', 'text', { required: true, maxlen: 120 }),
      field('training_date', 'Training date', 'date', { required: true }),
      field('trainer', 'Trainer', 'text', { required: true, maxlen: 120 }),
    ]),
    section('orientation', 'Volunteer Orientation', [
      field('orientation_completed', 'Orientation completed', 'select', { required: true, options: ['Yes', 'No'] }),
      field('orientation_topics', 'Orientation covered (mission, program overview, roles, safety policies, confidentiality, code of conduct, communication, event briefing)', 'textarea', { required: true, maxlen: 3000 }),
    ]),
    section('specialized', 'Specialized / Annual Training', [
      field('role_training_required', 'Role-specific training required', 'select', { required: true, options: ['Yes', 'No'] }),
      field('training_modules', 'Training modules completed (route safety, traffic management, hand signals, radio, first aid/CPR, waiver processing, cash handling, child safety, etc.)', 'textarea', { required: false, maxlen: 3000 }),
      field('certification', 'Certification (e.g., first aid / CPR)', 'text', { required: false, maxlen: 200 }),
      field('certification_expiration', 'Certification expiration date', 'date', { required: false }),
    ]),
    section('acknowledgment', 'Acknowledgement', [
      field('acknowledgment_statement', 'Acknowledgment statement', 'textarea', { required: true, maxlen: 2000, help: 'I confirm completion of the orientation/annual training, understand the safety policies and emergency procedures, and agree to apply them during service.' }),
    ]),
  ],
  documents: Object.freeze([
    workDocument('VOL-FORM-008', 'Volunteer Training Record', [
      field('volunteer_name', 'Volunteer name', 'text', { required: true, maxlen: 120 }),
      field('training_date', 'Training date', 'date', { required: true }),
      field('role', 'Role', 'text', { required: true, maxlen: 120 }),
      field('program', 'Program / event', 'text', { required: true, maxlen: 120 }),
      field('training_modules', 'Training modules delivered', 'textarea', { required: true, maxlen: 3000 }),
      field('trainer', 'Trainer', 'text', { required: true, maxlen: 120 }),
      field('certification', 'Certification / reference', 'text', { required: false, maxlen: 200 }),
    ], [
      { id: 'participant', label: 'Participant signature', signerRole: 'Participant' },
      { id: 'trainer', label: 'Trainer signature', signerRole: 'Trainer' },
    ], 'Volunteer Training Record (VOL-FORM-008).'),
  ]),
});

export const TEMPLATES = Object.freeze(Object.fromEntries(
  [EMPLOYEE_ONBOARDING_TEMPLATE, VOLUNTEER_ONBOARDING_TEMPLATE, MEMBER_ONBOARDING_TEMPLATE, GRANT_MASTER_TEMPLATE, EVENT_MASTER_TEMPLATE, SAFETY_TRAINING_TEMPLATE]
    .map((template) => [template.id, Object.freeze(template)]),
));

export function getTemplate(id) {
  return TEMPLATES[id] || null;
}

export function activeSections(template, definition) {
  return (definition.activeSections || []).map((sectionId) => template.sections.find((section) => section.id === sectionId)).filter(Boolean);
}

export function templateDocuments(template) {
  return template.documents || [];
}

/**
 * @file        02-onboarding-onboard-member.workflow.js
 * @description ACE workflow definition — 02-onboarding-onboard-member
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'onboard-member', name: 'Onboard a Member', category: 'onboarding', categoryGroup: 'People', idPrefix: 'MBR', workflowVersion: '3.0',
  summary: 'Establish a Member relationship and initial program enrollment through documented eligibility, consent, review, and activation without granting employment, volunteer, governance, or system authority.',
  purpose: 'Use this workflow to review and activate one prospective Lost Limb Riders Member and record the person’s initial participation in a canonically available program.',
  whenToUse: ['Use when a prospective Member submits the canonical Program Enrollment Form and requests participation in a Lost Limb Riders program.'],
  whenNotToUse: ['Do not use to hire an employee, approve a volunteer assignment, appoint an officer or director, or enroll an existing Member in another activity-specific process.'],
  prerequisites: ['A prospective Member has requested enrollment.', 'The confidential Program Enrollment Form is available for review.', 'The intended initial program and currently authorized chapter/location are known.'],
  beforeYouBegin: ['Have the applicant’s contact information, confidential enrollment-record reference, program choice, required consent, and any selected-program eligibility or safety review available.'],
  outputs: ['Active Member relationship record', 'Approved initial program enrollment', 'Recorded consent and acknowledgment statuses', 'Member record identifier and audit history'],
  exceptions: ['If eligibility, consent, program review, or required participant documentation is incomplete, keep the record pending and do not activate membership.'],
  followUp: ['Use the applicable program or activity workflow for later activity-specific waivers, services, or additional enrollments.', 'Start separate Employee or Volunteer onboarding if the person later enters either relationship; do not convert this Member record.'],
  retention: 'Retain the confidential enrollment/application, consent, approval, and Member record under the Organization Handbook Privacy Policy and REC-SOP-001; this compliance record contains only status and opaque references for protected details.',
  completionCriteria: ['Program eligibility is satisfied.', 'The enrollment application and required participant records are complete.', 'Required guardian consent is verified for a minor.', 'Required agreements and the selected-program review are complete.', 'Membership approval and the Member record ID are recorded.'],
  templateId: 'MEMBER_ONBOARDING_TEMPLATE', creationSection: 'A',
  titleField: { sectionId: 'A', fieldName: 'full_name', label: 'Legal name' },
  source: [{ id: 'ORG-HBK-001', section: 'Member Handbook — Programs' }, { path: 'lost_limb_riders_handbooks/04-Forms-and-Templates/03-Program-Enrollment-Form.md', section: 'Program Enrollment Form' }, { path: 'employees/13-Membership-Coordinator.md', section: 'Primary Responsibilities' }, { id: 'REC-SOP-001', section: 'Restricted and confidential records' }],
  provenanceNote: 'The canonical corpus does not define statutory voting membership or a separate controlled Member lifecycle procedure. This workflow implements the documented participant enrollment, Membership Department processing, consent, and recordkeeping process; “Member” grants no organizational authority.',
  activeSections: ['A', 'B', 'C', 'F', 'I'], workingDocuments: [],
  governingDocuments: [{ id: 'ORG-HBK-001', note: 'Member Handbook and Organization Handbook Privacy Policy' }, { id: 'REC-SOP-001', note: 'Records security and retention' }], referenceDocuments: [],
  lifecycle: [
    {
      id: 'application-intake', label: 'Application and Confidential Intake',
      instructions: 'Receive the canonical Program Enrollment Form. Record contact information needed to administer the relationship, retain protected birth date, address, emergency-contact, limb/disability, accommodation, and health/safety details in the confidential participant record, and place only its opaque reference and completion statuses here. For a minor, obtain parent/legal guardian consent.',
      purpose: 'The application is complete while protected participant details remain outside general compliance-record surfaces.', role: 'Membership Coordinator',
      source: { id: 'ORG-HBK-001', path: 'lost_limb_riders_handbooks/04-Forms-and-Templates/03-Program-Enrollment-Form.md', section: 'Participant Information; Signature and Date' }, sectionsRequired: ['A'], evidenceRequired: true, approvalRequired: false,
      blockingRules: [{ when: { sectionId: 'A', field: 'date_of_birth_record_status', in: ['Completed', 'Verified'] }, message: 'The date of birth must be recorded in the confidential enrollment record.' }, { when: { any: [{ sectionId: 'A', field: 'minor_status', equals: 'No' }, { sectionId: 'A', field: 'guardian_consent_status', equals: 'Verified' }] }, message: 'Verified parent/legal guardian consent is required for a minor.' }],
    },
    {
      id: 'eligibility-program-review', label: 'Eligibility and Initial Program Review',
      instructions: 'Confirm the minimum participant eligibility category and review the applicant against the selected canonical program’s requirements. Record only the eligibility result—not diagnosis or medical history. Confirm required emergency-contact and confidential participant safety information. If Ride Forward is selected, complete its specific eligibility and safety review.',
      purpose: 'Membership and initial program participation are explicit related decisions, without turning the Member record into a medical record.', role: 'Membership Coordinator and applicable Program Coordinator',
      source: { id: 'ORG-HBK-001', path: 'lost_limb_riders_handbooks/04-Forms-and-Templates/03-Program-Enrollment-Form.md', section: 'Program Interest; Participant Background; Emergency Contact; Medical Information' }, sectionsRequired: ['B', 'C'], evidenceRequired: true, approvalRequired: false,
      blockingRules: [{ when: { sectionId: 'C', field: 'eligibility_review_status', in: ['Satisfied', 'Verified'] }, message: 'The selected-program eligibility review must be satisfied.' }, { when: { sectionId: 'C', field: 'program_enrollment_status', equals: 'Approved' }, message: 'The initial program enrollment must be approved.' }, { when: { sectionId: 'C', field: 'emergency_contact_status', in: ['Completed', 'Verified'] }, message: 'The emergency-contact record must be complete.' }, { when: { sectionId: 'C', field: 'participant_safety_record_status', in: ['Completed', 'Verified'] }, message: 'The confidential participant safety information must be complete.' }, { when: { any: [{ sectionId: 'C', field: 'program_area', notEquals: 'Ride Forward Program' }, { sectionId: 'C', field: 'ride_forward_safety_status', in: ['Completed', 'Verified'] }] }, message: 'Ride Forward enrollment requires its eligibility and safety review.' }],
    },
    {
      id: 'agreements-consent', label: 'Agreements and Consent',
      instructions: 'Confirm the signed participant agreement and liability release, selected-program rules, and privacy acknowledgment. Record the participant’s voluntary communication and photo/media choices; declining either optional consent does not block membership.',
      purpose: 'Required participation terms are acknowledged while optional consent remains a real choice.', role: 'Membership Coordinator',
      source: { id: 'ORG-HBK-001', path: 'lost_limb_riders_handbooks/04-Forms-and-Templates/03-Program-Enrollment-Form.md', section: 'Participant Agreement and Liability Release; Consent and Communication' }, sectionsRequired: ['F'], evidenceRequired: true, approvalRequired: false,
      blockingRules: [{ when: { sectionId: 'F', field: 'participant_agreement_status', in: ['Completed', 'Verified'] }, message: 'The signed Program Enrollment Form agreement must be complete.' }, { when: { sectionId: 'F', field: 'liability_release_status', in: ['Completed', 'Verified'] }, message: 'The Participant Release of Liability must be complete.' }],
    },
    {
      id: 'membership-activation', label: 'Membership Review and Activation',
      instructions: 'The Membership Coordinator records the application review, approval reference and date, and unique Member record ID. Successful completion activates only the Member relationship and initial approved program enrollment; it grants no volunteer duties, employment status, governance role, approval authority, representation authority, or system access.',
      purpose: 'Member activation is explicit, auditable, and separate from every other organizational relationship.', role: 'Membership Coordinator under Membership Director oversight',
      source: { id: 'HR-REF-001', path: 'employees/13-Membership-Coordinator.md', section: 'Primary Responsibilities' }, sectionsRequired: ['I'], evidenceRequired: true, approvalRequired: true,
      blockingRules: [{ when: { sectionId: 'I', field: 'membership_review_status', equals: 'Approved' }, message: 'The membership application must be approved before activation.' }],
    },
  ],
};

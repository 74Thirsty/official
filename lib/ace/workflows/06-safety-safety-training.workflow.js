/**
 * @file        06-safety-safety-training.workflow.js
 * @description ACE workflow definition — 06-safety-safety-training
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'safety-training',
  name: 'Safety Training',
  category: 'safety',
  categoryGroup: 'People',
  idPrefix: 'TRN',
  workflowVersion: '1.0',
  summary: 'Determine a participant’s training requirements, complete volunteer orientation and any role-specific training, and certify the participant with a trainer’s sign-off and dated acknowledgment.',
  templateId: 'SAFETY_TRAINING_TEMPLATE',
  creationSection: 'participant',
  titleField: { sectionId: 'participant', fieldName: 'participant_name', label: 'Participant name' },
  source: [{ id: 'RIDEFWD-001', section: 'Ride Forward Program — Volunteer Orientation and Annual Training' }, { id: 'VOL-FORM-008', section: 'Volunteer Safety Training Acknowledgment' }, { id: 'VOL-PROC-001', section: 'Orientation' }, { id: 'VOL-FORM-005', section: 'Volunteer Orientation and Training Record' }],
  activeSections: ['participant', 'orientation', 'specialized', 'acknowledgment'],
  workingDocuments: ['VOL-FORM-008'],
  governingDocuments: [{ id: 'RIDEFWD-001', note: 'Ride Forward — Volunteer Orientation and Annual Training' }, { id: 'VOL-FORM-008', note: 'Volunteer Safety Training Acknowledgment' }, { id: 'VOL-FORM-005', note: 'Volunteer Orientation and Training Record' }],
  referenceDocuments: [],
  lifecycle: [
    {
      id: 'training-required',
      label: 'Training Required',
      instructions: 'Record the participant, their associated role/assignment, and the training that applies to them: the standard Volunteer Orientation (SAF-TRN-001) for all volunteers, plus the specific annual training required for their role (SAF-TRN-002 through SAF-TRN-005 as applicable).',
      purpose: 'Training is scheduled against the required set for the person’s role — not invented per session.',
      role: 'Designated trainer',
      source: { id: 'RIDEFWD-001', section: 'Volunteer Orientation and Annual Training' },
      sectionsRequired: ['participant'],
      evidenceRequired: false,
      approvalRequired: false,
    },
    {
      id: 'volunteer-orientation',
      label: 'Volunteer Orientation',
      instructions: 'Deliver the standard orientation covering the safety topics and organizational procedures required of every volunteer, and record the completion reference (date, trainer, and the orientation/training record).',
      purpose: 'Every volunteer completes the base orientation before any role-specific training or assignment.',
      role: 'Designated trainer',
      source: { id: 'RIDEFWD-001', section: 'Volunteer Orientation' },
      sectionsRequired: ['orientation'],
      evidenceRequired: true,
      approvalRequired: false,
    },
    {
      id: 'specialized-training',
      label: 'Specialized / Annual Training',
      instructions: 'Deliver the participant’s required annual training for their specific role or operation and record the delivery date, content covered, trainer, and any re-training or certification refresher due date.',
      purpose: 'Role-specific hazards are trained, not assumed.',
      role: 'Designated trainer',
      source: { id: 'RIDEFWD-001', section: 'Annual Training' },
      sectionsRequired: ['specialized'],
      evidenceRequired: true,
      approvalRequired: false,
    },
    {
      id: 'certification-acknowledgment',
      label: 'Certification and Acknowledgment',
      instructions: 'The trainer certifies the participant on the completed topics and the participant signs the acknowledgment (VOL-FORM-008) affirming they understand the safety requirements, hazards, reporting, and their right to stop unsafe work. The trainer also signs.',
      purpose: 'Training is only proven by a dated certification and an informed acknowledgment.',
      role: 'Designated trainer',
      source: { id: 'VOL-FORM-008', section: 'Volunteer Safety Training Acknowledgment' },
      sectionsRequired: ['acknowledgment'],
      documentsRequired: [{ documentId: 'VOL-FORM-008', note: 'Safety Training Acknowledgment — signed by participant and trainer' }],
      signaturesRequired: [{ documentId: 'VOL-FORM-008', signatureId: 'participant' }, { documentId: 'VOL-FORM-008', signatureId: 'trainer' }],
      evidenceRequired: true,
      approvalRequired: false,
    },
  ],
};

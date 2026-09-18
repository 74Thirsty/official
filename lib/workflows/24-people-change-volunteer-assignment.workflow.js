/**
 * @file        24-people-change-volunteer-assignment.workflow.js
 * @description ACE workflow definition — 24-people-change-volunteer-assignment
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'change-volunteer-assignment',
  intent: 'Change a Volunteer Assignment',
  domain: 'People',
  idPrefix: 'VOL',
  titleField: { name: 'volunteer_name', label: 'Volunteer Name' },
  summary: 'Document and authorize a material change to a volunteer’s existing assignment: duties, authority, supervisor, location, program, schedule, access, training, or duration. A volunteer may never accrue responsibilities informally until the role no longer resembles the approved assignment.',
  source: [
    { id: 'VOL-PROC-001', section: 'Assignment Changes' },
  ],
  intake: [
    { name: 'volunteer_name', label: 'Volunteer Name', type: 'text', required: true, maxlen: 80 },
    { name: 'volunteer_reference', label: 'Volunteer Reference', type: 'text', required: true, maxlen: 40 },
    { name: 'assignment_reference', label: 'Assignment Reference', type: 'text', required: true, maxlen: 80 },
    { name: 'change_description', label: 'Change Description', type: 'textarea', required: true, maxlen: 2000, help: 'Describe what changed and why' },
    { name: 'changed_by', label: 'Changed By', type: 'text', required: true, maxlen: 80 },
  ],
  requirements: [
    {
      id: 'document-change',
      title: 'Document the Change',
      instructions: 'Record the material change on the Volunteer Assignment Change form (VOL-FORM-010): what changed, why, and the effective date. Changes to duties, authority, supervisor, location, program, schedule, access, training, or duration must be documented.',
      purpose: 'Informal role creep is prevented.',
      role: 'Coordinator / supervisor',
      source: { id: 'VOL-PROC-001', section: 'Assignment Changes' },
      documents: [
        { id: 'VOL-FORM-010', note: 'Assignment Change Record' },
      ],
      evidence: { type: 'TEXT', label: 'Change documented' },
    },
    {
      id: 'confirm-training',
      title: 'Confirm Required Training',
      instructions: 'If the change introduces new duties requiring training, complete the new training before the volunteer performs those duties.',
      purpose: 'A volunteer is never put into a changed role unprepared.',
      role: 'Supervisor / trainer',
      source: { id: 'VOL-PROC-001', section: 'Assignment Changes' },
      documents: [
        { id: 'VOL-FORM-008', note: 'Training Record' },
      ],
      evidence: { type: 'TEXT', label: 'Training confirmed' },
    },
    {
      id: 'authorize-change',
      title: 'Authorize the Changed Assignment',
      instructions: 'Obtain authorization for the changed assignment from the appropriate authority. Record who authorized it and when.',
      purpose: 'Changes to assignment authority require explicit authorization.',
      role: 'Authorized authority',
      source: { id: 'VOL-PROC-001', section: 'Assignment Changes' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Change authorized' },
      approval_required: true,
    },
  ],
};

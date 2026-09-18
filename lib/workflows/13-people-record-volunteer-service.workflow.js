/**
 * @file        13-people-record-volunteer-service.workflow.js
 * @description ACE workflow definition — 13-people-record-volunteer-service
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'record-volunteer-service',
  intent: 'Record Volunteer Service Hours',
  domain: 'People',
  idPrefix: 'VOL',
  titleField: { name: 'volunteer_name', label: 'Volunteer Name' },
  summary: 'Record a volunteer’s participation and hours for an active assignment. Hours are service to the organization, not wages.',
  source: [{ id: 'VOL-PROC-001', section: 'Participation and Hours §' }],
  intake: [
    { name: 'volunteer_name', label: 'Volunteer Name', type: 'text', required: true, maxlen: 80 },
    { name: 'volunteer_reference', label: 'Volunteer ID', type: 'text', required: true, maxlen: 40 },
    { name: 'assignment_reference', label: 'Assignment reference', type: 'text', required: true, maxlen: 80 },
    { name: 'service_date', label: 'Service date', type: 'date', required: true },
    { name: 'activity', label: 'Activity', type: 'text', required: true, maxlen: 200 },
    { name: 'hours', label: 'Hours', type: 'number', required: true, help: 'Total hours this date for this activity.' },
  ],
  requirements: [
    {
      id: 'confirm-assignment',
      title: 'Confirm the Volunteer Has an Active Assignment',
      instructions: 'Confirm the volunteer has an authorized active assignment in the Volunteer Register (VOL-REG-001) with a named supervisor before recording service.',
      purpose: 'Only authorized active assignments are recorded as volunteer service.',
      role: 'Supervisor',
      source: { id: 'VOL-PROC-001', section: 'Authorized Active Assignment §' },
      documents: [{ id: 'VOL-REG-001', note: 'Volunteer Register' }],
      evidence: { type: 'TEXT', label: 'Active assignment confirmed', placeholder: 'Assignment reference and supervisor confirmed.' },
    },
    {
      id: 'record-participation',
      title: 'Record Participation',
      instructions: 'Record the participation on the Volunteer Hours / Participation record (VOL-FORM-009): date, activity, start and end, hours, location, program, supervisor, and notes. Hours are service, not wages.',
      purpose: 'Documented hours give an accurate, audit-ready service record.',
      role: 'Volunteer and supervisor',
      source: { id: 'VOL-PROC-001', section: 'Participation and Hours §' },
      documents: [{ id: 'VOL-FORM-009', note: 'Hours and Participation Record' }],
      evidence: { type: 'TEXT', label: 'Participation recorded', placeholder: 'The completed hours record reference.' },
    },
    {
      id: 'supervisor-confirms',
      title: 'Supervisor Confirms the Hours',
      instructions: 'The assigned supervisor reviews and confirms the recorded hours before they are counted.',
      purpose: 'Recorded hours are verified as service actually performed.',
      role: 'Supervisor',
      source: { id: 'VOL-PROC-001', section: 'Participation and Hours §' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Hours confirmed', placeholder: 'Supervisor confirmation and date.' },
    },
  ],
};

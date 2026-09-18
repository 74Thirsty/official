/**
 * @file        06-people-employee-discipline.workflow.js
 * @description ACE workflow definition — 06-people-employee-discipline
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'discipline-employee',
  intent: 'Take Employee Disciplinary Action',
  domain: 'People',
  idPrefix: 'EMP',
  titleField: { name: 'employee_name', label: 'Employee Name' },
  summary: 'Document and manage employee conduct or performance through the disciplinary process, from documenting the concern through corrective expectations and formal action where warranted.',
  source: [{ id: 'HR-SOP-007', section: 'Performance Review and Discipline SOP' }],
  intake: [
    { name: 'employee_name', label: 'Employee Name', type: 'text', required: true, maxlen: 80 },
    { name: 'employee_reference', label: 'Employee ID (EMP-YYYY-NNN)', type: 'text', required: true, maxlen: 40 },
    { name: 'concern_type', label: 'Type of concern', type: 'select', required: true, options: ['Conduct', 'Performance', 'Attendance / reliability', 'Policy violation', 'Safety', 'Harassment or misconduct allegation', 'Other'] },
    { name: 'initiated_by', label: 'Initiated by', type: 'text', required: true, maxlen: 80 },
  ],
  requirements: [
    {
      id: 'document-concern',
      title: 'Document the Concern',
      instructions: 'Document the specific concern in factual terms: the behavior or performance, dates, and who is involved. Do not include speculation. Record whether this is a repeat of a previously addressed issue.',
      purpose: 'Discipline begins with a factual, dated record — not impressions.',
      role: 'Supervisor',
      source: { id: 'HR-SOP-007', section: 'Performance Review and Discipline SOP' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Concern documented', placeholder: 'Facts, dates, prior issues, and evidence retained.' },
    },
    {
      id: 'discuss-expectations',
      title: 'Set Clear Corrective Expectations',
      instructions: 'Discuss the concern with the employee, clarify the expected standard, and set the corrective expectation in writing: what must change and by when. Record the discussion and the expectation.',
      purpose: 'The employee is told precisely what must change before any formal step.',
      role: 'Supervisor and employee',
      source: { id: 'HR-SOP-007', section: 'Performance Review and Discipline SOP' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Expectations set', placeholder: 'Discussion date, expected change, and deadline.' },
    },
    {
      id: 'monitor-and-escalate',
      title: 'Monitor the Corrective Period and Decide on Formal Action',
      instructions: 'Monitor the corrective period. If the issue is resolved, record the resolution. If not, decide whether formal disciplinary action (HR-FORM-008 Disciplinary Action form) is warranted, and record that decision and its basis. Escalate serious conduct to leadership.',
      purpose: 'Corrective action is proportionate and either resolves the issue or proceeds through documented formal steps.',
      role: 'Supervisor, then leadership as required',
      source: { id: 'HR-SOP-007', section: 'Performance Review and Discipline SOP' },
      documents: [{ id: 'HR-FORM-008', note: 'Disciplinary Action form' }],
      evidence: { type: 'TEXT', label: 'Outcome and decision', placeholder: 'Resolution, or formal action taken with the form reference, or escalation.' },
    },
  ],
};

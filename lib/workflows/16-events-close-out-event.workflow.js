/**
 * @file        16-events-close-out-event.workflow.js
 * @description ACE workflow definition — 16-events-close-out-event
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'close-out-event',
  intent: 'Close Out an Event',
  domain: 'Events',
  idPrefix: 'EVT',
  titleField: { name: 'event_title', label: 'Event Name' },
  summary: 'Close an authorized event: reconcile finances, complete the closeout, update the register, and capture any lessons learned.',
  source: [
    { id: 'EVT-CLOSE-001', section: 'Event Closeout' },
  ],
  intake: [
    { name: 'event_title', label: 'Event Name', type: 'text', required: true, maxlen: 140 },
    { name: 'event_reference', label: 'Event Reference', type: 'text', required: true, maxlen: 40, help: 'The EVT-YYYY-NNN from authorization' },
    { name: 'closed_by', label: 'Closed By', type: 'text', required: true, maxlen: 80 },
  ],
  requirements: [
    {
      id: 'reconcile-finances',
      title: 'Reconcile Event Finances',
      instructions: 'Complete the Event Financial Summary (EVT-FORM-002) comparing the actual results to the authorized budget (EVT-FIN-001). Note variances and explain them.',
      purpose: 'An event closes only when its finances are reconciled.',
      role: 'Events Director / Finance',
      source: { id: 'EVT-CLOSE-001', section: 'Event Closeout' },
      documents: [
        { id: 'EVT-FORM-002', note: 'Event Financial Summary' },
        { id: 'EVT-FIN-001', note: 'Event Financial Feasibility' },
      ],
      evidence: { type: 'TEXT', label: 'Financial reconciliation' },
    },
    {
      id: 'complete-closeout',
      title: 'Complete the Event Closeout Record',
      instructions: 'Complete the Event Closeout record (EVT-CLOSE-001) with the final results, any outstanding obligations, and confirm obligations fully resolved. Confirm registration of lessons learned where applicable.',
      purpose: 'The closeout record captures the actual results and lessons learned.',
      role: 'Events Director',
      source: { id: 'EVT-CLOSE-001', section: 'Event Closeout' },
      documents: [
        { id: 'EVT-CLOSE-001', note: 'Event Closeout' },
      ],
      evidence: { type: 'TEXT', label: 'Closeout record' },
    },
    {
      id: 'update-register',
      title: 'Update the Event Register to Closed',
      instructions: 'Update the event entry in the Event Register (EVT-REG-001) from active to closed, with the closeout date.',
      purpose: 'The register is the final authoritative status.',
      role: 'Events / Records',
      source: { id: 'EVT-CLOSE-001', section: 'Event Closeout' },
      documents: [
        { id: 'EVT-REG-001', note: 'Event Register' },
      ],
      evidence: { type: 'TEXT', label: 'Register updated to closed' },
    },
  ],
};

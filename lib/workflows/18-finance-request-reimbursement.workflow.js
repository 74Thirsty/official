/**
 * @file        18-finance-request-reimbursement.workflow.js
 * @description ACE workflow definition — 18-finance-request-reimbursement
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'request-reimbursement',
  intent: 'Request Reimbursement',
  domain: 'Finance',
  idPrefix: 'EXP',
  workflowVersion: '2.0',
  titleField: { name: 'reimbursement_title', label: 'Reimbursement Request Title' },
  summary: 'Request reimbursement for an out-of-pocket expense incurred for legitimate organizational purposes, through a completed expense report, approval, and payment.',
  purpose: 'Use this workflow when an individual personally paid an authorized Lost Limb Riders expense and is requesting repayment from the organization.',
  whenToUse: ['Use after an individual has paid an organizational expense with personal funds and repayment is requested.'],
  whenNotToUse: ['Do not use for an unpaid vendor invoice, an advance, payroll, or a purchase the organization will pay directly.'],
  prerequisites: ['The expense has already been paid by the requester.', 'The expense has a legitimate organizational business purpose.', 'A receipt or the controlled missing-receipt exception documentation can be provided.'],
  beforeYouBegin: ['Have the itemized receipt or paid invoice, purchase date, amount, business purpose, payment details, allocation, and any prior authorization available.'],
  outputs: ['Approved reimbursement record', 'Supporting evidence package', 'Payment reference', 'Expense-register and reconciliation record'],
  exceptions: ['If an itemized receipt is unavailable, select the missing-receipt option and complete FIN-EXP-004 rather than substituting an unrelated document.'],
  followUp: ['Finance records the payment reference and reconciles the transaction after approval.'],
  retention: 'Retain the expense report, receipt or exception declaration, approval, payment reference, and allocation record under FIN-EXP-002 and the controlled records schedule.',
  source: [
    { id: 'FIN-EXP-002', section: 'Expense Report and Reimbursement Procedure' },
  ],
  intake: [
    { name: 'reimbursement_title', label: 'Reimbursement Request Title', type: 'text', required: true, maxlen: 140 },
    { name: 'requester', label: 'Requester / reimbursement recipient', type: 'text', required: true, maxlen: 80, help: 'Name the individual who paid personally and will receive reimbursement.' },
    { name: 'expense_date', label: 'Expense Date', type: 'date', required: true },
    { name: 'expense_category', label: 'Expense category', type: 'select', required: true, options: ['Supplies', 'Travel', 'Mileage', 'Meals', 'Event expense', 'Program expense', 'Other'], help: 'Choose the category that best describes what was purchased.' },
    { name: 'vendor', label: 'Vendor / payee', type: 'text', required: true, maxlen: 120, help: 'Enter the business or person originally paid by the requester.' },
    { name: 'amount', label: 'Amount (USD)', type: 'number', required: true, help: 'Expense amount in USD' },
    { name: 'business_purpose', label: 'Business Purpose', type: 'textarea', required: true, maxlen: 2000, help: 'Explain what was purchased, why Lost Limb Riders needed it, and the program, event, activity, or organizational need it served.', example: 'Printing 250 outreach brochures for distribution during the September community outreach event.' },
    { name: 'allocation_reference', label: 'Program / event / project allocation', type: 'text', required: true, maxlen: 120, help: 'Identify the program, event, project, or general operating budget that should bear this expense.' },
    { name: 'grant_funded', label: 'Is any part grant-funded or otherwise restricted?', type: 'select', required: true, options: ['Yes', 'No'], help: 'Restricted and grant funds may only be used for their authorized purpose.' },
    { name: 'restricted_fund_reference', label: 'Grant / restricted-fund reference', type: 'text', required: true, maxlen: 120, when: { field: 'grant_funded', equals: 'Yes' }, help: 'Enter the grant or restricted-fund identifier and applicable budget category.' },
    { name: 'prior_authorization', label: 'Prior authorization reference, if required', type: 'text', required: false, maxlen: 160, help: 'Provide the approval or purchase authorization that permitted the expense, when applicable.' },
    { name: 'receipt_available', label: 'Receipt Available', type: 'select', required: true, options: ['Yes', 'No — missing receipt declaration attached'] },
    { name: 'missing_receipt_reason', label: 'Why is the receipt unavailable?', type: 'textarea', required: true, maxlen: 1000, when: { field: 'receipt_available', equals: 'No — missing receipt declaration attached' }, help: 'Explain the missing receipt and complete FIN-EXP-004; this explanation does not replace that controlled declaration.' },
    { name: 'mileage_log_reference', label: 'Mileage log reference', type: 'text', required: true, maxlen: 160, when: { field: 'expense_category', equals: 'Mileage' }, help: 'Provide the completed FIN-EXP-003 reference.' },
  ],
  requirements: [
    {
      id: 'complete-expense-report',
      title: 'Complete the Expense Report',
      instructions: 'Complete the Expense Report (FIN-EXP-001) with all line items, amounts, receipts, and the related program/event/grant IDs. For mileage, complete the Mileage Log (FIN-EXP-003). If a receipt is missing, complete the Missing Receipt Declaration (FIN-EXP-004) with the basis, and note the supervisor exception process.',
      purpose: 'Every expense is documented before reimbursement is paid.',
      role: 'Requester',
      source: { id: 'FIN-EXP-002', section: 'Expense Report and Reimbursement Procedure' },
      documents: [
        { id: 'FIN-EXP-001', note: 'Expense Report' },
        { id: 'FIN-EXP-003', note: 'Mileage Log' },
        { id: 'FIN-EXP-004', note: 'Missing Receipt Declaration' },
      ],
      evidence: { type: 'TEXT', label: 'Expense report completed' },
    },
    {
      id: 'supervisor-approval',
      title: 'Obtain Supervisor Approval',
      instructions: 'The supervisor (who is not the requester) reviews the report for legitimacy, necessity, and compliance with budget and grant terms, and approves.',
      purpose: 'Reimbursement requires approval by someone other than the requester.',
      role: 'Supervisor (not the requester)',
      source: { id: 'FIN-EXP-002', section: 'Expense Report and Reimbursement Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Supervisor approval' },
      approval_required: true,
    },
    {
      id: 'finance-review',
      title: 'Finance Review',
      instructions: 'Finance reviews the expense report for policy, budget, and grant compliance, confirms all required documentation is attached, and records any exceptions.',
      purpose: 'Finance validates that the expense meets organizational rules.',
      role: 'Finance',
      source: { id: 'FIN-EXP-002', section: 'Expense Report and Reimbursement Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Finance review determination' },
    },
    {
      id: 'process-payment',
      title: 'Process Reimbursement Payment',
      instructions: 'Issue the reimbursement per the payment authorization procedure (FIN-PROC-002) and record the payment reference.',
      purpose: 'Reimbursement is paid accurately and traceably.',
      role: 'Finance',
      source: { id: 'FIN-EXP-002', section: 'Expense Report and Reimbursement Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Payment processed' },
    },
    {
      id: 'record-expense-register',
      title: 'Record in the Expense Register',
      instructions: 'Log the reimbursed expense in the expense register (FIN-REG-001) with the EXP ID and confirm reconciliation with the bank.',
      purpose: 'Reimbursement is recorded and reconciled.',
      role: 'Finance',
      source: { id: 'FIN-EXP-002', section: 'Expense Report and Reimbursement Procedure' },
      documents: [
        { id: 'FIN-REG-001', note: 'Expense Register' },
      ],
      evidence: { type: 'TEXT', label: 'Expense registered and reconciled' },
    },
  ],
};

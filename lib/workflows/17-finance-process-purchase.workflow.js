/**
 * @file        17-finance-process-purchase.workflow.js
 * @description ACE workflow definition — 17-finance-process-purchase
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'process-purchase',
  intent: 'Process a Purchase',
  domain: 'Finance',
  idPrefix: 'EXP',
  titleField: { name: 'purchase_title', label: 'Purchase Title' },
  summary: 'Obtain, approve, and complete a purchase of goods or services for a mission need within budget, through a controlled requisition, competitive quotes where required, and approved vendor.',
  source: [
    { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
    { id: 'FIN-FORM-004', section: 'Purchase Requisition' },
  ],
  intake: [
    { name: 'purchase_title', label: 'Purchase Title', type: 'text', required: true, maxlen: 140 },
    { name: 'description', label: 'Description', type: 'textarea', required: true, maxlen: 2000, help: 'What is being purchased and the mission justification' },
    { name: 'vendor', label: 'Vendor', type: 'text', required: true, maxlen: 120 },
    { name: 'estimated_cost', label: 'Estimated Cost (USD)', type: 'number', required: true, help: 'Estimated cost in USD' },
    { name: 'requester', label: 'Requester', type: 'text', required: true, maxlen: 80 },
    { name: 'program_event', label: 'Program / Event', type: 'text', required: true, maxlen: 80, help: 'Program or event this purchase serves' },
  ],
  requirements: [
    {
      id: 'confirm-need',
      title: 'Confirm the Need and Budget',
      instructions: 'Confirm the purchase serves a mission need and is within the approved budget, or is separately approved for unbudgeted items. Record the budget line and program/event.',
      purpose: 'Purchases serve mission and fit budget.',
      role: 'Requester',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Need and budget confirmation' },
    },
    {
      id: 'complete-requisition',
      title: 'Complete the Purchase Requisition',
      instructions: 'Complete the Purchase Requisition form (FIN-FORM-004) with item, quantity, estimated cost, vendor, justification, and program/event. Obtain quotes where the amount is above threshold and not impractical, and document the comparison.',
      purpose: 'The requisition is the controlled starting record.',
      role: 'Requester / department',
      source: { id: 'FIN-FORM-004', section: 'Purchase Requisition' },
      documents: [
        { id: 'FIN-FORM-004', note: 'Purchase Requisition' },
      ],
      evidence: { type: 'TEXT', label: 'Requisition completed' },
    },
    {
      id: 'conflict-check',
      title: 'Run a Conflict Check',
      instructions: 'Confirm no purchase from an interested person without the GOV-POL-004 conflict process. Record the outcome.',
      purpose: 'Conflicts of interest in purchasing are prevented or disclosed.',
      role: 'Requester / Finance',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Conflict check outcome' },
    },
    {
      id: 'approve-requisition',
      title: 'Approve the Requisition',
      instructions: 'Obtain approval per the FIN-CTRL-001 approval matrix, with a different person reviewing than the requester where practical. Record the approving authority and basis.',
      purpose: 'No commitment is made before the correct authority approves.',
      role: 'Per FIN-CTRL-001',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Requisition approval' },
      approval_required: true,
    },
    {
      id: 'receive-goods',
      title: 'Receive and Verify Goods / Services',
      instructions: 'Verify that the goods or services received match the approved order. Note discrepancies immediately. Record who received and when.',
      purpose: 'Verification before payment catches errors.',
      role: 'Requester / receiving staff',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Receipt verification' },
    },
    {
      id: 'record-expense',
      title: 'Record the Purchase and Pay',
      instructions: 'Route to payment authorization (FIN-PROC-002) and process payment per the approval matrix. Log the completed purchase in the expense register (FIN-REG-001) and reconcile to the bank.',
      purpose: 'Purchases are paid, recorded, and reconciled.',
      role: 'Finance',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [
        { id: 'FIN-REG-001', note: 'Expense Register' },
      ],
      evidence: { type: 'TEXT', label: 'Expense recorded and reconciled' },
    },
  ],
};

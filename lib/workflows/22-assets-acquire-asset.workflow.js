/**
 * @file        22-assets-acquire-asset.workflow.js
 * @description ACE workflow definition — 22-assets-acquire-asset
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'acquire-asset',
  intent: 'Acquire an Asset',
  domain: 'Assets',
  idPrefix: 'AST',
  titleField: { name: 'asset_title', label: 'Asset Description' },
  summary: 'Purchase and record an organizational asset through the purchasing procedure, then tag and register it with a custodian in the Asset Register.',
  source: [
    { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
    { id: 'FIN-REG-005', section: 'Asset Register' },
  ],
  intake: [
    { name: 'asset_title', label: 'Asset Description', type: 'text', required: true, maxlen: 140 },
    { name: 'description', label: 'Description', type: 'textarea', required: true, maxlen: 2000 },
    { name: 'estimated_value', label: 'Estimated Value (USD)', type: 'number', required: true, help: 'Estimated value in USD' },
    { name: 'vendor', label: 'Vendor', type: 'text', required: true, maxlen: 120 },
    { name: 'requested_by', label: 'Requested By', type: 'text', required: true, maxlen: 80 },
    { name: 'program_event', label: 'Program / Event', type: 'text', required: true, maxlen: 80, help: 'Program or event this asset serves' },
  ],
  requirements: [
    {
      id: 'confirm-need',
      title: 'Confirm the Asset Need and Budget',
      instructions: 'Confirm the asset serves a mission need and is within the approved budget, or is separately approved. Record the budget line and program/event.',
      purpose: 'Assets are purchased for mission needs, not convenience.',
      role: 'Requesting department',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Need and budget confirmed' },
    },
    {
      id: 'approve-purchase',
      title: 'Approve the Purchase',
      instructions: 'Complete the Purchase Requisition (FIN-FORM-004) and obtain approval per the approval matrix (FIN-CTRL-001). Obtain competitive quotes above threshold and document the comparison.',
      purpose: 'The purchase is authorized before commitment.',
      role: 'Per FIN-CTRL-001',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [
        { id: 'FIN-FORM-004', note: 'Purchase Requisition' },
      ],
      evidence: { type: 'TEXT', label: 'Purchase approved' },
      approval_required: true,
    },
    {
      id: 'receive-asset',
      title: 'Receive and Verify the Asset',
      instructions: 'Receive the asset, verify it against the order, and note any discrepancies immediately.',
      purpose: 'What arrives matches what was ordered.',
      role: 'Receiving / department',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Asset received and verified' },
    },
    {
      id: 'tag-and-record',
      title: 'Tag and Record the Asset',
      instructions: 'Assign the asset a unique identifier, record it in the Asset Register (FIN-REG-005) with its description, value, custodian, date, and related event or program. Process payment through payment authorization (FIN-PROC-002).',
      purpose: 'The asset is traceable from the day it is acquired.',
      role: 'Finance / asset custodian',
      source: { id: 'FIN-REG-005', section: 'Asset Register' },
      documents: [
        { id: 'FIN-REG-005', note: 'Asset Register' },
      ],
      evidence: { type: 'TEXT', label: 'Asset tagged and registered' },
    },
    {
      id: 'file-records',
      title: 'File Purchase Records',
      instructions: 'File the requisition, quotes, invoice, receipt, approval, and payment record together under the EXP transaction ID per the purchasing procedure.',
      purpose: 'The purchase record is retained as a complete package.',
      role: 'Finance / Records',
      source: { id: 'FIN-PROC-001', section: 'Purchasing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Purchase records filed' },
    },
  ],
};

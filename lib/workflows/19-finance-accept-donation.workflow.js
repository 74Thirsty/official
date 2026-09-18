/**
 * @file        19-finance-accept-donation.workflow.js
 * @description ACE workflow definition — 19-finance-accept-donation
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export default {
  id: 'accept-donation',
  intent: 'Accept a Donation',
  domain: 'Finance',
  idPrefix: 'DON',
  titleField: { name: 'donation_title', label: 'Donation Title' },
  summary: 'Receive, record, deposit, acknowledge, and reconcile a donation, distinguishing it from a sponsorship or sale, and tracking any restricted-fund designation.',
  source: [
    { id: 'FUND-PROC-001', section: 'Donation Processing Procedure' },
  ],
  intake: [
    { name: 'donation_title', label: 'Donation Title', type: 'text', required: true, maxlen: 140 },
    { name: 'donor_name', label: 'Donor Name', type: 'text', required: true, maxlen: 120 },
    { name: 'amount', label: 'Amount (USD)', type: 'number', required: true, help: 'Donation amount in USD' },
    { name: 'gift_method', label: 'Gift Method', type: 'select', required: true, options: ['Cash', 'Check', 'Credit/debit card', 'Online', 'In-kind', 'Pledge', 'Matching gift'] },
    { name: 'received_by', label: 'Received By', type: 'text', required: true, maxlen: 80 },
    { name: 'restriction', label: 'Restriction', type: 'text', required: true, maxlen: 500, help: 'Restricted designation, if any, or "Unrestricted"' },
  ],
  requirements: [
    {
      id: 'receive-and-record',
      title: 'Receive and Record the Donation',
      instructions: 'Record the gift method, date, amount, and donor identity. Assign a DON-YYYY-NNN number from the Donation Register (FIN-REG-002). If the gift is restricted, record it in the Restricted Funds Register (FIN-REG-003) per the restricted-fund procedure (FIN-PROC-006).',
      purpose: 'Every donation is recorded when received.',
      role: 'Fundraising / Finance',
      source: { id: 'FUND-PROC-001', section: 'Donation Processing Procedure' },
      documents: [
        { id: 'FIN-REG-002', note: 'Donation Register' },
        { id: 'FIN-REG-003', note: 'Restricted Funds Register' },
      ],
      evidence: { type: 'TEXT', label: 'Donation received and recorded' },
    },
    {
      id: 'count-and-deposit',
      title: 'Count Cash, Endorse Checks, and Deposit',
      instructions: 'Count cash with two people per the cash handling policy (FIN-POL-002). Endorse checks for deposit and deposit per the deposit checklist (FIN-CHK-004).',
      purpose: 'Cash is counted by two people and deposited per schedule.',
      role: 'Finance',
      source: { id: 'FUND-PROC-001', section: 'Donation Processing Procedure' },
      documents: [
        { id: 'FIN-CHK-004', note: 'Donation Deposit Checklist' },
      ],
      evidence: { type: 'TEXT', label: 'Cash counted and deposit made' },
    },
    {
      id: 'acknowledge',
      title: 'Issue Acknowledgment',
      instructions: 'Issue the written acknowledgment (FIN-FORM-006) per the donation acknowledgment procedure (FIN-PROC-005). Gifts of $250 or more require contemporaneous written acknowledgment. For in-kind gifts, attach the In-Kind Donation form (FIN-FORM-008).',
      purpose: 'Donors receive a written acknowledgment, and the wording is accurate.',
      role: 'Fundraising / Finance',
      source: { id: 'FUND-PROC-001', section: 'Donation Processing Procedure' },
      documents: [
        { id: 'FIN-FORM-006', note: 'Donation Acknowledgment' },
        { id: 'FIN-FORM-008', note: 'In-Kind Donation form' },
      ],
      evidence: { type: 'TEXT', label: 'Acknowledgment issued' },
    },
    {
      id: 'post-accounting',
      title: 'Post to the Ledger',
      instructions: 'Post the donation to the ledger and reconcile monthly: donations equal deposits in the bank; restricted funds match FIN-REG-003.',
      purpose: 'Reconciliation prevents errors and fraud.',
      role: 'Finance',
      source: { id: 'FUND-PROC-001', section: 'Donation Processing Procedure' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Ledger posted and reconciled' },
    },
    {
      id: 'update-register',
      title: 'Confirm the Register and Donor Record',
      instructions: 'Confirm the donation register row is accurate and the donor record reflects the gift, contact, and consent per the donor-privacy rules.',
      purpose: 'The register is the authoritative record and the donor is treated correctly.',
      role: 'Finance / Fundraising',
      source: { id: 'FUND-PROC-001', section: 'Donation Processing Procedure' },
      documents: [
        { id: 'FIN-REG-002', note: 'Donation Register' },
      ],
      evidence: { type: 'TEXT', label: 'Register and donor record confirmed' },
    },
  ],
};

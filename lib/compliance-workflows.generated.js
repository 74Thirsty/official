/**
 * @file        compliance-workflows.generated.js
 * @description Generated compliance workflow definitions
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
// GENERATED FILE. Run npm run generate:compliance; do not edit by hand.
export const COMPLIANCE_WORKFLOW_MANIFEST = {
  "schema_version": 1,
  "generated_from": "ADM-REF-002",
  "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
  "source_version": "1.0",
  "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
  "approval_source": {
    "document_id": "FIN-CTRL-001",
    "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md",
    "source_hash": "77851260bd1e4e251963f60b5fe065dd85be18c49c29fc652ca283f27a2d1fc9"
  },
  "workflows": [
    {
      "id": "employee-hire-and-pay",
      "intent": "Employee Hire and Pay",
      "source_section": "3. Employee Hire and Pay",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "HR-FORM-001",
        "HR-REF-001",
        "HR-FORM-005",
        "HR-SOP-003",
        "HR-SOP-002",
        "HR-FORM-002",
        "HR-FORM-003",
        "HR-FORM-004",
        "HR-CHK-002",
        "HR-SOP-004",
        "HR-FORM-006",
        "HR-TIME-001",
        "HR-SOP-005",
        "FIN-PROC-004",
        "FIN-CHK-001",
        "HR-FORM-007",
        "HR-SOP-006",
        "HR-CHK-004",
        "HR-CHK-005",
        "HR-POL-001",
        "GOV-POL-005",
        "HR-REG-001",
        "FIN-REG-004",
        "HR-CHK-003",
        "REC-MATRIX-001"
      ],
      "stages": [
        {
          "id": "employee-hire-and-pay-1",
          "sequence": 1,
          "label": "Position Need",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-2",
          "sequence": 2,
          "label": "Position Authorization (HR-FORM-001)",
          "document_ids": [
            "HR-FORM-001"
          ],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-3",
          "sequence": 3,
          "label": "Job Description (HR-REF-001)",
          "document_ids": [
            "HR-REF-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-4",
          "sequence": 4,
          "label": "Compensation Worksheet (HR-FORM-005)",
          "document_ids": [
            "HR-FORM-005"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-5",
          "sequence": 5,
          "label": "Compensation Approval (HR-SOP-003)",
          "document_ids": [
            "HR-SOP-003"
          ],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": [
            {
              "id": "FIN-CTRL-001-1478A60A88",
              "action": "Insider compensation (founder, officers, directors, key employees)",
              "authority": "Disinterested Board members",
              "condition": "Always (GOV-POL-005)",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-EECEF42939",
              "action": "Employee compensation (non-insider)",
              "authority": "Executive Director",
              "condition": "Per HR-FORM-005",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            }
          ]
        },
        {
          "id": "employee-hire-and-pay-6",
          "sequence": 6,
          "label": "Recruitment (HR-SOP-002)",
          "document_ids": [
            "HR-SOP-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-7",
          "sequence": 7,
          "label": "Application (HR-FORM-002)",
          "document_ids": [
            "HR-FORM-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-8",
          "sequence": 8,
          "label": "Interview (HR-FORM-003)",
          "document_ids": [
            "HR-FORM-003"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-9",
          "sequence": 9,
          "label": "Selection + Conflict Check",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-10",
          "sequence": 10,
          "label": "Offer (HR-FORM-004)",
          "document_ids": [
            "HR-FORM-004"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-11",
          "sequence": 11,
          "label": "Acceptance",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-12",
          "sequence": 12,
          "label": "Onboarding (HR-CHK-002, HR-SOP-004)",
          "document_ids": [
            "HR-CHK-002",
            "HR-SOP-004"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-13",
          "sequence": 13,
          "label": "Payroll Setup (HR-FORM-006)",
          "document_ids": [
            "HR-FORM-006"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-14",
          "sequence": 14,
          "label": "Active Employment",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-15",
          "sequence": 15,
          "label": "Timekeeping (HR-TIME-001, HR-SOP-005)",
          "document_ids": [
            "HR-TIME-001",
            "HR-SOP-005"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-16",
          "sequence": 16,
          "label": "Payroll (FIN-PROC-004, FIN-CHK-001)",
          "document_ids": [
            "FIN-PROC-004",
            "FIN-CHK-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-17",
          "sequence": 17,
          "label": "Performance Review (HR-FORM-007)",
          "document_ids": [
            "HR-FORM-007"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-18",
          "sequence": 18,
          "label": "Separation (HR-SOP-006, HR-CHK-004, HR-CHK-005)",
          "document_ids": [
            "HR-SOP-006",
            "HR-CHK-004",
            "HR-CHK-005"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-19",
          "sequence": 19,
          "label": "Final Payroll",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-20",
          "sequence": 20,
          "label": "Access Revocation",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-21",
          "sequence": 21,
          "label": "Property Return",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "employee-hire-and-pay-22",
          "sequence": 22,
          "label": "Record Retention",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "contractor-engagement-and-payment",
      "intent": "Contractor Engagement and Payment",
      "source_section": "4. Contractor Engagement and Payment",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "CTR-CHK-001",
        "CTR-CHK-002",
        "CTR-FORM-001",
        "CTR-FORM-002",
        "CTR-FORM-003",
        "CTR-FORM-004",
        "CTR-SOP-001",
        "CTR-POL-001",
        "CTR-REG-001",
        "FIN-PROC-002"
      ],
      "stages": [
        {
          "id": "contractor-engagement-and-payment-1",
          "sequence": 1,
          "label": "Business Need",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-2",
          "sequence": 2,
          "label": "Classification Review (CTR-CHK-001)",
          "document_ids": [
            "CTR-CHK-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-3",
          "sequence": 3,
          "label": "Selection",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-4",
          "sequence": 4,
          "label": "Conflict Review",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-5",
          "sequence": 5,
          "label": "W-9 (CTR-CHK-002)",
          "document_ids": [
            "CTR-CHK-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-6",
          "sequence": 6,
          "label": "Written Agreement (CTR-FORM-001)",
          "document_ids": [
            "CTR-FORM-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-7",
          "sequence": 7,
          "label": "Scope of Work (CTR-FORM-002)",
          "document_ids": [
            "CTR-FORM-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-8",
          "sequence": 8,
          "label": "Rate + Approval",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-9",
          "sequence": 9,
          "label": "Work Performed",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-10",
          "sequence": 10,
          "label": "Invoice (CTR-FORM-003)",
          "document_ids": [
            "CTR-FORM-003"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-11",
          "sequence": 11,
          "label": "Verification",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-12",
          "sequence": 12,
          "label": "Payment Authorization (CTR-FORM-004)",
          "document_ids": [
            "CTR-FORM-004"
          ],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-13",
          "sequence": 13,
          "label": "Payment",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-14",
          "sequence": 14,
          "label": "Accounting",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-15",
          "sequence": 15,
          "label": "1099 Review (CTR-SOP-001)",
          "document_ids": [
            "CTR-SOP-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "contractor-engagement-and-payment-16",
          "sequence": 16,
          "label": "Closeout",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "event-lifecycle",
      "intent": "Event Lifecycle",
      "source_section": "5. Event Lifecycle",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "EVT-AUTH-001",
        "EVT-FIN-001",
        "EVT-HR-001",
        "EVT-HR-002",
        "EVT-CHK-001",
        "EVT-FORM-001",
        "EVT-CLOSE-001",
        "EVT-PROC-002",
        "EVT-POL-001",
        "EVT-REG-001",
        "FIN-PROC-008",
        "EVT-REF-001",
        "EVT-FORM-002"
      ],
      "stages": [
        {
          "id": "event-lifecycle-1",
          "sequence": 1,
          "label": "Event Opportunity",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-2",
          "sequence": 2,
          "label": "Event Authorization (EVT-AUTH-001)",
          "document_ids": [
            "EVT-AUTH-001"
          ],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": [
            {
              "id": "FIN-CTRL-001-F72F736E7E",
              "action": "Event acceptance",
              "authority": "Events Director + Executive Director",
              "condition": "Per EVT-AUTH-001; Board for Board-level financial risk",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            }
          ]
        },
        {
          "id": "event-lifecycle-3",
          "sequence": 3,
          "label": "Feasibility (EVT-FIN-001)",
          "document_ids": [
            "EVT-FIN-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-4",
          "sequence": 4,
          "label": "Contract + Insurance + Permits",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-5",
          "sequence": 5,
          "label": "Staffing Plan (EVT-HR-001)",
          "document_ids": [
            "EVT-HR-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-6",
          "sequence": 6,
          "label": "Worker Assignments (EVT-HR-002)",
          "document_ids": [
            "EVT-HR-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-7",
          "sequence": 7,
          "label": "Event Day (EVT-CHK-001)",
          "document_ids": [
            "EVT-CHK-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-8",
          "sequence": 8,
          "label": "Revenue/Expense Logs (EVT-FORM-001/002)",
          "document_ids": [
            "EVT-FORM-001",
            "EVT-FORM-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-9",
          "sequence": 9,
          "label": "Closeout (EVT-CLOSE-001)",
          "document_ids": [
            "EVT-CLOSE-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "event-lifecycle-10",
          "sequence": 10,
          "label": "Postmortem if needed (EVT-PROC-002)",
          "document_ids": [
            "EVT-PROC-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "expense-and-reimbursement",
      "intent": "Expense and Reimbursement",
      "source_section": "6. Expense and Reimbursement",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "FIN-FORM-004",
        "FIN-CTRL-001",
        "FIN-FORM-001",
        "FIN-FORM-002",
        "FIN-FORM-003",
        "FIN-PROC-003",
        "FIN-REG-001",
        "FIN-PROC-002"
      ],
      "stages": [
        {
          "id": "expense-and-reimbursement-1",
          "sequence": 1,
          "label": "Need",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-2",
          "sequence": 2,
          "label": "Purchase Requisition (FIN-FORM-004)",
          "document_ids": [
            "FIN-FORM-004"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-3",
          "sequence": 3,
          "label": "Approval (FIN-CTRL-001)",
          "document_ids": [
            "FIN-CTRL-001"
          ],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": [
            {
              "id": "FIN-CTRL-001-7A97D83925",
              "action": "Routine expense / purchase",
              "authority": "Department Director",
              "condition": "Up to $250 per transaction, within approved budget",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-6627F63E6D",
              "action": "Expense / purchase",
              "authority": "Executive Director",
              "condition": "$250.01 – $1,000",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-BB95192A7F",
              "action": "Expense / purchase",
              "authority": "Finance Committee",
              "condition": "$1,000.01 – $5,000",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-33410D153B",
              "action": "Expense / purchase; unbudgeted long-term obligation; capital asset acquisition",
              "authority": "Board",
              "condition": "Above $5,000 or any unbudgeted long-term obligation",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            }
          ]
        },
        {
          "id": "expense-and-reimbursement-4",
          "sequence": 4,
          "label": "Purchase",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-5",
          "sequence": 5,
          "label": "Receipt",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-6",
          "sequence": 6,
          "label": "Expense Report (FIN-FORM-001) or Mileage Log (FIN-FORM-002)",
          "document_ids": [
            "FIN-FORM-001",
            "FIN-FORM-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-7",
          "sequence": 7,
          "label": "Supervisor Approval",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": [
            {
              "id": "FIN-CTRL-001-7A97D83925",
              "action": "Routine expense / purchase",
              "authority": "Department Director",
              "condition": "Up to $250 per transaction, within approved budget",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-6627F63E6D",
              "action": "Expense / purchase",
              "authority": "Executive Director",
              "condition": "$250.01 – $1,000",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-BB95192A7F",
              "action": "Expense / purchase",
              "authority": "Finance Committee",
              "condition": "$1,000.01 – $5,000",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-33410D153B",
              "action": "Expense / purchase; unbudgeted long-term obligation; capital asset acquisition",
              "authority": "Board",
              "condition": "Above $5,000 or any unbudgeted long-term obligation",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            }
          ]
        },
        {
          "id": "expense-and-reimbursement-8",
          "sequence": 8,
          "label": "Finance Review",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-9",
          "sequence": 9,
          "label": "Payment",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-10",
          "sequence": 10,
          "label": "Accounting",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-11",
          "sequence": 11,
          "label": "Reconciliation",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "expense-and-reimbursement-12",
          "sequence": 12,
          "label": "Retention",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "donation",
      "intent": "Donation",
      "source_section": "7. Donation",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "FIN-PROC-005",
        "FIN-CHK-004",
        "FIN-PROC-006",
        "FIN-REG-002",
        "FIN-REG-003",
        "FUND-POL-001"
      ],
      "stages": [
        {
          "id": "donation-1",
          "sequence": 1,
          "label": "Donation Received",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-2",
          "sequence": 2,
          "label": "Identify Donor",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-3",
          "sequence": 3,
          "label": "Determine Restriction",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-4",
          "sequence": 4,
          "label": "Receipt/Acknowledgment (FIN-PROC-005)",
          "document_ids": [
            "FIN-PROC-005"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-5",
          "sequence": 5,
          "label": "Deposit (FIN-CHK-004)",
          "document_ids": [
            "FIN-CHK-004"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-6",
          "sequence": 6,
          "label": "Accounting",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-7",
          "sequence": 7,
          "label": "Donor Record",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-8",
          "sequence": 8,
          "label": "Restricted Fund Tracking (FIN-PROC-006)",
          "document_ids": [
            "FIN-PROC-006"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "donation-9",
          "sequence": 9,
          "label": "Reconciliation",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "sponsorship",
      "intent": "Sponsorship",
      "source_section": "8. Sponsorship",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "FUND-SPON-001",
        "FUND-FORM-001",
        "FIN-REG-006"
      ],
      "stages": [
        {
          "id": "sponsorship-1",
          "sequence": 1,
          "label": "Prospect",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "sponsorship-2",
          "sequence": 2,
          "label": "Offer",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "sponsorship-3",
          "sequence": 3,
          "label": "Sponsorship Agreement (FUND-SPON-001)",
          "document_ids": [
            "FUND-SPON-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "sponsorship-4",
          "sequence": 4,
          "label": "Payment",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "sponsorship-5",
          "sequence": 5,
          "label": "Deliverables",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "sponsorship-6",
          "sequence": 6,
          "label": "Recognition",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "sponsorship-7",
          "sequence": 7,
          "label": "Tracking (FUND-FORM-001)",
          "document_ids": [
            "FUND-FORM-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "sponsorship-8",
          "sequence": 8,
          "label": "Closeout",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "grant",
      "intent": "Grant",
      "source_section": "9. Grant",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "GRT-FORM-001",
        "GRT-FORM-002",
        "GRT-FORM-003",
        "GRT-FORM-004",
        "GRT-REG-001",
        "FIN-PROC-006"
      ],
      "stages": [
        {
          "id": "grant-1",
          "sequence": 1,
          "label": "Opportunity",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-2",
          "sequence": 2,
          "label": "Eligibility (GRT-FORM-001)",
          "document_ids": [
            "GRT-FORM-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-3",
          "sequence": 3,
          "label": "Application",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-4",
          "sequence": 4,
          "label": "Award",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-5",
          "sequence": 5,
          "label": "Classification",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-6",
          "sequence": 6,
          "label": "Budget (GRT-FORM-002)",
          "document_ids": [
            "GRT-FORM-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-7",
          "sequence": 7,
          "label": "Expenditures",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-8",
          "sequence": 8,
          "label": "Documentation",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-9",
          "sequence": 9,
          "label": "Reporting (GRT-FORM-003)",
          "document_ids": [
            "GRT-FORM-003"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-10",
          "sequence": 10,
          "label": "Program Performance",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "grant-11",
          "sequence": 11,
          "label": "Closeout (GRT-FORM-004)",
          "document_ids": [
            "GRT-FORM-004"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "asset-acquisition-and-disposal",
      "intent": "Asset Acquisition and Disposal",
      "source_section": "10. Asset Acquisition and Disposal",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "FIN-CTRL-001",
        "FIN-REG-005"
      ],
      "stages": [
        {
          "id": "asset-acquisition-and-disposal-1",
          "sequence": 1,
          "label": "Need",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "asset-acquisition-and-disposal-2",
          "sequence": 2,
          "label": "Approval (FIN-CTRL-001)",
          "document_ids": [
            "FIN-CTRL-001"
          ],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": [
            {
              "id": "FIN-CTRL-001-7A97D83925",
              "action": "Routine expense / purchase",
              "authority": "Department Director",
              "condition": "Up to $250 per transaction, within approved budget",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-6627F63E6D",
              "action": "Expense / purchase",
              "authority": "Executive Director",
              "condition": "$250.01 – $1,000",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-BB95192A7F",
              "action": "Expense / purchase",
              "authority": "Finance Committee",
              "condition": "$1,000.01 – $5,000",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            },
            {
              "id": "FIN-CTRL-001-33410D153B",
              "action": "Expense / purchase; unbudgeted long-term obligation; capital asset acquisition",
              "authority": "Board",
              "condition": "Above $5,000 or any unbudgeted long-term obligation",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            }
          ]
        },
        {
          "id": "asset-acquisition-and-disposal-3",
          "sequence": 3,
          "label": "Purchase",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "asset-acquisition-and-disposal-4",
          "sequence": 4,
          "label": "Tag and Record (FIN-REG-005, Asset Register)",
          "document_ids": [
            "FIN-REG-005"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "asset-acquisition-and-disposal-5",
          "sequence": 5,
          "label": "Custodian",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "asset-acquisition-and-disposal-6",
          "sequence": 6,
          "label": "Depreciation/Accounting",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "asset-acquisition-and-disposal-7",
          "sequence": 7,
          "label": "Condition Review",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "asset-acquisition-and-disposal-8",
          "sequence": 8,
          "label": "Disposal Approval",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": true,
          "approval_rules": [
            {
              "id": "FIN-CTRL-001-AC6F479E86",
              "action": "Asset disposal",
              "authority": "Finance Director (Board above threshold)",
              "condition": "Per FIN-REG-005",
              "source_document_id": "FIN-CTRL-001",
              "source_path": "lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md"
            }
          ]
        },
        {
          "id": "asset-acquisition-and-disposal-9",
          "sequence": 9,
          "label": "Disposition",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "asset-acquisition-and-disposal-10",
          "sequence": 10,
          "label": "Proceeds Recorded",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "incident",
      "intent": "Incident",
      "source_section": "11. Incident",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "SFT-FORM-001",
        "SFT-REG-001",
        "SFT-SOP-001",
        "SFT-SOP-002",
        "SFT-CHK-001"
      ],
      "stages": [
        {
          "id": "incident-1",
          "sequence": 1,
          "label": "Incident",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-2",
          "sequence": 2,
          "label": "Immediate Response",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-3",
          "sequence": 3,
          "label": "Incident Report (existing 04-Forms incident form + SFT-FORM-001 cover sheet)",
          "document_ids": [
            "SFT-FORM-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-4",
          "sequence": 4,
          "label": "Incident ID (SFT-REG-001)",
          "document_ids": [
            "SFT-REG-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-5",
          "sequence": 5,
          "label": "Supervisor Review",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-6",
          "sequence": 6,
          "label": "Risk/Insurance Review (SFT-SOP-001)",
          "document_ids": [
            "SFT-SOP-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-7",
          "sequence": 7,
          "label": "Corrective Action (SFT-SOP-002)",
          "document_ids": [
            "SFT-SOP-002"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-8",
          "sequence": 8,
          "label": "Escalation if required (SFT-CHK-001)",
          "document_ids": [
            "SFT-CHK-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "incident-9",
          "sequence": 9,
          "label": "Closeout",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    },
    {
      "id": "volunteer-lifecycle",
      "intent": "Volunteer Lifecycle",
      "source_section": "12. Volunteer Lifecycle",
      "source_document_id": "ADM-REF-002",
      "source_path": "lost_limb_riders_handbooks/transactional_operations/00-START-HERE/TRANSACTION-MAP.md",
      "source_version": "1.0",
      "source_hash": "86704735b2552e21de6a0c3d337577fe8f902083ebfd0d20bf038589608fb501",
      "supporting_document_ids": [
        "VOL-FORM-001",
        "FIN-PROC-003",
        "VOL-POL-001"
      ],
      "stages": [
        {
          "id": "volunteer-lifecycle-1",
          "sequence": 1,
          "label": "Application (existing 04-Forms volunteer application)",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-2",
          "sequence": 2,
          "label": "Screening",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-3",
          "sequence": 3,
          "label": "Orientation",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-4",
          "sequence": 4,
          "label": "Agreement (VOL-FORM-001)",
          "document_ids": [
            "VOL-FORM-001"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-5",
          "sequence": 5,
          "label": "Assignment",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-6",
          "sequence": 6,
          "label": "Service",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-7",
          "sequence": 7,
          "label": "Time Tracking (existing 09-Volunteer-Hours-Tracking form)",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-8",
          "sequence": 8,
          "label": "Expense Reimbursement (FIN-PROC-003)",
          "document_ids": [
            "FIN-PROC-003"
          ],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-9",
          "sequence": 9,
          "label": "Incident Reporting",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-10",
          "sequence": 10,
          "label": "Recognition",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        },
        {
          "id": "volunteer-lifecycle-11",
          "sequence": 11,
          "label": "Separation",
          "document_ids": [],
          "evidence_required": true,
          "approval_required": false,
          "approval_rules": []
        }
      ]
    }
  ]
};

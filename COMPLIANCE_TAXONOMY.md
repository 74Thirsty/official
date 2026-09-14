# ACE Taxonomy Audit

**Audited:** September 7, 2026

**Scope:** The 29 workflow definitions currently implemented in `official` and the operational domains named in the corrective directive.
**Rule:** A category organizes existing controlled workflow definitions. A missing domain is not filled by inventing a workflow.

## Navigation taxonomy

The seven selectable categories are subcategories within four durable parent domains:

| Parent domain | Selectable category | Current workflow coverage |
|---|---|---|
| People Operations | Onboarding | Member, volunteer, and employee onboarding |
| People Operations | Workforce, Volunteers & Contractors | Payroll, compensation, performance, discipline, separation, contractor engagement/payment/reporting, and volunteer assignment/service/change/suspension/end |
| Financial Stewardship | Finance, Procurement & Fundraising | Purchases, reimbursements, contractor payments, donations, and sponsorships |
| Financial Stewardship | Grants & Restricted Funds | Grant pursuit and administration |
| Programs & Service | Events & Programs | Event authorization, execution, reconciliation, and closeout |
| Programs & Service | Safety, Incidents & Risk | Safety training, incident response, insurance/risk review, corrective action, and escalation |
| Organizational Operations | Assets & Equipment | Asset acquisition, custody records, and disposal |

This keeps the launcher compact today and allows new subcategories to be added without displaying every workflow on the engine home.

## Domain coverage determination

| Requested operational domain | Determination |
|---|---|
| Organizational / Board Governance; Organizational Policies | Governance parent domain is warranted when controlled executable workflows are defined; no current workflow definition supports a selectable category. |
| Corporate Records; Records Management | Cross-cutting requirements and registers exist inside current workflows. Dedicated records workflows are a documented gap. |
| Human Resources | Covered under People Operations. |
| Volunteer Management | Covered under People Operations; not duplicated as another top-level domain. |
| Contractor Management; Vendor Management | Contractor lifecycle is covered under People Operations and contractor payment/reporting under Financial Stewardship. General vendor management remains a gap. |
| Finance; Accounting; Expenses; Reimbursements; Banking; Tax Compliance | Finance, expenses, reimbursements, payroll, 1099 review, and transaction accounting are represented. Banking and broader tax workflows remain gaps. |
| Procurement | Purchase workflow is covered under Finance, Procurement & Fundraising. |
| Grants; Restricted Funds | Grant lifecycle is covered; restricted-fund tracking is embedded in grant controls rather than duplicated as a top-level category. |
| Fundraising; Donations | Donation and sponsorship workflows are covered. Additional fundraising methods remain a gap until controlled definitions exist. |
| Programs; Participant / Member Operations | Member onboarding and event operations are represented. General program enrollment/administration remains a gap. |
| Events | Covered under Events & Programs. |
| Safety; Incident Management; Insurance; Risk Management | Safety training and incident lifecycle include insurance review, risk review, escalation, and corrective action. Broader insurance administration remains a gap. |
| Assets; Equipment | Covered under Assets & Equipment. |
| Vehicles; Transportation | Not covered by a current workflow definition. Do not alias asset acquisition into vehicle operations. |
| Facilities | Not covered by a current workflow definition. |
| Information Technology; Cybersecurity; Privacy / Data Protection | Not covered by current workflow definitions. These belong under a future Organizational Operations / Information Governance branch. |
| Communications; Marketing; Intellectual Property | Not covered by current workflow definitions. They should remain separate future subcategories if canonical workflows are approved. |
| Legal / Regulatory Compliance; Government Filings | Cross-cutting references exist, but no dedicated executable workflows are implemented. |
| Partnerships / Agreements | Sponsorship and contractor agreements are covered. General partnership agreements remain a gap. |

## Conclusions

- Existing categories were consolidated into four parent domains without manufacturing unsupported workflows.
- Search spans workflow name, category metadata, summaries, stages, roles, and controlled references.
- Terms such as `vehicle`, `cybersecurity`, or `government filing` correctly return no workflow until canonical definitions exist.
- Governance, records, banking/tax, program administration, vehicles/transportation, facilities, information governance, communications, intellectual property, regulatory filings, and general partnerships are identified expansion areas—not silently claimed as complete.

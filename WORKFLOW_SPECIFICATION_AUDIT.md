# Compliance Workflow Specification Audit

**Audited:** September 7, 2026

**Scope:** All 30 executable workflow definitions in `official`, evaluated against their cited canonical Autobiography sources.

## Audit standard

Every catalog entry is required to expose purpose, use trigger, non-use guidance, prerequisites, preparation, action-specific fields, procedural stages, evidence, approvals where defined, exception direction, completion gates, outputs, follow-up, retention, version, and canonical source provenance. The automated contract in `tests/compliance-engine.test.mjs` fails when any workflow or stage loses that specification baseline.

The execution engine now derives display guidance only from the selected workflow definition and its cited sources. It does not introduce external legal requirements. Fields are classified for the operator as required, conditional, or optional. Conditional fields are enforced by the server only when their declared condition applies.

## Individual workflow review

| Domain | Workflow definitions reviewed | Operational distinction verified |
|---|---|---|
| Grants | `pursue-grant`, `administer-grant` | Opportunity/eligibility/application/decision versus administration of an existing award |
| Member onboarding | `onboard-member` | Member identity, program relationship, acknowledgment, approval, and record creation |
| Volunteer operations | `onboard-volunteer`, `assign-volunteer`, `record-volunteer-service`, `change-volunteer-assignment`, `suspend-volunteer`, `end-volunteer-assignment` | Entry, role authorization, service recording, change, suspension, and closure are separate actions |
| Employment | `hire-employee`, `onboard-employee`, `process-payroll`, `change-compensation`, `performance-review`, `discipline-employee`, `terminate-employee` | Hiring decision, onboarding, pay cycle, compensation change, review, discipline, and separation retain distinct data and gates |
| Contractors | `engage-contractor`, `process-contractor-payment`, `contractor-1099-review` | Engagement authorization, invoice/payment control, and year-end reporting review are separate records |
| Events | `host-event`, `authorize-event`, `close-out-event` | End-to-end event lifecycle, authorization-only, and closeout-only actions remain distinct |
| Safety | `report-incident`, `safety-training` | Incident response/investigation/closure versus role-specific training acknowledgment |
| Finance | `process-purchase`, `request-reimbursement`, `accept-donation`, `execute-sponsorship` | Direct purchasing, repayment of personal funds, gift acceptance, and reciprocal sponsorship are different procedures |
| Assets | `acquire-asset`, `dispose-asset` | Custody creation and disposition authorization/record closure use different requirements |

## Reference-quality workflows

Five materially different definitions establish the schema quality gate:

- `hire-employee`: position, candidate, classification, compensation, funding, supervisor, authorization, recruitment, selection, offer, onboarding, and employee registration.
- `request-reimbursement`: recipient, vendor, expense category, business purpose, allocation, grant/restricted-fund branch, receipt exception, mileage branch, approval, payment, and reconciliation.
- `report-incident`: incident facts, people and witnesses, injury/damage, medical-response branch, law-enforcement branch, immediate response, controlled report, register, review, escalation, corrective action, and closure.
- `pursue-grant`: opportunity, eligibility decision, application, budget and matching-funds branch, approval, submission, award decision, award-only administration stages, reporting, and closeout.
- `onboard-volunteer`: confidential identity/contact references, canonical program/area, controlled location, specifically defined assignment and authority boundaries, named supervisor, minor/guardian branch, risk-triggered screening, participant-driving controls, least-privilege data access, volunteer agreement, acknowledgments, assignment-specific training, approval, register activation, and an Active outcome.

## Data-model determination

The former duplication was caused by storing initiation input in both `creationValues` and `fieldValues[creationSection]`. Schema version 2 stores new-record input only in `fieldValues`. Register interpolation retains read compatibility with schema-version-1 records. The UI renders the same section schema during initiation and later execution; there is no second generic metadata form or competing value model.

## Completion and exception behavior

- Stage completion is calculated from applicable required fields, controlled documents, signatures, evidence, decision rules, and approvals.
- Non-applicable conditional fields and stages are recorded as such rather than forcing irrelevant input.
- A blocked transition lists the specific missing or unresolved requirement.
- Completed, cancelled, and archived records remain non-mutable.
- Workflow and template snapshots preserve the requirements that governed each record at creation.

## Legal and governance boundary

This audit does not add or characterize a statutory obligation. Requirements shown by the engine are organizational controls derived from the Document IDs cited by each workflow. Any future legal or regulatory rule must first be established or incorporated by the authoritative documentation process, then versioned into the executable definition.

## Onboarding field and records classification

The Organization Handbook Privacy Policy and REC-SOP-001 jointly govern onboarding data. The three onboarding definitions are separate schemas even where they reuse renderer components.

| Data | Workflows | Classification / handling |
|---|---|---|
| Relationship type | Employee, volunteer, member | Workflow-derived, immutable internal state |
| Legal/full name, address, phone, email | Applicable relationship workflow | Restricted personnel/member/volunteer data; authenticated operational record only; data minimization applies |
| Program / area | Volunteer, member | Controlled program assignment; employee workflow does not collect it |
| Position, description, provenance | Employee | Internal canonical reference derived from HR-REF-001 and the 42 generated position manuals |
| Chapter / location | Employee | Controlled internal reference; currently only Fort Dodge, Iowa is authorized pending a canonical location register |
| Compensation and hiring authority | Employee | Restricted personnel information / internal approval information; authenticated workflow only |
| DOB, SSN, W-4 contents, I-9 contents, government ID data/images, bank data | Employee | Restricted records. Values and files are prohibited from generic `fieldValues`, APIs, exports, titles, search, audit details, URLs, and browser persistence. They belong only in the separate encrypted, need-to-know HR/payroll records system required by REC-SOP-001. |
| W-4, I-9, identity, work-authorization, DOB/SSN capture, and payroll completion states | Employee | Status-only operational controls; no underlying restricted content |
| Restricted record reference | Employee | Opaque reference only; must not encode PII |
| Signatures and screening evidence | Applicable workflow | Restricted record references/evidence; underlying records remain in the authorized restricted system |

Volunteer Onboarding derives `Volunteer` immutably and contains no employee position, compensation, SSN, W-4, I-9, payroll, or banking fields. Its ten program/area choices are generated from the six canonical program manuals plus the non-duplicative capacities expressly listed in VOL-FORM-004. Canonical policy does not publish a fixed assignment-title taxonomy, so each assignment is defined under VOL-FORM-006 with purpose, duties, boundaries, schedule, reporting, and a named supervisor. Enhanced screening is enforced from assignment risk under VOL-APP-001; it cannot be marked Not Required for vulnerable-person, participant-transport, financial-access, or special-required assignments.

The application currently has no encrypted, role-separated restricted-record provider. Consequently it does not collect or upload underlying SSNs, DOB values, tax forms, I-9 contents, identity documents, or bank information. Employee onboarding orchestrates and gates their completion through status fields and an opaque external record reference without misrepresenting ordinary Vercel KV as compliant restricted storage.

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
- `onboard-volunteer`: identity, role interests, availability, screening, driving branch, approval, register, orientation, and assignment handoff.

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

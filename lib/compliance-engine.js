import { WORKFLOWS, TEMPLATES, WORKFLOW_PROVENANCE, getWorkflow, getTemplate, publicWorkflow, publicTemplate, resolveCategoryGroups, CATEGORY_GROUPS, workflowSourceRevision } from './ace/catalog.js';
import {
  createInstance, saveFieldValues, addEvidence, approveStage, advanceStage,
  createDocumentInstance, saveDocumentFieldValues, applySignature, finalizeDocument,
  cancelInstance, isAceInstance, summarizeInstance, detailInstance, buildInstanceExport,
  validateFieldValues, stageSatisfied, sectionIsSatisfied, findDocumentInstance, documentSignatureApplied,
} from './ace/engine.js';

export {
  WORKFLOWS, TEMPLATES, WORKFLOW_PROVENANCE, getWorkflow, getTemplate,
  publicWorkflow, publicTemplate, resolveCategoryGroups, CATEGORY_GROUPS, workflowSourceRevision,
  createInstance, saveFieldValues, addEvidence, approveStage, advanceStage,
  createDocumentInstance, saveDocumentFieldValues, applySignature, finalizeDocument,
  cancelInstance, isAceInstance, summarizeInstance, detailInstance, buildInstanceExport,
  validateFieldValues, stageSatisfied, sectionIsSatisfied, findDocumentInstance, documentSignatureApplied,
};

export const COMPLIANCE_WORKFLOWS = WORKFLOWS;
export const getComplianceWorkflow = getWorkflow;
export const validateIntake = validateFieldValues;
export const createComplianceTransaction = createInstance;
export const addComplianceEvidence = addEvidence;
export const approveComplianceRequirement = approveStage;
export const advanceComplianceTransaction = advanceStage;
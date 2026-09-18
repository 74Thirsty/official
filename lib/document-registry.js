/**
 * @file        document-registry.js
 * @description Document registry — canonical document metadata
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { DOCUMENT_MANIFEST } from './document-manifest.generated.js';

export const DOCUMENT_SOURCE_REPO = DOCUMENT_MANIFEST.source_repository;
export const DOCUMENT_SOURCE_REVISION = DOCUMENT_MANIFEST.source_revision;
export const DOCUMENT_SOURCE_PATH = `${DOCUMENT_SOURCE_REPO}/blob/${DOCUMENT_SOURCE_REVISION}/`;

export const DOCUMENT_REGISTRY = Object.freeze(DOCUMENT_MANIFEST.documents.map((record) => Object.freeze({
  ...record,
  document_code: record.key,
  domain: record.responsible_area || record.section.split(' / ').at(-1) || 'Documents',
  description: '',
  source_repository: 'Autobiography',
  source_url: `${DOCUMENT_SOURCE_PATH}${record.canonical_path}`,
})));

export function getDocumentRegistry() {
  return DOCUMENT_REGISTRY.map((document) => ({ ...document }));
}

export function getActiveDocuments() {
  return getDocumentRegistry().filter((document) => String(document.status).toLowerCase() === 'active');
}

export function getAccessibleDocuments(authenticated = false) {
  return getActiveDocuments().filter((document) => document.access === 'public' || authenticated);
}

export function classifyDocumentsByDomain(documents = getActiveDocuments()) {
  const groups = new Map();
  for (const document of documents) {
    const section = document.section || document.domain || 'Documents';
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(document);
  }
  return [...groups.entries()].map(([section, items]) => ({ section, items }));
}

export function findDocumentByCode(value) {
  const key = String(value || '').trim();
  return getDocumentRegistry().find((document) => (
    document.key === key
    || document.document_id === key
    || document.canonical_path === key
  )) || null;
}

export function filterDocuments(query = '', documents = getActiveDocuments()) {
  const normalize = (input) => String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const value = normalize(query);
  if (!value) return documents;
  return documents.filter((document) => [
    document.document_id,
    document.document_code,
    document.title,
    document.type,
    document.domain,
    document.section,
    document.responsible_area,
    document.canonical_path,
  ].filter(Boolean).map(normalize).join(' ').includes(value));
}

export function getDocumentIntegrity() {
  const brokenReferences = DOCUMENT_REGISTRY.flatMap((document) => document.references
    .filter((reference) => !reference.resolved)
    .map((reference) => ({
      source_document: document.document_id || document.key,
      source_path: document.canonical_path,
      reference_kind: reference.kind,
      target: reference.target,
    })));
  return {
    source_revision: DOCUMENT_SOURCE_REVISION,
    documents_checked: DOCUMENT_REGISTRY.length,
    references_indexed: DOCUMENT_REGISTRY.reduce((total, document) => total + document.references.length, 0),
    broken_references: brokenReferences,
  };
}

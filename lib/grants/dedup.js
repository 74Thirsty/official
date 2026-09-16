export function buildExternalId(opportunity) {
  return `${opportunity.provider}:${opportunity.providerOpportunityId}`;
}

export function findExisting(opportunities, externalId) {
  return opportunities.find((o) => {
    const eid = o.externalId || buildExternalId(o);
    return eid === externalId;
  }) || null;
}

export function upsertOpportunity(opportunities, fresh, mergeFn) {
  const externalId = buildExternalId(fresh);
  const existing = findExisting(opportunities, externalId);
  if (existing) {
    const merged = mergeFn(existing, fresh);
    merged.externalId = externalId;
    merged.updatedAt = new Date().toISOString();
    return { record: merged, isNew: false };
  }
  fresh.externalId = externalId;
  fresh.status = 'new';
  fresh.screening = null;
  fresh.relevanceScore = null;
  fresh.adminNotes = '';
  fresh.aceInstanceId = null;
  fresh.aceStatus = null;
  fresh.createdAt = new Date().toISOString();
  fresh.updatedAt = fresh.createdAt;
  fresh.retrievedAt = fresh.retrievedAt || new Date().toISOString();
  return { record: fresh, isNew: true };
}

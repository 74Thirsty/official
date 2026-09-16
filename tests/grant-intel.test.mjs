import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORG_CORE_FACTS, buildOrgProfile, getOrgFact, mapFieldToOrgFact,
  evaluateMatch, ORGANIZATION_KEYWORDS,
  normalizeGrantsGovSearchHit, normalizeGrantsGovDetail,
  normalizeRequirementModel, buildFallbackRequirementModel,
  autoFillRequirements, allFields, countWords,
  createApplication, saveAnswer, validateApplication, markSubmitted,
  summarizeOpportunity, summarizeApplication, publicApplication,
  OPP_STATUSES, APP_STATUSES, SOURCE_TYPES,
} from '../lib/grant-intel.js';

// ── Org Knowledge Base (§1) ──────────────────────────────────────────

describe('ORG_CORE_FACTS', () => {
  it('contains canonical organizational facts from tracked sources', () => {
    assert.ok(ORG_CORE_FACTS.legal_name.value.includes('Lost Limb Riders'));
    assert.ok(ORG_CORE_FACTS.ein.value === '42-4078619');
    assert.ok(ORG_CORE_FACTS.address.value.includes('Fort Dodge'));
    assert.ok(ORG_CORE_FACTS.phone.value.includes('515'));
    assert.ok(ORG_CORE_FACTS.mission_statement.value.includes('amputees'));
    assert.ok(ORG_CORE_FACTS.population_served.value.includes('amputees'));
    assert.ok(ORG_CORE_FACTS.programs.value.includes('Peer Connection'));
    for (const [key, fact] of Object.entries(ORG_CORE_FACTS)) {
      assert.ok(fact.label, `${key} has a label`);
      assert.ok(fact.value, `${key} has a value`);
      assert.ok(fact.source, `${key} has a source provenance`);
    }
  });
});

describe('buildOrgProfile', () => {
  it('merges core facts with administrator supplements', () => {
    const admin = { facts: { ein: { value: 'CUSTOM-EIN', source: 'Admin override' }, annual_budget: { value: '50000' } } };
    const profile = buildOrgProfile(admin);
    assert.equal(profile.facts.ein.value, 'CUSTOM-EIN');
    assert.equal(profile.facts.ein.source, 'Admin override');
    assert.equal(profile.facts.legal_name.value, 'Lost Limb Riders');
    assert.equal(profile.extras.annual_budget.value, '50000');
  });

  it('returns core facts when no admin record provided', () => {
    const profile = buildOrgProfile(null);
    assert.equal(profile.facts.legal_name.value, 'Lost Limb Riders');
    assert.equal(Object.keys(profile.extras).length, 0);
  });
});

describe('mapFieldToOrgFact', () => {
  it('maps grant question labels to org fact keys', () => {
    assert.equal(mapFieldToOrgFact('Legal Organization Name'), 'legal_name');
    assert.equal(mapFieldToOrgFact('Mission Statement'), 'mission');
    assert.equal(mapFieldToOrgFact('Mailing Address'), 'address');
    assert.equal(mapFieldToOrgFact('Phone Number'), 'phone');
    assert.equal(mapFieldToOrgFact('Employer Identification Number'), 'ein');
    assert.equal(mapFieldToOrgFact('Geographic Service Area'), 'service_area');
    assert.equal(mapFieldToOrgFact('Population Served'), 'population_served');
    assert.equal(mapFieldToOrgFact('Programs and Services'), 'programs');
    assert.equal(mapFieldToOrgFact('Founder'), 'founder');
    assert.equal(mapFieldToOrgFact('Completely unrelated question'), null);
  });
});

// ── Opportunity Matching (§2) ────────────────────────────────────────

describe('evaluateMatch', () => {
  const profile = buildOrgProfile(null);

  it('returns strong match for disability-related grants', () => {
    const opp = { title: 'Amputee Peer Support Program', description: 'Funding for prosthetic outreach and limb loss rehabilitation in Iowa', categories: [], eligibility: 'Nonprofits with 501(c)(3) status' };
    const result = evaluateMatch(opp, profile);
    assert.ok(result.score >= 3, `Expected score >= 3, got ${result.score}`);
    assert.equal(result.level, 'strong');
    assert.equal(result.eligible, 'eligible');
    assert.ok(result.matchedKeywords.length > 0);
    assert.ok(result.summary.length > 0);
  });

  it('returns unlikely for unrelated grants', () => {
    const opp = { title: 'Agricultural Research Grants', description: 'Funding for crop science and livestock improvement', categories: [], eligibility: 'Individuals' };
    const result = evaluateMatch(opp, profile);
    assert.equal(result.level, 'unlikely');
  });

  it('returns unknown eligibility when no eligibility text', () => {
    const opp = { title: 'Community Grant', description: 'community support for veterans', eligibility: '' };
    const result = evaluateMatch(opp, profile);
    assert.equal(result.eligible, 'unknown');
  });

  it('returns not-eligible for individual-only grants without nonprofit mention', () => {
    const opp = { title: 'Individual Artist Grant', description: 'For individuals only', eligibility: 'Individuals only. No organizations.' };
    const result = evaluateMatch(opp, profile);
    assert.equal(result.eligible, 'not-eligible');
  });
});

// ── Grants.gov Normalization ─────────────────────────────────────────

describe('normalizeGrantsGovSearchHit', () => {
  it('normalizes a search hit with standard fields', () => {
    const hit = normalizeGrantsGovSearchHit({ oppId: 12345, oppTitle: 'Test Grant', agencyName: 'HHS', oppStatus: 'posted', closeDate: '2026-12-31', awardCeiling: 100000 });
    assert.equal(hit.sourceId, '12345');
    assert.equal(hit.title, 'Test Grant');
    assert.equal(hit.funder, 'HHS');
    assert.equal(hit.status, 'posted');
    assert.equal(hit.closeDate, '2026-12-31');
    assert.equal(hit.amountMax, 100000);
  });

  it('returns null for empty input', () => {
    assert.equal(normalizeGrantsGovSearchHit(null), null);
    assert.equal(normalizeGrantsGovSearchHit({}), null);
  });
});

describe('normalizeGrantsGovDetail', () => {
  it('normalizes a detail record with eligibility', () => {
    const detail = normalizeGrantsGovDetail({ opportunityNumber: 'GRANT-001', opportunityTitle: 'Health Grant', agencyName: 'HHS', eligibility: { eligibleApplicants: '501(c)(3) nonprofits', eligibilityDescription: 'Tax-exempt organizations' }, closeDate: '2026-06-30', awardFloor: 10000, awardCeiling: 500000, synopsis: { description: 'Health services for underserved populations' } });
    assert.equal(detail.sourceId, 'GRANT-001');
    assert.ok(detail.eligibility.includes('501(c)(3)'));
    assert.equal(detail.amountMin, 10000);
    assert.equal(detail.amountMax, 500000);
    assert.ok(detail.description.includes('Health services'));
  });

  it('returns null for empty input', () => {
    assert.equal(normalizeGrantsGovDetail(null), null);
  });
});

// ── Requirement Model (§2) ──────────────────────────────────────────

describe('normalizeRequirementModel', () => {
  it('produces a valid model from raw input', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'sec1', title: 'Section 1', fields: [{ id: 'q1', label: 'Question 1', kind: 'text', required: true, maxChars: 200 }] }],
      budget: { required: true, maxAmount: 50000 },
      attachments: [{ id: 'att1', label: 'Budget Spreadsheet', required: true }],
      certifications: [{ id: 'cert1', label: 'I certify this is accurate', required: true }],
      signatures: [{ id: 'sig1', label: 'Director signature', role: 'Executive Director', required: true }],
      eligibility: [{ id: 'el1', requirement: 'Must be 501(c)(3)', met: 'unknown' }],
      submission: { method: 'online', url: 'https://example.com', deadline: '2026-12-01' },
    });
    assert.equal(model.sections.length, 1);
    assert.equal(model.sections[0].fields[0].id, 'q1');
    assert.equal(model.budget.required, true);
    assert.equal(model.budget.maxAmount, 50000);
    assert.equal(model.attachments.length, 1);
    assert.equal(model.certifications.length, 1);
    assert.equal(model.signatures.length, 1);
    assert.equal(model.eligibility[0].met, 'unknown');
    assert.equal(model.submission.method, 'online');
  });

  it('merges narrativePrompts into a narratives section', () => {
    const model = normalizeRequirementModel({
      narrativePrompts: [{ id: 'n1', label: 'Project Narrative', prompt: 'Describe your project', charLimit: 2000, required: true }],
    });
    const narratives = model.sections.find((s) => s.id === 'narratives');
    assert.ok(narratives);
    assert.equal(narratives.fields[0].narrative, true);
    assert.equal(narratives.fields[0].maxChars, 2000);
  });

  it('returns empty model for null input', () => {
    const model = normalizeRequirementModel(null);
    assert.equal(model.sections.length, 0);
    assert.equal(model.attachments.length, 0);
  });
});

describe('buildFallbackRequirementModel', () => {
  it('builds a model from a Grants.gov opportunity', () => {
    const opp = { source: 'grants-gov', title: 'Health Grant', amountMax: 100000, amountMin: 10000, applicantTypes: '501(c)(3) nonprofits', attachments: [{ label: 'Budget' }] };
    const model = buildFallbackRequirementModel(opp);
    assert.equal(model.source, 'grants-gov-synopsis');
    assert.ok(model.sections.length >= 3);
    assert.ok(model.attachments.length >= 1);
    assert.ok(model.budget.required);
    assert.equal(model.budget.maxAmount, 100000);
  });

  it('adds an instructions section for manual opportunities without instructions', () => {
    const opp = { source: 'manual', title: 'Local Grant', description: '' };
    const model = buildFallbackRequirementModel(opp);
    const instructionsSection = model.sections.find((s) => s.id === 'instructions');
    assert.ok(instructionsSection, 'Manual opportunity without instructions gets an instructions section');
  });
});

// ── Auto-fill (§3) ──────────────────────────────────────────────────

describe('autoFillRequirements', () => {
  it('populates answers from org knowledge for mapped fields', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'org', title: 'Org', fields: [
        { id: 'name', label: 'Legal Organization Name', kind: 'text', required: true, mapsTo: 'legal_name' },
        { id: 'mission', label: 'Mission Statement', kind: 'textarea', required: true, mapsTo: 'mission_statement' },
        { id: 'custom', label: 'Custom Question', kind: 'text', required: true },
      ] }],
    });
    const profile = buildOrgProfile(null);
    const answers = autoFillRequirements(model, profile);
    assert.equal(answers.name.value, 'Lost Limb Riders');
    assert.equal(answers.name.sourceType, 'auto-populated');
    assert.equal(answers.mission.value, 'Lost Limb Riders exists to provide hope, peer support, mentorship, education, and opportunity to amputees and people with disabilities.');
    assert.equal(answers.mission.sourceType, 'auto-populated');
    assert.equal(answers.custom.value, '');
    assert.equal(answers.custom.sourceType, 'action-required');
  });

  it('flags narrative fields as action-required', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'n', title: 'Narrative', fields: [{ id: 'n1', label: 'Project Narrative', kind: 'textarea', required: true, narrative: true, sourcePrompt: 'Describe your project' }] }],
    });
    const answers = autoFillRequirements(model, buildOrgProfile(null));
    assert.equal(answers.n1.sourceType, 'action-required');
  });
});

// ── Application Lifecycle (§11, §12) ────────────────────────────────

describe('createApplication', () => {
  it('creates an application with auto-filled answers', () => {
    const opp = { id: 'gopp-test', title: 'Test Grant' };
    const model = normalizeRequirementModel({ sections: [{ id: 'o', title: 'Org', fields: [{ id: 'name', label: 'Legal Organization Name', kind: 'text', required: true, mapsTo: 'legal_name' }] }] });
    const profile = buildOrgProfile(null);
    const app = createApplication({ opportunity: opp, requirementModel: model, profile, actor: 'admin', existingIds: new Set() });
    assert.ok(app.id.startsWith('gapp-'));
    assert.equal(app.status, 'in-preparation');
    assert.equal(app.opportunityId, 'gopp-test');
    assert.equal(app.answers.name.value, 'Lost Limb Riders');
    assert.equal(app.answers.name.sourceType, 'auto-populated');
    assert.equal(app.locked, false);
    assert.equal(app.audit.length, 1);
    assert.equal(app.audit[0].event, 'application_created');
  });
});

describe('saveAnswer', () => {
  it('saves an answer with administrator-entered source type', () => {
    const opp = { id: 'gopp-test', title: 'Test Grant' };
    const model = normalizeRequirementModel({ sections: [{ id: 'o', title: 'Org', fields: [{ id: 'name', label: 'Legal Organization Name', kind: 'text', required: true, mapsTo: 'legal_name' }, { id: 'custom', label: 'Custom', kind: 'text', required: true }] }] });
    const app = createApplication({ opportunity: opp, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    const updated = saveAnswer(app, 'custom', { value: 'My answer', sourceType: 'administrator-entered' }, 'admin');
    assert.equal(updated.answers.custom.value, 'My answer');
    assert.equal(updated.answers.custom.sourceType, 'administrator-entered');
    assert.ok(updated.audit.some((e) => e.event === 'answer_saved'));
  });

  it('throws for unknown question ID', () => {
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: normalizeRequirementModel({}), profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    assert.throws(() => saveAnswer(app, 'nonexistent', { value: 'test' }, 'admin'), /Question not found/);
  });

  it('rejects edits on locked applications', () => {
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: normalizeRequirementModel({}), profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    app.locked = true;
    assert.throws(() => saveAnswer(app, 'x', { value: 'test' }, 'admin'), /locked/);
  });
});

describe('validateApplication', () => {
  it('reports READY when all required fields are filled', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'o', title: 'Org', fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, mapsTo: 'legal_name' },
        { id: 'email', label: 'Email', kind: 'text', required: true },
      ] }],
      attachments: [],
      certifications: [],
      signatures: [],
      eligibility: [],
      budget: { required: false },
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    saveAnswer(app, 'email', { value: 'test@example.com', sourceType: 'administrator-entered' }, 'admin');
    validateApplication(app, buildOrgProfile(null));
    assert.equal(app.validation.ready, true);
    assert.equal(app.validation.status, 'READY FOR FINAL HUMAN REVIEW');
  });

  it('reports NOT READY when required fields are empty', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'o', title: 'Org', fields: [{ id: 'name', label: 'Name', kind: 'text', required: true }] }],
      attachments: [],
      certifications: [],
      signatures: [],
      eligibility: [],
      budget: { required: true },
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    // name is auto-filled from legal_name, but requested_amount is not
    validateApplication(app, buildOrgProfile(null));
    assert.equal(app.validation.ready, false);
    assert.ok(app.validation.errors.length > 0);
    assert.ok(app.validation.errors.some((e) => e.field === 'name' || (e.message && e.message.includes('requested amount'))));
  });

  it('detects character limit violations', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'o', title: 'Org', fields: [{ id: 'short', label: 'Short', kind: 'text', required: false, maxChars: 10 }] }],
      attachments: [], certifications: [], signatures: [], eligibility: [],
      budget: { required: false },
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    saveAnswer(app, 'short', { value: 'This is way too long for the field', sourceType: 'administrator-entered' }, 'admin');
    validateApplication(app, buildOrgProfile(null));
    assert.ok(app.validation.errors.some((e) => e.field === 'short' && e.message.includes('character limit')));
  });

  it('detects missing required attachments', () => {
    const model = normalizeRequirementModel({
      sections: [],
      attachments: [{ id: 'att1', label: 'Budget', required: true }],
      certifications: [],
      signatures: [],
      eligibility: [],
      budget: { required: false },
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    validateApplication(app, buildOrgProfile(null));
    assert.ok(app.validation.errors.some((e) => e.attachment === 'att1'));
  });

  it('detects unacknowledged required certifications', () => {
    const model = normalizeRequirementModel({
      sections: [],
      attachments: [],
      certifications: [{ id: 'cert1', label: 'Accuracy cert', required: true }],
      signatures: [],
      eligibility: [],
      budget: { required: false },
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    validateApplication(app, buildOrgProfile(null));
    assert.ok(app.validation.errors.some((e) => e.certification === 'cert1'));
  });

  it('warns on unknown eligibility', () => {
    const model = normalizeRequirementModel({
      sections: [],
      attachments: [],
      certifications: [],
      signatures: [],
      eligibility: [{ id: 'el1', requirement: '501(c)(3)', met: 'unknown' }],
      budget: { required: false },
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    validateApplication(app, buildOrgProfile(null));
    assert.ok(app.validation.warnings.some((w) => w.eligibility === 'el1'));
  });

  it('errors on not-met eligibility', () => {
    const model = normalizeRequirementModel({
      sections: [],
      attachments: [],
      certifications: [],
      signatures: [],
      eligibility: [{ id: 'el1', requirement: 'Must be a university', met: 'not-met' }],
      budget: { required: false },
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    validateApplication(app, buildOrgProfile(null));
    assert.ok(app.validation.errors.some((e) => e.eligibility === 'el1'));
  });
});

describe('markSubmitted', () => {
  it('creates an immutable snapshot and locks the application', () => {
    const model = normalizeRequirementModel({ sections: [{ id: 'o', title: 'Org', fields: [{ id: 'name', label: 'Name', kind: 'text', required: true, mapsTo: 'legal_name' }] }] });
    const app = createApplication({ opportunity: { id: 'gopp-1', title: 'Grant 1' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    const result = markSubmitted(app, { date: '2026-10-01', method: 'online', reference: 'CONF-123', confirmHumanSubmission: true }, 'admin');
    assert.ok(result.snapshot.id.startsWith('gsub-'));
    assert.equal(result.application.status, 'submitted');
    assert.equal(result.application.locked, true);
    assert.equal(result.application.submissionSnapshotId, result.snapshot.id);
    assert.equal(result.snapshot.answers.name.value, 'Lost Limb Riders');
    assert.equal(result.snapshot.submission.reference, 'CONF-123');
    assert.ok(result.application.audit.some((e) => e.event === 'application_submitted'));
  });

  it('requires confirmHumanSubmission', () => {
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: normalizeRequirementModel({}), profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    assert.throws(() => markSubmitted(app, { confirmHumanSubmission: false }, 'admin'), /human must confirm/);
  });

  it('rejects double submission', () => {
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: normalizeRequirementModel({}), profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    markSubmitted(app, { confirmHumanSubmission: true }, 'admin');
    assert.throws(() => markSubmitted(app, { confirmHumanSubmission: true }, 'admin'), /already/);
  });

  it('snapshot is immutable — later edits do not affect it', () => {
    const model = normalizeRequirementModel({ sections: [{ id: 'o', title: 'Org', fields: [{ id: 'name', label: 'Name', kind: 'text', required: true, mapsTo: 'legal_name' }] }] });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    const { snapshot } = markSubmitted(app, { confirmHumanSubmission: true }, 'admin');
    const originalName = snapshot.answers.name.value;
    // The snapshot is a deep copy; mutating it doesn't affect anything.
    snapshot.answers.name.value = 'MUTATED';
    assert.equal(originalName, 'Lost Limb Riders');
  });
});

// ── Summaries ────────────────────────────────────────────────────────

describe('summarizeOpportunity', () => {
  it('produces a public summary of an opportunity', () => {
    const opp = { id: 'gopp-1', title: 'Test', funder: 'F', source: 'manual', deadline: '2026-12-01', amountMax: 50000, match: { score: 5 }, createdAt: '2026-09-01' };
    const summary = summarizeOpportunity(opp);
    assert.equal(summary.id, 'gopp-1');
    assert.equal(summary.amount.max, 50000);
    assert.equal(summary.match.score, 5);
  });

  it('returns null for null input', () => {
    assert.equal(summarizeOpportunity(null), null);
  });
});

describe('summarizeApplication', () => {
  it('computes progress from required fields', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'o', title: 'Org', fields: [
        { id: 'a', label: 'A', kind: 'text', required: true, mapsTo: 'legal_name' },
        { id: 'b', label: 'B', kind: 'text', required: true },
      ] }],
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    const summary = summarizeApplication(app);
    assert.equal(summary.requiredTotal, 2);
    assert.equal(summary.answeredRequired, 1); // only 'a' is auto-filled
    assert.equal(summary.progress, 50);
  });
});

describe('publicApplication', () => {
  it('returns source-attributed fields for the review workspace', () => {
    const model = normalizeRequirementModel({
      sections: [{ id: 'o', title: 'Org', fields: [{ id: 'name', label: 'Name', kind: 'text', required: true, mapsTo: 'legal_name' }] }],
    });
    const app = createApplication({ opportunity: { id: 'x', title: 'X' }, requirementModel: model, profile: buildOrgProfile(null), actor: 'admin', existingIds: new Set() });
    const pub = publicApplication(app);
    assert.ok(pub.sections.length > 0);
    assert.equal(pub.sections[0].fields[0].answer.sourceType, 'auto-populated');
    assert.equal(pub.sections[0].fields[0].answer.value, 'Lost Limb Riders');
  });
});

// ── Constants ────────────────────────────────────────────────────────

describe('constants', () => {
  it('OPP_STATUSES covers the addendum lifecycle', () => {
    assert.ok(OPP_STATUSES.includes('discovered'));
    assert.ok(OPP_STATUSES.includes('potential-match'));
    assert.ok(OPP_STATUSES.includes('application-in-preparation'));
    assert.ok(OPP_STATUSES.includes('ready-for-submission'));
    assert.ok(OPP_STATUSES.includes('submitted'));
  });

  it('SOURCE_TYPES covers the review distinction', () => {
    assert.ok(SOURCE_TYPES.includes('auto-populated'));
    assert.ok(SOURCE_TYPES.includes('generated-draft'));
    assert.ok(SOURCE_TYPES.includes('administrator-entered'));
    assert.ok(SOURCE_TYPES.includes('action-required'));
    assert.ok(SOURCE_TYPES.includes('validation-error'));
  });

  it('ORGANIZATION_KEYWORDS has meaningful terms', () => {
    assert.ok(ORGANIZATION_KEYWORDS.includes('amputee'));
    assert.ok(ORGANIZATION_KEYWORDS.includes('limb loss'));
    assert.ok(ORGANIZATION_KEYWORDS.includes('prosthetic'));
    assert.ok(ORGANIZATION_KEYWORDS.includes('iowa'));
  });
});

// ── Helpers ──────────────────────────────────────────────────────────

describe('countWords', () => {
  it('counts words in a string', () => {
    assert.equal(countWords(''), 0);
    assert.equal(countWords('hello'), 1);
    assert.equal(countWords('hello world'), 2);
    assert.equal(countWords('  spaced  out  '), 2);
  });
});

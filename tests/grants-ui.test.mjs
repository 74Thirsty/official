import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const html = readFileSync(join(__dirname, '..', 'grants.html'), 'utf8');

// ── Page Structure ───────────────────────────────────────────────────

describe('grants.html page structure', () => {
  it('has the correct title', () => {
    assert.ok(html.includes('<title>Grant Intelligence | Lost Limb Riders</title>'));
  });

  it('has the sticky nav with site brand', () => {
    assert.ok(html.includes('Lost Limb Riders'));
    assert.ok(html.includes('class="brand"'));
  });

  it('has navigation links to all site pages', () => {
    for (const page of ['mission.html', 'events.html', 'media.html', 'community.html', 'documentation.html', 'compliance.html', 'admin.html']) {
      assert.ok(html.includes(`href="${page}"`), `Missing nav link to ${page}`);
    }
  });
});

// ── Auth Gate ────────────────────────────────────────────────────────

describe('auth gate', () => {
  it('has an auth gate div that blocks access', () => {
    assert.ok(html.includes('id="authGate"'));
    assert.ok(html.includes('Sign In Required'));
    assert.ok(html.includes('documentation.html'));
  });

  it('checks sessionStorage for llr-docs-session', () => {
    assert.ok(html.includes("sessionStorage.getItem('llr-docs-session')"));
  });

  it('shows appContainer only when session exists', () => {
    assert.ok(html.includes('id="appContainer"'));
    assert.ok(html.includes('appContainer') && html.includes('display'));
  });

  it('has a logout button that clears session', () => {
    assert.ok(html.includes('navLogout'));
    assert.ok(html.includes("sessionStorage.removeItem('llr-docs-session')"));
  });
});

// ── Dashboard ────────────────────────────────────────────────────────

describe('dashboard', () => {
  it('has metric grid with four stat cards', () => {
    assert.ok(html.includes('id="metricsGrid"'));
    assert.ok(html.includes('Opportunities'));
    assert.ok(html.includes('Potential Matches'));
    assert.ok(html.includes('In Preparation'));
    assert.ok(html.includes('Submitted'));
  });

  it('has five tabs: Discovery, Opportunities, Applications, Submissions, Org Knowledge', () => {
    assert.ok(html.includes('data-tab="discovery"'));
    assert.ok(html.includes('data-tab="opportunities"'));
    assert.ok(html.includes('data-tab="applications"'));
    assert.ok(html.includes('data-tab="submissions"'));
    assert.ok(html.includes('data-tab="org"'));
  });
});

// ── Discovery Tab ────────────────────────────────────────────────────

describe('discovery tab', () => {
  it('has Grants.gov search with keyword and category inputs', () => {
    assert.ok(html.includes('id="searchKeywords"'));
    assert.ok(html.includes('id="searchCategories"'));
    assert.ok(html.includes('id="btnSearch"'));
    assert.ok(html.includes('Search Grants.gov'));
  });

  it('has manual opportunity add form with required title', () => {
    assert.ok(html.includes('id="addTitle"'));
    assert.ok(html.includes('id="addFunder"'));
    assert.ok(html.includes('id="addUrl"'));
    assert.ok(html.includes('id="addDeadline"'));
    assert.ok(html.includes('id="addAmountMin"'));
    assert.ok(html.includes('id="addAmountMax"'));
    assert.ok(html.includes('id="addDescription"'));
    assert.ok(html.includes('id="addEligibility"'));
    assert.ok(html.includes('id="addInstructions"'));
    assert.ok(html.includes('id="btnAddOpp"'));
    assert.ok(html.includes('Add Opportunity Manually'));
  });

  it('has search results container', () => {
    assert.ok(html.includes('id="searchResults"'));
  });
});

// ── Opportunities Tab ────────────────────────────────────────────────

describe('opportunities tab', () => {
  it('has opportunity list container', () => {
    assert.ok(html.includes('id="oppListContainer"'));
  });
});

// ── Applications Tab ─────────────────────────────────────────────────

describe('applications tab', () => {
  it('has application list container', () => {
    assert.ok(html.includes('id="appListContainer"'));
  });
});

// ── Submissions Tab ──────────────────────────────────────────────────

describe('submissions tab', () => {
  it('has submissions list container', () => {
    assert.ok(html.includes('id="subsListContainer"'));
  });
});

// ── Org Knowledge Tab ────────────────────────────────────────────────

describe('org knowledge tab', () => {
  it('has org profile card', () => {
    assert.ok(html.includes('id="orgProfileCard"'));
    assert.ok(html.includes('Org Knowledge'));
  });
});

// ── Opportunity Detail ───────────────────────────────────────────────

describe('opportunity detail section', () => {
  it('has the detail section with back button and container', () => {
    assert.ok(html.includes('id="secOpportunity"'));
    assert.ok(html.includes('id="btnBackOpp"'));
    assert.ok(html.includes('id="oppDetailContainer"'));
  });

  it('has BEGIN GRANT WORKFLOW button', () => {
    assert.ok(html.includes('beginWorkflow()'));
    assert.ok(html.includes('BEGIN GRANT WORKFLOW'));
  });

  it('shows match score, eligibility assessment, and detail boxes', () => {
    assert.ok(html.includes('Match Score'));
    assert.ok(html.includes('Eligibility Assessment'));
  });
});

// ── Application Workspace ────────────────────────────────────────────

describe('application workspace section', () => {
  it('has the workspace section with back button and container', () => {
    assert.ok(html.includes('id="secApplication"'));
    assert.ok(html.includes('id="btnBackApp"'));
    assert.ok(html.includes('id="appWorkspaceContainer"'));
  });

  it('has auto-fill button', () => {
    assert.ok(html.includes('Auto-Fill from Org Knowledge'));
    assert.ok(html.includes('autoFillApp'));
  });

  it('has validation button', () => {
    assert.ok(html.includes('Run Final Validation'));
    assert.ok(html.includes('validateApp'));
  });

  it('has review button', () => {
    assert.ok(html.includes('openReview'));
    assert.ok(html.includes('Review Application'));
  });

  it('has source-attributed field rendering with source badges', () => {
    assert.ok(html.includes('source-auto'));
    assert.ok(html.includes('source-draft'));
    assert.ok(html.includes('source-admin'));
    assert.ok(html.includes('source-required'));
    assert.ok(html.includes('source-error'));
  });

  it('has attachments, certifications, and signatures section', () => {
    assert.ok(html.includes('Attachments, Certifications'));
    assert.ok(html.includes('attachmentStatus'));
    assert.ok(html.includes('certificationsAcknowledged'));
    assert.ok(html.includes('signaturesIdentified'));
  });

  it('saves answers on input change', () => {
    assert.ok(html.includes('data-qid'));
    assert.ok(html.includes('saveFieldAnswer'));
  });
});

// ── Final Review ─────────────────────────────────────────────────────

describe('final review section', () => {
  it('has the review section with back button', () => {
    assert.ok(html.includes('id="secReview"'));
    assert.ok(html.includes('id="btnBackReview"'));
    assert.ok(html.includes('id="reviewContainer"'));
  });

  it('has Ready to Submit area with export, print, and mark-as-submitted', () => {
    assert.ok(html.includes('Ready to Submit'));
    assert.ok(html.includes('exportAppJSON'));
    assert.ok(html.includes('printApp'));
    assert.ok(html.includes('showSubmitForm'));
  });

  it('has submission form with confirmHumanSubmission', () => {
    assert.ok(html.includes('id="submitForm"'));
    assert.ok(html.includes('confirmSubmit'));
    assert.ok(html.includes('confirmHumanSubmission'));
  });

  it('requires user confirmation before recording submission', () => {
    assert.ok(html.includes("confirm('Confirm that you have personally submitted"));
  });

  it('has submission fields: date, method, reference, portal, notes, follow-up', () => {
    assert.ok(html.includes('id="subDate"'));
    assert.ok(html.includes('id="subMethod"'));
    assert.ok(html.includes('id="subRef"'));
    assert.ok(html.includes('id="subPortal"'));
    assert.ok(html.includes('id="subNotes"'));
    assert.ok(html.includes('id="subFollowUp"'));
  });
});

// ── Submissions Tracking ─────────────────────────────────────────────

describe('submissions tracking', () => {
  it('has View Snapshot button for immutable snapshot', () => {
    assert.ok(html.includes('viewSnapshot'));
    assert.ok(html.includes('View Snapshot'));
  });
});

// ── CSS Variables ────────────────────────────────────────────────────

describe('CSS custom properties', () => {
  it('uses the shared :root variables', () => {
    assert.ok(html.includes('--orange'));
    assert.ok(html.includes('--black'));
    assert.ok(html.includes('--charcoal'));
    assert.ok(html.includes('--card'));
    assert.ok(html.includes('--white'));
    assert.ok(html.includes('--muted'));
    assert.ok(html.includes('--line'));
    assert.ok(html.includes('--shadow'));
  });
});

// ── Source Attribution ───────────────────────────────────────────────

describe('source attribution UI', () => {
  it('renders sourceBadge function for the five source types', () => {
    assert.ok(html.includes("'auto-populated'"));
    assert.ok(html.includes("'generated-draft'"));
    assert.ok(html.includes("'administrator-entered'"));
    assert.ok(html.includes("'action-required'"));
    assert.ok(html.includes("'validation-error'"));
  });

  it('displays source badge labels', () => {
    assert.ok(html.includes('Auto-filled'));
    assert.ok(html.includes('Draft'));
    assert.ok(html.includes('Entered'));
    assert.ok(html.includes('Action Required'));
  });
});

// ── Safety — No Auto-Submit ──────────────────────────────────────────

describe('safety — no auto-submit', () => {
  it('submission requires explicit human confirmation', () => {
    assert.ok(html.includes('confirmHumanSubmission: true'));
    assert.ok(html.includes('confirm('));
  });

  it('no fetch with auto-submit in background', () => {
    const autoSubmitPattern = /auto.*submit|submit.*auto|setInterval.*submit/i;
    assert.ok(!autoSubmitPattern.test(html), 'No auto-submit pattern found');
  });
});

// ── Navigation Back Buttons ──────────────────────────────────────────

describe('navigation back buttons', () => {
  it('opportunity detail has back button to opportunities tab', () => {
    assert.ok(html.includes("showTab('subOpportunities')"));
    assert.ok(html.includes('loadOppList'));
  });

  it('application workspace has back button to applications tab', () => {
    assert.ok(html.includes("showTab('subApplications')"));
    assert.ok(html.includes('loadAppList'));
  });

  it('review has back button to application workspace', () => {
    assert.ok(html.includes("show('secApplication')"));
    assert.ok(html.includes('renderAppWorkspace'));
  });
});

// ── Validation Display ───────────────────────────────────────────────

describe('validation display', () => {
  it('shows error and warning containers with correct styling', () => {
    assert.ok(html.includes('validation-errors'));
    assert.ok(html.includes('validation-warnings'));
    assert.ok(html.includes('validation-ok'));
  });

  it('shows ready banner for passed validation', () => {
    assert.ok(html.includes('ready-banner'));
    assert.ok(html.includes('READY FOR FINAL HUMAN REVIEW'));
  });

  it('shows action-required banner for failed validation', () => {
    assert.ok(html.includes('action-required-banner'));
  });
});

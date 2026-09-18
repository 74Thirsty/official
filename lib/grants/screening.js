/**
 * @file        screening.js
 * @description Grant screening — eligibility checks and scoring
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
const LLR_ELIGIBLE_APPLICANT_TYPES = new Set([
  '50', 'nonprofit', 'nonprofits', 'non-profit', 'non-profits',
  'private institutions of higher education',
  'public and state controlled institutions of higher education',
  'independent school districts',
  'public housing authorities/Indian housing authorities',
  'native american tribal organizations',
  'native american tribal governments',
  'city or township governments',
  'special district governments',
  'state governments',
  'county governments',
]);

const LLR_INELIGIBLE_APPLICANT_KEYWORDS = new Set([
  'individuals', 'foreign entities', 'foreign',
]);

const LLR_MISSION_KEYWORDS = [
  'amputee', 'amputees', 'limb difference', 'limb loss',
  'disability', 'disabilities', 'disabled',
  'accessibility', 'accessible',
  'mobility', 'mobile',
  'transportation', 'transit',
  'independence', 'independent living',
  'peer support', 'support group',
  'community health', 'community support',
  'rehabilitation', 'rehab',
  'prosthetic', 'prosthetics', 'orthotic', 'orthotics',
  'adaptive recreation', 'adaptive sport',
  'veteran', 'veterans',
  'physical disability', 'physical disabilities',
  'wheelchair', 'mobility aid', 'mobility device',
  'adaptive', 'adaptation',
];

const GEOGRAPHY_TERMS = [
  'iowa', 'ia', 'midwest', 'united states', 'u.s.', 'nationwide',
  'national', 'all states', 'all 50 states', 'american samoa',
  'guam', 'northern mariana islands', 'puerto rico', 'u.s. virgin islands',
];

function lower(s) { return (s || '').toLowerCase(); }

function textContains(text, keyword) {
  const t = lower(text);
  const k = lower(keyword);
  return t.includes(k);
}

function anyTextContains(texts, keyword) {
  return texts.some((t) => textContains(t, keyword));
}

function extractApplicantTypeDescriptions(opportunity) {
  const types = opportunity.eligibility?.applicantTypes || [];
  return types.map((t) => t.description || '').filter(Boolean);
}

function extractFundingInstrumentDescriptions(opportunity) {
  const instruments = opportunity.fundingInstrument || [];
  return instruments.map((i) => i.description || '').filter(Boolean);
}

function extractFundingCategoryDescriptions(opportunity) {
  const cats = opportunity.fundingCategory || [];
  return cats.map((c) => c.description || '').filter(Boolean);
}

function allDescriptionText(opportunity) {
  return [
    opportunity.synopsis || '',
    opportunity.programDescription || '',
    opportunity.title || '',
    opportunity.issuingAgency || '',
    ...(opportunity.assistanceListings || []).map((a) => a.title || ''),
  ].filter(Boolean);
}

export function screenOpportunity(opportunity, llrContext = {}) {
  const checks = [];
  const hardFails = [];
  const unknowns = [];
  const relevances = [];

  const applicantDescs = extractApplicantTypeDescriptions(opportunity);
  const applicantText = applicantDescs.join(' ').toLowerCase();
  const descs = allDescriptionText(opportunity);
  const fullText = descs.join(' ').toLowerCase();
  const instrumentDescs = extractFundingInstrumentDescriptions(opportunity);
  const categoryDescs = extractFundingCategoryDescriptions(opportunity);

  // --- Hard eligibility gates ---

  // 1. Applicant type exclusion
  if (applicantDescs.length > 0) {
    const hasNonprofit = applicantDescs.some((d) =>
      d.toLowerCase().includes('nonprofit') || d.toLowerCase().includes('non-profit')
    );
    const explicitIneligible = applicantDescs.some((d) => {
      const dl = d.toLowerCase();
      return LLR_INELIGIBLE_APPLICANT_KEYWORDS.has(dl);
    });
    const limitedToSpecific = applicantDescs.length > 0 && !hasNonprofit && applicantDescs.every((d) => {
      const dl = d.toLowerCase();
      return dl.includes('government') || dl.includes('tribal') || dl.includes('education') ||
        dl.includes('hospital') || dl.includes('profit') && !dl.includes('non-profit');
    });

    if (explicitIneligible) {
      hardFails.push({
        rule: 'applicant-type',
        status: 'fail',
        reason: `INELIGIBLE — Applicant types are limited to: ${applicantDescs.join('; ')}.`,
      });
    } else if (limitedToSpecific && !hasNonprofit) {
      hardFails.push({
        rule: 'applicant-type',
        status: 'fail',
        reason: `INELIGIBLE — Applicant types do not appear to include nonprofit organizations: ${applicantDescs.join('; ')}.`,
      });
    } else if (hasNonprofit) {
      checks.push({
        rule: 'applicant-type',
        status: 'pass',
        reason: 'Eligible applicant class includes nonprofit organizations.',
      });
    } else {
      unknowns.push({
        rule: 'applicant-type',
        status: 'unknown',
        reason: 'Applicant type eligibility could not be determined from source data. Human review required.',
      });
    }
  } else {
    unknowns.push({
      rule: 'applicant-type',
      status: 'unknown',
      reason: 'No applicant type information available. Human review required.',
    });
  }

  // 2. Deadline viability
  if (opportunity.closingDate) {
    const closeDate = new Date(opportunity.closingDate);
    const now = new Date();
    if (Number.isFinite(closeDate.getTime())) {
      if (closeDate < now) {
        hardFails.push({
          rule: 'deadline',
          status: 'fail',
          reason: `INELIGIBLE — Application deadline has passed (${opportunity.closingDate}).`,
        });
      } else {
        const daysLeft = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        checks.push({
          rule: 'deadline',
          status: 'pass',
          reason: `Application closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${opportunity.closingDate}).`,
        });
      }
    } else {
      unknowns.push({
        rule: 'deadline',
        status: 'unknown',
        reason: 'Deadline date could not be parsed. Human review required.',
      });
    }
  } else {
    unknowns.push({
      rule: 'deadline',
      status: 'unknown',
      reason: 'No deadline provided in source data. Human review required.',
    });
  }

  // 3. Geography
  const geoText = (opportunity.geographicRestrictions || '').toLowerCase();
  if (geoText) {
    const mentionsIowa = /\biowa\b|\bia\b/.test(geoText);
    const mentionsNationwide = /\bmidwest\b|\bunited states\b|\bu\.s\.\b|\bnationwide\b|\bnational\b|\ball states\b|\ball 50 states\b|\bamerican samoa\b|\bguam\b|\bnorthern mariana islands\b|\bpuerto rico\b|\bu\.s\. virgin islands\b/.test(geoText);
    const isRestrictive = geoText.includes('only') || geoText.includes('restricted') || geoText.includes('limited to') || geoText.includes('exclusive');
    const mentionsSpecificState = /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/.test(geoText);
    const mentionsExclusiveOutside = !mentionsIowa && !mentionsNationwide && (mentionsSpecificState || isRestrictive) && isRestrictive;

    if (mentionsExclusiveOutside) {
      hardFails.push({
        rule: 'geography',
        status: 'fail',
        reason: `INELIGIBLE — Geographic restrictions exclude Iowa: "${opportunity.geographicRestrictions}".`,
      });
    } else if (mentionsIowa || mentionsNationwide) {
      checks.push({
        rule: 'geography',
        status: 'pass',
        reason: 'Geographic eligibility includes Iowa or nationwide.',
      });
    } else {
      unknowns.push({
        rule: 'geography',
        status: 'unknown',
        reason: `Geographic restrictions require human confirmation: "${opportunity.geographicRestrictions}".`,
      });
    }
  } else {
    unknowns.push({
      rule: 'geography',
      status: 'unknown',
      reason: 'No geographic restriction data in source. Human review required.',
    });
  }

  // 4. Cost sharing
  if (opportunity.costSharing === true) {
    unknowns.push({
      rule: 'cost-sharing',
      status: 'unknown',
      reason: 'Source data indicates cost sharing is required. Review match/cost-share terms.',
    });
  } else if (opportunity.costSharing === false) {
    checks.push({
      rule: 'cost-sharing',
      status: 'pass',
      reason: 'No matching requirement identified in source data.',
    });
  } else {
    unknowns.push({
      rule: 'cost-sharing',
      status: 'unknown',
      reason: 'Cost sharing requirement unknown from source data.',
    });
  }

  // --- Relevance assessment ---
  for (const keyword of LLR_MISSION_KEYWORDS) {
    if (anyTextContains(descs, keyword)) {
      relevances.push(keyword);
    }
  }

  // Funding category relevance
  const categoryText = categoryDescs.join(' ').toLowerCase();
  const relevantCategories = ['health', 'transportation', 'housing', 'community services',
    'human services', 'social services', 'employment', 'labor', 'education',
    'arts', 'culture', 'recreation', 'regional development'];
  const matchedCategories = relevantCategories.filter((c) => categoryText.includes(c));
  for (const cat of matchedCategories) {
    relevances.push(`category:${cat}`);
  }

  // Funding instrument check
  const isGrant = instrumentDescs.some((d) => d.toLowerCase().includes('grant'));
  if (isGrant) {
    checks.push({
      rule: 'funding-instrument',
      status: 'pass',
      reason: 'Funding instrument includes grants.',
    });
  }

  // Compute summary
  const hasHardFail = hardFails.length > 0;
  const allUnknown = !hasHardFail && checks.length === 0 && unknowns.length > 0;
  const hasStrongRelevance = relevances.length >= 3;
  const hasModerateRelevance = relevances.length >= 1;

  let overallStatus;
  let explanation;

  if (hasHardFail) {
    overallStatus = 'rejected';
    explanation = hardFails.map((f) => f.reason).join(' ');
  } else if (allUnknown) {
    overallStatus = 'needs-review';
    explanation = 'Insufficient source data for automated screening. Human review required.';
  } else if (hasStrongRelevance) {
    overallStatus = 'potential-match';
    explanation = checks.map((c) => c.reason).join(' ') +
      (unknowns.length ? ' ' + unknowns.map((u) => u.reason).join(' ') : '');
  } else if (hasModerateRelevance) {
    overallStatus = 'needs-review';
    explanation = checks.map((c) => c.reason).join(' ') +
      (unknowns.length ? ' ' + unknowns.map((u) => u.reason).join(' ') : '');
  } else {
    overallStatus = 'needs-review';
    explanation = checks.map((c) => c.reason).join(' ') +
      (unknowns.length ? ' ' + unknowns.map((u) => u.reason).join(' ') : '');
  }

  return {
    overallStatus,
    explanation,
    hardFails,
    checks,
    unknowns,
    relevances,
    screeningVersion: '1.0',
    screenedAt: new Date().toISOString(),
  };
}

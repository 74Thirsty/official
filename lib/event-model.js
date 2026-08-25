import { clean } from './http.js';

export const IDEA_STATUSES = ['pending', 'draft', 'approved', 'rejected'];
export const EVENT_STATUSES = ['published', 'cancelled', 'completed', 'draft', 'rejected'];
export const PUBLIC_STATUSES = ['published'];

export const EVENT_TYPES = {
  ride: 'Ride',
  fundraiser: 'Fundraiser',
  community: 'Community',
  meeting: 'Meeting',
  rally: 'Rally',
};

export const ROLE_TYPES = {
  hosted: 'Hosted by Lost Limb Riders',
  attending: 'Attending',
  partner: 'Partner Event',
  fundraiser: 'Fundraiser',
  outreach: 'Outreach',
  meetup: 'Member Meetup',
  ride: 'Ride',
  support: 'Support/Community',
  educational: 'Educational',
  advocacy: 'Advocacy',
  recruitment: 'Recruitment',
  volunteer: 'Volunteer',
  sponsor: 'Sponsor Event',
  other: 'Other',
};

export const ROLE_TO_CATEGORY = {
  hosted: 'community',
  attending: 'community',
  partner: 'community',
  fundraiser: 'fundraiser',
  outreach: 'rally',
  meetup: 'meeting',
  ride: 'ride',
  support: 'community',
  educational: 'meeting',
  advocacy: 'rally',
  recruitment: 'meeting',
  volunteer: 'meeting',
  sponsor: 'fundraiser',
  other: 'community',
};

export const OUTCOME_FIELDS = [
  'attendance', 'newContacts', 'newMembers', 'volunteerLeads', 'sponsorLeads',
  'donations', 'fundsRaised', 'orgsContacted', 'referrals', 'followUpRequired',
  'photosUrl', 'notes', 'whatWorked', 'whatToChange',
];

export const FORMATIVE_CATEGORIES = {
  membership: { label: 'Membership & Peer Connection', examples: 'Member meetups, peer gatherings, coffee meetups, family gatherings, new-member welcomes' },
  outreach: { label: 'Outreach', examples: 'Community resource fairs, disability-awareness, healthcare outreach, nonprofit networking' },
  fundraising: { label: 'Fundraising', examples: 'Benefit rides, restaurant fundraisers, donation drives, sponsor recruitment' },
  visibility: { label: 'Visibility', examples: 'Motorcycle events, bike nights, community festivals, parades, rallies' },
  orgdev: { label: 'Organizational Development', examples: 'Volunteer recruitment, board meetings, planning sessions, sponsor meetings' },
  education: { label: 'Education & Support', examples: 'Rehabilitation resources, peer-support education, financial-resource sessions' },
};

export function isPubliclyVisible(event) {
  if (event.status && !PUBLIC_STATUSES.includes(event.status)) return false;
  return true;
}

export function normalizeIdeaPayload(payload) {
  return {
    title: clean(payload.title, 200),
    date: clean(payload.date || '', 10),
    endDate: clean(payload.endDate || '', 10),
    time: clean(payload.time || '', 5),
    endTime: clean(payload.endTime || '', 5),
    eventType: clean(payload.eventType || 'community', 30),
    role: clean(payload.role || 'other', 30),
    location: clean(payload.location || '', 200),
    address: clean(payload.address || '', 200),
    city: clean(payload.city || '', 100),
    state: clean(payload.state || '', 50),
    contactPerson: clean(payload.contactPerson || '', 100),
    contactPhone: clean(payload.contactPhone || '', 30),
    contactEmail: clean(payload.contactEmail || '', 100),
    website: clean(payload.website || '', 300),
    registrationUrl: clean(payload.registrationUrl || '', 300),
    socialUrl: clean(payload.socialUrl || '', 300),
    visibility: clean(payload.visibility || 'public', 20),
    registrationRequired: Boolean(payload.registrationRequired),
    cost: clean(payload.cost || '', 50),
    transportationNeeded: Boolean(payload.transportationNeeded),
    accessibilityNotes: clean(payload.accessibilityNotes || '', 300),
    volunteerRequired: Boolean(payload.volunteerRequired),
    volunteerCount: clean(String(payload.volunteerCount || ''), 10),
    volunteerDetails: clean(payload.volunteerDetails || '', 300),
    equipmentNeeded: clean(payload.equipmentNeeded || '', 300),
    boothNeeded: Boolean(payload.boothNeeded),
    promoMaterialsNeeded: clean(payload.promoMaterialsNeeded || '', 300),
    sponsorInvolvement: clean(payload.sponsorInvolvement || '', 300),
    insurancePermitNotes: clean(payload.insurancePermitNotes || '', 300),
    audience: clean(payload.audience || '', 200),
    estimatedCost: clean(payload.estimatedCost || '', 50),
    fundraisingPotential: clean(payload.fundraisingPotential || '', 20),
    outreachPotential: clean(payload.outreachPotential || '', 20),
    membershipValue: clean(payload.membershipValue || '', 20),
    rationale: clean(payload.rationale || '', 500),
    sourceUrl: clean(payload.sourceUrl || '', 500),
    source: clean(payload.source || 'manual', 30),
    scores: payload.scores || {},
  };
}

export function ideaToEvent(idea) {
  const category = ROLE_TO_CATEGORY[idea.role] || idea.eventType || 'community';
  return {
    id: 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
    title: idea.title,
    date: idea.date,
    endDate: idea.endDate || '',
    time: idea.time,
    category,
    location: idea.location || [idea.city, idea.state].filter(Boolean).join(', '),
    description: [idea.rationale, idea.audience ? 'Audience: ' + idea.audience : ''].filter(Boolean).join(' '),
    status: 'published',
    source: idea.source || 'ai-generated',
    ideaId: idea.id || '',
    createdAt: new Date().toISOString(),
  };
}

export function validateIdea(idea) {
  if (!idea.title || !idea.title.trim()) return 'Title is required.';
  return null;
}

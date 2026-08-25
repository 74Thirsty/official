import { FORMATIVE_CATEGORIES } from './event-model.js';

const STORY_SYSTEM = `You are a fiction writer for Lost Limb Riders, an organization supporting limb-loss amputees and their families through motorcycle community, peer support, and outreach.

Write original fictional stories that feel human, specific, and emotionally authentic. Each story must feature a protagonist navigating life with limb loss — but amputation must not be their entire identity. People should have personalities, relationships, jobs, hobbies, fears, humor, mistakes, and goals.

Quality rules:
- Specific human details, believable dialogue, earned resolution
- Hopeful without being artificial or cliché
- Respectful and appropriate for the limb-loss community
- No fabricated claims about real members
- No recycled internet stories
- No obvious AI patterns (no "embarked on a journey", no "tapestry", no unnecessary adjectives)
- Focus on human experience, not medical terminology
- 600-1000 words

Return valid JSON with these fields: title, text (the story as paragraphs separated by \\n\\n), character (object with name, ageRange, occupation, background, limbLossCircumstances), setting, primaryConflict, secondaryConflict, theme, emotionalBeats (array), plotStructure, resolution, keyDetails (array), keywords (array).`;

const IDEAS_SYSTEM = `You are an event strategist for Lost Limb Riders, an organization supporting limb-loss amputees through motorcycle community, peer support, and outreach.

Generate practical event recommendations for a formative-stage organization building membership, visibility, and fundraising capacity in Fort Dodge, Iowa and surrounding areas.

Each recommendation MUST explain WHY this specific event could benefit the organization and include a rationale paragraph.

Score each recommendation 1-5 on: outreach, membership, fundraising, sponsor, visibility.

Categories and examples:
${Object.entries(FORMATIVE_CATEGORIES).map(([k, v]) => `${v.label}: ${v.examples}`).join('\n')}

Return valid JSON: { "ideas": [ { title, eventType, role, date (suggest near-future date or empty), time, location, city, state, audience, estimatedCost, fundraisingPotential, outreachPotential, membershipValue, rationale (2-3 sentences explaining why), scores: { outreach, membership, fundraising, sponsor, visibility } } ] }`;

export function buildStoryPrompt(params = {}, historySummary = 'No previous stories.') {
  let constraints = `Previous stories for reference (AVOID repetition in characters, occupations, themes, settings, conflicts, and resolutions):\n${historySummary}\n\n`;

  if (params.theme) constraints += `Theme: ${params.theme}\n`;
  if (params.tone) constraints += `Emotional tone: ${params.tone}\n`;
  if (params.characterType) constraints += `Character type: ${params.characterType}\n`;
  if (params.setting) constraints += `Setting: ${params.setting}\n`;
  if (params.challenge) constraints += `Challenge/focus: ${params.challenge}\n`;
  if (params.motorcycleRelated) constraints += 'Include motorcycle/motorcycle community elements.\n';
  if (params.familyFocused) constraints += 'Focus on family relationships.\n';
  if (params.peerSupportFocused) constraints += 'Focus on peer-support dynamics.\n';
  if (params.recoveryFocused) constraints += 'Focus on recovery/resilience journey.\n';

  if (!params.theme && !params.tone && !params.characterType) {
    constraints += 'Select all parameters intelligently. Make this story substantially different from the examples above. Surprise the reader.\n';
  }

  return constraints + '\nWrite the complete story now as valid JSON.';
}

export function buildIdeasPrompt(existingEvents = []) {
  const eventSummary = existingEvents.length > 0
    ? existingEvents.slice(0, 15).map(e => `- ${e.title} (${e.date}, ${e.category}, ${e.location || 'TBD'})`).join('\n')
    : 'No events currently in the calendar.';

  return `Existing calendar events (AVOID duplicating these):\n${eventSummary}\n\nGenerate 3 event recommendations that complement the existing calendar. Choose events from different categories. Be specific to the Fort Dodge, Iowa area and surrounding communities.\n\nReturn the JSON now.`;
}

export function parseStoryResponse(data) {
  if (!data || typeof data !== 'object') return null;
  if (!data.title) return null;
  if (!data.text && data.story) data.text = data.story;
  if (!data.text) return null;
  if (data.character_type && !data.character) {
    data.character = { name: '', occupation: data.character_type, background: '', limbLossCircumstances: '' };
  }
  if (data.emotional_tone && !data.emotionalBeats) data.emotionalBeats = [data.emotional_tone];
  return data;
}

export function parseIdeasResponse(data) {
  if (!data) return null;
  let arr;
  if (Array.isArray(data) && data.length) {
    arr = data;
  } else if (Array.isArray(data?.ideas) && data.ideas.length) {
    arr = data.ideas;
  } else {
    const firstArrayKey = Object.keys(data).find(k => Array.isArray(data[k]) && data[k].length);
    if (firstArrayKey) arr = data[firstArrayKey];
  }
  if (!arr || !arr.length) return null;
  return arr.filter(i => i && (i.title || i.name));
}

const THEME_OPTIONS = ['resilience', 'second chances', 'community', 'family', 'courage', 'belonging', 'starting over', 'mentorship', 'friendship', 'trust'];
const TONE_OPTIONS = ['warm', 'reflective', 'hopeful', 'bittersweet', 'determined', 'humorous', 'quietly powerful'];
const CHARACTER_OPTIONS = ['veteran', 'young adult', 'parent', 'retiree', 'college student', 'skilled tradesperson', 'athlete', 'artist', 'teacher', 'small-business owner'];
const SETTING_OPTIONS = ['small-town Iowa', 'motorcycle rally', 'workshop', 'coffee shop', 'hospital rehab', 'family kitchen', 'community fair', 'riding trail', 'neighborhood block party', 'garage'];

export function pickSurpriseParams() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  return {
    theme: pick(THEME_OPTIONS),
    tone: pick(TONE_OPTIONS),
    characterType: pick(CHARACTER_OPTIONS),
    setting: pick(SETTING_OPTIONS),
    motorcycleRelated: Math.random() > 0.5,
    familyFocused: Math.random() > 0.5,
    peerSupportFocused: Math.random() > 0.5,
  };
}

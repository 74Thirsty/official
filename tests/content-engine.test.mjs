import test from 'node:test';
import assert from 'node:assert/strict';
import { isPubliclyVisible, normalizeIdeaPayload, ideaToEvent, validateIdea, ROLE_TO_CATEGORY, OUTCOME_FIELDS } from '../lib/event-model.js';
import { normalizeStoryMeta, wordCount, renderStoryWithDisclosure, similarityFlags, buildHistorySummary, DISCLOSURE_TEXT } from '../lib/story-model.js';
import { buildStoryPrompt, buildIdeasPrompt, parseStoryResponse, parseIdeasResponse, pickSurpriseParams } from '../lib/generation.js';
import { buildDiscordPayload } from '../lib/notify.js';
import { aiConfigured } from '../lib/ai.js';
import { buildNewsletter } from '../lib/newsletter.js';

// --- Event model ---

test('isPubliclyVisible: events without status are visible (legacy compat)', () => {
  assert.ok(isPubliclyVisible({ id: 'e1', title: 'Test' }));
});

test('isPubliclyVisible: published events are visible', () => {
  assert.ok(isPubliclyVisible({ id: 'e2', status: 'published' }));
});

test('isPubliclyVisible: cancelled events are hidden', () => {
  assert.equal(isPubliclyVisible({ id: 'e3', status: 'cancelled' }), false);
});

test('isPubliclyVisible: draft, rejected, completed events are hidden', () => {
  assert.equal(isPubliclyVisible({ status: 'draft' }), false);
  assert.equal(isPubliclyVisible({ status: 'rejected' }), false);
  assert.equal(isPubliclyVisible({ status: 'completed' }), false);
});

test('normalizeIdeaPayload cleans and defaults fields', () => {
  const idea = normalizeIdeaPayload({ title: '  Test Event  ', date: '2026-09-01', role: 'fundraiser', rationale: 'Great outreach' });
  assert.equal(idea.title, 'Test Event');
  assert.equal(idea.date, '2026-09-01');
  assert.equal(idea.role, 'fundraiser');
  assert.equal(idea.source, 'manual');
  assert.equal(typeof idea.scores, 'object');
});

test('validateIdea rejects missing title', () => {
  assert.ok(validateIdea({ title: '' }));
  assert.ok(validateIdea({ title: '   ' }));
  assert.equal(validateIdea({ title: 'Valid Event' }), null);
});

test('ideaToEvent produces a published event with correct category mapping', () => {
  const idea = normalizeIdeaPayload({ title: 'Charity Ride', date: '2026-09-15', role: 'ride', location: 'Fort Dodge, IA', rationale: 'Fundraiser ride' });
  const event = ideaToEvent(idea);
  assert.equal(event.status, 'published');
  assert.equal(event.category, 'ride');
  assert.equal(event.title, 'Charity Ride');
  assert.ok(event.id.startsWith('ev-'));
  assert.ok(event.createdAt);
});

test('ideaToEvent maps outreach role to rally category', () => {
  const idea = normalizeIdeaPayload({ title: 'Resource Fair', role: 'outreach' });
  assert.equal(ideaToEvent(idea).category, 'rally');
});

test('ideaToEvent maps fundraiser role to fundraiser category', () => {
  const idea = normalizeIdeaPayload({ title: 'Pancake Breakfast', role: 'fundraiser' });
  assert.equal(ideaToEvent(idea).category, 'fundraiser');
});

// --- Story model ---

test('wordCount counts words correctly', () => {
  assert.equal(wordCount('Hello world'), 2);
  assert.equal(wordCount('One two three four five'), 5);
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount(null), 0);
});

test('renderStoryWithDisclosure includes title, paragraphs, and disclosure', () => {
  const story = { title: 'Test Story', text: 'Paragraph one.\n\nParagraph two.' };
  const html = renderStoryWithDisclosure(story);
  assert.ok(html.includes('Test Story'));
  assert.ok(html.includes('Paragraph one.'));
  assert.ok(html.includes('Paragraph two.'));
  assert.ok(html.includes(DISCLOSURE_TEXT));
  assert.ok(html.includes('fictional'));
});

test('renderStoryWithDisclosure escapes HTML in story content', () => {
  const story = { title: 'XSS <script>alert(1)</script>', text: 'Content with <b>bold</b>' };
  const html = renderStoryWithDisclosure(story);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;'));
});

test('normalizeStoryMeta provides defaults for all fields', () => {
  const meta = normalizeStoryMeta({ id: 'st-1', title: 'Story', text: 'The text' });
  assert.equal(meta.id, 'st-1');
  assert.equal(meta.text, 'The text');
  assert.equal(meta.status, 'pending');
  assert.equal(typeof meta.character, 'object');
  assert.ok(Array.isArray(meta.emotionalBeats));
  assert.ok(Array.isArray(meta.keywords));
});

test('similarityFlags detects overlapping names and themes', () => {
  const candidate = {
    character: { name: 'Mike', occupation: 'Welder' },
    theme: 'resilience',
    setting: 'Iowa',
    keywords: ['motorcycle', 'family'],
  };
  const existing = [
    { character: { name: 'Mike', occupation: 'Teacher' }, theme: 'resilience', setting: 'Iowa', keywords: ['motorcycle'] },
  ];
  const flags = similarityFlags(candidate, existing);
  assert.ok(flags.names >= 1, 'should detect name overlap');
  assert.ok(flags.themes >= 1, 'should detect theme overlap');
  assert.ok(flags.keywords >= 1, 'should detect keyword overlap');
});

test('similarityFlags returns zero for different stories', () => {
  const candidate = { character: { name: 'Alice', occupation: 'Doctor' }, theme: 'hope', setting: 'City', keywords: ['urban'] };
  const existing = [{ character: { name: 'Bob', occupation: 'Teacher' }, theme: 'resilience', setting: 'Rural', keywords: ['rural'] }];
  const flags = similarityFlags(candidate, existing);
  assert.equal(flags.names, 0);
  assert.equal(flags.themes, 0);
});

test('buildHistorySummary produces readable summary', () => {
  const stories = [
    { title: 'First Story', character: { name: 'Mike', occupation: 'Welder' }, theme: 'resilience', setting: 'Fort Dodge' },
    { title: 'Second Story', character: { name: 'Sarah', occupation: 'Teacher' }, theme: 'community', setting: 'Des Moines' },
  ];
  const summary = buildHistorySummary(stories);
  assert.ok(summary.includes('First Story'));
  assert.ok(summary.includes('Mike'));
  assert.ok(summary.includes('Second Story'));
});

test('buildHistorySummary handles empty array', () => {
  assert.ok(buildHistorySummary([]).includes('No previous'));
});

// --- Generation ---

test('buildStoryPrompt includes history and default surprise params', () => {
  const prompt = buildStoryPrompt({ theme: 'resilience' }, '- "Story One": Mike, Welder');
  assert.ok(prompt.includes('resilience'));
  assert.ok(prompt.includes('Story One'));
  assert.ok(prompt.includes('JSON'));
});

test('buildIdeasPrompt includes existing events summary', () => {
  const events = [{ title: 'Charity Ride', date: '2026-09-01', category: 'ride', location: 'Fort Dodge' }];
  const prompt = buildIdeasPrompt(events);
  assert.ok(prompt.includes('Charity Ride'));
  assert.ok(prompt.includes('AVOID'));
});

test('parseStoryResponse validates required fields', () => {
  assert.ok(parseStoryResponse({ title: 'T', text: 'Content', character: {} }));
  assert.equal(parseStoryResponse(null), null);
  assert.equal(parseStoryResponse({ title: 'T' }), null);
  assert.equal(parseStoryResponse({ text: 'Content' }), null);
});

test('parseIdeasResponse filters valid ideas', () => {
  const result = parseIdeasResponse({ ideas: [
    { title: 'Good Idea', eventType: 'community' },
    { noTitle: true },
    null,
    { title: 'Another Good One' },
  ]});
  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'Good Idea');
});

test('parseIdeasResponse returns null for invalid data', () => {
  assert.equal(parseIdeasResponse(null), null);
  assert.equal(parseIdeasResponse({ notIdeas: [] }), null);
});

test('pickSurpriseParams returns all required fields', () => {
  const params = pickSurpriseParams();
  assert.ok(params.theme);
  assert.ok(params.tone);
  assert.ok(params.characterType);
  assert.ok(params.setting);
  assert.equal(typeof params.motorcycleRelated, 'boolean');
});

// --- Notifications ---

test('buildDiscordPayload creates valid embed for event notification', () => {
  const payload = buildDiscordPayload('event-generated', { title: 'Test Event', date: '2026-09-01', location: 'Fort Dodge' });
  assert.equal(payload.embeds.length, 1);
  assert.ok(payload.embeds[0].title.includes('Event Recommendation'));
  assert.ok(payload.embeds[0].description.includes('Test Event'));
  assert.equal(typeof payload.embeds[0].color, 'number');
});

test('buildDiscordPayload creates valid embed for story notification', () => {
  const payload = buildDiscordPayload('story-generated', { title: 'My Story', reason: 'Theme: resilience' });
  assert.ok(payload.embeds[0].title.includes('Story'));
  assert.ok(payload.embeds[0].description.includes('My Story'));
});

test('buildDiscordPayload handles missing fields gracefully', () => {
  const payload = buildDiscordPayload('event-generated', {});
  assert.ok(payload.embeds[0].description.includes('No details'));
});

// --- Newsletter integration ---

test('buildNewsletter with no story leaves story section empty', () => {
  const { html } = buildNewsletter('Hello', [], [], 'Rider');
  assert.ok(html.includes('Hello'));
  assert.ok(!html.includes('fictional'));
});

test('buildNewsletter with a story includes disclosure', () => {
  const story = { title: 'Test Tale', text: 'Once upon a time in Iowa.' };
  const { html } = buildNewsletter('', [], [], 'Rider', '', story);
  assert.ok(html.includes('Test Tale'));
  assert.ok(html.includes('Once upon a time'));
  assert.ok(html.includes(DISCLOSURE_TEXT));
});

// --- AI config ---

test('aiConfigured returns false when no key set', () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal(aiConfigured(), false);
});

test('aiConfigured returns true when key is set', () => {
  process.env.GEMINI_API_KEY = 'test-key';
  assert.equal(aiConfigured(), true);
  delete process.env.GEMINI_API_KEY;
});

// --- Role to category mapping ---

test('ROLE_TO_CATEGORY covers all roles', () => {
  const roles = ['hosted', 'attending', 'partner', 'fundraiser', 'outreach', 'meetup', 'ride', 'support', 'educational', 'advocacy', 'recruitment', 'volunteer', 'sponsor', 'other'];
  for (const role of roles) {
    assert.ok(ROLE_TO_CATEGORY[role] !== undefined, `${role} should have a category mapping`);
  }
});

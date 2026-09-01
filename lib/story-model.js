export const STORY_STATUSES = ['pending', 'approved', 'rejected', 'archived', 'used'];

export const DISCLOSURE_TEXT = 'This original story is fictional and was created to reflect the challenges, resilience, and connections that can exist within the limb-loss community. It is not a real member account.';

export function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

export function renderStoryWithDisclosure(story) {
  const title = story.title || 'Untitled Story';
  const text = story.text || story.body || '';
  return `<h2 style="margin:0 0 16px;color:#ff6a00;font-size:20px;font-weight:800;">${escapeEntity(title)}</h2>` +
    text.split(/\n\n+/).filter(Boolean).map(p => `<p style="margin:0 0 12px;color:#ccc;font-size:15px;line-height:1.7;">${escapeEntity(p.trim())}</p>`).join('') +
    `<p style="margin:20px 0 0;padding:14px 18px;border-left:3px solid #f59e0b;font-style:italic;color:#999;font-size:12px;">${escapeEntity(DISCLOSURE_TEXT)}</p>`;
}

function escapeEntity(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function normalizeStoryMeta(meta) {
  return {
    id: meta.id || '',
    title: meta.title || 'Untitled Story',
    text: meta.text || '',
    createdAt: meta.createdAt || new Date().toISOString(),
    newsletterIssue: meta.newsletterIssue || null,
    wordCount: meta.wordCount || wordCount(meta.text || ''),
    character: {
      name: meta.character?.name || '',
      ageRange: meta.character?.ageRange || '',
      occupation: meta.character?.occupation || '',
      background: meta.character?.background || '',
      limbLossCircumstances: meta.character?.limbLossCircumstances || '',
    },
    setting: meta.setting || '',
    primaryConflict: meta.primaryConflict || '',
    secondaryConflict: meta.secondaryConflict || '',
    theme: meta.theme || '',
    emotionalBeats: Array.isArray(meta.emotionalBeats) ? meta.emotionalBeats : [],
    plotStructure: meta.plotStructure || '',
    resolution: meta.resolution || '',
    keyDetails: Array.isArray(meta.keyDetails) ? meta.keyDetails : [],
    keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
    status: meta.status || 'pending',
    motorcycleRelated: Boolean(meta.motorcycleRelated),
    familyFocused: Boolean(meta.familyFocused),
    peerSupportFocused: Boolean(meta.peerSupportFocused),
  };
}

export function similarityFlags(candidate, existingStories) {
  const overlaps = { names: 0, occupations: 0, themes: 0, settings: 0, keywords: 0 };
  if (!existingStories.length) return overlaps;

  const cName = (candidate.character?.name || '').toLowerCase();
  const cOcc = (candidate.character?.occupation || '').toLowerCase();
  const cTheme = (candidate.theme || '').toLowerCase();
  const cSetting = (candidate.setting || '').toLowerCase();
  const cKeywords = new Set((candidate.keywords || []).map(k => k.toLowerCase()));

  for (const s of existingStories) {
    if (cName && s.character?.name?.toLowerCase() === cName) overlaps.names++;
    if (cOcc && s.character?.occupation?.toLowerCase() === cOcc) overlaps.occupations++;
    if (cTheme && s.theme?.toLowerCase() === cTheme) overlaps.themes++;
    if (cSetting && s.setting?.toLowerCase() === cSetting) overlaps.settings++;
    for (const k of cKeywords) {
      if (s.keywords?.some(sk => sk.toLowerCase() === k)) overlaps.keywords++;
    }
  }
  return overlaps;
}

export function buildHistorySummary(stories) {
  if (!stories.length) return 'No previous stories have been written.';
  const recent = stories.slice(0, 20);
  return recent.map(s => {
    const char = s.character || {};
    return `- "${s.title || 'Untitled'}": ${char.name || 'unnamed'}, ${char.occupation || 'unknown occupation'}, theme: ${s.theme || 'none'}, setting: ${s.setting || 'none'}`;
  }).join('\n');
}

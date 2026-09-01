import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { addAudit } from '../lib/audit.js';
import { isPubliclyVisible, normalizeIdeaPayload, ideaToEvent, validateIdea, OUTCOME_FIELDS } from '../lib/event-model.js';
import { notifyOwner } from '../lib/notify.js';
import { seedEvents } from '../lib/seed.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);

  const action = getParam(req, 'action') || 'list';

  if (action === 'list') {
    getList(KEYS.events).then(async (events) => {
      if (!events.length) {
        await setList(KEYS.events, seedEvents);
        events = seedEvents;
      }
      if (isAdmin(req)) {
        const showAll = getParam(req, 'all') === '1';
        const filtered = showAll ? events : events.filter(isPubliclyVisible);
        sendJson(res, { events: filtered, total: events.length });
      } else {
        sendJson(res, { events: events.filter(isPubliclyVisible) });
      }
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'validate') {
    if (isAdmin(req)) {
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { error: 'Invalid admin key.' }, 403);
  }

  if (action === 'ideas') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    getList(KEYS.eventIdeas).then((ideas) => {
      sendJson(res, { ideas, total: ideas.length });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'POST required.' }, 405);
  }

  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }

  readBody(req).then(async (payload) => {
    if (action === 'add') {
      const event = {
        id: 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
        title: clean(payload.title, 200),
        date: clean(payload.date, 10),
        endDate: clean(payload.endDate || '', 10),
        time: clean(payload.time, 5),
        category: clean(payload.category || 'community', 30),
        location: clean(payload.location, 200),
        description: clean(payload.description, 2000),
        status: clean(payload.status || 'published', 30),
        source: clean(payload.source || 'manual', 30),
        repeat: clean(payload.repeat || 'none', 10),
        repeatUntil: clean(payload.repeatUntil || '', 10),
        createdAt: new Date().toISOString(),
      };
      if (!event.title || !event.date) {
        return sendJson(res, { error: 'Title and date are required.' }, 422);
      }
      const events = await getList(KEYS.events);
      events.unshift(event);
      await setList(KEYS.events, events);
      await addAudit('event_created', 'admin', { eventId: event.id, title: event.title });
      return sendJson(res, { event }, 201);
    }

    if (action === 'update') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Event ID required.' }, 422);

      const events = await getList(KEYS.events);
      const idx = events.findIndex((e) => e.id === id);
      if (idx === -1) return sendJson(res, { error: 'Event not found.' }, 404);

      const fields = [
        ['title', 200], ['date', 10], ['endDate', 10], ['time', 5],
        ['category', 30], ['location', 200], ['description', 2000],
        ['status', 30], ['cancelledReason', 500],
        ['repeat', 10], ['repeatUntil', 10],
      ];
      for (const [field, limit] of fields) {
        if (payload[field] !== undefined) {
          events[idx][field] = clean(payload[field], limit);
        }
      }
      for (const field of OUTCOME_FIELDS) {
        if (payload[field] !== undefined) {
          events[idx][field] = clean(String(payload[field] || ''), 500);
        }
      }
      events[idx].updatedAt = new Date().toISOString();
      await setList(KEYS.events, events);
      await addAudit('event_updated', 'admin', { eventId: id, title: events[idx].title });
      return sendJson(res, { event: events[idx] });
    }

    if (action === 'delete') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Event ID required.' }, 422);

      const events = await getList(KEYS.events);
      const filtered = events.filter((e) => e.id !== id);
      if (filtered.length === events.length) {
        return sendJson(res, { error: 'Event not found.' }, 404);
      }
      await setList(KEYS.events, filtered);
      await addAudit('event_deleted', 'admin', { eventId: id });
      return sendJson(res, { ok: true });
    }

    if (action === 'add-idea') {
      const idea = normalizeIdeaPayload(payload);
      const err = validateIdea(idea);
      if (err) return sendJson(res, { error: err }, 422);
      idea.id = 'ei-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      idea.status = 'pending';
      idea.generatedAt = new Date().toISOString();
      const ideas = await getList(KEYS.eventIdeas);
      ideas.unshift(idea);
      await setList(KEYS.eventIdeas, ideas.slice(0, LIMITS.eventIdeas));
      await addAudit('idea_created', 'admin', { ideaId: idea.id, title: idea.title });
      notifyOwner('event-generated', { title: idea.title, date: idea.date, location: idea.location, type: idea.role, source: idea.source, reason: idea.rationale }).catch(() => {});
      return sendJson(res, { idea }, 201);
    }

    if (action === 'update-idea') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Idea ID required.' }, 422);
      const ideas = await getList(KEYS.eventIdeas);
      const idx = ideas.findIndex(i => i.id === id);
      if (idx === -1) return sendJson(res, { error: 'Idea not found.' }, 404);
      const ideaFields = [
        'title', 'date', 'endDate', 'time', 'endTime', 'eventType', 'role',
        'location', 'address', 'city', 'state', 'contactPerson', 'contactPhone',
        'contactEmail', 'website', 'registrationUrl', 'socialUrl', 'visibility',
        'cost', 'accessibilityNotes', 'volunteerDetails', 'equipmentNeeded',
        'promoMaterialsNeeded', 'sponsorInvolvement', 'insurancePermitNotes',
        'audience', 'estimatedCost', 'fundraisingPotential', 'outreachPotential',
        'membershipValue', 'rationale', 'sourceUrl', 'status',
      ];
      const boolFields = ['registrationRequired', 'transportationNeeded', 'volunteerRequired', 'boothNeeded'];
      for (const field of ideaFields) {
        if (payload[field] !== undefined) ideas[idx][field] = clean(String(payload[field] || ''), 500);
      }
      for (const field of boolFields) {
        if (payload[field] !== undefined) ideas[idx][field] = Boolean(payload[field]);
      }
      if (payload.scores && typeof payload.scores === 'object') {
        ideas[idx].scores = payload.scores;
      }
      ideas[idx].updatedAt = new Date().toISOString();
      await setList(KEYS.eventIdeas, ideas);
      await addAudit('idea_updated', 'admin', { ideaId: id, title: ideas[idx].title });
      notifyOwner('event-edited', { title: ideas[idx].title }).catch(() => {});
      return sendJson(res, { idea: ideas[idx] });
    }

    if (action === 'approve-idea') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Idea ID required.' }, 422);
      const ideas = await getList(KEYS.eventIdeas);
      const idx = ideas.findIndex(i => i.id === id);
      if (idx === -1) return sendJson(res, { error: 'Idea not found.' }, 404);
      const idea = ideas[idx];
      let event;
      if (idea.status !== 'approved') {
        event = ideaToEvent(idea);
        event.title = clean(payload.title || idea.title, 200);
        event.date = clean(payload.date || idea.date, 10);
        event.time = clean(payload.time || idea.time, 5);
        event.location = clean(payload.location || idea.location, 200);
        event.description = clean(payload.description || idea.rationale, 2000);
        if (payload.category) event.category = clean(payload.category, 30);
        const events = await getList(KEYS.events);
        events.unshift(event);
        await setList(KEYS.events, events);
        idea.status = 'approved';
        idea.approvedAt = new Date().toISOString();
        idea.eventId = event.id;
        await setList(KEYS.eventIdeas, ideas);
      }
      await addAudit('idea_approved', 'admin', { ideaId: id, eventId: event?.id, title: idea.title });
      notifyOwner('event-approved', { title: idea.title, date: idea.date, location: idea.location }).catch(() => {});
      return sendJson(res, { ok: true, event: event || null });
    }

    if (action === 'reject-idea') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Idea ID required.' }, 422);
      const ideas = await getList(KEYS.eventIdeas);
      const idx = ideas.findIndex(i => i.id === id);
      if (idx === -1) return sendJson(res, { error: 'Idea not found.' }, 404);
      ideas[idx].status = 'rejected';
      ideas[idx].rejectedAt = new Date().toISOString();
      ideas[idx].rejectionReason = clean(payload.reason || '', 500);
      await setList(KEYS.eventIdeas, ideas);
      await addAudit('idea_rejected', 'admin', { ideaId: id, title: ideas[idx].title });
      notifyOwner('event-rejected', { title: ideas[idx].title, reason: ideas[idx].rejectionReason }).catch(() => {});
      return sendJson(res, { ok: true });
    }

    if (action === 'delete-idea') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Idea ID required.' }, 422);
      const ideas = await getList(KEYS.eventIdeas);
      const filtered = ideas.filter(i => i.id !== id);
      if (filtered.length === ideas.length) return sendJson(res, { error: 'Idea not found.' }, 404);
      await setList(KEYS.eventIdeas, filtered);
      await addAudit('idea_deleted', 'admin', { ideaId: id });
      notifyOwner('event-deleted', { title: payload.title || '' }).catch(() => {});
      return sendJson(res, { ok: true });
    }

    sendJson(res, { error: 'Unsupported action.' }, 404);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}


import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventCalendar } from '../lib/icalendar.js';

test('buildEventCalendar produces a Thunderbird-compatible event feed', () => {
  const calendar = buildEventCalendar([{
    id: 'ev-1',
    title: 'Ride, Meet & Greet',
    date: '2026-09-19',
    time: '09:00',
    location: 'Fort Dodge; Iowa',
    description: 'Bring gear.\nAll riders welcome.',
    repeat: 'weekly',
    repeatUntil: '2026-10-03',
    updatedAt: '2026-09-12T14:30:00Z',
  }]);

  assert.match(calendar, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(calendar, /UID:ev-1@lostlimbriders\.org/);
  assert.match(calendar, /DTSTART;TZID=America\/Chicago:20260919T090000/);
  assert.match(calendar, /DTEND;TZID=America\/Chicago:20260919T100000/);
  assert.match(calendar, /SUMMARY:Ride\\, Meet & Greet/);
  assert.match(calendar, /LOCATION:Fort Dodge\\; Iowa/);
  assert.match(calendar, /DESCRIPTION:Bring gear\.\\nAll riders welcome\./);
  assert.match(calendar, /RRULE:FREQ=WEEKLY;UNTIL=20261003T235959Z/);
  assert.match(calendar, /LAST-MODIFIED:20260912T143000Z/);
  assert.match(calendar, /END:VCALENDAR\r\n$/);
});

test('buildEventCalendar uses exclusive end dates for all-day multi-day events', () => {
  const calendar = buildEventCalendar([{
    id: 'ev-2',
    title: 'Weekend Rally',
    date: '2026-09-19',
    endDate: '2026-09-20',
  }]);

  assert.match(calendar, /DTSTART;VALUE=DATE:20260919/);
  assert.match(calendar, /DTEND;VALUE=DATE:20260921/);
});

test('recurring events use the end date as the recurrence limit, not occurrence duration', () => {
  const calendar = buildEventCalendar([{
    id: 'ev-3',
    title: 'Weekly Meeting',
    date: '2026-09-10',
    endDate: '2026-12-31',
    repeat: 'weekly',
    repeatUntil: '2026-12-31',
  }]);

  assert.match(calendar, /DTSTART;VALUE=DATE:20260910/);
  assert.match(calendar, /DTEND;VALUE=DATE:20260911/);
  assert.match(calendar, /RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z/);
});

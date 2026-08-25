import test from 'node:test';
import assert from 'node:assert/strict';
import { iowaDay, computeVisitorStats } from '../lib/visitor-stats.js';

test('iowaDay maps summer instants on America/Chicago calendar days (CDT, UTC-5)', () => {
  assert.equal(iowaDay('2026-07-14T22:00:00Z'), '2026-07-14');
  assert.equal(iowaDay('2026-07-15T04:59:59Z'), '2026-07-14');
  assert.equal(iowaDay('2026-07-15T05:00:00Z'), '2026-07-15');
  assert.equal(iowaDay('2026-07-15T12:00:00Z'), '2026-07-15');
});

test('iowaDay maps winter instants on America/Chicago calendar days (CST, UTC-6)', () => {
  assert.equal(iowaDay('2026-01-14T22:00:00Z'), '2026-01-14');
  assert.equal(iowaDay('2026-01-15T05:59:59Z'), '2026-01-14');
  assert.equal(iowaDay('2026-01-15T06:00:00Z'), '2026-01-15');
});

test('iowaDay handles spring-forward DST: local midnight of 2026-03-09 is 05:00Z', () => {
  assert.equal(iowaDay('2026-03-08T08:00:00Z'), '2026-03-08');
  assert.equal(iowaDay('2026-03-09T04:59:59Z'), '2026-03-08');
  assert.equal(iowaDay('2026-03-09T05:00:00Z'), '2026-03-09');
});

test('iowaDay handles fall-back DST: local midnight of 2026-11-02 is 06:00Z', () => {
  assert.equal(iowaDay('2026-11-01T07:00:00Z'), '2026-11-01');
  assert.equal(iowaDay('2026-11-02T05:59:59Z'), '2026-11-01');
  assert.equal(iowaDay('2026-11-02T06:00:00Z'), '2026-11-02');
});

test('daily statistics follow Iowa calendar, not UTC, late into the evening', () => {
  const visitors = [
    { timestamp: '2026-07-14T22:00:00Z', visitorId: 'a', country: 'United States', userAgent: 'Mozilla/5.0 Chrome/120' },
    { timestamp: '2026-07-15T03:30:00Z', visitorId: 'b', country: 'United States', userAgent: 'Mozilla/5.0 Chrome/120' },
    { timestamp: '2026-07-15T03:45:00Z', visitorId: 'a', country: 'United States', userAgent: 'Mozilla/5.0 Firefox/130' },
    { timestamp: '2026-07-15T03:50:00Z', visitorId: 'c', country: 'Canada', userAgent: 'Mozilla/5.0 Safari/605' },
    { timestamp: '2026-07-15T05:30:00Z', visitorId: 'b', country: 'United States', userAgent: 'Mozilla/5.0 Chrome/120' },
    { timestamp: '2026-07-15T12:00:00Z', visitorId: 'd', country: 'N/A', userAgent: 'unknown' },
  ];

  const justBeforeMidnight = computeVisitorStats(visitors, new Date('2026-07-15T04:59:59Z'));
  assert.equal(iowaDay(new Date('2026-07-15T04:59:59Z')), '2026-07-14');
  assert.equal(justBeforeMidnight.todayVisits, 4);
  assert.equal(justBeforeMidnight.uniqueToday, 3);
  assert.equal(justBeforeMidnight.newVisitorsToday, 2);
  assert.equal(justBeforeMidnight.returningVisitorsToday, 1);

  const rightAfterMidnight = computeVisitorStats(visitors, new Date('2026-07-15T05:00:00Z'));
  assert.equal(iowaDay(new Date('2026-07-15T05:00:00Z')), '2026-07-15');
  assert.equal(rightAfterMidnight.todayVisits, 2);
  assert.equal(rightAfterMidnight.uniqueToday, 2);
  assert.equal(rightAfterMidnight.newVisitorsToday, 1);
  assert.equal(rightAfterMidnight.returningVisitorsToday, 1);

  assert.equal(justBeforeMidnight.totalVisits, 6);
  assert.equal(justBeforeMidnight.uniqueVisitors, 4);
  assert.equal(rightAfterMidnight.totalVisits, 6);
  assert.equal(rightAfterMidnight.uniqueVisitors, 4);
});

test('a visit after UTC midnight still counts as Today while Fort Dodge is pre-midnight', () => {
  assert.equal(iowaDay('2026-07-15T03:59:59Z'), '2026-07-14');
  const visitors = [{ timestamp: '2026-07-15T03:30:00Z', visitorId: 'x', country: 'N/A', userAgent: 'unknown' }];
  const stats = computeVisitorStats(visitors, new Date('2026-07-15T03:59:59Z'));
  assert.equal(stats.todayVisits, 1);
  assert.equal(stats.uniqueToday, 1);
});

test('malformed or missing timestamps never crash stats nor count as Today', () => {
  const visitors = [
    { visitorId: 'm1', country: 'N/A', userAgent: 'unknown' },
    { timestamp: 'not-a-date', visitorId: 'm2', country: 'N/A', userAgent: 'unknown' },
    { timestamp: '2026-07-15T10:00:00Z', visitorId: 'ok', country: 'N/A', userAgent: 'unknown' },
  ];
  const stats = computeVisitorStats(visitors, new Date('2026-07-15T12:00:00Z'));
  assert.equal(stats.totalVisits, 3);
  assert.equal(stats.uniqueVisitors, 3);
  assert.equal(stats.todayVisits, 1);
});

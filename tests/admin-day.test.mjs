import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { iowaDay, computeVisitorStats } from '../lib/visitor-stats.js';

const adminPage = await readFile(new URL('../admin.html', import.meta.url), 'utf8');

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

test('enriched analytics calculate traffic windows, retention, conversion, and chart data', () => {
  const visitors = [
    { timestamp:'2026-07-10T12:00:00Z', visitorId:'a', page:'https://lostlimbriders.org/', referrer:'direct', city:'Fort Dodge', country:'United States', userAgent:'Mozilla/5.0 (iPhone) Mobile Safari/605' },
    { timestamp:'2026-07-11T12:00:00Z', visitorId:'a', page:'https://lostlimbriders.org/newsletter.html', referrer:'https://facebook.com/post', city:'Fort Dodge', country:'United States', userAgent:'Mozilla/5.0 (iPhone) Mobile Safari/605' },
    { timestamp:'2026-07-12T12:00:00Z', visitorId:'b', page:'/mission.html', referrer:'direct', city:'Des Moines', country:'United States', userAgent:'Mozilla/5.0 Chrome/120' },
    { timestamp:'2026-07-13T12:00:00Z', visitorId:'b', page:'/mission.html', referrer:'https://lostlimbriders.org/', city:'Des Moines', country:'United States', userAgent:'Mozilla/5.0 Chrome/120' },
    { timestamp:'2026-07-14T12:00:00Z', visitorId:'c', page:'/events.html', referrer:'direct', city:'Ames', country:'United States', userAgent:'Mozilla/5.0 (iPad) Safari/605' },
    { timestamp:'2026-07-15T12:00:00Z', visitorId:'d', page:'/', referrer:'direct', city:'Ames', country:'United States', userAgent:'Mozilla/5.0 Firefox/130' },
  ];
  const subscribers = [
    { visitorId:'a', status:'active' },
    { visitorId:'missing', status:'active' },
    { visitorId:'b', status:'unsubscribed' },
  ];
  const stats = computeVisitorStats(visitors, new Date('2026-07-15T12:00:00Z'), subscribers);
  assert.equal(stats.visits7, 6);
  assert.equal(stats.visits30, 6);
  assert.equal(stats.unique7, 4);
  assert.equal(stats.returningVisitors, 2);
  assert.equal(stats.returningRate, 50);
  assert.equal(stats.pagesPerVisitor, 1.5);
  assert.equal(stats.activeSubscribers, 2);
  assert.equal(stats.unsubscribedSubscribers, 1);
  assert.equal(stats.identifiedVisitors, 1);
  assert.equal(stats.newsletterConversionRate, 25);
  assert.equal(stats.trafficSeries.length, 14);
  assert.equal(stats.trafficSeries.at(-1).visits, 1);
  assert.deepEqual(stats.topPages, { Home:2, mission:2, newsletter:1, events:1 });
  assert.deepEqual(stats.deviceStats, { Mobile:2, Desktop:3, Tablet:1 });
  assert.deepEqual(stats.topReferrers, { Direct:4, 'facebook.com':1, Internal:1 });
});

test('admin dashboard renders enriched KPIs and the two primary analytics visuals', () => {
  for (const id of ['statVisits7', 'statVisits30', 'statReturningRate', 'statPagesPerVisitor', 'statConversion']) {
    assert.match(adminPage, new RegExp(`id="${id}"`));
  }
  assert.match(adminPage, /id="trafficTrend"/);
  assert.match(adminPage, /id="pagePopularity"/);
  assert.match(adminPage, /function renderTrafficTrend\(series\)/);
  assert.match(adminPage, /function renderRankedList\(containerId, emptyId, data\)/);
  assert.match(adminPage, /Reporting timezone: America\/Chicago/);
});

import { parseBrowser } from './ua.js';

const REPORT_TZ = 'America/Chicago';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function iowaDay(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const parts = dayFormatter.formatToParts(date);
  const get = (type) => {
    const part = parts.find((p) => p.type === type);
    return part ? part.value : '';
  };
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function getBrowserStats(visitors) {
  const stats = { Chrome: 0, Firefox: 0, Safari: 0, Edge: 0, Other: 0 };
  for (const v of visitors) {
    const browser = parseBrowser(v.userAgent);
    if (stats[browser] !== undefined) stats[browser]++;
    else stats.Other++;
  }
  return stats;
}

function topCounts(values, limit = 8) {
  const counts = {};
  for (const value of values) {
    if (!value || value === 'N/A' || value === 'unknown') continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit));
}

function dayOffset(day, offset) {
  const [year, month, date] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + offset));
  return shifted.toISOString().slice(0, 10);
}

function pageLabel(value) {
  if (!value || value === 'N/A') return '';
  try {
    const url = new URL(value, 'https://lostlimbriders.org');
    return url.pathname === '/' ? 'Home' : url.pathname.replace(/^\//, '').replace(/\.html$/, '') || 'Home';
  } catch {
    return String(value).split(/[?#]/)[0].replace(/^\//, '').replace(/\.html$/, '') || 'Home';
  }
}

function referrerLabel(value) {
  if (!value || value === 'direct') return 'Direct';
  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    return host === 'lostlimbriders.org' ? 'Internal' : host;
  } catch {
    return 'Direct';
  }
}

function deviceLabel(userAgent) {
  const ua = String(userAgent || '');
  if (/ipad|tablet|kindle|silk/i.test(ua)) return 'Tablet';
  if (/mobile|iphone|ipod|android/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

export function computeVisitorStats(visitors, now = new Date(), subscribers = []) {
  const todayStr = iowaDay(now);
  let today = 0;
  const countries = {};
  const seenEver = new Set();
  const seenBeforeToday = new Set();
  const seenToday = new Set();
  const seen7 = new Set();
  const seen30 = new Set();
  const visitCounts = new Map();
  let visits7 = 0;
  let visits30 = 0;
  const daily = new Map(Array.from({ length: 14 }, (_, index) => {
    const day = dayOffset(todayStr, index - 13);
    return [day, { date: day, visits: 0, unique: new Set() }];
  }));
  for (const v of visitors) {
    const day = v.timestamp ? iowaDay(v.timestamp) : '';
    if (day === todayStr) today++;
    const c = v.country;
    if (c && c !== 'N/A') countries[c] = (countries[c] || 0) + 1;
    const vid = v.visitorId;
    if (day && day >= dayOffset(todayStr, -6) && day <= todayStr) visits7++;
    if (day && day >= dayOffset(todayStr, -29) && day <= todayStr) visits30++;
    const dailyEntry = daily.get(day);
    if (dailyEntry) dailyEntry.visits++;
    if (!vid) continue;
    visitCounts.set(vid, (visitCounts.get(vid) || 0) + 1);
    if (day === todayStr) seenToday.add(vid);
    else seenBeforeToday.add(vid);
    if (day && day >= dayOffset(todayStr, -6) && day <= todayStr) seen7.add(vid);
    if (day && day >= dayOffset(todayStr, -29) && day <= todayStr) seen30.add(vid);
    if (dailyEntry) dailyEntry.unique.add(vid);
    seenEver.add(vid);
  }
  const returningToday = [...seenToday].filter((id) => seenBeforeToday.has(id)).length;
  const newToday = seenToday.size - returningToday;

  const topCountries = Object.entries(countries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((acc, [k, n]) => {
      acc[k] = n;
      return acc;
    }, {});

  const activeSubscribers = subscribers.filter((subscriber) => (subscriber.status || 'active') === 'active');
  const linkedVisitorIds = new Set(activeSubscribers.map((subscriber) => subscriber.visitorId).filter(Boolean));
  const identifiedVisitors = [...linkedVisitorIds].filter((id) => seenEver.has(id)).length;
  const newsletterConversionRate = seenEver.size ? Number(((identifiedVisitors / seenEver.size) * 100).toFixed(1)) : 0;
  const returningEver = [...visitCounts.values()].filter((count) => count > 1).length;

  return {
    totalVisits: visitors.length,
    todayVisits: today,
    uniqueVisitors: seenEver.size,
    uniqueToday: seenToday.size,
    newVisitorsToday: newToday,
    returningVisitorsToday: returningToday,
    visits7,
    visits30,
    unique7: seen7.size,
    unique30: seen30.size,
    returningVisitors: returningEver,
    returningRate: seenEver.size ? Number(((returningEver / seenEver.size) * 100).toFixed(1)) : 0,
    pagesPerVisitor: seenEver.size ? Number(([...visitCounts.values()].reduce((sum, count) => sum + count, 0) / seenEver.size).toFixed(1)) : 0,
    activeSubscribers: activeSubscribers.length,
    unsubscribedSubscribers: subscribers.length - activeSubscribers.length,
    identifiedVisitors,
    newsletterConversionRate,
    trafficSeries: [...daily.values()].map((entry) => ({ date: entry.date, visits: entry.visits, unique: entry.unique.size })),
    topPages: topCounts(visitors.map((visitor) => pageLabel(visitor.page))),
    topReferrers: topCounts(visitors.map((visitor) => referrerLabel(visitor.referrer))),
    topCities: topCounts(visitors.map((visitor) => visitor.city)),
    deviceStats: topCounts(visitors.map((visitor) => deviceLabel(visitor.userAgent))),
    topCountries,
    browserStats: getBrowserStats(visitors),
  };
}

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

export function computeVisitorStats(visitors, now = new Date()) {
  const todayStr = iowaDay(now);
  let today = 0;
  const countries = {};
  const seenEver = new Set();
  const seenBeforeToday = new Set();
  const seenToday = new Set();
  for (const v of visitors) {
    const day = v.timestamp ? iowaDay(v.timestamp) : '';
    if (day === todayStr) today++;
    const c = v.country;
    if (c && c !== 'N/A') countries[c] = (countries[c] || 0) + 1;
    const vid = v.visitorId;
    if (!vid) continue;
    if (day === todayStr) seenToday.add(vid);
    else seenBeforeToday.add(vid);
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

  return {
    totalVisits: visitors.length,
    todayVisits: today,
    uniqueVisitors: seenEver.size,
    uniqueToday: seenToday.size,
    newVisitorsToday: newToday,
    returningVisitorsToday: returningToday,
    topCountries,
    browserStats: getBrowserStats(visitors),
  };
}

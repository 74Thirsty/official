const CALENDAR_TIME_ZONE = 'America/Chicago';

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function compactDate(value) {
  return String(value || '').replaceAll('-', '');
}

function addDays(value, count) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function addOneHour(dateValue, timeValue) {
  const date = new Date(`${dateValue}T${timeValue}:00Z`);
  date.setUTCHours(date.getUTCHours() + 1);
  return {
    date: date.toISOString().slice(0, 10),
    time: date.toISOString().slice(11, 16),
  };
}

function dateTime(date, time) {
  return `${compactDate(date)}T${String(time).replace(':', '')}00`;
}

function utcStamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function foldLine(line) {
  const parts = [];
  let part = '';
  let limit = 75;
  for (const character of line) {
    if (Buffer.byteLength(part + character, 'utf8') > limit) {
      parts.push(part);
      part = character;
      limit = 74;
    } else {
      part += character;
    }
  }
  parts.push(part);
  return parts.join('\r\n ');
}

function recurrenceLine(event) {
  const frequencies = { weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
  const frequency = frequencies[event.repeat];
  if (!frequency) return '';
  const until = event.repeatUntil
    ? `;UNTIL=${compactDate(event.repeatUntil)}T235959Z`
    : '';
  return `RRULE:FREQ=${frequency}${until}`;
}

function eventLines(event) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(event.id)}@lostlimbriders.org`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  const stamp = event.updatedAt || event.createdAt;
  if (stamp && !Number.isNaN(Date.parse(stamp))) {
    lines.push(`DTSTAMP:${utcStamp(stamp)}`);
    lines.push(`LAST-MODIFIED:${utcStamp(stamp)}`);
  }

  if (event.time) {
    const end = addOneHour(event.endDate || event.date, event.time);
    lines.push(`DTSTART;TZID=${CALENDAR_TIME_ZONE}:${dateTime(event.date, event.time)}`);
    lines.push(`DTEND;TZID=${CALENDAR_TIME_ZONE}:${dateTime(end.date, end.time)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(event.endDate || event.date, 1))}`);
  }

  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  const recurrence = recurrenceLine(event);
  if (recurrence) lines.push(recurrence);
  lines.push('END:VEVENT');
  return lines;
}

export function buildEventCalendar(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lost Limb Riders//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Lost Limb Riders Events',
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
  ];

  for (const event of events) {
    if (event.id && event.title && event.date) lines.push(...eventLines(event));
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

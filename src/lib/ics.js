/** ملفّ تقويم ‎.ics‎ لفعالية (UTC، مع طيّ الأسطر حسب RFC 5545). */

const pad = (n) => String(n).padStart(2, '0');

function stamp(iso) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T`
       + `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const escapeText = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/** طيّ الأسطر عند 75 ثمانيّة (بايت) مع مراعاة محارف UTF-8 متعدّدة البايت. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push((start === 0 ? '' : ' ') + bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74;
  }
  return out.join('\r\n');
}

export function eventToIcs(event, { uid, url, organizer } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Astroutas//Culture & Literature Club//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(uid || `event-${event.id}@astroutas`)}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(event.ends_at)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`تذكير: ${event.title}`)}`,
    'END:VALARM',
  ];
  if (url) lines.push(`URL:${escapeText(url)}`);
  if (organizer) lines.push(`ORGANIZER;CN=${escapeText(organizer)}:mailto:noreply@utas.edu.om`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export const icsHeaders = (filename) => ({
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': `attachment; filename="${filename}"`,
  'Cache-Control': 'no-store',
});

/**
 * كل التواريخ في الموقع بتوقيت عُمان (UTC+4، بلا توقيت صيفي).
 * التخزين دائمًا UTC، والعرض والإدخال بتوقيت عُمان.
 */
import config from '../config.js';

const TZ = config.timeZone;
const OMAN_OFFSET = '+04:00';

export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** "2026-09-20T18:00" (بتوقيت عُمان من نموذج datetime-local) ← ISO بتوقيت UTC */
export function omanInputToUtc(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value).trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${OMAN_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** ISO (UTC) ← قيمة صالحة لحقل datetime-local بتوقيت عُمان */
export function utcToOmanInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function parts(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const out = {};
  for (const { type, value } of fmt.formatToParts(date)) out[type] = value;
  if (out.hour === '24') out.hour = '00';
  return out;
}

const dateFmt = new Intl.DateTimeFormat(config.locale, {
  timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat(config.locale, {
  timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true,
});
const shortFmt = new Intl.DateTimeFormat(config.locale, {
  timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric',
});

export const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '');
export const formatTime = (iso) => (iso ? timeFmt.format(new Date(iso)) : '');
export const formatShort = (iso) => (iso ? shortFmt.format(new Date(iso)) : '');
export const formatDateTime = (iso) => (iso ? `${formatDate(iso)} — ${formatTime(iso)}` : '');

/** "الاثنين ٢٠ سبتمبر ٢٠٢٦، ٦:٠٠ م – ٨:٠٠ م" */
export function formatRange(startIso, endIso) {
  if (!startIso) return '';
  const sameDay = endIso && formatDate(startIso) === formatDate(endIso);
  if (sameDay) return `${formatDate(startIso)}، ${formatTime(startIso)} – ${formatTime(endIso)}`;
  return `${formatDateTime(startIso)} حتى ${formatDateTime(endIso)}`;
}

/** صيغة مختصرة للتصدير: 2026-09-20 06:00 م (توقيت عُمان) */
export function formatForExport(iso) {
  if (!iso) return '';
  const p = parts(new Date(iso));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** نصّ نسبي عربي: «بعد ٣ أيام» / «منذ ساعتين». */
export function relative(iso, from = Date.now()) {
  const diff = new Date(iso).getTime() - from;
  const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
  const abs = Math.abs(diff);
  const units = [
    ['year', 365 * 24 * 3600e3], ['month', 30 * 24 * 3600e3], ['day', 24 * 3600e3],
    ['hour', 3600e3], ['minute', 60e3],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), 'second');
}

export const isPast = (iso) => new Date(iso).getTime() < Date.now();
export const isFuture = (iso) => new Date(iso).getTime() > Date.now();

export { arabicDigits } from './arabic.js';

/** أدوات الطلب والاستجابة: قراءة الجسم، الترويسات، فحص المنشأ، الأخطاء. */
import { parseCookies } from './session.js';

export const MAX_FORM_BYTES = 128 * 1024;

/** ترويسات أمان تُرسل مع كل استجابة HTML. */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
};

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export const cookies = (req) => parseCookies(req.headers.cookie);

export function readBody(req, limit = MAX_FORM_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('PAYLOAD_TOO_LARGE'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** نموذج urlencoded → كائن عادي (آخر قيمة تفوز، والمكرّر يُجمع في مصفوفة). */
export async function readForm(req) {
  const raw = (await readBody(req)).toString('utf8');
  const params = new URLSearchParams(raw);
  const out = Object.create(null);
  for (const [key, value] of params) {
    if (key in out) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

export async function readJson(req) {
  const raw = (await readBody(req)).toString('utf8');
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * رفض الطلبات القادمة من مواقع أخرى (فحص المنشأ).
 * يُطبَّق على كل طلب يغيّر الحالة.
 */
export function sameOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  // 1) Sec-Fetch-Site ترويسة محظورة لا تستطيع الصفحات تزويرها — تُقدَّم على غيرها.
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';

  // 2) Origin — بعض المتصفّحات لا ترسلها مع نماذج نفس الموقع.
  const origin = req.headers.origin;
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }

  // 3) Referer كملاذ أخير.
  const referer = req.headers.referer;
  if (referer) {
    try { return new URL(referer).host === host; } catch { return false; }
  }

  // 4) عميل قديم لا يرسل أيًّا منها.
  return true;
}

export function send(res, status, headers, body) {
  res.writeHead(status, { ...securityHeaders, ...headers });
  res.end(body);
}

export function sendHtml(res, status, html, extraHeaders = {}) {
  const body = Buffer.from(String(html), 'utf8');
  send(res, status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...extraHeaders,
  }, body);
}

export function sendJson(res, status, data, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(data), 'utf8');
  send(res, status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...extraHeaders,
  }, body);
}

export function redirect(res, location, { status = 303, headers = {} } = {}) {
  send(res, status, { Location: location, ...headers }, '');
}

/** يبني رابطًا مطلقًا للموقع (لرموز QR وملفات التقويم). */
export function absoluteUrl(req, pathname = '/') {
  const configured = process.env.BASE_URL;
  if (configured) return new URL(pathname, configured.replace(/\/$/, '') + '/').toString();
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return new URL(pathname, `${proto}://${host}`).toString();
}

export const isSecure = (req) =>
  (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

export const wantsJson = (req) =>
  String(req.headers.accept || '').includes('application/json')
  || String(req.headers['x-requested-with'] || '').toLowerCase() === 'fetch';

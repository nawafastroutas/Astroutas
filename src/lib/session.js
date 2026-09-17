/**
 * جلسة بكعكة HttpOnly مبصومة (HMAC-SHA256) صالحة أسبوعًا — بلا حالة على الخادم.
 */
import crypto from 'node:crypto';
import config from '../config.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function sign(payloadB64) {
  return crypto.createHmac('sha256', config.sessionSecret).update(payloadB64).digest('base64url');
}

/** @returns {string} قيمة الكعكة */
export function issue(memberId) {
  const payload = { m: memberId, iat: Date.now(), exp: Date.now() + config.sessionMaxAgeMs };
  const body = b64u(JSON.stringify(payload));
  return `v1.${body}.${sign(body)}`;
}

/** @returns {{memberId:number, exp:number}|null} */
export function verify(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, body, mac] = parts;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.m !== 'number') return null;
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
  return { memberId: payload.m, exp: payload.exp };
}

export function cookieHeader(value, { secure, maxAgeMs = config.sessionMaxAgeMs } = {}) {
  const bits = [
    `${config.sessionCookie}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

export function clearCookieHeader({ secure } = {}) {
  const bits = [`${config.sessionCookie}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

export function parseCookies(header) {
  const out = Object.create(null);
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

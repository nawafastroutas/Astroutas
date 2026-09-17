/** الموجِّه: الملفّات الثابتة، الجلسة، فحص المنشأ، ثم المسارات. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import config, { ROOT } from './config.js';
import * as Session from './lib/session.js';
import * as Members from './models/members.js';
import { getObject } from './lib/storage.js';
import {
  cookies, sameOrigin, sendHtml, sendJson, send, redirect, clientIp, isSecure, wantsJson,
} from './lib/http.js';
import { errorPage } from './views/pages.js';

const routes = [];

/** يحوّل "/events/:id" إلى تعبير نمطي مع أسماء المعاملات. */
function compile(pattern) {
  const names = [];
  const source = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)/g, (_, name) => { names.push(name); return '([^/]+)'; });
  return { re: new RegExp(`^${source}$`), names };
}

export function route(method, pattern, handler, options = {}) {
  routes.push({ method, ...compile(pattern), handler, options, pattern });
}
export const get = (p, h, o) => route('GET', p, h, o);
export const post = (p, h, o) => route('POST', p, h, o);

/* --------------------------- الملفّات الثابتة --------------------------- */
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const STATIC_MOUNTS = [
  { prefix: '/css/', dir: path.join(ROOT, 'public', 'css') },
  { prefix: '/js/', dir: path.join(ROOT, 'public', 'js') },
  { prefix: '/assets/', dir: path.join(ROOT, 'public', 'assets') },
  { prefix: '/splash/', dir: path.join(ROOT, 'src', 'splash') },
];

function serveStatic(req, res, pathname) {
  const mount = STATIC_MOUNTS.find((m) => pathname.startsWith(m.prefix));
  if (!mount) return false;
  const rel = decodeURIComponent(pathname.slice(mount.prefix.length));
  if (!rel || rel.includes('\0')) return false;
  const file = path.join(mount.dir, rel);
  if (!file.startsWith(mount.dir + path.sep)) return false;      // يمنع الخروج عن المجلّد
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;

  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`;
  if (req.headers['if-none-match'] === etag) {
    send(res, 304, { ETag: etag }, '');
    return true;
  }
  send(res, 200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': config.env === 'production' ? 'public, max-age=3600' : 'no-cache',
    ETag: etag,
  }, fs.readFileSync(file));
  return true;
}

/** صور تخزين الكائنات — المفتاح العشوائي هو السرّ. */
function serveObject(req, res, pathname) {
  const key = decodeURIComponent(pathname.slice('/o/'.length));
  const object = getObject(key);
  if (!object) {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'غير موجود');
    return;
  }
  const etag = `W/"${object.size}-${Number(object.mtime.getTime()).toString(36)}"`;
  if (req.headers['if-none-match'] === etag) { send(res, 304, { ETag: etag }, ''); return; }
  send(res, 200, {
    'Content-Type': object.type,
    'Content-Length': object.size,
    'Cache-Control': 'private, max-age=86400, immutable',
    ETag: etag,
  }, fs.readFileSync(object.path));
}

/* ------------------------------ الطلب الكامل ----------------------------- */
export async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (serveStatic(req, res, pathname)) return;
    if (pathname.startsWith('/o/')) { serveObject(req, res, pathname); return; }
  }

  // الجلسة
  const token = cookies(req)[config.sessionCookie];
  const session = Session.verify(token);
  const member = session ? Members.findById(session.memberId) : null;

  const ctx = {
    req, res, url, query: url.searchParams, params: {},
    member, isAdmin: !!member?.is_admin,
    ip: clientIp(req), secure: isSecure(req),
    nonce: crypto.randomBytes(16).toString('base64'),
    wantsJson: wantsJson(req),
    html: (status, markup, headers) => sendHtml(res, status, markup, {
      ...headers,
      'Content-Security-Policy': [
        "default-src 'self'", "img-src 'self' data: blob:", "style-src 'self' 'unsafe-inline'",
        `script-src 'self' 'nonce-${ctx.nonce}'`, "connect-src 'self'", "media-src 'self' blob:",
        "form-action 'self'", "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'",
      ].join('; '),
    }),
    json: (status, data, headers) => sendJson(res, status, data, headers),
    redirect: (location, options) => redirect(res, location, options),
    send: (status, headers, body) => send(res, status, headers, body),
  };

  const match = routes.find((r) => r.method === req.method && r.re.test(pathname))
    || (req.method === 'HEAD' ? routes.find((r) => r.method === 'GET' && r.re.test(pathname)) : null);

  if (!match) {
    const allowed = routes.some((r) => r.re.test(pathname));
    if (allowed) {
      ctx.send(405, { Allow: 'GET, POST' }, '');
      return;
    }
    ctx.html(404, errorPage(ctx, 404, 'الصفحة غير موجودة', 'تحقّق من الرابط، أو ابدأ من الصفحة الرئيسية.'));
    return;
  }

  const values = match.re.exec(pathname).slice(1).map(decodeURIComponent);
  match.names.forEach((name, i) => { ctx.params[name] = values[i]; });

  // رفض الطلبات القادمة من مواقع أخرى (فحص المنشأ) لكل ما يغيّر الحالة
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    if (ctx.wantsJson) ctx.json(403, { ok: false, message: 'طلب مرفوض — مصدره موقع آخر.' });
    else ctx.html(403, errorPage(ctx, 403, 'طلب مرفوض', 'وصل الطلب من موقع آخر، ولم يُنفَّذ حمايةً لحسابك.'));
    return;
  }

  // الصلاحيات
  if (match.options.auth && !member) {
    const next = encodeURIComponent(url.pathname + url.search);
    ctx.redirect(`/login?next=${next}`);
    return;
  }
  if (match.options.admin && !ctx.isAdmin) {
    ctx.html(403, errorPage(ctx, 403, 'الدخول مقيَّد',
      'لوحة الإدارة متاحة لمن يملك صلاحية إدارة النادي فقط.'));
    return;
  }

  try {
    await match.handler(ctx);
  } catch (err) {
    if (err?.statusCode === 413) {
      if (ctx.wantsJson) ctx.json(413, { ok: false, message: 'الملفّ أكبر من الحدّ المسموح.' });
      else ctx.html(413, errorPage(ctx, 413, 'حجم كبير', 'الملفّ أو النموذج أكبر من الحدّ المسموح.'));
      return;
    }
    console.error(`[خطأ] ${req.method} ${pathname}`, err);
    if (res.headersSent) { res.end(); return; }
    if (ctx.wantsJson) ctx.json(500, { ok: false, message: 'حدث خلل غير متوقّع. حاول مرّة أخرى.' });
    else ctx.html(500, errorPage(ctx, 500, 'خلل غير متوقّع', 'حدث خطأ في الخادم. حاول مرّة أخرى بعد قليل.'));
  }
}

export default handle;

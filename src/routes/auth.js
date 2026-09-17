/** الدخول برقم الجوال وحده، والتسجيل، والخروج. */
import { get, post } from '../app.js';
import config from '../config.js';
import * as Members from '../models/members.js';
import * as Views from '../views/pages.js';
import { readForm } from '../lib/http.js';
import * as Session from '../lib/session.js';
import { hit, tooManyMessage } from '../lib/ratelimit.js';
import { flashFrom } from '../lib/flash.js';
import {
  validateName, validatePhone, validateStudentId, validateEmail, validateMajor,
} from '../lib/validate.js';

/** مسار داخلي فقط — يمنع التحويل إلى موقع خارجي بعد الدخول. */
const safeNext = (value) => {
  const s = String(value || '');
  return /^\/(?!\/)[^\s]*$/.test(s) ? s : '/me';
};

get('/login', (ctx) => {
  if (ctx.member) { ctx.redirect('/me'); return; }
  ctx.html(200, Views.loginPage(ctx, {
    next: safeNext(ctx.query.get('next')),
    flash: flashFrom(ctx.query),
  }));
});

post('/login', async (ctx) => {
  const form = await readForm(ctx.req);
  const next = safeNext(form.next);

  const limit = hit(`login:${ctx.ip}`, config.rateLimits.login);
  if (!limit.allowed) {
    ctx.html(429, Views.loginPage(ctx, {
      values: { phone: form.phone }, next, error: tooManyMessage(limit.retryAfterSec),
    }));
    return;
  }

  const phone = validatePhone(form.phone);
  if (!phone.ok) {
    ctx.html(422, Views.loginPage(ctx, { values: { phone: form.phone }, next, error: phone.message }));
    return;
  }

  const member = Members.findByPhone(phone.value);
  if (!member) {
    ctx.html(404, Views.loginPage(ctx, {
      values: { phone: form.phone }, next,
      error: 'لا توجد عضوية بهذا الرقم. سجّل عضويتك أولًا.',
    }));
    return;
  }

  ctx.redirect(next, {
    headers: { 'Set-Cookie': Session.cookieHeader(Session.issue(member.id), { secure: ctx.secure }) },
  });
});

get('/register', (ctx) => {
  if (ctx.member) { ctx.redirect('/me'); return; }
  ctx.html(200, Views.registerPage(ctx, {}));
});

post('/register', async (ctx) => {
  const form = await readForm(ctx.req);
  const values = {
    full_name: form.full_name || '', phone: form.phone || '', student_id: form.student_id || '',
    email: form.email || '', major: form.major || '',
  };

  const limit = hit(`register:${ctx.ip}`, config.rateLimits.login);
  if (!limit.allowed) {
    ctx.html(429, Views.registerPage(ctx, { values, error: tooManyMessage(limit.retryAfterSec) }));
    return;
  }

  const checks = {
    full_name: validateName(values.full_name),
    phone: validatePhone(values.phone),
    student_id: validateStudentId(values.student_id),
    email: validateEmail(values.email),
    major: validateMajor(values.major),
  };
  const errors = {};
  for (const [field, result] of Object.entries(checks)) {
    if (!result.ok) errors[field] = result.message;
  }
  if (Object.keys(errors).length) {
    ctx.html(422, Views.registerPage(ctx, { values, errors }));
    return;
  }

  const created = Members.createMember({
    fullName: checks.full_name.value,
    phone: checks.phone.value,
    studentId: checks.student_id.value,
    email: checks.email.value,
    major: checks.major.value,
  });

  if (!created.ok) {
    // رسالة محدَّدة للحقل المكرَّر، لا رسالة قاعدة بيانات
    ctx.html(409, Views.registerPage(ctx, { values, errors: { [created.field]: created.message } }));
    return;
  }

  ctx.redirect('/me?ok=registered', {
    headers: { 'Set-Cookie': Session.cookieHeader(Session.issue(created.id), { secure: ctx.secure }) },
  });
});

post('/logout', (ctx) => {
  ctx.redirect('/?ok=logged_out', {
    headers: { 'Set-Cookie': Session.clearCookieHeader({ secure: ctx.secure }) },
  });
});

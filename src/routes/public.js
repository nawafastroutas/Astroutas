/** الصفحات العامّة: الرئيسية، الفعاليات، الهيكلة، عن النادي، التواصل. */
import { get, post } from '../app.js';
import config from '../config.js';
import { getDb } from '../db/index.js';
import * as Events from '../models/events.js';
import * as Members from '../models/members.js';
import * as Tickets from '../models/tickets.js';
import * as Content from '../models/content.js';
import * as Views from '../views/pages.js';
import { flashFrom } from '../lib/flash.js';
import { readForm, absoluteUrl } from '../lib/http.js';
import { hit, tooManyMessage } from '../lib/ratelimit.js';
import { validateName, validatePhone, validateText } from '../lib/validate.js';
import { eventToIcs, icsHeaders } from '../lib/ics.js';
import { alertBox } from '../views/layout.js';

/* ------------------------------- الرئيسية ------------------------------- */
get('/', (ctx) => {
  const db = getDb();
  ctx.html(200, Views.homePage(ctx, {
    announcements: Content.publishedAnnouncements(),
    upcoming: Events.upcoming(3),
    majors: Members.majorsRanking(6),
    board: Members.boardMembers(),
    stats: {
      members: Members.countMembers(),
      events: db.prepare("SELECT COUNT(*) AS n FROM events WHERE status = 'published'").get().n,
      attendance: db.prepare('SELECT COUNT(*) AS n FROM attendances').get().n,
    },
  }));
});

/* ------------------------------- الفعاليات ------------------------------ */
get('/events', (ctx) => {
  const q = (ctx.query.get('q') || '').slice(0, 80);
  const { upcoming, past } = Events.listPublic({ q });
  ctx.html(200, Views.eventsPage(ctx, { upcoming, past, q }));
});

function loadEvent(ctx) {
  const event = Events.findById(Number(ctx.params.id));
  if (!event) return null;
  if (event.status === 'draft' && !ctx.isAdmin) return null;      // المسودّات للإدارة فقط
  return event;
}

get('/events/:id', (ctx) => {
  const event = loadEvent(ctx);
  if (!event) {
    ctx.html(404, Views.errorPage(ctx, 404, 'الفعالية غير موجودة', 'ربما حُذفت أو لم تُنشر بعد.'));
    return;
  }
  const ended = Events.isEnded(event);
  ctx.html(200, Views.eventPage(ctx, {
    event,
    seats: Events.seatsLeft(event),
    ticket: ctx.member ? Tickets.forMemberEvent(ctx.member.id, event.id) : null,
    ended,
    // أسماء المسجَّلين لا تُكشف قبل انتهاء الفعالية
    attendees: ended ? Events.attendees(event.id) : [],
    images: Events.listImages(event.id),
    evaluated: ctx.member ? Tickets.hasEvaluated(event.id, ctx.member.id) : false,
    hasSurvey: !!event.survey_url,          // الرابط نفسه لا يُرسَل إلى المتصفّح
    flash: flashFrom(ctx.query),
  }));
});

/* --------------------------------- الحجز -------------------------------- */
post('/events/:id/book', async (ctx) => {
  const limit = hit(`book:${ctx.ip}`, config.rateLimits.booking);
  if (!limit.allowed) {
    ctx.html(429, Views.errorPage(ctx, 429, 'محاولات كثيرة', tooManyMessage(limit.retryAfterSec)));
    return;
  }
  const event = loadEvent(ctx);
  if (!event) { ctx.redirect('/events'); return; }

  const result = Tickets.book(ctx.member.id, event.id);
  if (result.ok) { ctx.redirect(`/t/${result.ticket.code}?ok=booked`); return; }
  if (result.code === 'DUPLICATE' && result.ticket) {
    ctx.redirect(`/t/${result.ticket.code}?ok=already_booked`);
    return;
  }
  ctx.html(409, Views.errorPage(ctx, 409, 'تعذّر الحجز', result.message));
}, { auth: true });

/* -------------------------------- التقييم ------------------------------- */
get('/events/:id/evaluate', (ctx) => {
  const event = loadEvent(ctx);
  if (!event || !event.survey_url) {
    ctx.html(404, Views.errorPage(ctx, 404, 'لا يوجد استبيان', 'لم يُضَف استبيان تقييم لهذه الفعالية.'));
    return;
  }
  ctx.html(200, Views.evaluateLandingPage(ctx, {
    event,
    evaluated: ctx.member ? Tickets.hasEvaluated(event.id, ctx.member.id) : false,
  }));
});

/**
 * يمنح نقاط التقييم مرّة واحدة ثم يحوّل إلى الاستبيان.
 * رابط الاستبيان الخارجي لا يظهر في أي صفحة — يُرسَل فقط في ردّ هذا الطلب.
 */
post('/events/:id/evaluate', (ctx) => {
  const event = loadEvent(ctx);
  if (!event) {
    if (ctx.wantsJson) ctx.json(404, { ok: false, message: 'الفعالية غير موجودة.' });
    else ctx.html(404, Views.errorPage(ctx, 404, 'الفعالية غير موجودة', 'تحقّق من الرابط.'));
    return;
  }
  const result = Tickets.evaluate(event.id, ctx.member.id);
  if (!result.ok) {
    if (ctx.wantsJson) ctx.json(400, result);
    else ctx.html(400, Views.errorPage(ctx, 400, 'تعذّر التقييم', result.message));
    return;
  }
  if (ctx.wantsJson) {
    ctx.json(200, { ok: true, awarded: result.awarded, points: result.points, message: result.message, url: result.url });
    return;
  }
  ctx.redirect(result.url, { status: 303 });     // بلا JavaScript: تحويل مباشر
}, { auth: true });

/* ------------------------------ ملفّ التقويم ----------------------------- */
get('/events/:id/calendar.ics', (ctx) => {
  const event = loadEvent(ctx);
  if (!event) { ctx.send(404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'غير موجودة'); return; }
  const body = eventToIcs(event, {
    uid: `event-${event.id}@astroutas`,
    url: absoluteUrl(ctx.req, `/events/${event.id}`),
    organizer: config.club.name,
  });
  ctx.send(200, icsHeaders(`event-${event.id}.ics`), Buffer.from(body, 'utf8'));
});

/* ----------------------------- هيكلة النادي ----------------------------- */
get('/structure', (ctx) => {
  ctx.html(200, Views.structurePage(ctx, {
    board: Members.boardMembers(),
    ranked: Members.rankedMembers(),
  }));
});

get('/about', (ctx) => ctx.html(200, Views.aboutPage(ctx)));

/* -------------------------------- التواصل ------------------------------- */
get('/contact', (ctx) => ctx.html(200, Views.contactPage(ctx, { flash: flashFrom(ctx.query) })));

post('/contact', async (ctx) => {
  const form = await readForm(ctx.req);
  const values = { name: form.name || '', phone: form.phone || '', body: form.body || '' };

  const limit = hit(`contact:${ctx.ip}`, config.rateLimits.contact);
  if (!limit.allowed) {
    ctx.html(429, Views.contactPage(ctx, {
      values, flash: alertBox('error', tooManyMessage(limit.retryAfterSec)),
    }));
    return;
  }

  const name = validateName(values.name);
  const phone = validatePhone(values.phone);
  const body = validateText(values.body, { label: 'الرسالة', min: 5, max: 2000 });
  const errors = {};
  if (!name.ok) errors.name = name.message;
  if (!phone.ok) errors.phone = phone.message;
  if (!body.ok) errors.body = body.message;

  if (Object.keys(errors).length) {
    ctx.html(422, Views.contactPage(ctx, { values, errors }));
    return;
  }
  Content.createMessage({ name: name.value, phone: phone.value, body: body.value });
  ctx.redirect('/contact?ok=message_sent');
});

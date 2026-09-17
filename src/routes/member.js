/** عضويتي والتذكرة. */
import { get, post } from '../app.js';
import config from '../config.js';
import * as Members from '../models/members.js';
import * as Tickets from '../models/tickets.js';
import * as Events from '../models/events.js';
import * as Views from '../views/pages.js';
import { readForm, absoluteUrl } from '../lib/http.js';
import { flashFrom } from '../lib/flash.js';
import { validateName, validateMajor } from '../lib/validate.js';
import { toSvg } from '../lib/qr.js';
import { eventToIcs, icsHeaders } from '../lib/ics.js';

const meData = (ctx, extra = {}) => ({
  member: ctx.member,
  points: Members.pointsOf(ctx.member.id),
  badges: Members.badgesOf(ctx.member.id),
  tickets: Tickets.forMember(ctx.member.id),
  flash: flashFrom(ctx.query),
  ...extra,
});

get('/me', (ctx) => ctx.html(200, Views.mePage(ctx, meData(ctx))), { auth: true });

post('/me', async (ctx) => {
  const form = await readForm(ctx.req);
  const name = validateName(form.full_name);
  const major = validateMajor(form.major);
  const errors = {};
  if (!name.ok) errors.full_name = name.message;
  if (!major.ok) errors.major = major.message;

  if (Object.keys(errors).length) {
    ctx.html(422, Views.mePage(ctx, meData(ctx, { errors })));
    return;
  }
  Members.updateProfile(ctx.member.id, { fullName: name.value, major: major.value });
  ctx.redirect('/me?ok=profile_saved');
}, { auth: true });

/* -------------------------------- التذكرة ------------------------------- */
function loadTicket(ctx) {
  const ticket = Tickets.byCode(String(ctx.params.code || '').toUpperCase());
  if (!ticket) return null;
  // التذكرة لصاحبها أو لإدارة النادي
  if (ticket.member_id !== ctx.member.id && !ctx.isAdmin) return null;
  return ticket;
}

get('/t/:code', (ctx) => {
  const ticket = loadTicket(ctx);
  if (!ticket) {
    ctx.html(404, Views.errorPage(ctx, 404, 'التذكرة غير موجودة', 'تحقّق من الرمز، أو افتحها من صفحة عضويتك.'));
    return;
  }
  ctx.html(200, Views.ticketPage(ctx, {
    ticket,
    event: Events.findById(ticket.event_id),
    // الرمز نفسه هو ما يُمسح — لا رابط، ليعمل المسح بلا إنترنت
    qrSvg: toSvg(ticket.code, { ecl: 'Q', scale: 6, label: `رمز التذكرة ${ticket.code}` }),
  }));
}, { auth: true });

get('/t/:code/calendar.ics', (ctx) => {
  const ticket = loadTicket(ctx);
  if (!ticket) { ctx.send(404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'غير موجودة'); return; }
  const event = Events.findById(ticket.event_id);
  const body = eventToIcs(event, {
    uid: `ticket-${ticket.code}@astroutas`,
    url: absoluteUrl(ctx.req, `/t/${ticket.code}`),
    organizer: config.club.name,
  });
  ctx.send(200, icsHeaders(`ticket-${ticket.code}.ics`), Buffer.from(body, 'utf8'));
}, { auth: true });

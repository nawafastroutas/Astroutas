/** لوحة الإدارة: الفعاليات، الأعضاء، الإعلانات، الرسائل، المسح، التصدير. */
import { get, post } from '../app.js';
import config from '../config.js';
import { getDb } from '../db/index.js';
import * as Events from '../models/events.js';
import * as Members from '../models/members.js';
import * as Tickets from '../models/tickets.js';
import * as Content from '../models/content.js';
import * as AdminViews from '../views/admin.js';
import * as Views from '../views/pages.js';
import { flashFrom } from '../lib/flash.js';
import { readForm, readBody, readJson, absoluteUrl } from '../lib/http.js';
import { hit, tooManyMessage } from '../lib/ratelimit.js';
import { putObject, deleteObject } from '../lib/storage.js';
import { toCsv, csvHeaders } from '../lib/csv.js';
import { toSvg } from '../lib/qr.js';
import { omanInputToUtc, formatForExport } from '../lib/datetime.js';
import { validateText, validateUrl, validateInt, validateName, validateMajor } from '../lib/validate.js';

const ADMIN = { admin: true, auth: true };
const newMessages = () => Content.countNewMessages();

/* قوالب جاهزة تملأ النموذج وتقترح موعدًا (يوم ثلاثاء قادم، ٦ مساءً). */
const TEMPLATES = [
  { label: 'أمسية شعرية', title: 'أمسية شعرية', category: 'أمسية شعرية', location: 'مسرح الكلية',
    description: 'أمسية يقرأ فيها شعراء النادي قصائدهم، ومنبر مفتوح لمن أراد المشاركة.',
    capacity: 80, points: 20, badge_name: 'حاضر الأمسية', durationHours: 2 },
  { label: 'ورشة كتابة', title: 'ورشة الكتابة الإبداعية', category: 'ورشة', location: 'قاعة التدريب',
    description: 'ورشة عملية في بناء النصّ وتحرير الأسلوب، مع تطبيقات مباشرة.',
    capacity: 30, points: 25, badge_name: 'متدرّب الورشة', durationHours: 3 },
  { label: 'نادي القراءة', title: 'جلسة نادي القراءة', category: 'نادي قراءة', location: 'مكتبة الكلية',
    description: 'مناقشة كتاب الشهر: قراءات الأعضاء وآراؤهم في جلسة مفتوحة.',
    capacity: 25, points: 15, badge_name: 'قارئ الشهر', durationHours: 2 },
  { label: 'مسابقة ثقافية', title: 'المسابقة الثقافية', category: 'مسابقة', location: 'قاعة المحاضرات',
    description: 'مسابقة بين فرق الطلبة في الأدب واللغة والمعلومات العامّة، بجوائز للفائزين.',
    capacity: 100, points: 30, badge_name: 'متسابق', durationHours: 2 },
  { label: 'محاضرة', title: 'محاضرة ثقافية', category: 'محاضرة', location: 'قاعة المحاضرات',
    description: 'محاضرة يقدّمها ضيف في موضوع أدبي أو لغوي، يعقبها نقاش مفتوح.',
    capacity: 120, points: 15, badge_name: 'حاضر المحاضرة', durationHours: 2 },
];

/* ------------------------------ نظرة عامّة ------------------------------ */
get('/admin', (ctx) => {
  const db = getDb();
  ctx.html(200, AdminViews.dashboardView(ctx, {
    stats: {
      members: Members.countMembers(),
      events: Events.countEvents(),
      newMessages: newMessages(),
      attendance: db.prepare('SELECT COUNT(*) AS n FROM attendances').get().n,
    },
    upcoming: Events.upcoming(5),
    messages: Content.listMessages().slice(0, 4),
    flash: flashFrom(ctx.query),
  }));
}, ADMIN);

/* ------------------------------- الفعاليات ------------------------------ */
function eventFromForm(form) {
  const errors = {};
  const title = validateText(form.title, { label: 'العنوان', max: 150 });
  if (!title.ok) errors.title = title.message;
  const starts = omanInputToUtc(form.starts_at);
  const ends = omanInputToUtc(form.ends_at);
  if (!starts) errors.starts_at = 'موعد البداية مطلوب.';
  if (!ends) errors.ends_at = 'موعد النهاية مطلوب.';
  if (starts && ends && new Date(ends) <= new Date(starts)) errors.ends_at = 'النهاية يجب أن تكون بعد البداية.';
  const survey = validateUrl(form.survey_url, { label: 'رابط الاستبيان' });
  if (!survey.ok) errors.survey_url = survey.message;
  const capacity = validateInt(form.capacity, { label: 'السعة', min: 0, max: 100000, fallback: 0 });
  const points = validateInt(form.points, { label: 'النقاط', min: 0, max: 10000, fallback: 0 });
  const status = ['published', 'draft', 'cancelled'].includes(form.status) ? form.status : 'draft';

  return {
    errors,
    data: {
      title: title.ok ? title.value : String(form.title || ''),
      description: String(form.description || '').trim().slice(0, 5000),
      category: String(form.category || '').trim().slice(0, 60),
      location: String(form.location || '').trim().slice(0, 120),
      starts_at: starts, ends_at: ends,
      capacity: capacity.ok ? capacity.value : 0,
      points: points.ok ? points.value : 0,
      badge_name: String(form.badge_name || '').trim().slice(0, 60),
      status,
      survey_url: survey.ok && survey.value ? survey.value : null,
      is_test: form.is_test ? 1 : 0,
    },
  };
}

const renderEvents = (ctx, { editing = null, errors = {}, status = 200 } = {}) => {
  ctx.html(status, AdminViews.eventsView(ctx, {
    events: Events.listAll(),
    editing,
    errors,
    images: editing ? Events.listImages(editing.id) : [],
    templates: TEMPLATES,
    flash: flashFrom(ctx.query),
    newMessages: newMessages(),
  }));
};

get('/admin/events', (ctx) => {
  const editId = Number(ctx.query.get('edit'));
  renderEvents(ctx, { editing: editId ? Events.findById(editId) : null });
}, ADMIN);

post('/admin/events', async (ctx) => {
  const form = await readForm(ctx.req);
  const { errors, data } = eventFromForm(form);
  if (Object.keys(errors).length) {
    renderEvents(ctx, { editing: { ...data, id: null }, errors, status: 422 });
    return;
  }
  const event = Events.create(data);
  ctx.redirect(`/admin/events?edit=${event.id}&ok=event_created`);
}, ADMIN);

post('/admin/events/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Events.findById(id)) { ctx.redirect('/admin/events'); return; }
  const form = await readForm(ctx.req);
  const { errors, data } = eventFromForm(form);
  if (Object.keys(errors).length) {
    renderEvents(ctx, { editing: { ...data, id }, errors, status: 422 });
    return;
  }
  Events.update(id, data);
  ctx.redirect(`/admin/events?edit=${id}&ok=event_saved`);
}, ADMIN);

post('/admin/events/:id/delete', (ctx) => {
  const result = Events.remove(Number(ctx.params.id));
  if (result.ok) { ctx.redirect('/admin/events?ok=event_deleted'); return; }
  ctx.html(409, Views.errorPage(ctx, 409, 'لا يمكن الحذف', result.message));
}, ADMIN);

post('/admin/events/:id/cancel', (ctx) => {
  Events.cancel(Number(ctx.params.id));
  ctx.redirect('/admin/events?ok=event_cancelled');
}, ADMIN);

/** باركود التقييم يُعرض على الشاشة — يحمل رابط الموقع لا رابط الاستبيان. */
get('/admin/events/:id/survey', (ctx) => {
  const event = Events.findById(Number(ctx.params.id));
  if (!event || !event.survey_url) {
    ctx.html(404, Views.errorPage(ctx, 404, 'لا يوجد استبيان', 'أضف رابط الاستبيان أولًا.'));
    return;
  }
  const url = absoluteUrl(ctx.req, `/events/${event.id}/evaluate`);
  ctx.html(200, AdminViews.surveyQrView(ctx, {
    event, url, qrSvg: toSvg(url, { ecl: 'M', scale: 10, label: 'باركود تقييم الفعالية' }),
  }));
}, ADMIN);

/* ------------------------------ رفع الصور ------------------------------- */
/** يستقبل الصورة الخام (مضغوطة في المتصفّح) — بلا multipart. */
async function receiveImage(ctx, prefix) {
  const limit = hit(`upload:${ctx.ip}`, config.rateLimits.upload);
  if (!limit.allowed) return { ok: false, message: tooManyMessage(limit.retryAfterSec), status: 429 };
  const buffer = await readBody(ctx.req, config.uploads.maxBytes + 1024);
  const stored = putObject(buffer, { prefix });
  return stored.ok ? { ok: true, key: stored.key } : { ok: false, message: stored.message, status: 422 };
}

post('/admin/events/:id/images', async (ctx) => {
  const event = Events.findById(Number(ctx.params.id));
  if (!event) { ctx.json(404, { ok: false, message: 'الفعالية غير موجودة.' }); return; }
  const result = await receiveImage(ctx, 'events');
  if (!result.ok) { ctx.json(result.status, { ok: false, message: result.message }); return; }
  Events.addImage(event.id, result.key);
  ctx.json(200, { ok: true, message: 'رُفعت الصورة.', url: `/o/${result.key}` });
}, ADMIN);

post('/admin/events/:id/images/:imageId/delete', (ctx) => {
  Events.removeImage(Number(ctx.params.id), Number(ctx.params.imageId));
  ctx.redirect(`/admin/events?edit=${ctx.params.id}&ok=image_deleted`);
}, ADMIN);

post('/admin/members/:id/photo', async (ctx) => {
  const member = Members.findById(Number(ctx.params.id));
  if (!member) { ctx.json(404, { ok: false, message: 'العضو غير موجود.' }); return; }
  const result = await receiveImage(ctx, 'members');
  if (!result.ok) { ctx.json(result.status, { ok: false, message: result.message }); return; }
  if (member.photo_key) deleteObject(member.photo_key);
  Members.setPhoto(member.id, result.key);
  ctx.json(200, { ok: true, message: 'حُدِّثت الصورة.', url: `/o/${result.key}` });
}, ADMIN);

post('/admin/announcements/:id/image', async (ctx) => {
  const item = Content.announcementById(Number(ctx.params.id));
  if (!item) { ctx.json(404, { ok: false, message: 'الإعلان غير موجود.' }); return; }
  const result = await receiveImage(ctx, 'news');
  if (!result.ok) { ctx.json(result.status, { ok: false, message: result.message }); return; }
  if (item.image_key) deleteObject(item.image_key);
  Content.updateAnnouncement(item.id, { ...item, image_key: result.key });
  ctx.json(200, { ok: true, message: 'رُفعت الصورة.', url: `/o/${result.key}` });
}, ADMIN);

/* -------------------------------- الأعضاء ------------------------------- */
get('/admin/members', (ctx) => {
  const q = (ctx.query.get('q') || '').slice(0, 80);
  const members = Members.listMembers({ q });
  const emails = Members.allMembersForExport().map((m) => m.email).join(',');
  ctx.html(200, AdminViews.membersView(ctx, {
    members, q, flash: flashFrom(ctx.query), newMessages: newMessages(),
    bccHref: `mailto:${encodeURIComponent(config.club.email)}?bcc=${encodeURIComponent(emails)}`
      + `&subject=${encodeURIComponent(config.club.name)}`,
  }));
}, ADMIN);

post('/admin/members/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  const member = Members.findById(id);
  if (!member) { ctx.redirect('/admin/members'); return; }
  const form = await readForm(ctx.req);
  const order = validateInt(form.display_order, { label: 'الترتيب', min: -999, max: 9999, fallback: 0 });
  // لا يُسقط المدير صلاحيته عن نفسه بالخطأ
  const isAdmin = id === ctx.member.id ? 1 : (form.is_admin ? 1 : 0);
  Members.updateAdminFields(id, {
    clubRole: String(form.club_role || '').slice(0, 60),
    displayOrder: order.ok ? order.value : member.display_order,
    isAdmin,
  });
  ctx.redirect(`/admin/members?ok=member_saved${ctx.query.get('q') ? `&q=${encodeURIComponent(ctx.query.get('q'))}` : ''}`);
}, ADMIN);

/* ------------------------------- الإعلانات ------------------------------ */
function announcementFromForm(form, existing = null) {
  const link = validateUrl(form.link_url, { label: 'الرابط' });
  return {
    title: String(form.title || '').trim().slice(0, 150) || 'بلا عنوان',
    body: String(form.body || '').trim().slice(0, 4000),
    image_key: existing?.image_key || null,
    link_url: link.ok && link.value ? link.value : null,
    pinned: form.pinned ? 1 : 0,
    published: form.published ? 1 : 0,
    expires_at: omanInputToUtc(form.expires_at),
    sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : 0,
  };
}

get('/admin/announcements', (ctx) => {
  const editId = Number(ctx.query.get('edit'));
  ctx.html(200, AdminViews.announcementsView(ctx, {
    items: Content.allAnnouncements(),
    editing: editId ? Content.announcementById(editId) : null,
    flash: flashFrom(ctx.query),
    newMessages: newMessages(),
  }));
}, ADMIN);

post('/admin/announcements', async (ctx) => {
  const form = await readForm(ctx.req);
  const created = Content.createAnnouncement(announcementFromForm(form));
  ctx.redirect(`/admin/announcements?edit=${created.id}&ok=announcement_saved`);
}, ADMIN);

post('/admin/announcements/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  const existing = Content.announcementById(id);
  if (!existing) { ctx.redirect('/admin/announcements'); return; }
  const form = await readForm(ctx.req);
  Content.updateAnnouncement(id, announcementFromForm(form, existing));
  ctx.redirect(`/admin/announcements?edit=${id}&ok=announcement_saved`);
}, ADMIN);

post('/admin/announcements/:id/toggle', async (ctx) => {
  const id = Number(ctx.params.id);
  const item = Content.announcementById(id);
  if (item) {
    const form = await readForm(ctx.req);
    if (form.field === 'pinned') Content.setAnnouncementFlags(id, { pinned: !item.pinned });
    else Content.setAnnouncementFlags(id, { published: !item.published });
  }
  ctx.redirect('/admin/announcements?ok=announcement_saved');
}, ADMIN);

post('/admin/announcements/:id/delete', (ctx) => {
  Content.deleteAnnouncement(Number(ctx.params.id));
  ctx.redirect('/admin/announcements?ok=announcement_deleted');
}, ADMIN);

/* -------------------------------- الرسائل ------------------------------- */
get('/admin/messages', (ctx) => {
  ctx.html(200, AdminViews.messagesView(ctx, {
    messages: Content.listMessages(), flash: flashFrom(ctx.query), newMessages: newMessages(),
  }));
}, ADMIN);

post('/admin/messages/:id/read', (ctx) => {
  Content.markMessageRead(Number(ctx.params.id));
  ctx.redirect('/admin/messages?ok=message_read');
}, ADMIN);

/* --------------------------------- المسح -------------------------------- */
get('/admin/scan', (ctx) => {
  ctx.html(200, AdminViews.scanView(ctx, {
    events: Events.listAll().filter((e) => e.status !== 'draft').slice(0, 50),
    selectedId: ctx.query.get('event') || '',
    newMessages: newMessages(),
  }));
}, ADMIN);

post('/api/scan', async (ctx) => {
  const limit = hit(`scan:${ctx.ip}`, config.rateLimits.scan);
  if (!limit.allowed) { ctx.json(429, { ok: false, message: tooManyMessage(limit.retryAfterSec) }); return; }

  const payload = await readJson(ctx.req);
  if (!payload) { ctx.json(400, { ok: false, message: 'طلب غير مفهوم.' }); return; }

  const result = Tickets.scan(payload.code, ctx.member.id);
  const ticket = result.ticket;
  ctx.json(result.ok ? 200 : 422, {
    ok: !!result.ok,
    repeat: !!result.repeat,
    message: result.message,
    member: ticket ? { name: ticket.member_name, major: ticket.member_major, studentId: ticket.member_student_id } : null,
    event: ticket ? { id: ticket.event_id, title: ticket.event_title } : null,
    attendance: result.attendance || null,
  });
}, ADMIN);

/* -------------------------------- التصدير ------------------------------- */
get('/admin/export', (ctx) => {
  const db = getDb();
  ctx.html(200, AdminViews.exportView(ctx, {
    newMessages: newMessages(),
    counts: {
      members: Members.countMembers(),
      attendance: db.prepare('SELECT COUNT(*) AS n FROM attendances').get().n,
    },
  }));
}, ADMIN);

get('/admin/export/members.csv', (ctx) => {
  const rows = Members.allMembersForExport().map((m) => [
    m.id, m.full_name, m.phone, m.student_id, m.email, m.major,
    m.club_role || '', m.display_order, m.is_admin ? 'نعم' : 'لا',
    formatForExport(m.joined_at), m.total_points, m.attendance_count, m.evaluation_count,
  ]);
  const csv = toCsv([
    'المعرّف', 'الاسم الثلاثي', 'الجوال', 'الرقم الجامعي', 'الإيميل الجامعي', 'التخصّص',
    'الرتبة', 'ترتيب الظهور', 'صلاحية إدارة', 'تاريخ الانضمام',
    'مجموع النقاط', 'مرّات الحضور', 'عدد التقييمات',
  ], rows);
  ctx.send(200, { ...csvHeaders('members.csv'), 'Content-Length': csv.length }, csv);
}, ADMIN);

get('/admin/export/attendance.csv', (ctx) => {
  const rows = Events.attendanceForExport().map((r) => [
    r.event_title, r.category, formatForExport(r.starts_at), r.location,
    r.full_name, r.student_id, r.phone, r.email, r.major,
    formatForExport(r.scanned_at), r.points_awarded, r.badge_name, r.card_id, r.scanned_by_name || '',
  ]);
  const csv = toCsv([
    'الفعالية', 'التصنيف', 'موعد البداية', 'المكان',
    'اسم العضو', 'الرقم الجامعي', 'الجوال', 'الإيميل', 'التخصّص',
    'وقت المسح', 'النقاط الممنوحة', 'الشارة', 'معرّف البطاقة', 'مَن مسحها',
  ], rows);
  ctx.send(200, { ...csvHeaders('attendance.csv'), 'Content-Length': csv.length }, csv);
}, ADMIN);

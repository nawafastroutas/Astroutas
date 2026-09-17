/**
 * فحوص قواعد النادي: التسجيل، الحجز، المسح، التقييم، النقاط، التصدير.
 * تعمل على قاعدة بيانات مؤقّتة مستقلّة.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'club-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.OBJECTS_DIR = path.join(tmp, 'objects');
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = 'secret-for-tests-only';

const { getDb } = await import('../src/db/index.js');
const Members = await import('../src/models/members.js');
const Events = await import('../src/models/events.js');
const Tickets = await import('../src/models/tickets.js');
const Content = await import('../src/models/content.js');
const config = (await import('../src/config.js')).default;

const db = getDb();
const hours = (h) => new Date(Date.now() + h * 3600e3).toISOString().replace(/\.\d{3}Z$/, 'Z');

const makeMember = (n, extra = {}) => Members.createMember({
  fullName: `عضو رقم ${n} الاختباري`,
  phone: `+9689${String(1000000 + n).slice(-7)}`,
  studentId: `2023${String(1000 + n)}`,
  email: `member${n}@utas.edu.om`,
  major: 'اللغة العربية',
  ...extra,
});

const makeEvent = (over = {}) => Events.create({
  title: 'فعالية اختبار', description: '', category: 'ورشة', location: 'قاعة',
  starts_at: hours(1), ends_at: hours(3), capacity: 0, points: 20,
  badge_name: 'شارة الاختبار', status: 'published', survey_url: null, is_test: 0, ...over,
});

/* ----------------------------- تفرّد العضوية ---------------------------- */
test('الجوال والرقم الجامعي والإيميل: كلٌّ فريد برسالة محدَّدة', () => {
  const first = makeMember(1);
  assert.ok(first.ok);

  const samePhone = Members.createMember({
    fullName: 'شخص آخر تمامًا', phone: '+96891000001', studentId: '20239001',
    email: 'other1@utas.edu.om', major: 'العلوم',
  });
  assert.equal(samePhone.ok, false);
  assert.equal(samePhone.message, 'هذا الرقم مسجّل بعضوية أخرى.');

  const sameStudentId = Members.createMember({
    fullName: 'شخص آخر تمامًا', phone: '+96899000001', studentId: '20231001',
    email: 'other2@utas.edu.om', major: 'العلوم',
  });
  assert.equal(sameStudentId.message, 'هذا الرقم الجامعي مسجّل بعضوية أخرى.');

  const sameEmail = Members.createMember({
    fullName: 'شخص آخر تمامًا', phone: '+96899000002', studentId: '20239002',
    email: 'member1@utas.edu.om', major: 'العلوم',
  });
  assert.equal(sameEmail.message, 'هذا الإيميل مسجّل بعضوية أخرى.');
});

/* --------------------------------- الحجز -------------------------------- */
test('تذكرة واحدة لكل عضو لكل فعالية — يحرسها قيد في القاعدة', () => {
  const member = makeMember(2);
  const event = makeEvent();

  const first = Tickets.book(member.id, event.id);
  assert.equal(first.ok, true);

  const second = Tickets.book(member.id, event.id);
  assert.equal(second.ok, false);
  assert.equal(second.code, 'DUPLICATE');
  assert.equal(second.ticket.code, first.ticket.code, 'يُعاد نفس رمز التذكرة');

  // القيد نفسه في القاعدة، لا في الشيفرة
  assert.throws(
    () => db.prepare('INSERT INTO tickets (member_id, event_id, code) VALUES (?, ?, ?)')
      .run(member.id, event.id, 'ASTQ-MANUAL22'),
    /UNIQUE constraint failed: tickets.member_id, tickets.event_id/,
  );
});

test('الحجز يُرفض: غير منشورة، منتهية، أو مكتملة السعة', () => {
  const member = makeMember(3);

  const draft = makeEvent({ status: 'draft' });
  assert.equal(Tickets.book(member.id, draft.id).code, 'NOT_PUBLISHED');

  const cancelled = makeEvent({ status: 'cancelled' });
  assert.equal(Tickets.book(member.id, cancelled.id).code, 'CANCELLED');

  const ended = makeEvent({ starts_at: hours(-5), ends_at: hours(-3) });
  assert.equal(Tickets.book(member.id, ended.id).code, 'ENDED');

  const full = makeEvent({ capacity: 1 });
  assert.equal(Tickets.book(makeMember(4).id, full.id).ok, true);
  const rejected = Tickets.book(member.id, full.id);
  assert.equal(rejected.code, 'FULL');
  assert.equal(rejected.message, 'اكتملت مقاعد هذه الفعالية.');
});

/* --------------------------------- المسح -------------------------------- */
test('نافذة المسح: تفتح قبل البداية بساعتين وتغلق بعد النهاية باثنتي عشرة ساعة', () => {
  const admin = makeMember(5, { isAdmin: 1 });
  const member = makeMember(6);

  const soon = makeEvent({ starts_at: hours(3), ends_at: hours(5) });   // أبعد من ساعتين
  const early = Tickets.book(member.id, soon.id);
  assert.equal(Tickets.scan(early.ticket.code, admin.id).code, 'WINDOW_CLOSED');

  const longGone = makeEvent({ starts_at: hours(-20), ends_at: hours(-13) });
  db.prepare('INSERT INTO tickets (member_id, event_id, code) VALUES (?, ?, ?)')
    .run(member.id, longGone.id, 'ASTQ-LATE2345');
  const late = Tickets.scan('ASTQ-LATE2345', admin.id);
  assert.equal(late.code, 'WINDOW_CLOSED');
  assert.match(late.message, /أُغلقت/);

  // داخل النافذة: قبل البداية بساعة
  const open = makeEvent({ starts_at: hours(1), ends_at: hours(3) });
  const ticket = Tickets.book(makeMember(7).id, open.id);
  assert.equal(Tickets.scan(ticket.ticket.code, admin.id).ok, true);
});

test('المسح يمنح النقاط والشارة والبطاقة مرّة واحدة مهما تكرّر', () => {
  const admin = makeMember(8, { isAdmin: 1 });
  const member = makeMember(9);
  const event = makeEvent({ points: 30, badge_name: 'شارة الحضور' });
  const { ticket } = Tickets.book(member.id, event.id);

  const first = Tickets.scan(ticket.code, admin.id);
  assert.equal(first.ok, true);
  assert.equal(first.repeat, false);
  assert.equal(first.attendance.points_awarded, 30);
  assert.equal(first.attendance.badge_name, 'شارة الحضور');
  assert.ok(first.attendance.card_id.startsWith('CARD-'));

  for (let i = 0; i < 3; i += 1) {
    const again = Tickets.scan(ticket.code, admin.id);
    assert.equal(again.repeat, true);
    assert.equal(again.message, 'ممسوحة من قبل — لم تُمنح نقاط جديدة.');
    assert.equal(again.attendance.card_id, first.attendance.card_id, 'البطاقة نفسها');
  }

  assert.equal(Members.pointsOf(member.id).total_points, 30, 'النقاط لم تتضاعف');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM attendances WHERE ticket_id = ?').get(ticket.id).n, 1);
});

test('المسح يقبل الرمز وحده أو داخل رابط، ويرفض ما سواه', () => {
  const admin = makeMember(10, { isAdmin: 1 });
  const event = makeEvent();
  const { ticket } = Tickets.book(makeMember(11).id, event.id);

  assert.equal(Tickets.normalizeCode(`https://club.example/t/${ticket.code}`), ticket.code);
  assert.equal(Tickets.normalizeCode(ticket.code.toLowerCase()), ticket.code);
  assert.equal(Tickets.normalizeCode('مرحبا'), null);
  assert.equal(Tickets.scan('ASTQ-ZZZZZZZZ', admin.id).code, 'NOT_FOUND');
  assert.equal(Tickets.scan('لا شيء', admin.id).code, 'BAD_CODE');
});

/* -------------------------------- التقييم ------------------------------- */
test('التقييم: عشر نقاط مرّة واحدة، والرابط يعود من الردّ في الحالتين', () => {
  const member = makeMember(12);
  const event = makeEvent({ survey_url: 'https://forms.example/survey' });

  const first = Tickets.evaluate(event.id, member.id);
  assert.equal(first.awarded, true);
  assert.equal(first.points, config.evaluationPoints);
  assert.equal(first.url, 'https://forms.example/survey');

  const second = Tickets.evaluate(event.id, member.id);
  assert.equal(second.awarded, false, 'لا تُمنح النقاط مرّتين');
  assert.equal(second.url, 'https://forms.example/survey', 'الاستبيان يُفتح مع ذلك');

  assert.equal(Members.pointsOf(member.id).total_points, config.evaluationPoints);
  assert.equal(Tickets.evaluate(makeEvent().id, member.id).code, 'NO_SURVEY');
});

/* -------------------------------- النقاط -------------------------------- */
test('النقاط تُحسب ولا تُخزَّن، والفعاليات التجريبية خارج الحساب', () => {
  const admin = makeMember(13, { isAdmin: 1 });
  const member = makeMember(14);

  const real = makeEvent({ points: 25, survey_url: 'https://forms.example/x' });
  const trial = makeEvent({ points: 500, is_test: 1, survey_url: 'https://forms.example/y' });

  Tickets.scan(Tickets.book(member.id, real.id).ticket.code, admin.id);
  Tickets.scan(Tickets.book(member.id, trial.id).ticket.code, admin.id);
  Tickets.evaluate(real.id, member.id);
  Tickets.evaluate(trial.id, member.id);

  const points = Members.pointsOf(member.id);
  assert.equal(points.total_points, 25 + config.evaluationPoints, 'التجريبية لا تُحتسب');
  assert.equal(points.attendance_count, 1);

  // لا عمود مخزَّن للنقاط أصلًا
  const columns = db.prepare('PRAGMA table_info(members)').all().map((c) => c.name);
  assert.ok(!columns.some((c) => c.includes('point')), 'لا عمود نقاط في جدول الأعضاء');

  // تغيير المصدر يغيّر المجموع فورًا
  db.prepare('UPDATE attendances SET points_awarded = 5 WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = ?)').run(real.id);
  assert.equal(Members.pointsOf(member.id).total_points, 5 + config.evaluationPoints);
});

/* ------------------------- حذف فعالية فيها حضور ------------------------- */
test('لا تُحذف فعالية سُجّل فيها حضور — تُحوَّل إلى ملغاة', () => {
  const admin = makeMember(15, { isAdmin: 1 });
  const event = makeEvent();
  const { ticket } = Tickets.book(makeMember(16).id, event.id);
  Tickets.scan(ticket.code, admin.id);

  const result = Events.remove(event.id);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HAS_ATTENDANCE');
  assert.ok(Events.findById(event.id), 'الفعالية باقية');

  // الحارس في القاعدة نفسها
  assert.throws(() => db.prepare('DELETE FROM events WHERE id = ?').run(event.id), /EVENT_HAS_ATTENDANCE/);

  assert.equal(Events.cancel(event.id).status, 'cancelled');

  // فعالية بلا حضور تُحذف عاديًّا
  const empty = makeEvent();
  assert.equal(Events.remove(empty.id).ok, true);
  assert.equal(Events.findById(empty.id), null);
});

/* --------------------------- أسماء الحضور --------------------------- */
test('قائمة من حضر تُقرأ من الحضور لا من الحجوزات', () => {
  const admin = makeMember(17, { isAdmin: 1 });
  const present = makeMember(18);
  const absent = makeMember(19);
  const event = makeEvent();

  const ticket = Tickets.book(present.id, event.id).ticket;
  Tickets.book(absent.id, event.id);
  Tickets.scan(ticket.code, admin.id);

  const names = Events.attendees(event.id).map((a) => a.full_name);
  assert.equal(names.length, 1);
  assert.ok(names[0].includes('18'));
});

/* -------------------------------- التصدير ------------------------------- */
test('CSV بترميز UTF-8 مع BOM وصفّ لكل حضور', async () => {
  const { toCsv } = await import('../src/lib/csv.js');
  const csv = toCsv(['الاسم', 'النقاط'], [['نواف, المقبالي', 20], ['="خطر"', 5]]);
  assert.equal(csv[0], 0xef);
  assert.equal(csv[1], 0xbb);
  assert.equal(csv[2], 0xbf);
  const text = csv.toString('utf8');
  assert.match(text, /^﻿الاسم,النقاط\r\n/);
  assert.match(text, /"نواف, المقبالي"/, 'الفاصلة داخل خلية مقتبسة');
  assert.ok(text.includes('"\'=""خطر"""'), 'الصيغة تُبطَل بفاصلة واقية ثم تُقتبس');

  const rows = Events.attendanceForExport();
  assert.ok(rows.length > 0);
  assert.ok(Object.keys(rows[0]).includes('card_id'));
});

/* ------------------------------- الجلسات -------------------------------- */
test('الجلسة مبصومة: العبث بها يُبطلها، وتنتهي بعد أسبوع', async () => {
  const Session = await import('../src/lib/session.js');
  const token = Session.issue(42);
  assert.equal(Session.verify(token).memberId, 42);

  const [, body, mac] = token.split('.');
  assert.equal(Session.verify(`v1.${body}.${mac.slice(0, -2)}xx`), null, 'بصمة مزوَّرة');
  const forged = Buffer.from(JSON.stringify({ m: 1, exp: Date.now() + 1e6 })).toString('base64url');
  assert.equal(Session.verify(`v1.${forged}.${mac}`), null, 'حمولة مبدَّلة');
  assert.equal(Session.verify('لا شيء'), null);

  const expired = Buffer.from(JSON.stringify({ m: 1, iat: 0, exp: Date.now() - 1000 })).toString('base64url');
  const crypto = await import('node:crypto');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(expired).digest('base64url');
  assert.equal(Session.verify(`v1.${expired}.${sig}`), null, 'منتهية');

  const header = Session.cookieHeader(token, { secure: true });
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
  assert.match(header, /Max-Age=604800/);
});

/* ----------------------------- حدّ المعدّل ------------------------------ */
test('حدّ المعدّل يسمح ثمّ يمنع ثمّ يسمح بعد النافذة', async () => {
  const { hit, reset, tooManyMessage } = await import('../src/lib/ratelimit.js');
  reset();
  const rule = { limit: 3, windowMs: 1000 };
  const now = Date.now();
  assert.equal(hit('ip', rule, now).allowed, true);
  assert.equal(hit('ip', rule, now).allowed, true);
  assert.equal(hit('ip', rule, now).allowed, true);
  const blocked = hit('ip', rule, now);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(hit('ip-آخر', rule, now).allowed, true, 'المفاتيح مستقلّة');
  assert.equal(hit('ip', rule, now + 1200).allowed, true, 'بعد انقضاء النافذة');
  assert.match(tooManyMessage(300), /محاولات كثيرة/);
});

/* ------------------------------ فحص المنشأ ------------------------------ */
test('فحص المنشأ يرفض الطلبات من مواقع أخرى', async () => {
  const { sameOrigin } = await import('../src/lib/http.js');
  const req = (headers) => ({ headers });
  assert.equal(sameOrigin(req({ host: 'club.om', origin: 'https://club.om' })), true);
  assert.equal(sameOrigin(req({ host: 'club.om', origin: 'https://evil.com' })), false);
  assert.equal(sameOrigin(req({ host: 'club.om', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(sameOrigin(req({ host: 'club.om', 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(sameOrigin(req({ host: 'club.om', referer: 'https://evil.com/x' })), false);
  assert.equal(sameOrigin(req({ host: 'club.om', 'sec-fetch-site': 'none' })), true, 'تصفّح مباشر');
  assert.equal(sameOrigin(req({ host: 'club.om', 'sec-fetch-site': 'same-site' })), false, 'نطاق فرعي آخر');
  assert.equal(sameOrigin(req({ host: 'club.om', referer: 'https://club.om/events' })), true);
  assert.equal(sameOrigin(req({ host: 'club.om' })), true, 'عميل قديم بلا ترويسات');
});

/* --------------------------- تخزين الكائنات ---------------------------- */
test('الصور: مفاتيح عشوائية، وحدّ حجم، وأنواع محدّدة', async () => {
  const storage = await import('../src/lib/storage.js');
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7),
  ]);
  const stored = storage.putObject(png, { prefix: 'events' });
  assert.equal(stored.ok, true);
  assert.match(stored.key, /^events\/[0-9a-f]{32}\.png$/, 'مفتاح عشوائي لا يُخمَّن');
  assert.ok(storage.getObject(stored.key));

  assert.equal(storage.putObject(Buffer.from('<?php evil(); ?>'), { prefix: 'events' }).ok, false);
  assert.match(storage.putObject(Buffer.alloc(config.uploads.maxBytes + 1), { prefix: 'events' }).message, /الحدّ المسموح/);
  assert.equal(storage.getObject('../../etc/passwd'), null, 'يمنع الخروج عن المجلّد');
  assert.equal(storage.getObject('events/xx.png'), null);
  assert.equal(storage.isValidKey(stored.key), true);
});

/* -------------------------- التقويم والتوقيت --------------------------- */
test('ملفّ التقويم صالح، والمواعيد بتوقيت عُمان', async () => {
  const { eventToIcs } = await import('../src/lib/ics.js');
  const { omanInputToUtc, utcToOmanInput, formatRange } = await import('../src/lib/datetime.js');

  assert.equal(omanInputToUtc('2026-09-20T18:00'), '2026-09-20T14:00:00Z', 'عُمان = ت.ع+٤');
  assert.equal(utcToOmanInput('2026-09-20T14:00:00Z'), '2026-09-20T18:00');
  assert.match(formatRange('2026-09-20T14:00:00Z', '2026-09-20T16:00:00Z'), /٦:٠٠ م – ٨:٠٠ م/);

  const ics = eventToIcs({
    id: 1, title: 'أمسية; شعرية, الليلة', description: 'سطر\nآخر', location: 'المسرح',
    starts_at: '2026-09-20T14:00:00Z', ends_at: '2026-09-20T16:00:00Z',
  }, { uid: 'x@y', url: 'https://club.om/events/1' });

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20260920T140000Z/);
  assert.match(ics, /DTEND:20260920T160000Z/);
  assert.match(ics, /SUMMARY:أمسية\; شعرية\\, الليلة/, 'المحارف الخاصّة مهرَّبة');
  assert.match(ics, /DESCRIPTION:سطر\\nآخر/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.from(line, 'utf8').length <= 75, `طول السطر: ${line}`);
  }
});

/* ------------------------------- الإعلانات ------------------------------ */
test('الإعلانات: المنتهية والمخفيّة لا تظهر، والمثبَّت في الصدارة', () => {
  Content.createAnnouncement({ title: 'عادي', body: '', image_key: null, link_url: null, pinned: 0, published: 1, expires_at: null, sort_order: 5 });
  Content.createAnnouncement({ title: 'مثبَّت', body: '', image_key: null, link_url: null, pinned: 1, published: 1, expires_at: null, sort_order: 9 });
  Content.createAnnouncement({ title: 'مخفي', body: '', image_key: null, link_url: null, pinned: 0, published: 0, expires_at: null, sort_order: 1 });
  Content.createAnnouncement({ title: 'منتهٍ', body: '', image_key: null, link_url: null, pinned: 0, published: 1, expires_at: hours(-1), sort_order: 1 });

  const titles = Content.publishedAnnouncements().map((a) => a.title);
  assert.equal(titles[0], 'مثبَّت', 'المثبَّت أوّلًا');
  assert.ok(titles.includes('عادي'));
  assert.ok(!titles.includes('مخفي'));
  assert.ok(!titles.includes('منتهٍ'));
});

test.after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

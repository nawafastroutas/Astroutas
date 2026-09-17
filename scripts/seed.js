#!/usr/bin/env node
/** بيانات تجريبية للعرض والتجربة. يُشغَّل: npm run seed */
import { getDb } from '../src/db/index.js';
import * as Members from '../src/models/members.js';
import * as Events from '../src/models/events.js';
import * as Tickets from '../src/models/tickets.js';
import * as Content from '../src/models/content.js';

const db = getDb();
if (db.prepare('SELECT COUNT(*) AS n FROM members').get().n > 0 && !process.argv.includes('--force')) {
  console.log('القاعدة تحتوي بيانات بالفعل. أضف --force لإعادة البذر فوقها.');
  process.exit(0);
}

const hoursFromNow = (h) => new Date(Date.now() + h * 3600e3).toISOString().replace(/\.\d{3}Z$/, 'Z');

const people = [
  ['نواف بن سعيد المقبالي', '+96891000001', '20231001', 'nawaf@utas.edu.om', 'تقنية المعلومات', 'رئيس النادي', 1, 1],
  ['ريم بنت خالد الهنائية', '+96891000002', '20231002', 'reem@utas.edu.om', 'اللغة العربية', 'نائب رئيس النادي', 2, 1],
  ['سالم بن ماجد البوسعيدي', '+96891000003', '20231003', 'salim@utas.edu.om', 'اللغة الإنجليزية', 'أمين السرّ', 3, 0],
  ['مريم بنت علي الشحية', '+96891000004', '20231004', 'maryam@utas.edu.om', 'اللغة العربية', 'مسؤول الإعلام', 4, 0],
  ['يوسف بن حمد الرواحي', '+96891000005', '20231005', 'yousuf@utas.edu.om', 'الرياضيات', null, 0, 0],
  ['هاجر بنت سيف العبرية', '+96891000006', '20231006', 'hajar@utas.edu.om', 'اللغة العربية', null, 0, 0],
  ['عبدالله بن راشد الكندي', '+96891000007', '20231007', 'abdullah@utas.edu.om', 'تقنية المعلومات', null, 0, 0],
  ['أسماء بنت ناصر الحارثية', '+96891000008', '20231008', 'asma@utas.edu.om', 'العلوم', null, 0, 0],
  ['خالد بن سليمان المعمري', '+96891000009', '20231009', 'khalid@utas.edu.om', 'الدراسات الاجتماعية', null, 0, 0],
  ['فاطمة بنت أحمد البلوشية', '+96891000010', '20231010', 'fatma@utas.edu.om', 'اللغة العربية', null, 0, 0],
];

const memberIds = [];
for (const [fullName, phone, studentId, email, major, role, order, isAdmin] of people) {
  const created = Members.createMember({ fullName, phone, studentId, email, major, isAdmin });
  if (!created.ok) { console.log('تخطّي', fullName, '—', created.message); continue; }
  if (role || order) Members.updateAdminFields(created.id, { clubRole: role, displayOrder: order, isAdmin });
  memberIds.push(created.id);
}

const events = [
  { title: 'أمسية الشعر النبطي', category: 'أمسية شعرية', location: 'مسرح الكلية',
    description: 'أمسية يقرأ فيها شعراء النادي قصائدهم، ومنبر مفتوح لمن أراد المشاركة.\nالحضور مفتوح لجميع طلبة الكلية.',
    starts_at: hoursFromNow(-720), ends_at: hoursFromNow(-718), capacity: 80, points: 20,
    badge_name: 'حاضر الأمسية', status: 'published', survey_url: 'https://forms.office.com/r/astro-poetry', is_test: 0 },
  { title: 'ورشة الكتابة الإبداعية', category: 'ورشة', location: 'قاعة التدريب ب٢',
    description: 'ورشة عملية في بناء النصّ وتحرير الأسلوب، مع تطبيقات مباشرة على نصوص المشاركين.',
    starts_at: hoursFromNow(-360), ends_at: hoursFromNow(-357), capacity: 30, points: 25,
    badge_name: 'متدرّب الورشة', status: 'published', survey_url: 'https://forms.office.com/r/astro-writing', is_test: 0 },
  { title: 'جلسة نادي القراءة — كتاب الشهر', category: 'نادي قراءة', location: 'مكتبة الكلية',
    description: 'مناقشة كتاب الشهر: «ذاكرة الجسد». تعالَ ولو لم تُكمل الكتاب.',
    starts_at: hoursFromNow(48), ends_at: hoursFromNow(50), capacity: 25, points: 15,
    badge_name: 'قارئ الشهر', status: 'published', survey_url: null, is_test: 0 },
  { title: 'المسابقة الثقافية الكبرى', category: 'مسابقة', location: 'قاعة المحاضرات الرئيسية',
    description: 'مسابقة بين فرق الطلبة في الأدب واللغة والمعلومات العامّة، بجوائز للفائزين.',
    starts_at: hoursFromNow(120), ends_at: hoursFromNow(122), capacity: 100, points: 30,
    badge_name: 'متسابق', status: 'published', survey_url: 'https://forms.office.com/r/astro-quiz', is_test: 0 },
  { title: 'معرض الكتاب السنوي', category: 'معرض', location: 'بهو الكلية',
    description: 'معرض كتب بأسعار طلابية، وركن لتبادل الكتب المستعملة.',
    starts_at: hoursFromNow(300), ends_at: hoursFromNow(310), capacity: 0, points: 10,
    badge_name: 'زائر المعرض', status: 'draft', survey_url: null, is_test: 0 },
];

const eventIds = events.map((e) => Events.create(e).id);

/*
 * الفعاليتان الأوليان منتهيتان، وحجزهما مرفوض بحقّ من قواعد النظام،
 * فتُدرَج تذاكرهما التاريخية وحضورها مباشرةً كما لو سُجّلت في حينها.
 */
const rndCode = (n) => Array.from({ length: n },
  () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 32)]).join('');

for (const eventId of [eventIds[0], eventIds[1]]) {
  const event = Events.findById(eventId);
  for (const [index, memberId] of memberIds.slice(0, 7).entries()) {
    const ticket = getDb().prepare(
      'INSERT INTO tickets (member_id, event_id, code) VALUES (?, ?, ?) RETURNING id',
    ).get(memberId, eventId, `ASTQ-${rndCode(8)}`);
    if (index % 3 === 2) continue;                       // بعضهم حجز ولم يحضر
    getDb().prepare(`
      INSERT OR IGNORE INTO attendances (ticket_id, scanned_by, points_awarded, badge_name, card_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(ticket.id, memberIds[0], event.points, event.badge_name, `CARD-${rndCode(6)}`);
  }
}
// حجوزات للفعاليات القادمة
for (const memberId of memberIds.slice(0, 5)) Tickets.book(memberId, eventIds[2]);
for (const memberId of memberIds.slice(2, 9)) Tickets.book(memberId, eventIds[3]);

// تقييمات
for (const memberId of memberIds.slice(0, 4)) Tickets.evaluate(eventIds[0], memberId);
for (const memberId of memberIds.slice(0, 2)) Tickets.evaluate(eventIds[1], memberId);

Content.createAnnouncement({
  title: 'فتح باب العضوية للفصل الأول', pinned: 1, published: 1, sort_order: 1,
  body: 'باب الانضمام إلى نادي الثقافة والأدب مفتوح لجميع طلبة الكلية.\nسجّل عضويتك من الموقع، واحضر أوّل فعالية لتكسب نقاطك الأولى.',
  image_key: null, link_url: null, expires_at: null,
});
Content.createAnnouncement({
  title: 'مسابقة القصة القصيرة — الجوائز', pinned: 0, published: 1, sort_order: 2,
  body: 'أُعلنت جوائز مسابقة القصة القصيرة: ثلاث جوائز مالية ونشر النصوص الفائزة في مجلة الكلية.',
  image_key: null, link_url: null, expires_at: null,
});
Content.createAnnouncement({
  title: 'إعلان قديم (مخفي)', pinned: 0, published: 0, sort_order: 9,
  body: 'هذا إعلان غير منشور — لا يظهر للزوّار.', image_key: null, link_url: null, expires_at: null,
});

Content.createMessage({ name: 'سعيد بن علي الفارسي', phone: '+96892000001', body: 'أرغب في الانضمام إلى لجنة الإعلام في النادي. كيف أتقدّم؟' });
Content.createMessage({ name: 'نورة بنت سالم الرحبية', phone: '+96892000002', body: 'هل تُقبل مشاركات الطالبات في أمسية الشعر القادمة؟' });

console.log(`تمّ البذر: ${memberIds.length} أعضاء، ${eventIds.length} فعاليات.`);
console.log('حساب الإدارة للتجربة: ٩١٠٠٠٠٠١ (nawaf)');

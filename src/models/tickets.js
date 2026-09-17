/**
 * الحجز والمسح والتقييم — قلب قواعد النقاط.
 * كل قاعدة هنا مسنودة بقيد في قاعدة البيانات، لا بشرط في الشيفرة وحده.
 */
import crypto from 'node:crypto';
import { getDb, transaction, uniqueViolation } from '../db/index.js';
import config from '../config.js';
import { points as arPoints } from '../lib/arabic.js';
import * as Events from './events.js';

/** أبجدية بلا محارف متشابهة (0/O، 1/I) — أسهل في الإملاء والقراءة. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const TICKET_PREFIX = 'ASTQ';
const CODE_RE = new RegExp(`${TICKET_PREFIX}-[${ALPHABET}]{8}`, 'i');

/** يقبل الرمز وحده أو رابطًا يحتويه (كما يقرؤه الماسح). */
export function normalizeCode(input) {
  const s = String(input ?? '').toUpperCase().replace(/\s+/g, '');
  const m = CODE_RE.exec(s);
  return m ? m[0].toUpperCase() : null;
}

/* --------------------------------- الحجز -------------------------------- */
/**
 * @returns {{ok:true, ticket:object}|{ok:false, code:string, message:string}}
 */
export function book(memberId, eventId) {
  return transaction((db) => {
    const event = Events.findById(eventId);
    if (!event) return { ok: false, code: 'NOT_FOUND', message: 'الفعالية غير موجودة.' };
    if (event.status === 'cancelled') return { ok: false, code: 'CANCELLED', message: 'أُلغيت هذه الفعالية.' };
    if (event.status !== 'published') return { ok: false, code: 'NOT_PUBLISHED', message: 'الحجز غير متاح لهذه الفعالية.' };
    if (Events.isEnded(event)) return { ok: false, code: 'ENDED', message: 'انتهت هذه الفعالية.' };

    const seats = Events.seatsLeft(event);
    if (seats !== null && seats <= 0) return { ok: false, code: 'FULL', message: 'اكتملت مقاعد هذه الفعالية.' };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `${TICKET_PREFIX}-${randomCode()}`;
      try {
        const info = db.prepare('INSERT INTO tickets (member_id, event_id, code) VALUES (?, ?, ?)')
          .run(memberId, eventId, code);
        return { ok: true, ticket: byId(Number(info.lastInsertRowid)) };
      } catch (err) {
        const constraint = uniqueViolation(err);
        if (constraint === 'tickets.member_id, tickets.event_id') {
          return { ok: false, code: 'DUPLICATE', message: 'لديك تذكرة في هذه الفعالية بالفعل.', ticket: forMemberEvent(memberId, eventId) };
        }
        if (constraint === 'tickets.code') continue;      // تصادم نادر: جرّب رمزًا آخر
        throw err;
      }
    }
    return { ok: false, code: 'CODE_COLLISION', message: 'تعذّر إصدار التذكرة. حاول مرّة أخرى.' };
  });
}

const TICKET_SELECT = `
  SELECT t.*, e.title AS event_title, e.starts_at, e.ends_at, e.location, e.status AS event_status,
         e.points AS event_points, e.badge_name AS event_badge, e.description AS event_description,
         e.id AS event_id, m.full_name AS member_name, m.major AS member_major,
         m.student_id AS member_student_id,
         a.id AS attendance_id, a.scanned_at, a.points_awarded, a.badge_name, a.card_id
  FROM tickets t
  JOIN events e ON e.id = t.event_id
  JOIN members m ON m.id = t.member_id
  LEFT JOIN attendances a ON a.ticket_id = t.id`;

export const byId = (id) => getDb().prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(id) || null;
export const byCode = (code) => getDb().prepare(`${TICKET_SELECT} WHERE t.code = ?`).get(code) || null;
export const forMemberEvent = (memberId, eventId) =>
  getDb().prepare(`${TICKET_SELECT} WHERE t.member_id = ? AND t.event_id = ?`).get(memberId, eventId) || null;
export const forMember = (memberId) =>
  getDb().prepare(`${TICKET_SELECT} WHERE t.member_id = ? ORDER BY e.starts_at DESC`).all(memberId);

/* --------------------------------- المسح -------------------------------- */
export function scanWindow(event) {
  const opens = new Date(event.starts_at).getTime() - config.scanWindow.opensBeforeStartMs;
  const closes = new Date(event.ends_at).getTime() + config.scanWindow.closesAfterEndMs;
  return { opens, closes, open: Date.now() >= opens && Date.now() <= closes };
}

/**
 * مسح تذكرة: يمنح النقاط والشارة وبطاقة الحضور **مرّة واحدة**.
 * الإعادة تُعلَم «ممسوحة من قبل» ولا تمنح شيئًا ثانيًا.
 */
export function scan(rawCode, adminId) {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, code: 'BAD_CODE', message: 'رمز غير صالح. تأكّد من الرمز أو أعد المسح.' };

  return transaction((db) => {
    const ticket = byCode(code);
    if (!ticket) return { ok: false, code: 'NOT_FOUND', message: 'هذا الرمز غير معروف في النظام.' };

    const event = Events.findById(ticket.event_id);
    if (event.status === 'cancelled') return { ok: false, code: 'CANCELLED', message: 'هذه الفعالية ملغاة.', ticket };

    const window = scanWindow(event);
    if (!window.open) {
      const message = Date.now() < window.opens
        ? 'نافذة المسح لم تفتح بعد — تفتح قبل بداية الفعالية بساعتين.'
        : 'نافذة المسح أُغلقت — تغلق بعد نهاية الفعالية باثنتي عشرة ساعة.';
      return { ok: false, code: 'WINDOW_CLOSED', message, ticket };
    }

    if (ticket.attendance_id) {
      return {
        ok: true,
        repeat: true,
        message: 'ممسوحة من قبل — لم تُمنح نقاط جديدة.',
        ticket,
        attendance: {
          card_id: ticket.card_id, scanned_at: ticket.scanned_at,
          points_awarded: ticket.points_awarded, badge_name: ticket.badge_name,
        },
      };
    }

    const cardId = `CARD-${randomCode(6)}`;
    try {
      db.prepare(`
        INSERT INTO attendances (ticket_id, scanned_by, points_awarded, badge_name, card_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(ticket.id, adminId ?? null, event.points, event.badge_name || '', cardId);
    } catch (err) {
      if (uniqueViolation(err) === 'attendances.ticket_id') {
        const again = byCode(code);
        return {
          ok: true, repeat: true, message: 'ممسوحة من قبل — لم تُمنح نقاط جديدة.', ticket: again,
          attendance: { card_id: again.card_id, scanned_at: again.scanned_at, points_awarded: again.points_awarded, badge_name: again.badge_name },
        };
      }
      throw err;
    }

    const updated = byCode(code);
    return {
      ok: true,
      repeat: false,
      message: `تمّ التسجيل — ${arPoints(event.points)}${event.badge_name ? ` وشارة «${event.badge_name}»` : ''}.`,
      ticket: updated,
      attendance: {
        card_id: updated.card_id, scanned_at: updated.scanned_at,
        points_awarded: updated.points_awarded, badge_name: updated.badge_name,
      },
    };
  });
}

/* -------------------------------- التقييم ------------------------------- */
/**
 * يمنح نقاط التقييم مرّة واحدة لكل عضو لكل فعالية، ثم يُعيد رابط الاستبيان.
 * الرابط الخارجي لا يُرسَل إلى المتصفّح إلا من ردّ هذا الطلب.
 */
export function evaluate(eventId, memberId) {
  const event = Events.findById(eventId);
  if (!event) return { ok: false, code: 'NOT_FOUND', message: 'الفعالية غير موجودة.' };
  if (!event.survey_url) return { ok: false, code: 'NO_SURVEY', message: 'لا يوجد استبيان تقييم لهذه الفعالية.' };
  if (event.status !== 'published') return { ok: false, code: 'NOT_PUBLISHED', message: 'التقييم غير متاح لهذه الفعالية.' };

  const info = getDb().prepare(`
    INSERT OR IGNORE INTO evaluations (event_id, member_id, points) VALUES (?, ?, ?)
  `).run(eventId, memberId, config.evaluationPoints);

  const awarded = info.changes > 0;
  return {
    ok: true,
    awarded,
    points: config.evaluationPoints,
    url: event.survey_url,
    message: awarded
      ? `شكرًا لك — أُضيفت ${arPoints(config.evaluationPoints)} إلى رصيدك. جارٍ تحويلك إلى الاستبيان…`
      : 'سبق أن قيّمت هذه الفعالية — النقاط تُمنح مرّة واحدة. جارٍ فتح الاستبيان…',
  };
}

export const hasEvaluated = (eventId, memberId) =>
  !!getDb().prepare('SELECT 1 AS x FROM evaluations WHERE event_id = ? AND member_id = ?').get(eventId, memberId);

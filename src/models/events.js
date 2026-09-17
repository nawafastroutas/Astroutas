/** الفعاليات ومعرض صورها. */
import { getDb, isAbort } from '../db/index.js';
import { deleteObject } from '../lib/storage.js';

const SELECT = `
  SELECT e.*,
    (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) AS tickets_count,
    (SELECT COUNT(*) FROM attendances a JOIN tickets t ON t.id = a.ticket_id
      WHERE t.event_id = e.id) AS attendance_count
  FROM events e`;

export const findById = (id) => getDb().prepare(`${SELECT} WHERE e.id = ?`).get(id) || null;

export const seatsLeft = (event) =>
  (event.capacity > 0 ? Math.max(0, event.capacity - event.tickets_count) : null);

export const isEnded = (event) => new Date(event.ends_at).getTime() < Date.now();

export function create(data) {
  const info = getDb().prepare(`
    INSERT INTO events (title, description, category, location, starts_at, ends_at,
                        capacity, points, badge_name, status, survey_url, is_test)
    VALUES (:title, :description, :category, :location, :starts_at, :ends_at,
            :capacity, :points, :badge_name, :status, :survey_url, :is_test)
  `).run(data);
  return findById(Number(info.lastInsertRowid));
}

export function update(id, data) {
  getDb().prepare(`
    UPDATE events SET title=:title, description=:description, category=:category,
      location=:location, starts_at=:starts_at, ends_at=:ends_at, capacity=:capacity,
      points=:points, badge_name=:badge_name, status=:status, survey_url=:survey_url,
      is_test=:is_test
    WHERE id = :id
  `).run({ ...data, id });
  return findById(id);
}

/**
 * الحذف محروس في القاعدة: فعالية سُجّل فيها حضور لا تُحذف (تمحو نقاط الأعضاء).
 * @returns {{ok:true}|{ok:false, code:string, message:string}}
 */
export function remove(id) {
  const db = getDb();
  const images = listImages(id);
  try {
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  } catch (err) {
    if (isAbort(err, 'EVENT_HAS_ATTENDANCE')) {
      return {
        ok: false,
        code: 'HAS_ATTENDANCE',
        message: 'لا يمكن حذف فعالية سُجّل فيها حضور — لأنّ ذلك يمحو نقاط الأعضاء. حوّلها إلى «ملغاة» بدلًا من ذلك.',
      };
    }
    throw err;
  }
  for (const img of images) deleteObject(img.object_key);
  return { ok: true };
}

export function cancel(id) {
  getDb().prepare("UPDATE events SET status = 'cancelled' WHERE id = ?").run(id);
  return findById(id);
}

export const listAll = () => getDb().prepare(`${SELECT} ORDER BY e.starts_at DESC`).all();

export const countEvents = () => getDb().prepare('SELECT COUNT(*) AS n FROM events').get().n;

/** الفعاليات المنشورة مع بحث نصّي، مفصولة: قادم / منتهٍ. */
export function listPublic({ q = '' } = {}) {
  const db = getDb();
  const rows = q.trim()
    ? db.prepare(`${SELECT}
        WHERE e.status IN ('published','cancelled')
          AND (e.title LIKE :q OR e.description LIKE :q OR e.category LIKE :q OR e.location LIKE :q)
        ORDER BY e.starts_at DESC`).all({ q: `%${q.trim()}%` })
    : db.prepare(`${SELECT} WHERE e.status IN ('published','cancelled') ORDER BY e.starts_at DESC`).all();

  const now = Date.now();
  return {
    upcoming: rows.filter((e) => new Date(e.ends_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
    past: rows.filter((e) => new Date(e.ends_at).getTime() < now),
  };
}

/** الفعاليات الثلاث القادمة (للصفحة الرئيسية). */
export const upcoming = (limit = 3) => getDb().prepare(`${SELECT}
  WHERE e.status = 'published' AND e.ends_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now')
  ORDER BY e.starts_at LIMIT ?`).all(limit);

/** من حضر الفعالية — لا يُكشف إلا بعد انتهائها (يفرضه المستدعي أيضًا). */
export const attendees = (eventId) => getDb().prepare(`
  SELECT m.full_name, m.major, a.scanned_at, a.card_id
  FROM attendances a
  JOIN tickets t ON t.id = a.ticket_id
  JOIN members m ON m.id = t.member_id
  WHERE t.event_id = ?
  ORDER BY a.scanned_at
`).all(eventId);

/* ------------------------------ معرض الصور ------------------------------ */
export const listImages = (eventId) => getDb().prepare(
  'SELECT * FROM event_images WHERE event_id = ? ORDER BY sort_order, id',
).all(eventId);

export function addImage(eventId, objectKey) {
  const next = getDb().prepare(
    'SELECT IFNULL(MAX(sort_order), 0) + 1 AS n FROM event_images WHERE event_id = ?',
  ).get(eventId).n;
  getDb().prepare('INSERT INTO event_images (event_id, object_key, sort_order) VALUES (?, ?, ?)')
    .run(eventId, objectKey, next);
  return listImages(eventId);
}

export function removeImage(eventId, imageId) {
  const row = getDb().prepare('SELECT * FROM event_images WHERE id = ? AND event_id = ?').get(imageId, eventId);
  if (!row) return false;
  getDb().prepare('DELETE FROM event_images WHERE id = ?').run(imageId);
  deleteObject(row.object_key);
  return true;
}

/** كل صفوف الحضور للتصدير — صفّ لكل حضور. */
export const attendanceForExport = () => getDb().prepare(`
  SELECT e.title AS event_title, e.category, e.starts_at, e.location,
         m.full_name, m.student_id, m.phone, m.email, m.major,
         a.scanned_at, a.points_awarded, a.badge_name, a.card_id,
         s.full_name AS scanned_by_name
  FROM attendances a
  JOIN tickets t ON t.id = a.ticket_id
  JOIN events  e ON e.id = t.event_id
  JOIN members m ON m.id = t.member_id
  LEFT JOIN members s ON s.id = a.scanned_by
  ORDER BY e.starts_at DESC, a.scanned_at
`).all();

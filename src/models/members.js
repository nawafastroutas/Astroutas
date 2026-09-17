/** الأعضاء: الإنشاء، البحث، الرتب، والنقاط المحسوبة. */
import { getDb, uniqueViolation } from '../db/index.js';
import { duplicateMessage } from '../lib/validate.js';

/** ترتيب الرتب في صفحة الهيكلة. */
export const ROLES = [
  'رئيس النادي',
  'نائب رئيس النادي',
  'أمين السرّ',
  'أمين الصندوق',
  'مسؤول الإعلام',
  'مسؤول الفعاليات',
  'عضو لجنة',
];
const roleRank = (role) => {
  const i = ROLES.indexOf(role);
  return i === -1 ? (role ? ROLES.length : 999) : i;
};

export function createMember({ fullName, phone, studentId, email, major, isAdmin = 0 }) {
  const db = getDb();
  try {
    const info = db.prepare(`
      INSERT INTO members (full_name, phone, student_id, email, major, is_admin)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fullName, phone, studentId, email, major, isAdmin ? 1 : 0);
    return { ok: true, id: Number(info.lastInsertRowid) };
  } catch (err) {
    const constraint = uniqueViolation(err);
    if (constraint) return { ok: false, field: constraint.split('.')[1], message: duplicateMessage(constraint) };
    throw err;
  }
}

export const findById = (id) =>
  getDb().prepare('SELECT * FROM members WHERE id = ?').get(id) || null;

export const findByPhone = (phone) =>
  getDb().prepare('SELECT * FROM members WHERE phone = ?').get(phone) || null;

export function updateProfile(id, { fullName, major }) {
  getDb().prepare('UPDATE members SET full_name = ?, major = ? WHERE id = ?').run(fullName, major, id);
  return findById(id);
}

export function updateAdminFields(id, { clubRole, displayOrder, isAdmin }) {
  const db = getDb();
  const current = findById(id);
  if (!current) return null;
  db.prepare('UPDATE members SET club_role = ?, display_order = ?, is_admin = ? WHERE id = ?').run(
    clubRole || null,
    Number.isFinite(displayOrder) ? displayOrder : current.display_order,
    isAdmin === undefined ? current.is_admin : (isAdmin ? 1 : 0),
    id,
  );
  return findById(id);
}

export function setPhoto(id, key) {
  getDb().prepare('UPDATE members SET photo_key = ? WHERE id = ?').run(key || null, id);
  return findById(id);
}

/** نقاط العضو — تُقرأ من العرض المحسوب لا من عمود مخزَّن. */
export const pointsOf = (id) =>
  getDb().prepare('SELECT * FROM member_points WHERE member_id = ?').get(id)
  || { member_id: id, total_points: 0, attendance_points: 0, evaluation_points: 0, attendance_count: 0, evaluation_count: 0 };

export const badgesOf = (id) =>
  getDb().prepare('SELECT * FROM member_badges WHERE member_id = ? ORDER BY earned_at DESC').all(id);

/** بحث شامل في كل الحقول (للوحة الإدارة). */
export function listMembers({ q = '', limit = 500 } = {}) {
  const db = getDb();
  const rows = q.trim()
    ? db.prepare(`
        SELECT m.*, p.total_points, p.attendance_count
        FROM members m JOIN member_points p ON p.member_id = m.id
        WHERE m.full_name LIKE :q OR m.phone LIKE :q OR m.student_id LIKE :q
           OR m.email LIKE :q OR m.major LIKE :q OR IFNULL(m.club_role,'') LIKE :q
        ORDER BY m.display_order, m.id
        LIMIT :limit
      `).all({ q: `%${q.trim()}%`, limit })
    : db.prepare(`
        SELECT m.*, p.total_points, p.attendance_count
        FROM members m JOIN member_points p ON p.member_id = m.id
        ORDER BY m.display_order, m.id LIMIT ?
      `).all(limit);
  return rows;
}

export const countMembers = () => getDb().prepare('SELECT COUNT(*) AS n FROM members').get().n;

/** ترتيب التخصّصات بعدد الأعضاء. */
export const majorsRanking = (limit = 8) => getDb().prepare(`
  SELECT major, COUNT(*) AS members_count
  FROM members GROUP BY major ORDER BY members_count DESC, major LIMIT ?
`).all(limit);

/** أعضاء الإدارة (أصحاب الرتب). */
export function boardMembers() {
  const rows = getDb().prepare(`
    SELECT m.*, p.total_points, p.attendance_count
    FROM members m JOIN member_points p ON p.member_id = m.id
    WHERE m.club_role IS NOT NULL AND m.club_role <> ''
  `).all();
  return rows.sort((a, b) =>
    roleRank(a.club_role) - roleRank(b.club_role)
    || a.display_order - b.display_order
    || a.id - b.id);
}

/** بقية الأعضاء مرتَّبين بمجموع النقاط تنازليًا. */
export const rankedMembers = () => getDb().prepare(`
  SELECT m.*, p.total_points, p.attendance_count
  FROM members m JOIN member_points p ON p.member_id = m.id
  WHERE m.club_role IS NULL OR m.club_role = ''
  ORDER BY p.total_points DESC, p.attendance_count DESC, m.full_name
`).all();

/** كل الأعضاء للتصدير. */
export const allMembersForExport = () => getDb().prepare(`
  SELECT m.*, p.total_points, p.attendance_count, p.evaluation_count
  FROM members m JOIN member_points p ON p.member_id = m.id
  ORDER BY m.id
`).all();

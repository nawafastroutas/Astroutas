-- =====================================================================
--  نادي الثقافة والأدب — مخطّط قاعدة البيانات
--  القواعد الحرجة محروسة هنا (قيود ومشغّلات)، لا في الشيفرة وحدها.
-- =====================================================================

-- ------------------------- الأعضاء -------------------------
CREATE TABLE IF NOT EXISTS members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT    NOT NULL,
  phone         TEXT    NOT NULL UNIQUE,              -- مُطبَّع: ‎+968xxxxxxxx
  student_id    TEXT    NOT NULL UNIQUE,              -- أرقام فقط 5..12
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  major         TEXT    NOT NULL,
  club_role     TEXT,                                 -- رتبة اختيارية
  display_order INTEGER NOT NULL DEFAULT 0,
  photo_key     TEXT,                                 -- مفتاح في تخزين الكائنات
  joined_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  is_admin      INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0,1))
);

-- ------------------------ الفعاليات ------------------------
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT '',
  location    TEXT    NOT NULL DEFAULT '',
  starts_at   TEXT    NOT NULL,                       -- UTC ISO
  ends_at     TEXT    NOT NULL,                       -- UTC ISO
  capacity    INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0), -- 0 = بلا حدّ
  points      INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  badge_name  TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'draft'
              CHECK (status IN ('published','draft','cancelled')),
  survey_url  TEXT,                                   -- رابط استبيان خارجي اختياري
  is_test     INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0,1)), -- تجريبية: خارج حساب النقاط
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status, starts_at);

-- معرض صور الفعالية
CREATE TABLE IF NOT EXISTS event_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  object_key TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_event_images_event ON event_images (event_id, sort_order);

-- ------------------------- التذاكر -------------------------
-- تذكرة واحدة لكل عضو لكل فعالية — يحرسها القيد الفريد أدناه.
CREATE TABLE IF NOT EXISTS tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code       TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (member_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets (event_id);

-- -------------------------- الحضور -------------------------
-- صفّ واحد لكل تذكرة لا يتكرّر — المسح المتكرّر لا يمنح شيئًا ثانيًا.
CREATE TABLE IF NOT EXISTS attendances (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id      INTEGER NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  scanned_by     INTEGER          REFERENCES members(id) ON DELETE SET NULL,
  scanned_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  badge_name     TEXT    NOT NULL DEFAULT '',
  card_id        TEXT    NOT NULL UNIQUE               -- معرّف بطاقة الحضور
);

-- ------------------------- التقييم -------------------------
CREATE TABLE IF NOT EXISTS evaluations (
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  points     INTEGER NOT NULL DEFAULT 10,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (event_id, member_id)                    -- مفتاح مركّب: مرة واحدة
);

-- ------------------------- الإعلانات ------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  image_key  TEXT,
  link_url   TEXT,
  pinned     INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  published  INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  expires_at TEXT,                                     -- وقت انتهاء تلقائي
  sort_order INTEGER NOT NULL DEFAULT 0,               -- ترتيب يدوي
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ---------------------- رسائل التواصل ----------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  phone      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'new' CHECK (status IN ('new','read')),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_status ON contact_messages (status, created_at);

-- =====================================================================
--  حارس: يُمنع حذف فعالية سُجّل فيها حضور (يمحو نقاط الأعضاء).
--  تُحوَّل إلى «ملغاة» بدلًا من ذلك.
-- =====================================================================
CREATE TRIGGER IF NOT EXISTS trg_events_no_delete_with_attendance
BEFORE DELETE ON events
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM attendances a
  JOIN tickets t ON t.id = a.ticket_id
  WHERE t.event_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'EVENT_HAS_ATTENDANCE');
END;

-- =====================================================================
--  النقاط تُحسب ولا تُخزَّن: مصدرها الوحيد الحضور والتقييمات،
--  والفعاليات التجريبية خارج الحساب.
-- =====================================================================
CREATE VIEW IF NOT EXISTS member_points AS
SELECT
  m.id AS member_id,
  COALESCE(att.points, 0) + COALESCE(ev.points, 0) AS total_points,
  COALESCE(att.points, 0)   AS attendance_points,
  COALESCE(ev.points, 0)    AS evaluation_points,
  COALESCE(att.count_, 0)   AS attendance_count,
  COALESCE(ev.count_, 0)    AS evaluation_count
FROM members m
LEFT JOIN (
  SELECT t.member_id AS mid,
         SUM(a.points_awarded) AS points,
         COUNT(*) AS count_
  FROM attendances a
  JOIN tickets t ON t.id = a.ticket_id
  JOIN events  e ON e.id = t.event_id
  WHERE e.is_test = 0
  GROUP BY t.member_id
) att ON att.mid = m.id
LEFT JOIN (
  SELECT v.member_id AS mid,
         SUM(v.points) AS points,
         COUNT(*) AS count_
  FROM evaluations v
  JOIN events e ON e.id = v.event_id
  WHERE e.is_test = 0
  GROUP BY v.member_id
) ev ON ev.mid = m.id;

-- شارات العضو (من الحضور) — تُشتقّ ولا تُخزَّن
CREATE VIEW IF NOT EXISTS member_badges AS
SELECT t.member_id AS member_id,
       a.badge_name AS badge_name,
       e.id         AS event_id,
       e.title      AS event_title,
       a.scanned_at AS earned_at,
       a.card_id    AS card_id
FROM attendances a
JOIN tickets t ON t.id = a.ticket_id
JOIN events  e ON e.id = t.event_id
WHERE a.badge_name <> '';

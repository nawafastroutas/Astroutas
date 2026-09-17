/** الإعلانات ورسائل التواصل. */
import { getDb } from '../db/index.js';
import { deleteObject } from '../lib/storage.js';

/* ------------------------------- الإعلانات ------------------------------ */
/** المنشورة وغير المنتهية: المثبّت أولًا، ثم الترتيب اليدوي. */
export const publishedAnnouncements = () => getDb().prepare(`
  SELECT * FROM announcements
  WHERE published = 1
    AND (expires_at IS NULL OR expires_at = '' OR expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  ORDER BY pinned DESC, sort_order, created_at DESC
`).all();

export const allAnnouncements = () => getDb().prepare(
  'SELECT * FROM announcements ORDER BY pinned DESC, sort_order, created_at DESC',
).all();

export const announcementById = (id) =>
  getDb().prepare('SELECT * FROM announcements WHERE id = ?').get(id) || null;

export function createAnnouncement(data) {
  const info = getDb().prepare(`
    INSERT INTO announcements (title, body, image_key, link_url, pinned, published, expires_at, sort_order)
    VALUES (:title, :body, :image_key, :link_url, :pinned, :published, :expires_at, :sort_order)
  `).run(data);
  return announcementById(Number(info.lastInsertRowid));
}

export function updateAnnouncement(id, data) {
  getDb().prepare(`
    UPDATE announcements SET title=:title, body=:body, image_key=:image_key, link_url=:link_url,
      pinned=:pinned, published=:published, expires_at=:expires_at, sort_order=:sort_order
    WHERE id = :id
  `).run({ ...data, id });
  return announcementById(id);
}

export function deleteAnnouncement(id) {
  const row = announcementById(id);
  if (!row) return false;
  getDb().prepare('DELETE FROM announcements WHERE id = ?').run(id);
  if (row.image_key) deleteObject(row.image_key);
  return true;
}

export function setAnnouncementFlags(id, { published, pinned }) {
  const row = announcementById(id);
  if (!row) return null;
  getDb().prepare('UPDATE announcements SET published = ?, pinned = ? WHERE id = ?').run(
    published === undefined ? row.published : (published ? 1 : 0),
    pinned === undefined ? row.pinned : (pinned ? 1 : 0),
    id,
  );
  return announcementById(id);
}

/* ---------------------------- رسائل التواصل ---------------------------- */
export function createMessage({ name, phone, body }) {
  const info = getDb().prepare(
    'INSERT INTO contact_messages (name, phone, body) VALUES (?, ?, ?)',
  ).run(name, phone, body);
  return Number(info.lastInsertRowid);
}

export const listMessages = () => getDb().prepare(
  'SELECT * FROM contact_messages ORDER BY status = \'read\', created_at DESC',
).all();

export const countNewMessages = () =>
  getDb().prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'").get().n;

export function markMessageRead(id) {
  getDb().prepare("UPDATE contact_messages SET status = 'read' WHERE id = ?").run(id);
  return getDb().prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) || null;
}

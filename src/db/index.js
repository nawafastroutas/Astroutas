/**
 * اتصال قاعدة البيانات (SQLite المدمجة في Node) + تهيئة المخطّط.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import config from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  return db;
}

/** تنفيذ ضمن معاملة فورية (تسلسل الكتابة يحمي فحص السعة). */
export function transaction(fn) {
  const d = getDb();
  d.exec('BEGIN IMMEDIATE');
  try {
    const out = fn(d);
    d.exec('COMMIT');
    return out;
  } catch (err) {
    try { d.exec('ROLLBACK'); } catch { /* تجاهل */ }
    throw err;
  }
}

/**
 * يستخرج اسم القيد الفريد المنتهَك من رسالة SQLite،
 * حتى تُقال للمستخدم رسالة عربية محدّدة لا رسالة قاعدة بيانات.
 * @returns {string|null} مثل "members.phone"
 */
export function uniqueViolation(err) {
  // قد يكون القيد مركّبًا: "tickets.member_id, tickets.event_id"
  const m = /UNIQUE constraint failed: (.+)$/m.exec(err?.message || '');
  return m ? m[1].trim() : null;
}

export function isAbort(err, marker) {
  return String(err?.message || '').includes(marker);
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}

export default getDb;

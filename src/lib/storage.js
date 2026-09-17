/**
 * تخزين كائنات بمفاتيح عشوائية لا تُخمَّن.
 * الواجهة مطابقة لما تتوقّعه خدمات S3/R2 — يكفي استبدال محرّك القرص أدناه.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import config from '../config.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const PREFIXES = new Set(['members', 'events', 'news']);

/** مفتاح صالح فقط بهذه الصيغة — يمنع أي خروج عن المجلّد. */
export const KEY_PATTERN = /^(members|events|news)\/[0-9a-f]{32}\.(jpg|png|webp)$/;

export const isValidKey = (key) => typeof key === 'string' && KEY_PATTERN.test(key);

/** يتعرّف على النوع من بصمة الملفّ نفسه، لا من ترويسة العميل. */
export function sniffType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF'
      && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/**
 * @returns {{ok:true, key:string, type:string}|{ok:false, message:string}}
 */
export function putObject(buffer, { prefix = 'events' } = {}) {
  if (!PREFIXES.has(prefix)) return { ok: false, message: 'وجهة الرفع غير معروفة.' };
  if (!buffer || buffer.length === 0) return { ok: false, message: 'لم يصل أي ملفّ.' };
  if (buffer.length > config.uploads.maxBytes) {
    const mb = (config.uploads.maxBytes / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `حجم الصورة يتجاوز الحدّ المسموح (${mb} ميجابايت).` };
  }
  const type = sniffType(buffer);
  if (!type || !config.uploads.allowedTypes.includes(type)) {
    return { ok: false, message: 'نوع الصورة غير مدعوم — استخدم JPG أو PNG أو WEBP.' };
  }

  const key = `${prefix}/${crypto.randomBytes(16).toString('hex')}.${EXT[type]}`;
  const dest = path.join(config.objectsDir, key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer, { mode: 0o640 });
  return { ok: true, key, type };
}

export function getObject(key) {
  if (!isValidKey(key)) return null;
  const file = path.join(config.objectsDir, key);
  try {
    const stat = fs.statSync(file);
    const ext = path.extname(file).slice(1);
    const type = Object.entries(EXT).find(([, e]) => e === ext)?.[0] || 'application/octet-stream';
    return { path: file, size: stat.size, type, mtime: stat.mtime };
  } catch {
    return null;
  }
}

export function deleteObject(key) {
  if (!isValidKey(key)) return false;
  try { fs.unlinkSync(path.join(config.objectsDir, key)); return true; } catch { return false; }
}

/** رابط العرض العام — المفتاح نفسه هو السرّ. */
export const objectUrl = (key) => (isValidKey(key) ? `/o/${key}` : null);

/**
 * إعدادات الموقع — كلّها قابلة للضبط عبر متغيّرات البيئة.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dataDir = process.env.DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(dataDir, { recursive: true });

/** سرّ توقيع الجلسات: من البيئة، وإلا يُولَّد مرّة ويُحفظ بصلاحيات مقيّدة. */
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(dataDir, '.session-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    console.warn('[تنبيه] لم يُضبط SESSION_SECRET — وُلِّد سرّ محلّي في data/.session-secret');
    return secret;
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',

  dataDir,
  dbPath: process.env.DB_PATH || path.join(dataDir, 'club.db'),
  objectsDir: process.env.OBJECTS_DIR || path.join(dataDir, 'objects'),

  sessionSecret: sessionSecret(),
  sessionCookie: 'astro_session',
  sessionMaxAgeMs: 7 * 24 * 60 * 60 * 1000,     // أسبوع

  /** يُستخدم لبناء روابط مطلقة (رمز QR، ملفات التقويم). */
  baseUrl: (process.env.BASE_URL || '').replace(/\/$/, ''),

  timeZone: 'Asia/Muscat',
  locale: 'ar-OM',

  club: {
    name: 'نادي الثقافة والأدب',
    college: 'كلية التربية بالرستاق',
    university: 'جامعة التقنية والعلوم التطبيقية',
    tagline: 'كلمةٌ تُقال، وأثرٌ يبقى',
    email: process.env.CLUB_EMAIL || 'culture.club@utas.edu.om',
  },

  /** نطاق الإيميل الجامعي — شرط التسجيل. */
  emailDomain: '@utas.edu.om',

  uploads: {
    maxBytes: Number(process.env.UPLOAD_MAX_BYTES || 3 * 1024 * 1024),   // 3MB بعد الضغط
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  /** حدود المعدّل (طلب/نافذة بالمللي ثانية) لكل IP. */
  rateLimits: {
    login:   { limit: 15,  windowMs: 5 * 60 * 1000 },
    booking: { limit: 20,  windowMs: 10 * 60 * 1000 },
    contact: { limit: 4,   windowMs: 10 * 60 * 1000 },
    scan:    { limit: 120, windowMs: 60 * 1000 },
    upload:  { limit: 60,  windowMs: 10 * 60 * 1000 },
  },

  /** نافذة المسح: تفتح قبل البداية بساعتين، وتغلق بعد النهاية باثنتي عشرة ساعة. */
  scanWindow: {
    opensBeforeStartMs: 2 * 60 * 60 * 1000,
    closesAfterEndMs: 12 * 60 * 60 * 1000,
  },

  /** نقاط تقييم الفعالية — مرّة واحدة لكل عضو لكل فعالية. */
  evaluationPoints: 10,
};

export default config;

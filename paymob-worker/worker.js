/* دُرمان — خادم الدفع الإلكتروني (Paymob عُمان)
   Cloudflare Worker صغير يحمل مفتاح Paymob السري بدلاً من الموقع.

   المسارات:
     GET  /health   — فحص الإعدادات (بدون أسرار).
     POST /create   — ينشئ Payment Intention لطلب ويعيد رابط صفحة الدفع.
     POST /webhook  — يستقبل تأكيد Paymob (Transaction Processed Callback)،
                      يتحقق من HMAC، ثم يسجّل حالة الدفع في Firebase على الطلب.

   المتغيرات (Settings → Variables and Secrets):
     PAYMOB_SECRET_KEY        سري  — Secret Key من لوحة Paymob (omn_sk_test_… أو omn_sk_live_…)
     PAYMOB_PUBLIC_KEY               Public Key (omn_pk_…)
     PAYMOB_HMAC_SECRET       سري  — HMAC Secret
     PAYMOB_INTEGRATION_IDS          أرقام Integration IDs مفصولة بفاصلة، مثل 12345,67890
     SITE_URL                        رابط الموقع، مثل https://subbha.com
     FIREBASE_DATABASE_URL           مثل https://ubhha-dd0e9-default-rtdb.firebaseio.com
     FIREBASE_API_KEY                مفتاح Firebase العام (نفسه الموجود في الموقع)
     FIREBASE_DATABASE_SECRET سري  — اختياري؛ بديل عن الدخول المجهول للكتابة في Firebase
     AMOUNT_MULTIPLIER               اختياري؛ 1000 افتراضياً (الريال العُماني = 1000 بيسة)
     PAYMOB_BASE_URL                 اختياري؛ https://oman.paymob.com افتراضياً
     PAYMOB_CHECKOUT_URL             اختياري؛ https://om.checkout.paymob.com/ افتراضياً
     ALLOWED_ORIGINS                 اختياري؛ روابط إضافية مسموح لها بالاتصال، مفصولة بفاصلة
*/

const DEFAULT_BASE = 'https://oman.paymob.com';
const DEFAULT_CHECKOUT = 'https://om.checkout.paymob.com/';
const HMAC_KEYS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
  'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type',
  'source_data.type', 'success',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/health') return json(health(env), cors);
      if (url.pathname === '/create' && request.method === 'POST') return await createIntention(request, env, cors);
      if (url.pathname === '/webhook' && request.method === 'POST') return await webhook(request, env, url);
      return json({ error: 'not found' }, cors, 404);
    } catch (err) {
      return json({ error: String(err && err.message || err) }, cors, err && err.status || 500);
    }
  },
};

/* ------------------------------------------------------------------ helpers */
function json(body, headers = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = [env.SITE_URL, ...String(env.ALLOWED_ORIGINS || '').split(',')]
    .map(s => String(s || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allow = !allowed.length ? '*' : (allowed.includes(origin.replace(/\/$/, '')) ? origin : allowed[0]);
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

export function multiplier(env) {
  const n = Number(env.AMOUNT_MULTIPLIER || 1000);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export function integrationIds(env) {
  return String(env.PAYMOB_INTEGRATION_IDS || '')
    .split(/[,\s]+/).map(s => Number(s)).filter(n => Number.isInteger(n) && n > 0);
}

function health(env) {
  const key = String(env.PAYMOB_SECRET_KEY || '');
  return {
    ok: true,
    service: 'durman-paymob',
    mode: !key ? 'missing' : (/_test_/i.test(key) ? 'test' : 'live'),
    configured: {
      secretKey: !!env.PAYMOB_SECRET_KEY,
      publicKey: !!env.PAYMOB_PUBLIC_KEY,
      hmacSecret: !!env.PAYMOB_HMAC_SECRET,
      integrationIds: integrationIds(env).length,
      siteUrl: !!env.SITE_URL,
      firebase: !!(env.FIREBASE_DATABASE_URL && (env.FIREBASE_API_KEY || env.FIREBASE_DATABASE_SECRET)),
    },
    currency: 'OMR',
    amountMultiplier: multiplier(env),
  };
}

export function omanPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return '+968' + digits;
  if (digits.startsWith('968') && digits.length === 11) return '+' + digits;
  return digits ? '+' + digits : '';
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || 'عميل', last: parts.slice(1).join(' ') || '-' };
}

function cleanText(v, max = 120) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

/* ------------------------------------------------------------------ /create */
export function buildIntention(body, env, workerOrigin) {
  const orderId = String(body.orderId || '').replace(/\D/g, '');
  if (!orderId) throw new HttpError(400, 'orderId مطلوب');
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new HttpError(400, 'مبلغ غير صالح');
  const customer = body.customer || {};
  const phone = omanPhone(customer.phone);
  if (phone.replace(/\D/g, '').length < 8) throw new HttpError(400, 'رقم الهاتف غير صالح');
  const ids = integrationIds(env);
  if (!ids.length) throw new HttpError(500, 'PAYMOB_INTEGRATION_IDS غير مضبوط');
  if (!env.PAYMOB_SECRET_KEY) throw new HttpError(500, 'PAYMOB_SECRET_KEY غير مضبوط');
  if (!env.PAYMOB_PUBLIC_KEY) throw new HttpError(500, 'PAYMOB_PUBLIC_KEY غير مضبوط');
  if (!env.SITE_URL) throw new HttpError(500, 'SITE_URL غير مضبوط');

  const mult = multiplier(env);
  const amountMinor = Math.round(amount * mult);
  const orderNumber = cleanText(body.orderNumber || orderId.slice(-6), 12);
  const itemCount = Array.isArray(body.items) ? body.items.reduce((n, i) => n + (Number(i.qty) || 1), 0) : 0;
  const { first, last } = splitName(customer.name);
  const siteHost = (() => { try { return new URL(env.SITE_URL).hostname; } catch { return 'durman.local'; } })();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email || '')) ? String(customer.email).trim()
    : (env.CUSTOMER_FALLBACK_EMAIL || `orders@${siteHost}`);
  const reference = `${orderId}-${Date.now()}`;

  return {
    reference,
    amountMinor,
    payload: {
      amount: amountMinor,
      currency: 'OMR',
      payment_methods: ids,
      items: [{
        name: cleanText(`طلب دُرمان #${orderNumber}`, 60),
        amount: amountMinor,
        description: cleanText(itemCount ? `${itemCount} منتج — ${body.gift ? 'طلب إهداء' : 'طلب متجر'}` : 'طلب متجر دُرمان', 100),
        quantity: 1,
      }],
      billing_data: {
        first_name: cleanText(first, 40),
        last_name: cleanText(last, 40),
        phone_number: phone,
        email,
        street: cleanText(customer.address, 120) || 'NA',
        building: 'NA',
        floor: 'NA',
        apartment: 'NA',
        city: cleanText(customer.governorate, 40) || 'Muscat',
        state: cleanText(customer.wilayat, 40) || 'NA',
        country: 'OM',
        postal_code: 'NA',
      },
      customer: { first_name: cleanText(first, 40), last_name: cleanText(last, 40), email, extras: { phone } },
      extras: { order_id: orderId, order_number: orderNumber },
      special_reference: reference,
      expiration: 3600,
      notification_url: `${workerOrigin}/webhook`,
      redirection_url: `${String(env.SITE_URL).replace(/\/$/, '')}/?paymob=return`,
    },
  };
}

async function createIntention(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { throw new HttpError(400, 'JSON غير صالح'); }
  const workerOrigin = new URL(request.url).origin;
  const { reference, amountMinor, payload } = buildIntention(body, env, workerOrigin);
  const base = String(env.PAYMOB_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const res = await fetch(`${base}/v1/intention/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Token ${env.PAYMOB_SECRET_KEY}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok || !data.client_secret) {
    return json({ error: 'Paymob رفض إنشاء عملية الدفع', status: res.status, detail: data }, cors, 502);
  }
  const checkoutBase = String(env.PAYMOB_CHECKOUT_URL || DEFAULT_CHECKOUT).replace(/\/?$/, '/');
  const checkoutUrl = `${checkoutBase}?publicKey=${encodeURIComponent(env.PAYMOB_PUBLIC_KEY)}&clientSecret=${encodeURIComponent(data.client_secret)}`;
  const orderId = String(body.orderId).replace(/\D/g, '');
  // تسجيل مرجع العملية على الطلب (لا يوقف الدفع إن فشل).
  await firebasePatch(env, `subbha/orders/${orderId}/paymob`, {
    intentionId: data.id || null,
    paymobOrderId: data.intention_order_id || null,
    reference,
    amountMinor,
    createdAt: new Date().toISOString(),
  }).catch(() => {});
  return json({ checkoutUrl, intentionId: data.id || null, paymobOrderId: data.intention_order_id || null, reference }, cors);
}

/* ------------------------------------------------------------------ /webhook */
function pick(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function hmacString(obj) {
  return HMAC_KEYS.map(k => {
    const v = pick(obj, k);
    return v == null ? '' : String(v);
  }).join('');
}

export async function hmacSha512Hex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function paymentUpdateFromTransaction(obj, env) {
  const mult = multiplier(env);
  const success = obj.success === true || obj.success === 'true';
  let paymentStatus = success ? 'paid' : 'failed';
  if (success && (obj.is_refunded === true || obj.is_refund === true)) paymentStatus = 'refunded';
  if (success && (obj.is_voided === true || obj.is_void === true)) paymentStatus = 'voided';
  const pan = pick(obj, 'source_data.pan'), sub = pick(obj, 'source_data.sub_type');
  return {
    paymentStatus,
    paymentVerified: true,
    paymentGateway: 'paymob',
    paymobTransactionId: obj.id != null ? String(obj.id) : null,
    paymobOrderId: pick(obj, 'order.id') != null ? String(pick(obj, 'order.id')) : null,
    paidAmount: Number.isFinite(Number(obj.amount_cents)) ? Number(obj.amount_cents) / mult : null,
    paidCurrency: obj.currency || 'OMR',
    paidAt: obj.created_at || new Date().toISOString(),
    paymentCard: [sub, pan ? `•••• ${pan}` : ''].filter(Boolean).join(' ') || null,
    paymentMessage: cleanText(pick(obj, 'data.message') || obj.txn_response_code || '', 120) || null,
    paymentUpdatedAt: new Date().toISOString(),
  };
}

async function webhook(request, env, url) {
  if (!env.PAYMOB_HMAC_SECRET) return json({ error: 'PAYMOB_HMAC_SECRET غير مضبوط' }, {}, 500);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON غير صالح' }, {}, 400); }
  const obj = body && body.obj;
  if (!obj || typeof obj !== 'object') return json({ ignored: true, reason: 'no obj' });
  const given = String(url.searchParams.get('hmac') || body.hmac || '').toLowerCase();
  const expected = await hmacSha512Hex(env.PAYMOB_HMAC_SECRET, hmacString(obj));
  if (!given || !timingSafeEqual(given, expected)) return json({ error: 'HMAC غير مطابق' }, {}, 401);

  const reference = String(pick(obj, 'order.merchant_order_id') || pick(obj, 'order.special_reference') || '');
  const orderId = reference.split('-')[0].replace(/\D/g, '');
  if (!orderId) return json({ ok: true, ignored: true, reason: 'no merchant_order_id' });
  const update = paymentUpdateFromTransaction(obj, env);
  try {
    await firebasePatch(env, `subbha/orders/${orderId}`, update);
  } catch (err) {
    return json({ error: 'تعذر تحديث الطلب في Firebase', detail: String(err && err.message || err) }, {}, 502);
  }
  return json({ ok: true, orderId, paymentStatus: update.paymentStatus });
}

/* ------------------------------------------------------------------ Firebase */
let cachedToken = { value: '', expiresAt: 0 };

async function firebaseToken(env) {
  if (env.FIREBASE_DATABASE_SECRET) return env.FIREBASE_DATABASE_SECRET;
  if (!env.FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY غير مضبوط');
  if (cachedToken.value && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  // جلسة مجهولة مثل جلسة العميل في الموقع؛ قواعد Firebase تسمح لها بالكتابة على الطلبات.
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.idToken) throw new Error('تعذر الحصول على جلسة Firebase: ' + (data.error?.message || res.status));
  cachedToken = { value: data.idToken, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.idToken;
}

async function firebasePatch(env, path, data) {
  if (!env.FIREBASE_DATABASE_URL) throw new Error('FIREBASE_DATABASE_URL غير مضبوط');
  const token = await firebaseToken(env);
  const base = String(env.FIREBASE_DATABASE_URL).replace(/\/$/, '');
  const res = await fetch(`${base}/${path}.json?auth=${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 401 && !env.FIREBASE_DATABASE_SECRET) cachedToken = { value: '', expiresAt: 0 };
    throw new Error(`Firebase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

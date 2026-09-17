/**
 * مسح تذاكر الحضور: قراءة QR بالكاميرا عبر BarcodeDetector،
 * مع إدخال يدوي يعمل في أي متصفّح.
 */
const video = document.querySelector('[data-scan-video]');
const startBtn = document.querySelector('[data-scan-start]');
const stopBtn = document.querySelector('[data-scan-stop]');
const support = document.querySelector('[data-scan-support]');
const form = document.querySelector('[data-scan-form]');
const input = form?.querySelector('input[name="code"]');
const result = document.querySelector('[data-scan-result]');
const log = document.querySelector('[data-scan-log]');

let stream = null;
let detector = null;
let running = false;
const recent = new Map();          // رمز → وقت آخر إرسال (يمنع التكرار السريع)

function show(state, title, lines = []) {
  if (!result) return;
  result.innerHTML = '';
  const card = document.createElement('div');
  card.className = `scan-result__card scan-result--${state}`;
  const h = document.createElement('strong');
  h.style.fontSize = '1.1rem';
  h.textContent = title;
  card.append(h);
  for (const line of lines.filter(Boolean)) {
    const p = document.createElement('p');
    p.style.margin = '.35rem 0 0';
    p.textContent = line;
    card.append(p);
  }
  result.append(card);
  if (state !== 'error' && navigator.vibrate) navigator.vibrate(state === 'ok' ? 90 : [40, 60, 40]);
}

function addLog(text) {
  if (!log) return;
  const li = document.createElement('li');
  const time = new Intl.DateTimeFormat('ar-OM', { timeStyle: 'medium', timeZone: 'Asia/Muscat' }).format(new Date());
  li.textContent = `${time} — ${text}`;
  log.prepend(li);
  while (log.children.length > 12) log.lastElementChild.remove();
}

async function submitCode(code) {
  const clean = String(code || '').trim();
  if (!clean) return;
  const last = recent.get(clean) || 0;
  if (Date.now() - last < 3000) return;         // نفس الرمز أمام الكاميرا
  recent.set(clean, Date.now());

  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'fetch' },
      credentials: 'same-origin',
      body: JSON.stringify({ code: clean }),
    });
    const data = await response.json();
    const who = data.member ? `${data.member.name} — ${data.member.major}` : '';
    const what = data.event ? data.event.title : '';

    if (!data.ok) {
      show('error', data.message, [who, what]);
      addLog(`✗ ${data.message}`);
      return;
    }
    if (data.repeat) {
      show('repeat', 'ممسوحة من قبل', [who, what, data.attendance ? `بطاقة: ${data.attendance.card_id}` : '']);
      addLog(`↺ ${who || clean} — ممسوحة من قبل`);
      return;
    }
    show('ok', 'تمّ تسجيل الحضور ✓', [
      who, what,
      data.attendance ? `${data.attendance.points_awarded} نقطة` : '',
      data.attendance?.badge_name ? `🏅 ${data.attendance.badge_name}` : '',
      data.attendance ? `بطاقة: ${data.attendance.card_id}` : '',
    ]);
    addLog(`✓ ${who || clean}`);
  } catch {
    show('error', 'تعذّر الاتصال بالخادم.', ['تحقّق من الشبكة ثم أعد المحاولة.']);
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitCode(input.value);
  input.value = '';
  input.focus();
});

/* ------------------------------ الكاميرا ------------------------------ */
async function detectorAvailable() {
  if (!('BarcodeDetector' in window)) return false;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('qr_code');
  } catch { return false; }
}

async function tick() {
  if (!running) return;
  try {
    const codes = await detector.detect(video);
    if (codes.length) await submitCode(codes[0].rawValue);
  } catch { /* إطار غير صالح — تجاهل */ }
  if (running) setTimeout(() => requestAnimationFrame(tick), 220);
}

async function start() {
  if (!await detectorAvailable()) {
    support.textContent = 'متصفّحك لا يدعم قراءة الرمز بالكاميرا. استخدم الإدخال اليدوي أدناه، '
      + 'أو افتح الصفحة من متصفّح كروم على الجوال.';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    support.textContent = 'الكاميرا غير متاحة. يلزم اتصال آمن (https) أو الإدخال اليدوي.';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false,
    });
  } catch {
    support.textContent = 'لم يُسمح باستخدام الكاميرا. اسمح بالإذن، أو استخدم الإدخال اليدوي.';
    return;
  }
  detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  video.srcObject = stream;
  video.hidden = false;
  await video.play();
  running = true;
  startBtn.hidden = true;
  stopBtn.hidden = false;
  support.textContent = 'وجّه الكاميرا إلى رمز التذكرة.';
  tick();
}

function stop() {
  running = false;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.hidden = true;
  startBtn.hidden = false;
  stopBtn.hidden = true;
  support.textContent = 'أُوقفت الكاميرا.';
}

startBtn?.addEventListener('click', start);
stopBtn?.addEventListener('click', stop);
window.addEventListener('pagehide', stop);

(async () => {
  if (!support) return;
  support.textContent = await detectorAvailable()
    ? 'الكاميرا جاهزة — اضغط «تشغيل الكاميرا».'
    : 'قراءة الرمز بالكاميرا غير مدعومة في هذا المتصفّح — الإدخال اليدوي يعمل دائمًا.';
  input?.focus();
})();

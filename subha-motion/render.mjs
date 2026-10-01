/* ===========================================================================
   سبحة · SUBHA — تصيير الموشن جرافيك إلى ملف MP4 طولي.

   الفكرة: كل حركة في المشهد هي CSS animation، فنفتح الصفحة في Chromium،
   نوقف الساعة تمامًا، ثم نضبط currentTime لكل الحركات على لحظة الإطار
   ونلتقط الصورة. النتيجة لا تعتمد على سرعة الجهاز إطلاقًا: نفس الإطار
   بالبكسل في كل تشغيل.

   التشغيل:  node render.mjs            (٣٠ إطارًا/ث، ٣٠٫٦ ثانية)
             node render.mjs --fps 60   (أنعم، ملف أكبر)
             node render.mjs --keep     (يُبقي ملفات الإطارات)
   =========================================================================== */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 1920;

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const FPS      = Number(arg('fps', 30));
const DURATION = Number(arg('duration', 30.6));      // يجب أن يطابق نهاية الخط الزمني في scene.css
const KEEP     = process.argv.includes('--keep');
const FRAMES   = Math.round(DURATION * FPS);
const FRAMEDIR = path.join(HERE, '.frames');
const OUT      = path.join(HERE, 'output', `subha-motion-${W}x${H}.mp4`);

const run = (cmd, args) => new Promise((ok, no) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  p.on('error', no);
  p.on('close', c => (c === 0 ? ok() : no(new Error(`${cmd} خرج بالرمز ${c}`))));
});

console.log(`▸ ${FRAMES} إطارًا · ${FPS} إطار/ث · ${DURATION}s · ${W}×${H}`);

await rm(FRAMEDIR, { recursive: true, force: true });
await mkdir(FRAMEDIR, { recursive: true });
await mkdir(path.join(HERE, 'output'), { recursive: true });

const browser = await chromium.launch({
  args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text']
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1
});

page.on('pageerror', e => console.error('خطأ في الصفحة:', e.message));
await page.goto('file://' + path.join(HERE, 'index.html'), { waitUntil: 'load' });

// ننتظر الخطوط والصور قبل أي التقاط، وإلا ظهرت إطارات بلا نص أو بلا شعار
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all(
  [...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))
));
await page.waitForTimeout(400);

// تجميد كل الحركات — من هنا فصاعدًا نحن من يحرّك الزمن
await page.evaluate(() => {
  document.getAnimations().forEach(a => a.pause());
});
const count = await page.evaluate(() => document.getAnimations().length);
console.log(`▸ ${count} حركة مُجمّدة`);

const seek = t => page.evaluate(ms => {
  for (const a of document.getAnimations()) a.currentTime = ms;
}, t);

// مهم: نتقدّم للأمام فقط. المتصفح يُسقِط الحركات المنتهية من document.getAnimations()
// فالرجوع بالزمن للخلف لا يعيد تشغيلها.
const t0 = Date.now();
for (let f = 0; f < FRAMES; f++) {
  await seek((f / FPS) * 1000);
  await page.screenshot({
    path: path.join(FRAMEDIR, String(f).padStart(5, '0') + '.png')
  });
  if (f % 60 === 0 || f === FRAMES - 1) {
    const pct = Math.round(((f + 1) / FRAMES) * 100);
    const eta = Math.round(((Date.now() - t0) / (f + 1)) * (FRAMES - f - 1) / 1000);
    process.stdout.write(`\r  التقاط ${pct}%  (باقٍ ~${eta}s)   `);
  }
}
process.stdout.write('\n');
await browser.close();

const got = (await readdir(FRAMEDIR)).length;
if (got !== FRAMES) throw new Error(`التُقط ${got} إطارًا والمتوقع ${FRAMES}`);

console.log('▸ ترميز H.264 …');
await run('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-framerate', String(FPS),
  '-i', path.join(FRAMEDIR, '%05d.png'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
  '-movflags', '+faststart',
  OUT
]);

// صورة الغلاف (آخر لقطة مكتملة للشعار)
await run('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-i', path.join(FRAMEDIR, String(FRAMES - 1).padStart(5, '0') + '.png'),
  path.join(HERE, 'output', 'poster.png')
]);

if (!KEEP) await rm(FRAMEDIR, { recursive: true, force: true });
if (existsSync(OUT)) console.log('✓ ' + path.relative(process.cwd(), OUT));

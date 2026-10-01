/* لقطات عند لحظات محدّدة — للمعاينة السريعة أثناء التصميم:
   node preview.mjs 1.2 3.4 6.5      */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
// تصاعديًا دائمًا: المتصفح يتخلّص من الحركات المنتهية، فالقفز للخلف لا يعيدها.
// render.mjs يتقدّم للأمام دائمًا، وهذا يحاكيه.
const PAGE = process.env.PREVIEW_PAGE || 'index.html';
const times = process.argv.slice(2).map(Number).sort((a, b) => a - b);
const out = process.env.PREVIEW_DIR || path.join(HERE, '.preview');
await mkdir(out, { recursive: true });
const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
p.on('pageerror', e => console.error('PAGEERROR:', e.message));
await p.goto('file://' + path.join(HERE, PAGE), { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
console.log('animations:', await p.evaluate(() => document.getAnimations().length));
for (const t of times) {
  await p.evaluate(ms => { for (const a of document.getAnimations()) a.currentTime = ms; }, t * 1000);
  await p.screenshot({ path: path.join(out, 't' + String(t).replace('.', '_') + '.png') });
}
await b.close();
console.log('saved', times.length, 'frames to', out);

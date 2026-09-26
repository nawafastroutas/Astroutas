// Astroutas smoke check: serves the repo statically, then drives Chromium via
// the preinstalled Playwright. Usage: node check.mjs [page.html]
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const page = process.argv[2] || 'index.html';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/${page}`;
const outDir = await mkdtemp(join(tmpdir(), 'astroutas-check-'));

const browser = await chromium.launch();
const failures = [];
const shots = [];

async function run(name, ctxOpts, { js = true } = {}) {
  const ctx = await browser.newContext({ ...ctxOpts, javaScriptEnabled: js, locale: 'ar' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(`JS error: ${e.message}`));
  p.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  p.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await p.goto(url, { waitUntil: 'load' });
  if (js) {
    try {
      await p.waitForFunction(() => document.documentElement.classList.contains('app-ready')
        && !document.querySelector('[data-splash]'), null, { timeout: 8000 });
    } catch { errors.push('splash did not finish within 8s'); }
    await p.waitForTimeout(900); // let enter animations settle
  }
  const m = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    dir: document.documentElement.dir, lang: document.documentElement.lang,
    text: document.body.innerText.trim().length,
  }));
  if (m.sw > m.iw) errors.push(`horizontal overflow: scrollWidth ${m.sw} > ${m.iw}`);
  if (m.dir !== 'rtl' || m.lang !== 'ar') errors.push(`expected lang="ar" dir="rtl", got lang="${m.lang}" dir="${m.dir}"`);
  if (!m.text) errors.push('page has no visible text');
  const shot = join(outDir, `${name}.png`);
  await p.screenshot({ path: shot, fullPage: true });
  shots.push(shot);
  for (const e of errors) failures.push(`[${name}] ${e}`);
  console.log(`${errors.length ? 'FAIL' : 'ok  '} ${name}`);
  await ctx.close();
}

const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 } };
await run('mobile-390', mobile);
await run('desktop-1440', desktop);
await run('narrow-320', { viewport: { width: 320, height: 640 } });
await run('reduced-motion', { ...mobile, reducedMotion: 'reduce' });
await run('no-js', mobile, { js: false });

await browser.close();
server.close();
console.log('\nScreenshots:\n' + shots.map(s => '  ' + s).join('\n'));
if (failures.length) { console.log('\nFAIL\n' + failures.join('\n')); process.exit(1); }
console.log('\nPASS');

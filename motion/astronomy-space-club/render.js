#!/usr/bin/env node
/*
 * Renders index.html frame by frame into an H.264 MP4 (or PNG stills).
 *
 *   node render.js --size 1920x1080 --fps 60 --out out/video-16x9.mp4
 *   node render.js --size 1920x1080 --stills 1,3.5,8.6,12.8 --outdir out/stills
 *
 * Needs Playwright (Chromium) and an ffmpeg with libx264 (FFMPEG env var or on PATH).
 * Audio is muxed separately (see README).
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const [W, H] = (args.size || '1920x1080').split('x').map(Number);
const FPS = Number(args.fps || 60);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const ROOT = __dirname;

const TYPES = { '.html': 'text/html; charset=utf-8', '.ttf': 'font/ttf', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${port}/index.html?capture=1`);
  await page.evaluate(() => window.ready);
  const duration = await page.evaluate(() => window.DURATION);

  if (args.stills) {
    const outdir = path.resolve(args.outdir || 'out/stills');
    fs.mkdirSync(outdir, { recursive: true });
    for (const t of String(args.stills).split(',').map(Number)) {
      await page.evaluate(t => window.render(t), t);
      const file = path.join(outdir, `t${t.toFixed(2).padStart(5, '0')}.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
  } else {
    const out = path.resolve(args.out || `out/video-${W}x${H}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 18), '-profile:v', 'high',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
    const total = Math.round(duration * FPS);
    const t0 = Date.now();
    for (let i = 0; i < total; i++) {
      await page.evaluate(t => window.render(t), i / FPS);
      // JPEG q96: ~5× faster than PNG here (the paper grain makes PNG encoding slow)
      const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % FPS === 0) process.stdout.write(`\r${i}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    console.log(`\n${out}`);
  }
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });

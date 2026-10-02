// Render Solva series episodes to video with sound.
//   node render.mjs            -> all episodes (ep01.html … ep30.html) to videos/day-XX.webm
//   node render.mjs 3 7 12     -> only those days
//   node render.mjs --mp4      -> H.264/AAC .mp4 instead (needs a full ffmpeg on PATH)
// Env: FFMPEG=path/to/ffmpeg, JOBS=parallel episodes (default 2)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FF = process.env.FFMPEG || 'ffmpeg';
const FPS = 30, JOBS = +(process.env.JOBS || 2);
const args = process.argv.slice(2), mp4 = args.includes('--mp4');
let days = args.filter(a => /^\d+$/.test(a)).map(Number);
if (!days.length) days = fs.readdirSync(DIR).map(f => f.match(/^ep(\d\d)\.html$/)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b);
fs.mkdirSync(path.join(DIR, 'videos'), { recursive: true });

const ff = a => new Promise((res, rej) => { const p = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' }); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });

async function renderDay(browser, day){
  const id = String(day).padStart(2, '0'), url = 'file://' + path.join(DIR, `ep${id}.html`) + '?render';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'solva-')), mj = path.join(tmp, 'f.mjpeg'), vid = path.join(tmp, 'v.webm'), aud = path.join(tmp, 'a.webm');
  const t0 = Date.now();
  // audio (real-time capture) runs alongside the frame capture
  const audio = (async () => {
    const p = await browser.newPage(); await p.goto(url); await p.evaluate(() => document.fonts.ready);
    if (await p.evaluate(() => S.CFG.silent)) { await p.close(); return false; } // silent episodes: video only
    fs.writeFileSync(aud, Buffer.from(await p.evaluate(() => S.audioWebm()), 'base64')); await p.close();
    return true;
  })();
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.error(`[day ${id}]`, e.message));
  await p.goto(url); await p.evaluate(() => document.fonts.ready);
  const dur = await p.evaluate(() => S.D), n = Math.round((dur + .5) * FPS), fd = fs.openSync(mj, 'w');
  for (let i = 0; i < n; i++){ await p.evaluate(t => S.seek(t), i / FPS); fs.writeSync(fd, await p.screenshot({ type: 'jpeg', quality: 94 })); }
  fs.closeSync(fd); await p.close();
  await ff(['-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'file:' + mj,
    '-c:v', 'libvpx', '-b:v', '7M', '-crf', '6', '-qmin', '0', '-qmax', '28', '-deadline', 'good', '-cpu-used', '2', '-threads', '2', '-pix_fmt', 'yuv420p', '-auto-alt-ref', '0', vid]);
  const hasAudio = await audio;
  const out = path.join(DIR, 'videos', `day-${id}.${mp4 ? 'mp4' : 'webm'}`);
  if (!hasAudio) mp4 ? await ff(['-i', vid, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]) : fs.copyFileSync(vid, out);
  else if (mp4) await ff(['-i', vid, '-i', aud, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  else await ff(['-i', vid, '-i', aud, '-map', '0:v', '-map', '1:a', '-c', 'copy', '-shortest', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`day ${id} ✓ ${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s → ${path.relative(DIR, out)}`);
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const queue = [...days];
await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) { const d = queue.shift(); try { await renderDay(browser, d); } catch (e) { console.error(`day ${d} ✗`, e.message); } } }));
await browser.close();

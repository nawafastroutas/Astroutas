// Build the three "all-in-one" videos: each joins 10 episodes back to back.
// Every episode is cut where its outro would start; only the last episode of each part keeps the Solva outro.
//   node compile.mjs          -> videos/solva-part-1.webm … part-3
//   node compile.mjs 2        -> only part 2
//   node compile.mjs --mp4    -> H.264/AAC .mp4 (needs a full ffmpeg on PATH)
// Env: FFMPEG=path/to/ffmpeg
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FF = process.env.FFMPEG || 'ffmpeg', FPS = 30, SR = 48000;
const PARTS = [
  { n: 1, days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { n: 2, days: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
  { n: 3, days: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
];
const args = process.argv.slice(2), mp4 = args.includes('--mp4');
const want = args.filter(a => /^\d$/.test(a)).map(Number);
const ff = a => new Promise((res, rej) => { const p = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' }); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });
const url = d => 'file://' + path.join(DIR, `ep${String(d).padStart(2, '0')}.html`) + '?render';

async function part(browser, P){
  const t0 = Date.now(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'solva-part-'));
  const mj = path.join(tmp, 'f.mjpeg'), vid = path.join(tmp, 'v.webm'), aud = path.join(tmp, 'a.webm');
  const fd = fs.openSync(mj, 'w'), audioChunks = [];
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error(`[part ${P.n}]`, e.message));
  let frames = 0;
  for (const [i, d] of P.days.entries()){
    const last = i === P.days.length - 1;
    await page.goto(url(d)); await page.evaluate(() => document.fonts.ready);
    const { dur, outro } = await page.evaluate(() => ({ dur: S.D, outro: S.CFG.outro }));
    const n = Math.round((last ? dur + .5 : outro) * FPS);
    for (let k = 0; k < n; k++){ await page.evaluate(t => S.seek(t), k / FPS); fs.writeSync(fd, await page.screenshot({ type: 'jpeg', quality: 94 })); }
    frames += n;
    // this episode's sound, trimmed to exactly its frames, with short fades at the seams
    audioChunks.push(await page.evaluate(async ({ n, last, FPS }) => {
      const buf = await S.renderAudio(), len = Math.round(n / FPS * buf.sampleRate), fi = Math.round(.02 * buf.sampleRate), fo = Math.round((last ? .05 : .25) * buf.sampleRate);
      const out = [];
      for (let c = 0; c < 2; c++){
        const src = buf.getChannelData(c), a = new Float32Array(len);
        for (let j = 0; j < len; j++){ let v = j < src.length ? src[j] : 0; if (j < fi) v *= j / fi; if (j > len - fo) v *= (len - j) / fo; a[j] = v; }
        const u = new Uint8Array(a.buffer); let s = ''; for (let j = 0; j < u.length; j += 0x8000) s += String.fromCharCode.apply(null, u.subarray(j, j + 0x8000));
        out.push(btoa(s));
      }
      return out;
    }, { n, last, FPS }));
    console.log(`part ${P.n}: day ${d} ${n} frames`);
  }
  fs.closeSync(fd); await page.close();
  const venc = ff(['-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'file:' + mj,
    '-c:v', 'libvpx', '-b:v', '7M', '-crf', '6', '-qmin', '0', '-qmax', '28', '-deadline', 'good', '-cpu-used', '2', '-threads', '2', '-pix_fmt', 'yuv420p', '-auto-alt-ref', '0', vid]);
  // join the audio in the browser and record it in real time to Opus
  const ap = await browser.newPage(); await ap.goto(url(P.days[0]));
  await ap.evaluate(() => { window.__A = [[], []]; });
  for (const [l, r] of audioChunks) await ap.evaluate(([l, r]) => { const dec = b => new Float32Array(Uint8Array.from(atob(b), c => c.charCodeAt(0)).buffer); __A[0].push(dec(l)); __A[1].push(dec(r)); }, [l, r]);
  const b64 = await ap.evaluate(async SR => {
    const total = __A[0].reduce((s, a) => s + a.length, 0), ac = new AudioContext({ sampleRate: SR }); await ac.resume();
    const buf = ac.createBuffer(2, total, SR);
    for (let c = 0; c < 2; c++){ const ch = buf.getChannelData(c); let o = 0; __A[c].forEach(a => { ch.set(a, o); o += a.length; }); }
    const src = ac.createBufferSource(); src.buffer = buf; const dest = ac.createMediaStreamDestination(); src.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 }), chunks = [];
    rec.ondataavailable = e => chunks.push(e.data); const done = new Promise(r => rec.onstop = r);
    rec.start(); src.start(); await new Promise(r => src.onended = r); await new Promise(r => setTimeout(r, 150)); rec.stop(); await done;
    const u = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }, SR);
  fs.writeFileSync(aud, Buffer.from(b64, 'base64')); await ap.close();
  await venc;
  const out = path.join(DIR, 'videos', `solva-part-${P.n}.${mp4 ? 'mp4' : 'webm'}`);
  if (mp4) await ff(['-i', vid, '-i', aud, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  else await ff(['-i', vid, '-i', aud, '-map', '0:v', '-map', '1:a', '-c', 'copy', '-shortest', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`part ${P.n} ✓ ${(frames / FPS).toFixed(1)}s, ${((Date.now() - t0) / 1000).toFixed(0)}s → ${path.relative(DIR, out)}`);
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
await Promise.all(PARTS.filter(p => !want.length || want.includes(p.n)).map(p => part(browser, p).catch(e => console.error(`part ${p.n} ✗`, e.message))));
await browser.close();

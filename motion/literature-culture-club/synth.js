#!/usr/bin/env node
/*
 * Procedural soundtrack for the 20 s motion graphic — no samples, no dependencies.
 * Every sound is placed on the same timeline as index.html:
 *
 *   0.75 / 3.05 / 5.05   plucked notes (Karplus–Strong, oud-like) for نقرأ · نكتب · نُبدع
 *   2.4 / 4.4            whooshes for the camera pans
 *   6.45 → 8.25          riser while the logo arcs draw, then impact + bell as the diamond pops
 *   9.9 → 11.2           whoosh as the mark glides into the lockup
 *   12.3                 resolving strum when the lockup is complete
 *   13.35                shimmer with the sheen, 16.0 soft bell with the ripple
 *
 * Melody sits in maqam Hijaz on D (D E♭ F♯ G A B♭ C).
 *
 *   node synth.js out/soundtrack.wav
 */
const fs = require('fs');
const path = require('path');

const SR = 48000, DUR = 20, N = SR * DUR;
const dryL = new Float32Array(N), dryR = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { D2: 38, A2: 45, D3: 50, A3: 57, D4: 62, Eb4: 63, Fs4: 66, G4: 67, A4: 69, Bb4: 70,
               D5: 74, Fs5: 78, A5: 81, D6: 86, Fs6: 90, A6: 93, D7: 98 };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// 2nd-order Butterworth high-pass (RBJ biquad)
function highpass(fc) {
  const w = 2 * Math.PI * fc / SR, c = Math.cos(w), al = Math.sin(w) / Math.SQRT2, a0 = 1 + al;
  const b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, b2 = b0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

// equal-power pan, pan in [-1, 1]
function out(n, v, pan, send) {
  if (n < 0 || n >= N) return;
  const a = (pan + 1) * Math.PI / 4;
  const l = v * Math.cos(a), r = v * Math.sin(a);
  dryL[n] += l; dryR[n] += r;
  sendL[n] += l * send; sendR[n] += r * send;
}

// ---------- instruments ----------
function pad(midis, t0, t1, amp, { att = 3, rel = 2.5, send = .6 } = {}) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR);
  for (const m of midis) {
    for (const [cents, pan] of [[-5, -.45], [5, .45]]) {
      const f = hz(m) * Math.pow(2, cents / 1200);
      const H = 8;
      const hAmp = [], ph = [];
      for (let h = 1; h <= H; h++) { hAmp.push((1 / h) * Math.exp(-(h - 1) / 2.2)); ph.push(rnd() * 6.283); }
      for (let n = n0; n < n1 && n < N; n++) {
        const t = (n - n0) / SR, left = (n1 - n) / SR;
        const env = Math.pow(clamp(t / att), 2) * clamp(left / rel) * (.85 + .15 * Math.sin(t * 1.1 + m));
        let v = 0;
        for (let h = 0; h < H; h++) v += hAmp[h] * Math.sin(ph[h] + 6.283185 * f * (h + 1) * t);
        out(n, v * env * amp, pan, send);
      }
    }
  }
}

function pluck(t0, midi, amp, pan, { g = .9955, bright = .42, dur = 4.5, send = .35 } = {}) {
  const f = hz(midi), n0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  const D = SR / f - .5, P = Math.round(SR / f), SIZE = 8192, y = new Float32Array(SIZE);
  let lp = 0;
  const hp = highpass(Math.min(90, f * .5));
  for (let n = 0; n < len; n++) {
    let ex = 0;
    if (n < P) { lp += bright * ((rnd() * 2 - 1) - lp); ex = lp; }
    let fb = 0;
    const rp = n - D;
    if (rp >= 1) {
      const i0 = Math.floor(rp), fr = rp - i0;
      const a = y[i0 & (SIZE - 1)] * (1 - fr) + y[(i0 + 1) & (SIZE - 1)] * fr;
      const b = y[(i0 - 1) & (SIZE - 1)] * (1 - fr) + y[i0 & (SIZE - 1)] * fr;
      fb = g * .5 * (a + b);
    }
    const v = ex + fb;
    y[n & (SIZE - 1)] = v;
    const env = clamp((len - n) / (SR * .4));
    out(n0 + n, hp(v) * amp * env, pan, send);
  }
}

function bell(t0, midi, amp, pan, { dur = 3.2, send = .55 } = {}) {
  const f = hz(midi), n0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  const parts = [[1, 1, 1], [2, .45, .6], [2.76, .32, .45], [5.4, .16, .25], [8.93, .08, .15]];
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    let v = 0;
    for (const [r, a, d] of parts) v += a * Math.exp(-t / (dur * d * .45)) * Math.sin(6.283185 * f * r * t);
    out(n0 + n, v * amp * clamp(t / .004) * clamp((len - n) / (SR * .6)), pan, send);
  }
}

// band-passed noise with a swept centre frequency; env peaks at `peak` (0..1 of the length)
function whoosh(t0, t1, amp, f0, f1, pan0, pan1, { q = 1.1, peak = .6, send = .5 } = {}) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR), len = n1 - n0;
  let low = 0, band = 0;
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const fc = f0 * Math.pow(f1 / f0, x);
    const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    const w = rnd() * 2 - 1;
    low += F * band; const high = w - low - q * band; band += F * high;
    const env = x < peak ? Math.pow(x / peak, 2.2) : Math.pow((1 - x) / (1 - peak), 1.6);
    out(n0 + i, band * amp * env, pan0 + (pan1 - pan0) * x, send);
  }
}

function impact(t0, amp) {
  const n0 = Math.round(t0 * SR), len = Math.round(2.4 * SR);
  let ph = 0, lp = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const f = 38 + 55 * Math.exp(-t / .07);
    ph += 6.283185 * f / SR;
    const body = Math.sin(ph) * Math.exp(-t / .55);
    lp += .02 * ((rnd() * 2 - 1) - lp);
    const thump = lp * 6 * Math.exp(-t / .06);
    out(n0 + n, (body + thump) * amp * clamp(t / .003) * clamp((len - n) / (SR * .5)), 0, .25);
  }
}

// ---------- the score ----------
// bed
pad([NOTE.D2], 0, 20, .016, { att: 2.5, rel: 2, send: .3 });
pad([NOTE.D3, NOTE.A3, NOTE.D4], .2, 20, .018, { att: 3.5, rel: 1.8 });
pad([NOTE.Fs4, NOTE.A4], 8.25, 20, .011, { att: 2.5, rel: 1.8 });

// words
pluck(.75, NOTE.D4, .34, -.15); pluck(.78, NOTE.D3, .2, .1, { bright: .35 });
pluck(3.05, NOTE.Eb4, .3, .15); pluck(3.36, NOTE.Fs4, .26, .2);
pluck(5.05, NOTE.G4, .3, -.1); pluck(5.36, NOTE.A4, .28, -.2);

// camera pans (content moves right → sound travels left to right)
whoosh(2.25, 3.45, .16, 350, 2200, -.6, .6);
whoosh(4.25, 5.45, .16, 380, 2400, -.6, .6);

// the dive: riser into the logo
whoosh(6.3, 8.24, .2, 220, 5200, -.2, .2, { peak: .97, q: .8 });
for (const [m, pan] of [[NOTE.D4, -.3], [NOTE.A4, .3]]) {
  const n0 = Math.round(6.4 * SR), n1 = Math.round(8.24 * SR);
  let ph = 0;
  for (let n = n0; n < n1; n++) {
    const x = (n - n0) / (n1 - n0);
    ph += 6.283185 * hz(m + 12 * x * x) / SR;
    out(n, Math.sin(ph) * .035 * Math.pow(x, 2.4) * clamp((n1 - n) / (SR * .02)), pan, .6);
  }
}

// diamond pop
impact(8.25, .3);
bell(8.25, NOTE.D6, .09, .1, { dur: 4 });
pluck(8.25, NOTE.D5, .3, -.1, { dur: 5 });
pluck(8.27, NOTE.A4, .2, .25, { dur: 5 });

// mark glides into the lockup; titles write on
whoosh(9.8, 11.3, .12, 260, 1600, .5, -.5, { peak: .5 });
pluck(10.45, NOTE.A4, .16, .3, { bright: .4 });
pluck(10.75, NOTE.D5, .14, -.3, { bright: .4 });

// lockup complete: rolled chord
[NOTE.D3, NOTE.A3, NOTE.D4, NOTE.Fs4, NOTE.A4, NOTE.D5].forEach((m, i) =>
  pluck(12.25 + i * .045, m, .2 - i * .015, -.5 + i * .2, { dur: 6, bright: .42 }));

// sheen shimmer, sweeping left → right with the light
[NOTE.D6, NOTE.Fs6, NOTE.A6, NOTE.D7, NOTE.A6].forEach((m, i) =>
  bell(13.4 + i * .11, m, .026, -.7 + i * .35, { dur: 2.2 }));

// ripple
bell(16.0, NOTE.A5, .045, .2, { dur: 3.5 });
pluck(16.02, NOTE.D5, .09, -.2, { dur: 3.5, bright: .35 });

// ---------- reverb (Freeverb) ----------
function freeverb(inL, inR, { room = .86, damp = .35, spread = 23 } = {}) {
  const k = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apT = [556, 441, 341, 225];
  const mk = (sp) => ({
    combs: combT.map(c => ({ b: new Float32Array(Math.round((c + sp) * k)), i: 0, f: 0 })),
    aps: apT.map(a => ({ b: new Float32Array(Math.round((a + sp) * k)), i: 0 })),
  });
  const run = (inp, st) => {
    const o = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const x = inp[n] * .015;
      let s = 0;
      for (const c of st.combs) {
        const y = c.b[c.i];
        c.f = y * (1 - damp) + c.f * damp;
        c.b[c.i] = x + c.f * room;
        c.i = (c.i + 1) % c.b.length;
        s += y;
      }
      for (const a of st.aps) {
        const bo = a.b[a.i];
        a.b[a.i] = s + bo * .5;
        a.i = (a.i + 1) % a.b.length;
        s = bo - s;
      }
      o[n] = s;
    }
    return o;
  };
  return [run(inL, mk(0)), run(inR, mk(spread))];
}

// keep the low end out of the reverb (combs pile up energy below ~100 Hz otherwise)
for (const buf of [sendL, sendR]) { const hp = highpass(180); for (let n = 0; n < N; n++) buf[n] = hp(buf[n]); }
const [wetL, wetR] = freeverb(sendL, sendR);
for (const buf of [wetL, wetR]) { const hp = highpass(120); for (let n = 0; n < N; n++) buf[n] = hp(buf[n]); }
const L = new Float32Array(N), R = new Float32Array(N);
// high-pass the whole mix a little (removes rumble / DC) and add the reverb
const hpL = highpass(32), hpR = highpass(32);
for (let n = 0; n < N; n++) {
  L[n] = hpL(dryL[n] + wetL[n] * 1.6);
  R[n] = hpR(dryR[n] + wetR[n] * 1.6);
}

// master: fade in/out, normalise, gentle soft-clip
let peak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const g = clamp(t / .05) * clamp((DUR - t) / 1.1);
  L[n] *= g; R[n] *= g;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const gain = .93 / peak;
let sum = 0;
const pcm = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  const l = Math.tanh(L[n] * gain * 1.5) / Math.tanh(1.5), r = Math.tanh(R[n] * gain * 1.5) / Math.tanh(1.5);
  sum += l * l + r * r;
  pcm.writeInt16LE(Math.round(clamp(l, -1, 1) * 32767), n * 4);
  pcm.writeInt16LE(Math.round(clamp(r, -1, 1) * 32767), n * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
const file = path.resolve(process.argv[2] || 'out/soundtrack.wav');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, Buffer.concat([hdr, pcm]));
console.log(`${file}  rms ${(10 * Math.log10(sum / (2 * N))).toFixed(1)} dBFS`);

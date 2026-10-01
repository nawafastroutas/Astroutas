#!/usr/bin/env node
/*
 * Procedural soundtrack for the 20 s astronomy motion graphic.
 * No samples, no dependencies — every sound is synthesised here and placed on
 * the same timeline as index.html:
 *
 *   0.0          sub drone + airy shimmer: deep space
 *   1.25 / 3.55 / 5.85   a bell per word (نرصد · نكتشف · نحلم), rising D–F#–A
 *   6.05 → 7.25  soft noise sweep with the shooting star
 *   8.30 → 12.2  riser: the comet approaches and traces the logo (arpeggio + noise)
 *   12.2         impact + white-noise bloom — the light burst
 *   13.0         warm resolving chord (D add9) as the lockup lands
 *   14.0 → 16.2  sparkle arpeggio while the titles write on
 *   16.4         shimmer with the sheen; soft pad tail to the end
 *
 *   node synth.js out/soundtrack.wav
 */
const fs = require('fs');
const path = require('path');

const SR = 48000, DUR = 20, N = SR * DUR;
const dryL = new Float32Array(N), dryR = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);

let seed = 31337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const NOTE = { D1: 26, D2: 38, A2: 45, D3: 50, E3: 52, Fs3: 54, A3: 57, B3: 59,
               D4: 62, E4: 64, Fs4: 66, A4: 69, B4: 71, D5: 74, E5: 76, Fs5: 78,
               A5: 81, B5: 83, D6: 86, Fs6: 90, A6: 93, D7: 98 };

function out(n, v, pan, send) {
  if (n < 0 || n >= N) return;
  const a = (pan + 1) * Math.PI / 4;
  const l = v * Math.cos(a), r = v * Math.sin(a);
  dryL[n] += l; dryR[n] += r;
  sendL[n] += l * send; sendR[n] += r * send;
}

// 2nd-order Butterworth high-pass (RBJ biquad)
function highpass(fc) {
  const w = 2 * Math.PI * fc / SR, c = Math.cos(w), al = Math.sin(w) / Math.SQRT2, a0 = 1 + al;
  const b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, b2 = b0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

// ---------- instruments ----------

// deep, slowly beating sub — the "weight" of space
function drone(midi, t0, t1, amp, { att = 4, rel = 3 } = {}) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR), f = hz(midi);
  const partials = [[1, 1], [2, .28], [3, .12], [4, .05]];
  const det = [-4, 4];
  for (const cents of det) {
    const ff = f * Math.pow(2, cents / 1200);
    const ph = partials.map(() => rnd() * 6.283);
    for (let n = n0; n < n1 && n < N; n++) {
      const t = (n - n0) / SR, left = (n1 - n) / SR;
      const env = Math.pow(clamp(t / att), 1.6) * clamp(left / rel);
      let v = 0;
      partials.forEach(([h, a], i) => { v += a * Math.sin(ph[i] + 6.283185 * ff * h * t); });
      out(n, v * env * amp * (.9 + .1 * Math.sin(t * .7 + cents)), cents < 0 ? -.25 : .25, .18);
    }
  }
}

// wide additive pad
function pad(midis, t0, t1, amp, { att = 3, rel = 3, send = .7, bright = 2.4 } = {}) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR);
  for (const m of midis) {
    for (const [cents, pan] of [[-6, -.5], [6, .5]]) {
      const f = hz(m) * Math.pow(2, cents / 1200), H = 9;
      const hA = [], ph = [];
      for (let h = 1; h <= H; h++) { hA.push((1 / h) * Math.exp(-(h - 1) / bright)); ph.push(rnd() * 6.283); }
      for (let n = n0; n < n1 && n < N; n++) {
        const t = (n - n0) / SR, left = (n1 - n) / SR;
        const env = Math.pow(clamp(t / att), 2) * clamp(left / rel) * (.86 + .14 * Math.sin(t * .9 + m));
        let v = 0;
        for (let h = 0; h < H; h++) v += hA[h] * Math.sin(ph[h] + 6.283185 * f * (h + 1) * t);
        out(n, v * env * amp, pan, send);
      }
    }
  }
}

// struck bell / chime (inharmonic partials)
function bell(t0, midi, amp, pan, { dur = 4.5, send = .72 } = {}) {
  const f = hz(midi), n0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  const parts = [[1, 1, 1], [2.01, .5, .55], [2.76, .34, .42], [4.07, .2, .3], [5.43, .12, .22], [8.1, .06, .14]];
  const hp = highpass(Math.min(120, f * .6));
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    let v = 0;
    for (const [r, a, d] of parts) v += a * Math.exp(-t / (dur * d * .4)) * Math.sin(6.283185 * f * r * t);
    out(n0 + n, hp(v) * amp * clamp(t / .004) * clamp((len - n) / (SR * .5)), pan, send);
  }
}

// airy shimmer: sparse high bells drifting across the stereo field
function shimmer(t0, t1, amp, scale) {
  let t = t0;
  while (t < t1) {
    const m = scale[Math.floor(rnd() * scale.length)];
    bell(t, m, amp * (.5 + rnd() * .6), rnd() * 2 - 1, { dur: 2.4 + rnd() * 2, send: .85 });
    t += .18 + rnd() * .5;
  }
}

// band-passed noise with a swept centre; env peaks at `peak` (0..1 of its length)
function sweep(t0, t1, amp, f0, f1, pan0, pan1, { q = 1.1, peak = .55, send = .55 } = {}) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR), len = n1 - n0;
  let low = 0, band = 0;
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const fc = f0 * Math.pow(f1 / f0, x);
    const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    const w = rnd() * 2 - 1;
    low += F * band; const high = w - low - q * band; band += F * high;
    const env = x < peak ? Math.pow(x / peak, 2.2) : Math.pow((1 - x) / (1 - peak), 1.5);
    out(n0 + i, band * amp * env, pan0 + (pan1 - pan0) * x, send);
  }
}

// the comet: rising noise + a glissando pair that tightens as it traces
function riser(t0, t1, amp) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR), len = n1 - n0;
  let low = 0, band = 0;
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const fc = 260 * Math.pow(26, x);
    const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    const w = rnd() * 2 - 1;
    low += F * band; const high = w - low - 0.75 * band; band += F * high;
    out(n0 + i, band * amp * Math.pow(x, 2.1), Math.sin(x * 9) * .5, .5);
  }
  for (const [m, pan] of [[NOTE.D4, -.35], [NOTE.A4, .35]]) {
    let ph = 0;
    for (let n = n0; n < n1; n++) {
      const x = (n - n0) / len;
      ph += 6.283185 * hz(m + 14 * x * x) / SR;
      out(n, Math.sin(ph) * amp * .22 * Math.pow(x, 2.6) * clamp((n1 - n) / (SR * .03)), pan, .6);
    }
  }
}

// the light burst: sub drop + bright noise bloom
function impact(t0, amp) {
  const n0 = Math.round(t0 * SR), len = Math.round(3.2 * SR);
  let ph = 0, lp = 0, hpN = highpass(900);
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const f = 44 + 90 * Math.exp(-t / .09);
    ph += 6.283185 * f / SR;
    const body = Math.sin(ph) * Math.exp(-t / .6);
    lp += .05 * ((rnd() * 2 - 1) - lp);
    const thump = lp * 5 * Math.exp(-t / .07);
    const bloom = hpN(rnd() * 2 - 1) * Math.exp(-t / .42) * .5;     // white bloom with the flash
    out(n0 + n, (body + thump) * amp * clamp(t / .003) * clamp((len - n) / (SR * .6)), 0, .22);
    out(n0 + n, bloom * amp * .9, (rnd() - .5) * .6, .8);
  }
}

// soft plucked sparkle (Karplus–Strong), used for the title arpeggio
function pluck(t0, midi, amp, pan, { g = .994, bright = .4, dur = 3, send = .55 } = {}) {
  const f = hz(midi), n0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  const D = SR / f - .5, P = Math.round(SR / f), SIZE = 8192, y = new Float32Array(SIZE);
  let lp = 0; const hp = highpass(Math.min(140, f * .5));
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
    out(n0 + n, hp(v) * amp * clamp((len - n) / (SR * .5)), pan, send);
  }
}

// ---------- the score ----------
// deep space bed
drone(NOTE.D2, 0, 20, .07, { att: 3, rel: 2.6 });
drone(NOTE.D1, 0, 20, .03, { att: 4, rel: 2.6 });
pad([NOTE.D3, NOTE.A3, NOTE.E4], .3, 13.0, .016, { att: 4, rel: 2, bright: 2.0 });
shimmer(.6, 8.6, .013, [NOTE.D6, NOTE.E5, NOTE.Fs6, NOTE.A5, NOTE.A6, NOTE.D7]);

// one bell per word — D, F#, A rising
bell(1.25, NOTE.D5, .20, -.18, { dur: 5 });
bell(1.27, NOTE.D4, .10, .12, { dur: 5 });
bell(3.55, NOTE.Fs5, .20, .20, { dur: 5 });
bell(3.57, NOTE.Fs4, .10, -.14, { dur: 5 });
bell(5.85, NOTE.A5, .20, -.12, { dur: 5 });
bell(5.87, NOTE.A4, .10, .18, { dur: 5 });

// the shooting star
sweep(6.05, 7.3, .10, 900, 5200, -.75, .75, { peak: .5, q: .9 });

// the comet: approach, then it traces the logo
sweep(8.25, 9.5, .09, 300, 1500, .6, -.3, { peak: .62 });
riser(9.3, 12.22, .17);
// a quiet arpeggio under the tracing
[[9.6, NOTE.D5], [9.95, NOTE.E5], [10.3, NOTE.Fs5], [10.65, NOTE.A5],
 [11.0, NOTE.B5], [11.35, NOTE.A5], [11.7, NOTE.Fs5]].forEach(([t, m], i) =>
  bell(t, m, .035 + i * .004, (i % 2 ? .4 : -.4), { dur: 2.6 }));

// the light burst
impact(12.2, .55);
bell(12.24, NOTE.D6, .085, .1, { dur: 5 });

// the lockup lands: warm D add9
pad([NOTE.D3, NOTE.A3, NOTE.D4, NOTE.E4, NOTE.Fs4, NOTE.A4], 12.9, 20, .021, { att: .6, rel: 3.2, bright: 2.6 });
drone(NOTE.D2, 12.8, 20, .055, { att: .5, rel: 3 });
[[12.95, NOTE.D4, -.45], [13.05, NOTE.A4, -.15], [13.15, NOTE.D5, .15], [13.25, NOTE.Fs5, .45]]
  .forEach(([t, m, p]) => pluck(t, m, .14, p, { dur: 5, bright: .34 }));

// sparkles while the titles write on
[[14.05, NOTE.A5], [14.35, NOTE.D6], [14.7, NOTE.Fs5], [15.05, NOTE.A5],
 [15.4, NOTE.D6], [15.8, NOTE.E5], [16.15, NOTE.Fs6]].forEach(([t, m], i) =>
  bell(t, m, .03, i % 2 ? .45 : -.45, { dur: 3 }));

// the sheen
sweep(16.35, 17.8, .05, 2200, 7000, -.5, .5, { peak: .45, q: .8 });
shimmer(16.4, 19.0, .009, [NOTE.D6, NOTE.Fs6, NOTE.A6, NOTE.D7]);
bell(17.0, NOTE.D5, .05, 0, { dur: 4.5 });

// ---------- reverb (Freeverb), kept out of the low end ----------
function freeverb(inL, inR, { room = .89, damp = .3, spread = 23 } = {}) {
  const k = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apT = [556, 441, 341, 225];
  const mk = sp => ({
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

for (const buf of [sendL, sendR]) { const hp = highpass(200); for (let n = 0; n < N; n++) buf[n] = hp(buf[n]); }
const [wetL, wetR] = freeverb(sendL, sendR);
for (const buf of [wetL, wetR]) { const hp = highpass(130); for (let n = 0; n < N; n++) buf[n] = hp(buf[n]); }

const L = new Float32Array(N), R = new Float32Array(N);
const hpL = highpass(28), hpR = highpass(28);
for (let n = 0; n < N; n++) {
  L[n] = hpL(dryL[n] + wetL[n] * 1.7);
  R[n] = hpR(dryR[n] + wetR[n] * 1.7);
}

// master: fades, normalise, gentle soft-clip
let peak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const g = clamp(t / .06) * clamp((DUR - t) / 1.2);
  L[n] *= g; R[n] *= g;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const gain = .92 / peak;
let sum = 0;
const pcm = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  const l = Math.tanh(L[n] * gain * 1.4) / Math.tanh(1.4), r = Math.tanh(R[n] * gain * 1.4) / Math.tanh(1.4);
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

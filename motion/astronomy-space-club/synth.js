#!/usr/bin/env node
/*
 * Sound design for the 20 s astronomy motion graphic — effects only, no music:
 * no notes, no chords, no melody. Everything here is filtered noise, sub sweeps
 * and transients, placed on the same timeline as index.html:
 *
 *   0.0  → 12.6   space bed: slow low rumble + faint high "air", with distant twinkles
 *   1.25 / 3.55 / 5.85   a soft swish as each word appears
 *   1.45 → 3.0    tiny ticks as the constellation lines connect
 *   3.45 → 6.2    a very low pass-by as the ringed planet drifts across
 *   6.05 → 7.3    the shooting star: fast whoosh, left to right
 *   8.25 → 9.5    the comet approaches
 *   9.4  → 11.8   sizzle of the glowing tail tracing the logo, with sparkles
 *   11.7 → 12.2   pre-burst riser
 *   12.2          the light burst: sub drop + white-noise bloom
 *   13.0 → 16.2   the lockup: settle whoosh, two title swishes, rule zip, soft tick
 *   16.4 → 17.7   the sheen: a thin high shimmer
 *   17.7 → 20     the air fades out
 *
 *   node synth.js out/soundtrack.wav
 */
const fs = require('fs');
const path = require('path');

const SR = 48000, DUR = 20, N = SR * DUR;
const dryL = new Float32Array(N), dryR = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);

let seed = 90210;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

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
// one-pole low-pass
function lowpass(fc) {
  const a = 1 - Math.exp(-2 * Math.PI * fc / SR);
  let y = 0;
  return x => (y += a * (x - y));
}

// ---------- effect generators ----------

// state-variable band-pass noise with a swept centre frequency
function noiseSweep(t0, t1, amp, f0, f1, pan0, pan1, { q = 1.0, attack = .25, curve = 2, send = .5, shape = null } = {}) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR), len = n1 - n0;
  let low = 0, band = 0;
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const fc = f0 * Math.pow(f1 / f0, x);
    const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    const w = rnd() * 2 - 1;
    low += F * band; const high = w - low - q * band; band += F * high;
    const env = shape ? shape(x)
      : (x < attack ? Math.pow(x / attack, curve) : Math.pow((1 - x) / (1 - attack), 1.4));
    out(n0 + i, band * amp * env, pan0 + (pan1 - pan0) * x, send);
  }
}

// the deep space bed: slow low rumble plus a faint high hiss
function spaceBed(t0, t1, amp) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR), len = n1 - n0;
  const lpL = lowpass(90), lpR = lowpass(80);
  const hpL = highpass(5200), hpR = highpass(6000);
  const bandL = lowpass(380), bandR = lowpass(420);
  const hp2L = highpass(150), hp2R = highpass(170);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = clamp(t / 2.2) * clamp((len - i) / (SR * 1.6));
    const slow = .7 + .3 * Math.sin(t * .23) * Math.sin(t * .11 + 1.3);
    const nL = rnd() * 2 - 1, nR = rnd() * 2 - 1;
    const rumble = [lpL(nL) * 3.2, lpR(nR) * 3.2];
    const mid = [hp2L(bandL(nL)) * 1.4, hp2R(bandR(nR)) * 1.4];
    const air = [hpL(nL) * .5, hpR(nR) * .5];
    out(n0 + i, (rumble[0] + mid[0] * .3 + air[0] * .22) * amp * env * slow, -.5, .3);
    out(n0 + i, (rumble[1] + mid[1] * .3 + air[1] * .22) * amp * env * slow, .5, .3);
  }
}

// a short filtered click — used for stars twinkling and small UI accents
function tick(t0, amp, pan, fc, { dur = .055, send = .6 } = {}) {
  const n0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  let low = 0, band = 0;
  const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    low += F * band; const high = w - low - .35 * band; band += F * high;
    const env = Math.exp(-i / (SR * dur * .22));
    out(n0 + i, band * amp * env, pan, send);
  }
}

// the sizzle of the comet's tail while it draws the logo
function sizzle(t0, t1, amp) {
  const n0 = Math.round(t0 * SR), n1 = Math.round(t1 * SR), len = n1 - n0;
  let low = 0, band = 0;
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const fc = 2400 + 1600 * Math.sin(x * 7.5) + 900 * Math.sin(x * 23.1);
    const F = 2 * Math.sin(Math.PI * Math.min(Math.max(fc, 300), SR / 6) / SR);
    const w = rnd() * 2 - 1;
    low += F * band; const high = w - low - .8 * band; band += F * high;
    const flutter = .62 + .38 * Math.sin(x * 61) * Math.sin(x * 17);
    const env = Math.min(1, x / .08) * Math.min(1, (1 - x) / .12) * flutter;
    out(n0 + i, band * amp * env, Math.sin(x * 5.5) * .55, .55);
  }
}

// the light burst: a falling sub, a white bloom, and a low tail
function burst(t0, amp) {
  const n0 = Math.round(t0 * SR), len = Math.round(3.4 * SR);
  let ph = 0, lp = 0;
  const hpN = highpass(700), lpTail = lowpass(220);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 95 * Math.exp(-t / .22) + 34;                 // sub drop
    ph += 6.283185 * f / SR;
    const sub = Math.sin(ph) * Math.exp(-t / .55);
    lp += .07 * ((rnd() * 2 - 1) - lp);
    const thump = lp * 4.5 * Math.exp(-t / .055);
    const bloom = hpN(rnd() * 2 - 1) * Math.exp(-t / .40) * .55;
    const tail = lpTail(rnd() * 2 - 1) * Math.exp(-t / .7) * .6;
    const g = clamp(t / .002) * clamp((len - i) / (SR * .7));
    out(n0 + i, (sub + thump + tail) * amp * g, 0, .25);
    out(n0 + i, bloom * amp * .95 * g, (rnd() - .5) * .7, .85);
  }
}

// ---------- the cue sheet ----------

// space bed through the night half, then a quieter "air" once the screen turns white
spaceBed(0, 12.9, .17);
noiseSweep(12.9, 19.6, .05, 2600, 1500, -.4, .4, { q: .7, attack: .12, send: .5,
  shape: x => Math.min(1, x / .12) * Math.min(1, (1 - x) / .35) });

// distant twinkles — sparse, quiet, scattered
{
  let t = .9;
  while (t < 8.4) {
    tick(t, .03 + rnd() * .03, rnd() * 2 - 1, 4200 + rnd() * 4200, { dur: .07, send: .8 });
    t += .35 + rnd() * .9;
  }
}

// a swish as each word lands
for (const t of [1.25, 3.55, 5.85]) {
  noiseSweep(t - .12, t + .45, .10, 420, 2100, -.35, .35, { q: .9, attack: .18 });
  tick(t, .05, 0, 2600, { dur: .09 });
}

// the constellation connecting, line by line
for (let i = 0; i < 5; i++) tick(1.5 + i * .31, .035, -.45 + i * .22, 5200 + i * 500, { dur: .06 });

// the ringed planet drifting past — felt more than heard
noiseSweep(3.5, 6.3, .11, 52, 128, -.8, .45, { q: .6, attack: .4, send: .2 });

// the shooting star
noiseSweep(6.05, 7.3, .14, 900, 5600, -.85, .85, { q: .8, attack: .42 });
tick(6.6, .055, -.1, 7200, { dur: .12 });

// the comet approaches, then its tail sizzles along the logo
noiseSweep(8.25, 9.55, .12, 240, 1900, .7, -.2, { q: .85, attack: .62 });
sizzle(9.4, 11.85, .10);
{
  let t = 9.6;
  while (t < 11.7) { tick(t, .026 + rnd() * .022, rnd() * 2 - 1, 5000 + rnd() * 4000, { dur: .05 }); t += .11 + rnd() * .22; }
}

// riser into the light, then the burst itself
noiseSweep(11.55, 12.21, .17, 400, 9000, -.3, .3, { q: .7, attack: .96, curve: 2.4 });
burst(12.2, .30);

// the lockup assembling
noiseSweep(13.0, 13.75, .075, 1800, 420, .25, -.1, { q: .8, attack: .2, send: .4 });   // mark settles
noiseSweep(13.9, 14.45, .07, 700, 2300, .6, -.5, { q: .9, attack: .2 });              // Arabic wipes right→left
noiseSweep(14.2, 14.8, .062, 700, 2300, -.6, .5, { q: .9, attack: .2 });               // English wipes left→right
noiseSweep(14.9, 15.9, .055, 2600, 1700, .45, -.45, { q: .6, attack: .25, send: .45 });// the rule draws
tick(15.45, .05, .2, 3200, { dur: .09 });                                             // the college line
tick(15.55, .035, -.2, 2600, { dur: .08 });

// the sheen sweeping across the finished logo
noiseSweep(16.4, 17.75, .06, 3200, 9500, -.6, .6, { q: .7, attack: .4, send: .7 });

// ---------- reverb (Freeverb), kept out of the low end ----------
function freeverb(inL, inR, { room = .86, damp = .35, spread = 23 } = {}) {
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

for (const buf of [sendL, sendR]) { const hp = highpass(220); for (let n = 0; n < N; n++) buf[n] = hp(buf[n]); }
const [wetL, wetR] = freeverb(sendL, sendR);
for (const buf of [wetL, wetR]) { const hp = highpass(150); for (let n = 0; n < N; n++) buf[n] = hp(buf[n]); }

const L = new Float32Array(N), R = new Float32Array(N);
const hpL = highpass(26), hpR = highpass(26);
for (let n = 0; n < N; n++) {
  L[n] = hpL(dryL[n] + wetL[n] * 1.5);
  R[n] = hpR(dryR[n] + wetR[n] * 1.5);
}

// master: fades, normalise to leave headroom, gentle soft-clip
let peak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const g = clamp(t / .08) * clamp((DUR - t) / 1.4);
  L[n] *= g; R[n] *= g;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const gain = .9 / peak;
let sum = 0;
const pcm = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  const l = Math.tanh(L[n] * gain * 1.3) / Math.tanh(1.3), r = Math.tanh(R[n] * gain * 1.3) / Math.tanh(1.3);
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

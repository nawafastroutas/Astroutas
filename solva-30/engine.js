/* Solva 30-day series engine.
 * Every animation is one Web Animations API track spanning the whole video, so any frame
 * can be reproduced exactly with S.seek(t) — the renderer screenshots frame by frame.
 * Sound (music bed + effects) is synthesised with WebAudio from the same cue list. */
(function(){
const OUT = 'cubic-bezier(.16,1,.3,1)', INOUT = 'cubic-bezier(.65,0,.35,1)', IN = 'cubic-bezier(.7,0,.84,0)',
      BACK = 'cubic-bezier(.34,1.56,.64,1)', LIN = 'linear';
const $ = (s, r = document) => typeof s === 'string' ? r.querySelector(s) : s;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let D = 15, CFG = {}, CUES = [], HOOKS = [];

/* ---------- animation ---------- */
// K(el, [[sec, {css}, easingToNext], ...], {add}) — one track over the whole video
function K(el, frames, o = {}){
  const els = typeof el === 'string' ? $$(el) : (el instanceof Element ? [el] : [...el]);
  els.forEach(e => {
    const kf = frames.map(([t, p, ez]) => ({...p, offset: Math.max(0, Math.min(1, t / D)), easing: ez || OUT}));
    kf.sort((a, b) => a.offset - b.offset);
    if (kf[0].offset > 0) kf.unshift({...kf[0], offset: 0});
    if (kf[kf.length - 1].offset < 1) kf.push({...kf[kf.length - 1], offset: 1});
    e.animate(kf, {duration: D * 1000, fill: 'both', composite: o.add ? 'add' : 'replace'});
  });
}
// appear at a (from dy / scale), optionally leave at b
function inOut(el, a, b, o = {}){
  const dy = o.dy ?? 50, dx = o.dx ?? 0, s0 = o.s ?? 1, d = o.d ?? .6, blur = o.blur ?? 0;
  const from = {opacity: 0, transform: `translate(${dx}px,${dy}px) scale(${s0})`, filter: `blur(${blur}px)`};
  const on = {opacity: 1, transform: 'translate(0px,0px) scale(1)', filter: 'blur(0px)'};
  const fr = [[a, from, o.ez || OUT], [a + d, on]];
  if (b != null){
    const to = {opacity: 0, transform: `translate(${o.ox ?? 0}px,${o.oy ?? -dy / 2}px) scale(${o.os ?? 1})`, filter: `blur(${blur}px)`};
    fr.push([b, on, IN], [b + (o.od ?? .3), to]);
  }
  K(el, fr);
}
const pop = (el, a, b, o = {}) => inOut(el, a, b, {dy: 0, s: .3, ez: BACK, d: .5, os: .8, ...o});
const fade = (el, a, b, d = .4) => K(el, b == null ? [[a, {opacity: 0}], [a + d, {opacity: 1}]] :
  [[a, {opacity: 0}], [a + d, {opacity: 1}], [b, {opacity: 1}], [b + d, {opacity: 0}]]);
// wrap words of an element into spans (element children count as one word)
function words(el){
  el = $(el); const out = [];
  [...el.childNodes].forEach(n => {
    if (n.nodeType === 3){
      n.textContent.split(/(\s+)/).forEach(p => {
        if (!p) return;
        if (/^\s+$/.test(p)){ el.insertBefore(document.createTextNode(p), n); return; }
        const s = document.createElement('span'); s.className = 'w'; s.textContent = p; el.insertBefore(s, n); out.push(s);
      });
      n.remove();
    } else if (n.nodeName !== 'BR') { n.classList.add('w'); out.push(n); }
  });
  return out;
}
// word-by-word reveal
function say(el, a, b, o = {}){
  const ws = words(el), st = o.st ?? .09;
  ws.forEach((w, i) => inOut(w, a + i * st, b == null ? null : b + i * .02, {dy: o.dy ?? 40, blur: o.blur ?? 6, d: .5, ...o}));
  return a + ws.length * st + .5;
}
// count a number up (text), with optional formatter
function count(el, a, b, from, to, fmt = v => Math.round(v).toLocaleString('en-US')){
  el = $(el);
  HOOKS.push(t => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); const e = 1 - Math.pow(1 - x, 3); el.textContent = fmt(from + (to - from) * e); });
}
const hook = f => HOOKS.push(f);
// stroke draw for svg paths
function draw(el, a, b, ez = INOUT){
  (typeof el === 'string' ? $$(el) : [el].flat()).forEach(p => {
    const len = p.getTotalLength(); p.style.strokeDasharray = len + 1;
    K(p, [[a, {strokeDashoffset: len + 1}, ez], [b, {strokeDashoffset: 0}]]);
  });
}

/* ---------- graphics ---------- */
const MARK = (c = '#5FA88A', w = 13) => `<svg viewBox="0 0 96 144" fill="none" stroke="${c}" stroke-width="${w}"><path class="a1" d="M77.345 18.655A41.5 41.5 0 0 0 18.655 77.345"/><path class="a2" d="M77.345 66.655A41.5 41.5 0 0 1 18.655 125.345"/></svg>`;
const IC = {
  pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
  code: '<path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  msg: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11h18V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
  gift: '<path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.5 0-.4-.15-.74-.4-1-.25-.26-.4-.6-.4-1 0-.83.67-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.96-4.5-9-10-9z"/>',
  car: '<path d="M5 17h14v-5l-2-5H7l-2 5v5z"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/><path d="M5 12h14"/>',
  map: '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/>',
  thumbs: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>',
  ruler: '<path d="M21.3 8.7L8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="M7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>',
  cup: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>',
  tooth: '<path d="M12 5.5C10 3 6 3 5 6s1 6 1.5 9 1 6 2.5 6 1.5-4 3-4 1.5 4 3 4 2-3 2.5-6 2.5-6 1.5-9-5-3-7-.5z"/>',
  drop: '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/>',
  flask: '<path d="M9 2h6M10 2v6L4 20a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 8V2"/><path d="M7 15h10"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  fork: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  steth: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
  arrow: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  arrowUp: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  equal: '<path d="M5 9h14M5 15h14"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
};
const icon = (n, size = 64, color = 'currentColor', sw = 2) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;

// flat geometric character. parts carry classes for animation: .hd .arm-r .arm-l .face .m-smile .m-flat .m-sad .eyes
function person(o = {}){
  const skin = o.skin || '#C89B7B', shirt = o.shirt || '#5FA88A', pants = o.pants || '#2A3530', hair = o.hair || '#14201B';
  const robe = o.dish, cap = o.cap ?? robe, old = o.old;
  const body = robe
    ? `<path d="M62 120 Q100 108 138 120 L150 380 Q100 392 50 380 Z" fill="${o.robe || '#FBFAF6'}" stroke="#C9C7BD" stroke-width="3"/>
       <path d="M100 124 L100 190" stroke="#C9C7BD" stroke-width="3"/><path d="M100 150 q8 20 0 46" stroke="${o.tassel || '#C9C7BD'}" stroke-width="4" fill="none"/>`
    : `<rect x="60" y="118" width="80" height="150" rx="30" fill="${shirt}"/>
       <rect x="66" y="250" width="30" height="130" rx="14" fill="${pants}"/><rect x="104" y="250" width="30" height="130" rx="14" fill="${pants}"/>`;
  const hairP = cap ? `<path d="M62 62 Q62 28 100 28 Q138 28 138 62 Z" fill="${o.capc || '#FBFAF6'}" stroke="#C9C7BD" stroke-width="3"/><path d="M66 50h68" stroke="#3F7A62" stroke-width="3" stroke-dasharray="4 5"/>`
    : old ? `<path d="M64 62 Q60 40 72 36 M136 62 Q140 40 128 36" stroke="#DFDED6" stroke-width="10" fill="none" stroke-linecap="round"/>`
    : `<path d="M62 66 Q60 24 100 24 Q142 24 138 66 Q128 44 100 44 Q74 44 62 66Z" fill="${hair}"/>`;
  const arm = (cls, x, rot) => `<g class="${cls}" style="transform-origin:${x}px 132px;transform-box:view-box;transform:rotate(${rot}deg)"><rect x="${x - 11}" y="124" width="22" height="${robe ? 118 : 110}" rx="11" fill="${robe ? (o.robe || '#FBFAF6') : shirt}" stroke="${robe ? '#C9C7BD' : 'none'}" stroke-width="3"/><circle cx="${x}" cy="${robe ? 246 : 238}" r="12" fill="${skin}"/></g>`;
  return `<svg viewBox="0 0 200 400" width="${o.w || 200}" height="${(o.w || 200) * 2}" style="overflow:visible">
    ${arm('arm-l', 56, 8)}${arm('arm-r', 144, -8)}
    ${body}
    <g class="hd" style="transform-origin:100px 110px;transform-box:view-box">
      <circle cx="100" cy="72" r="40" fill="${skin}"/>${hairP}
      ${old ? '<circle cx="86" cy="76" r="11" fill="none" stroke="#14201B" stroke-width="3"/><circle cx="114" cy="76" r="11" fill="none" stroke="#14201B" stroke-width="3"/><path d="M97 76h6" stroke="#14201B" stroke-width="3"/>' : ''}
      <g class="eyes"><circle cx="86" cy="76" r="4.5" fill="#14201B"/><circle cx="114" cy="76" r="4.5" fill="#14201B"/></g>
      <path class="m-smile" d="M88 94 Q100 104 112 94" stroke="#14201B" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path class="m-flat" d="M90 97 H110" stroke="#14201B" stroke-width="4" fill="none" stroke-linecap="round" opacity="0"/>
      <path class="m-sad" d="M88 101 Q100 91 112 101" stroke="#14201B" stroke-width="4" fill="none" stroke-linecap="round" opacity="0"/>
      ${robe && !old ? '<path d="M78 100 Q100 124 122 100 Q118 116 100 118 Q82 116 78 100Z" fill="#14201B"/>' : ''}
      ${old ? '<path d="M80 104 Q100 124 120 104" stroke="#DFDED6" stroke-width="6" fill="none" stroke-linecap="round"/>' : ''}
    </g></svg>`;
}
// swap mouth expression at time t (names: smile|flat|sad)
function mood(root, t, m){
  root = $(root);
  ['smile', 'flat', 'sad'].forEach(k => HOOK_OP(root.querySelector('.m-' + k), t, k === m));
}
const OPS = new Map();
function HOOK_OP(el, t, on){ if (!OPS.has(el)) OPS.set(el, []); OPS.get(el).push([t, on]); }

/* ---------- audio ---------- */
const cue = (t, name, o = {}) => CUES.push({t, name, ...o});
function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function noiseBuf(ctx, sec = 2, seed = 7){
  const r = rng(seed), b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; return b;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, peak, dec, sus = 0.0001){
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, .0001), t + a + dec);
}
function tone(ctx, out, t, f, dur, o = {}){
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
  if (o.det) osc.detune.value = o.det;
  env(g, t, o.a ?? .005, o.v ?? .3, dur);
  let n = osc.connect(g);
  if (o.lp){ const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; n = n.connect(f2); }
  if (o.pan != null && ctx.createStereoPanner){ const p = ctx.createStereoPanner(); p.pan.value = o.pan; n = n.connect(p); }
  n.connect(out); osc.start(t); osc.stop(t + (o.a ?? .005) + dur + .05);
}
function noise(ctx, out, t, dur, o = {}){
  const s = ctx.createBufferSource(); s.buffer = ctx._nb; const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q ?? 1;
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  if (o.env === 'swell'){ g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.v ?? .3, t + dur * (o.peak ?? .6)); g.gain.exponentialRampToValueAtTime(.0001, t + dur); }
  else env(g, t, o.a ?? .003, o.v ?? .3, dur);
  let n = s.connect(f).connect(g);
  if (o.pan != null){ const p = ctx.createStereoPanner(); p.pan.setValueAtTime(o.pan, t); if (o.pan2 != null) p.pan.linearRampToValueAtTime(o.pan2, t + dur); n = n.connect(p); }
  n.connect(out); s.start(t, (o.off || 0) % 1); s.stop(t + dur + .05);
}
const SFX = {
  whoosh: (c, o, t, p) => noise(c, o, t, p.d || .55, {f: 400, f2: 3200, q: 1.2, env: 'swell', v: .5 * (p.v || 1), pan: -.6, pan2: .6}),
  swish: (c, o, t, p) => noise(c, o, t, p.d || .28, {f: 1800, f2: 5000, q: 1.5, env: 'swell', v: .35 * (p.v || 1), peak: .4}),
  swoop: (c, o, t, p) => noise(c, o, t, p.d || .6, {f: 3500, f2: 300, q: 1.2, env: 'swell', v: .4 * (p.v || 1), pan: .6, pan2: -.6}),
  pop: (c, o, t, p) => tone(c, o, t, p.f || 620, .12, {to: (p.f || 620) * .45, glide: .08, v: .45 * (p.v || 1)}),
  pop2: (c, o, t, p) => { tone(c, o, t, (p.f || 520), .1, {to: (p.f || 520) * 1.6, glide: .06, v: .35 * (p.v || 1)}); },
  click: (c, o, t, p) => { noise(c, o, t, .03, {ft: 'highpass', f: 3000, v: .35 * (p.v || 1)}); tone(c, o, t, 1800, .03, {v: .15 * (p.v || 1)}); },
  tick: (c, o, t, p) => { noise(c, o, t, .02, {ft: 'highpass', f: 5000, v: .22 * (p.v || 1)}); tone(c, o, t, p.f || 2400, .02, {v: .1 * (p.v || 1)}); },
  type: (c, o, t, p) => { const r = rng(Math.floor(t * 1000)); for (let i = 0; i < (p.n || 10); i++) { const tt = t + i * (p.gap || .075) + r() * .02; noise(c, o, tt, .025, {ft: 'highpass', f: 2500 + r() * 2000, v: .18 + r() * .1, off: r()}); } },
  ding: (c, o, t, p) => { const f = p.f || 1320; tone(c, o, t, f, 1.2, {v: .28 * (p.v || 1)}); tone(c, o, t, f * 2.01, .6, {v: .08 * (p.v || 1)}); },
  chime: (c, o, t, p) => [0, 4, 7, 12].forEach((s, i) => { const f = mtof((p.m || 76) + s); tone(c, o, t + i * .08, f, .9, {v: .18 * (p.v || 1)}); tone(c, o, t + i * .08, f * 2, .4, {v: .05}); }),
  success: (c, o, t, p) => [0, 7, 12].forEach((s, i) => tone(c, o, t + i * .1, mtof(72 + s), .7, {v: .22 * (p.v || 1), type: 'triangle'})),
  error: (c, o, t, p) => { tone(c, o, t, 180, .12, {type: 'square', v: .12 * (p.v || 1), lp: 1200}); tone(c, o, t + .16, 150, .18, {type: 'square', v: .12 * (p.v || 1), lp: 1200}); },
  buzz: (c, o, t, p) => tone(c, o, t, 110, p.d || .35, {type: 'sawtooth', v: .1 * (p.v || 1), lp: 900}),
  riser: (c, o, t, p) => { const d = p.d || 1.2; noise(c, o, t, d, {ft: 'highpass', f: 400, f2: 6000, env: 'swell', peak: .95, v: .25 * (p.v || 1)}); tone(c, o, t, 200, d, {to: 900, glide: d, v: .06 * (p.v || 1), type: 'sawtooth', lp: 2000, a: d * .8}); },
  impact: (c, o, t, p) => { tone(c, o, t, 110, .7, {to: 38, glide: .5, v: .8 * (p.v || 1)}); noise(c, o, t, .35, {ft: 'lowpass', f: 900, v: .4 * (p.v || 1)}); },
  thud: (c, o, t, p) => tone(c, o, t, 160, .25, {to: 60, glide: .15, v: .6 * (p.v || 1)}),
  glitch: (c, o, t, p) => { const r = rng(Math.floor(t * 999)); for (let i = 0; i < 6; i++) tone(c, o, t + i * .035, 200 + r() * 1400, .03, {type: 'square', v: .08 * (p.v || 1), lp: 3000}); },
  flip: (c, o, t, p) => { noise(c, o, t, .07, {f: 2600, q: 2, v: .35 * (p.v || 1)}); noise(c, o, t + .09, .05, {f: 1800, q: 2, v: .25 * (p.v || 1)}); },
  bubble: (c, o, t, p) => tone(c, o, t, p.f || 420, .12, {to: (p.f || 420) * 2.2, glide: .07, v: .35 * (p.v || 1)}),
  send: (c, o, t, p) => { tone(c, o, t, 700, .09, {to: 1400, glide: .08, v: .25 * (p.v || 1)}); noise(c, o, t, .2, {f: 3000, f2: 6000, env: 'swell', v: .12}); },
  cash: (c, o, t, p) => { tone(c, o, t, 2093, .5, {v: .2 * (p.v || 1)}); tone(c, o, t + .08, 2637, .7, {v: .2 * (p.v || 1)}); noise(c, o, t, .3, {ft: 'highpass', f: 6000, v: .1}); },
  rocket: (c, o, t, p) => { const d = p.d || 1.8; noise(c, o, t, d, {ft: 'lowpass', f: 200, f2: 1400, env: 'swell', peak: .5, v: .7 * (p.v || 1)}); tone(c, o, t, 60, d, {to: 140, glide: d, v: .25, type: 'sawtooth', lp: 400}); },
  engine: (c, o, t, p) => { const d = p.d || 1.5; tone(c, o, t, p.f || 55, d, {to: (p.f || 55) * (p.up || 2.2), glide: d, type: 'sawtooth', v: .14 * (p.v || 1), lp: 700, a: .1}); },
  beep: (c, o, t, p) => tone(c, o, t, p.f || 880, .12, {v: .22 * (p.v || 1), type: 'triangle'}),
  grow: (c, o, t, p) => { const d = p.d || 1.5; tone(c, o, t, 70, d, {to: 45, glide: d, v: .35 * (p.v || 1), a: d * .7}); noise(c, o, t, d, {ft: 'lowpass', f: 300, f2: 1200, env: 'swell', peak: .9, v: .3 * (p.v || 1)}); },
  slide: (c, o, t, p) => noise(c, o, t, p.d || .18, {f: 900, f2: 1600, q: 3, env: 'swell', v: .25 * (p.v || 1)}),
  zip: (c, o, t, p) => tone(c, o, t, 300, .15, {to: 1800, glide: .14, v: .18 * (p.v || 1), type: 'triangle'}),
  zipdown: (c, o, t, p) => tone(c, o, t, 1600, .18, {to: 260, glide: .16, v: .18 * (p.v || 1), type: 'triangle'}),
  snap: (c, o, t, p) => noise(c, o, t, .05, {f: 1600, q: 1, v: .5 * (p.v || 1)}),
  stamp: (c, o, t, p) => { tone(c, o, t, 140, .2, {to: 70, glide: .1, v: .6 * (p.v || 1)}); noise(c, o, t, .08, {f: 1200, v: .4}); },
  clockTick: (c, o, t, p) => { for (let i = 0; i < (p.n || 4); i++) SFX.tick(c, o, t + i * (p.gap || .5), {f: i % 2 ? 2000 : 2600, v: p.v}); },
  yawn: (c, o, t, p) => tone(c, o, t, 330, .9, {to: 170, glide: .9, type: 'triangle', v: .12 * (p.v || 1), a: .15, lp: 900}),
  boing: (c, o, t, p) => tone(c, o, t, 220, .45, {to: 660, glide: .12, type: 'triangle', v: .22 * (p.v || 1)}),
  wrong: (c, o, t, p) => { tone(c, o, t, 311, .25, {type: 'triangle', v: .2}); tone(c, o, t + .2, 233, .45, {type: 'triangle', v: .2}); },
  right: (c, o, t, p) => { tone(c, o, t, 784, .2, {type: 'triangle', v: .2}); tone(c, o, t + .12, 1175, .5, {type: 'triangle', v: .2}); },
  scribble: (c, o, t, p) => { const r = rng(Math.floor(t * 777)); for (let i = 0; i < (p.n || 8); i++) noise(c, o, t + i * .07 + r() * .02, .06, {f: 2500 + r() * 2500, q: 4, v: .12, off: r()}); },
  horn: (c, o, t, p) => { tone(c, o, t, 392, .3, {type: 'sawtooth', v: .08, lp: 1500}); tone(c, o, t, 494, .3, {type: 'sawtooth', v: .08, lp: 1500}); },
  crowd: (c, o, t, p) => noise(c, o, t, p.d || 1.2, {f: 900, q: .6, env: 'swell', v: .25 * (p.v || 1)}),
};

// procedural music bed per mood
const MOODS = {
  calm:    {bpm: 92,  root: 57, prog: [[-3,0,4],[-7,-3,0],[0,4,7],[-5,-1,2]], drums: 0, bass: 1, pluck: 1, pad: 1},
  drive:   {bpm: 112, root: 55, prog: [[-3,0,4],[-7,-3,0],[0,4,7],[-5,-1,2]], drums: 2, bass: 1, pluck: 1, pad: 1},
  playful: {bpm: 118, root: 60, prog: [[0,4,7],[-3,0,4],[-7,-3,0],[-5,-1,2]], drums: 3, bass: 1, pluck: 2, pad: 0},
  tense:   {bpm: 90,  root: 50, prog: [[0,3,7],[0,3,7],[-4,0,3],[-2,2,5]], drums: 1, bass: 2, pluck: 0, pad: 1},
  warm:    {bpm: 100, root: 58, prog: [[0,4,7],[-5,-1,2],[-3,0,4],[-7,-3,0]], drums: 1, bass: 1, pluck: 1, pad: 1},
};
function music(ctx, out, dur, name, seed){
  const M = {...MOODS[name || 'calm'], ...(CFG.music || {})}, beat = 60 / M.bpm, bar = beat * 4, r = rng(seed || 3);
  const nBars = Math.ceil(dur / bar) + 1;
  for (let b = 0; b < nBars; b++){
    const ch = M.prog[b % M.prog.length], t0 = b * bar;
    if (M.pad) ch.forEach(s => [-6, 6].forEach(d => tone(ctx, out, t0, mtof(M.root + s), bar * .95, {type: 'sawtooth', det: d, v: .025, a: .5, lp: 900})));
    if (M.bass) for (let i = 0; i < (M.bass === 2 ? 8 : 2); i++){
      const tt = t0 + i * (M.bass === 2 ? beat / 2 : beat * 2);
      tone(ctx, out, tt, mtof(M.root - 12 + ch[0]), M.bass === 2 ? beat * .4 : beat * 1.6, {type: 'triangle', v: M.bass === 2 ? .12 : .16, lp: 500});
    }
    if (M.pluck) for (let i = 0; i < 8; i++){
      if (M.pluck === 1 && r() < .25) continue;
      const s = ch[[0, 1, 2, 1, 2, 0, 1, 2][i]] + (i >= 4 && r() < .5 ? 12 : 0) + 12;
      tone(ctx, out, t0 + i * beat / 2, mtof(M.root + s), M.pluck === 2 ? .18 : .45, {type: M.pluck === 2 ? 'sine' : 'triangle', v: M.pluck === 2 ? .09 : .06, pan: (i % 2 ? .3 : -.3)});
    }
    if (M.drums) for (let i = 0; i < 4; i++){
      const tt = t0 + i * beat;
      if (M.drums >= 2 || i % 2 === 0) tone(ctx, out, tt, 140, .28, {to: 42, glide: .12, v: M.drums === 1 ? .22 : .38});
      noise(ctx, out, tt + beat / 2, .035, {ft: 'highpass', f: 7500, v: .06});
      if (M.drums === 3 && i % 2) noise(ctx, out, tt, .12, {f: 1500, q: .8, v: .18});
      if (M.drums === 2 && i % 2) noise(ctx, out, tt, .09, {f: 2200, q: .7, v: .09});
    }
  }
}
async function renderAudio(){
  const sr = 48000, len = Math.ceil((D + .3) * sr), ctx = new OfflineAudioContext(2, len, sr);
  ctx._nb = noiseBuf(ctx, 2, 11);
  // mix bus: gain -> glue compressor -> makeup -> brick-wall-ish limiter
  const master = ctx.createGain(); master.gain.value = 1.4;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.knee.value = 6; comp.attack.value = .005; comp.release.value = .25;
  const makeup = ctx.createGain(); makeup.gain.value = 1.7;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .1;
  const trim = ctx.createGain(); trim.gain.value = .85;
  master.connect(comp).connect(makeup).connect(lim).connect(trim).connect(ctx.destination);
  const mus = ctx.createGain(); mus.connect(master);
  const mv = CFG.musicVol ?? 1;
  mus.gain.setValueAtTime(.0001, 0); mus.gain.exponentialRampToValueAtTime(mv, .6);
  mus.gain.setValueAtTime(mv, Math.max(.7, D - 1.6)); mus.gain.exponentialRampToValueAtTime(.0001, D + .2);
  music(ctx, mus, D, CFG.mood, CFG.day * 17 + 5);
  const fx = ctx.createGain(); fx.gain.value = 1; fx.connect(master);
  CUES.forEach(c => SFX[c.name] && SFX[c.name](ctx, fx, Math.max(0, c.t), c));
  return ctx.startRendering();
}

/* ---------- series chrome ---------- */
function header(){
  const h = document.createElement('div'); h.id = 'hdr'; h.className = 'abs';
  h.innerHTML = `${MARK(CFG.bg === 'paper' ? '#3F7A62' : '#5FA88A', 15)}<span>SOLVA · DAY ${String(CFG.day).padStart(2, '0')}/30</span>`;
  $('#stage').appendChild(h);
  K(h, [[.1, {opacity: 0}], [.6, {opacity: 1}], [CFG.outro - .2, {opacity: 1}], [CFG.outro, {opacity: 0}]]);
}
function outro(){
  const t = CFG.outro, o = CFG.end || {};
  const el = document.createElement('div'); el.id = 'outro'; el.className = 'abs on-ink';
  el.innerHTML = `<div class="lock"><div class="wm">${'Solva'.split('').map(c => `<span>${c}</span>`).join('')}</div><div class="mk">${MARK()}</div></div>
    <div class="ln">${o.line || 'نبني ما <b>يعمل</b>، لا ما يُعجب فقط.'}</div>
    <div class="btn cta">${o.cta || 'ابدأ مشروعك'}</div>
    <div class="nx lab">${o.next || (CFG.day < 30 ? 'DAY ' + String(CFG.day + 1).padStart(2, '0') + ' · tomorrow' : 'thank you')}</div>`;
  $('#stage').appendChild(el);
  K(el, [[t, {clipPath: 'circle(0px at 540px 960px)'}, INOUT], [t + .7, {clipPath: 'circle(1200px at 540px 960px)'}]]);
  $$('.mk path', el).forEach((p, i) => draw(p, t + .35 + i * .3, t + .8 + i * .3));
  $$('.wm span', el).forEach((s, i) => inOut(s, t + .5 + i * .05, null, {dy: 60}));
  inOut($('.ln', el), t + .95, null, {dy: 30});
  K($('.cta', el), [[t + 1.2, {opacity: 0, transform: 'translateX(-50%) translateY(30px)'}], [t + 1.7, {opacity: 1, transform: 'translateX(-50%) translateY(0)'}]]);
  fade($('.nx', el), t + 1.6);
  cue(t, 'swoop', {v: .8}); cue(t + .45, 'zip', {v: .6}); cue(t + 1.3, 'pop', {f: 700, v: .6});
}

/* ---------- lifecycle ---------- */
function setup(c){
  CFG = {bg: 'ink', mood: 'calm', ...c};
  CFG.outro = c.outro ?? c.dur - 2.9; D = c.dur;
  const st = $('#stage'); if (CFG.bg === 'paper') st.classList.add('paper'); else st.classList.add('on-ink');
}
function start(){
  header(); outro();
  // expression switches -> opacity tracks
  OPS.forEach((list, el) => { list.sort((a, b) => a[0] - b[0]); const init = el.getAttribute('opacity') === '0' ? 0 : 1;
    const fr = [[0, {opacity: init}, 'steps(1,end)']]; list.forEach(([t, on]) => fr.push([t, {opacity: on ? 1 : 0}, 'steps(1,end)'])); K(el, fr); });
  const stage = $('#stage');
  const fit = () => { const s = Math.min(innerWidth / 1080, innerHeight / 1920); stage.style.transform = `translate(-50%,-50%) scale(${s})`; };
  addEventListener('resize', fit); fit();
  if (location.search.includes('render')) { seek(0); return; }
  // preview: silent loop until clicked, then play with sound
  let t0 = performance.now(), ac = null, src = null;
  const loop = now => { const t = (now - t0) / 1000; if (t > D + .8){ t0 = now; if (ac) playAudio(); } seek(Math.min(t, D)); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const btn = document.createElement('div'); btn.id = 'play'; btn.innerHTML = '<b>▶ تشغيل مع الصوت</b>'; document.body.appendChild(btn);
  let buf = null;
  async function playAudio(){ if (src) try { src.stop(); } catch(e){} src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start(); t0 = performance.now(); }
  btn.onclick = async () => { btn.remove(); ac = new AudioContext(); buf = await renderAudio(); playAudio(); };
}
function seek(t){
  document.getAnimations().forEach(a => { a.pause(); a.currentTime = Math.min(t, D) * 1000 - (t >= D ? .001 : 0); });
  HOOKS.forEach(f => f(t));
}
// used by the renderer: synthesise, then record in real time to Opus/WebM, returned as base64
async function audioWebm(){
  const buf = await renderAudio(), ac = new AudioContext({sampleRate: 48000}); await ac.resume();
  const src = ac.createBufferSource(); src.buffer = buf; const dest = ac.createMediaStreamDestination(); src.connect(dest);
  const rec = new MediaRecorder(dest.stream, {mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000}); const chunks = [];
  rec.ondataavailable = e => chunks.push(e.data); const done = new Promise(r => rec.onstop = r);
  rec.start(); src.start();
  await new Promise(r => src.onended = r); await new Promise(r => setTimeout(r, 150)); rec.stop(); await done;
  const u = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}

window.S = {K, inOut, pop, fade, say, words, count, hook, draw, cue, setup, start, seek, audioWebm, renderAudio,
  icon, person, mood, MARK, $, $$, get D(){ return D; }, E: {OUT, INOUT, IN, BACK, LIN}};
})();

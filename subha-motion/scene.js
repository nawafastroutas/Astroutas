/* ===========================================================================
   سبحة · SUBHA — بناء العناصر المتكررة فقط (خرز، خيوط، تعليقات، ومضات).
   لا حركة هنا إطلاقًا: كل الحركة في scene.css. هذا الملف يبني الـ DOM مرة
   واحدة ثم يصمت — وهو ما يسمح لـ render.mjs أن يلتقط أي لحظة بدقة تامة.
   =========================================================================== */
(function () {
  'use strict';

  var BEADS = ['#7A6A5C', '#6C5B4E', '#5E4B3F', '#B9955C', '#463529', '#433227', '#463529'];

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function v(n, k, val) { n.style.setProperty(k, val); return n; }

  /* مروحة خيوط الكركوش: الخيط الأوسط أطول، والتأخير يتدرّج من المنتصف للطرفين */
  function fan(host, count, spreadDeg, maxLen) {
    for (var k = 0; k < count; k++) {
      var p = count === 1 ? 0 : (k / (count - 1)) * 2 - 1;
      var t = el('i');
      v(t, '--r', (p * spreadDeg).toFixed(2) + 'deg');
      v(t, '--h', Math.round(maxLen * (1 - 0.42 * p * p)) + 'px');
      v(t, '--j', String(Math.round(Math.abs(p) * (count - 1) / 2)));
      host.appendChild(t);
    }
  }

  /* ---------- خرزات الافتتاحية: تتساقط من اليمين لليسار (اتجاه القراءة) ---------- */
  var dots = document.getElementById('introDots');
  BEADS.forEach(function (c, i) {
    var b = el('span', 'dot');
    v(b, '--c', c);
    v(b, '--i', String(BEADS.length - 1 - i));
    dots.appendChild(b);
  });

  /* ---------- شريط التقدّم السفلي: خرزة لكل مشهد ---------- */
  var rail = document.getElementById('rail');
  [[0, 5], [5, 3.3], [9.7, 3.6], [13.3, 3.6], [16.9, 3.6], [20.5, 3.6], [24.1, 3.5]]
    .forEach(function (w, i) {
      var b = el('i');
      v(b, '--i', String(i));
      v(b, '--rt', w[0] + 's');
      v(b, '--rd', w[1] + 's');
      rail.appendChild(b);
    });

  /* ---------- ٠١ السُّبَح: حلقة مفتوحة من الأعلى + شاهد + كركوش داخلي ---------- */
  var loop = document.getElementById('misbaha');
  var N = 31, SPAN = 318;
  for (var i = 0; i < N; i++) {
    var b = el('b');
    v(b, '--a', (-SPAN / 2 + (SPAN / (N - 1)) * i).toFixed(2) + 'deg');
    v(b, '--c', '#4A382B');
    v(b, '--i', String(Math.round(Math.abs(i - (N - 1) / 2))));
    if (i === 0 || i === N - 1 || i === 10 || i === 20) b.className = 'div';
    loop.appendChild(b);
  }
  var mt = document.getElementById('misbahaTassel');
  v(mt, '--c', '#4A382B');
  fan(mt, 11, 24, 196);

  /* ---------- ٠٢ الكركوشات ---------- */
  var tWrap = document.getElementById('tassels');
  ['#463529', '#B9955C', '#7C6B5D'].forEach(function (color, i) {
    var d = el('div', 'tassel');
    v(d, '--c', color);
    v(d, '--i', String(i));
    d.appendChild(el('span', 'ring'));
    d.appendChild(el('span', 'knot'));
    d.appendChild(el('span', 'cap'));
    var f = el('span', 'fan');
    fan(f, 19, 26, 240);
    d.appendChild(f);
    tWrap.appendChild(d);
  });

  /* ---------- ٠٣ التعليقات: ثلاث قطع بأطوال سلاسل مختلفة ---------- */
  var cWrap = document.getElementById('charms');
  var CHARMS = [
    ['sh-moon', '#7C6B5D', 150],
    ['sh-diamond', '#B9955C', 208],
    ['sh-drop', '#463529', 122]
  ];
  CHARMS.forEach(function (c, i) {
    var d = el('div', 'charm');
    v(d, '--c', c[1]);
    v(d, '--len', c[2] + 'px');
    v(d, '--i', String(i));
    d.appendChild(el('span', 'chain'));
    d.appendChild(el('span', 'cbead'));
    d.appendChild(el('span', 'shape ' + c[0]));
    cWrap.appendChild(d);
  });

  /* ---------- ٠٤ المحفظات: خرزات تطلّ من فوق حافة المحفظة ---------- */
  var peek = document.getElementById('casePeek');
  ['#5E4B3F', '#B9955C', '#463529', '#6C5B4E', '#433227'].forEach(function (c, i) {
    var b = el('i');
    v(b, '--c', c);
    v(b, '--i', String(i));
    peek.appendChild(b);
  });

  /* ---------- الإهداء: ومضات ماسيّة حول العلبة ---------- */
  var sparks = document.getElementById('sparks');
  [[-200, -108, 18], [188, -74, 14], [-150, 96, 12], [206, 74, 20], [-64, -164, 11],
   [112, -150, 15], [-212, -18, 13]].forEach(function (s, i) {
    var d = el('i');
    v(d, '--x', s[0] + 'px');
    v(d, '--y', s[1] + 'px');
    v(d, '--s', s[2] + 'px');
    v(d, '--i', String(i));
    sparks.appendChild(d);
  });

  /* ---------- رسم خطوط SVG: pathLength=1 يجعل stroke-dashoffset موحّدًا ---------- */
  document.querySelectorAll('.casesvg rect, .casesvg path, .casesvg circle, .giftsvg rect, .giftsvg path')
    .forEach(function (n) { n.setAttribute('pathLength', '1'); });

  /* ---------- معاينة: index.html?fit يصغّر المسرح ليناسب نافذة المتصفح ---------- */
  if (location.search.indexOf('fit') > -1) {
    var fit = function () {
      var s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
      document.getElementById('stage').style.setProperty('--fit', s);
    };
    fit();
    window.addEventListener('resize', fit);
  }
})();

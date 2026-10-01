/* بناء العناصر المتكررة في مقطع الإهداء — لا حركة هنا، كلها في CSS. */
(function () {
  'use strict';
  var v = function (n, k, val) { n.style.setProperty(k, val); return n; };

  /* شريط التقدّم: خرزة لكل مشهد من المشاهد الأربعة */
  var rail = document.getElementById('rail');
  [[0, 3.4], [3.4, 3.2], [6.6, 3.6], [10.2, 3.6]].forEach(function (w, i) {
    var b = document.createElement('i');
    v(b, '--i', String(i));
    v(b, '--rt', w[0] + 's');
    v(b, '--rd', w[1] + 's');
    rail.appendChild(b);
  });

  /* ومضات ماسيّة: حول العنوان في الافتتاح، وحول العلبة في مشهد التغليف */
  var SETS = {
    openSparks: [[-250, -210, 20], [238, -176, 15], [-206, 150, 13], [262, 120, 22],
                 [-96, -268, 12], [150, -250, 16], [-282, -34, 14]],
    giftSparks: [[-200, -108, 18], [188, -74, 14], [-150, 96, 12], [206, 74, 20],
                 [-64, -164, 11], [112, -150, 15], [-212, -18, 13]]
  };
  Object.keys(SETS).forEach(function (id) {
    var host = document.getElementById(id);
    if (!host) return;
    SETS[id].forEach(function (s, i) {
      var d = document.createElement('i');
      v(d, '--x', s[0] + 'px');
      v(d, '--y', s[1] + 'px');
      v(d, '--s', s[2] + 'px');
      v(d, '--i', String(i));
      host.appendChild(d);
    });
  });

  /* pathLength=1 يوحّد stroke-dashoffset لكل الأشكال مهما اختلف طولها */
  document.querySelectorAll('.giftsvg rect, .giftsvg path, .shipsvg path')
    .forEach(function (n) { n.setAttribute('pathLength', '1'); });

  if (location.search.indexOf('fit') > -1) {
    var fit = function () {
      document.getElementById('stage').style.setProperty(
        '--fit', Math.min(window.innerWidth / 1080, window.innerHeight / 1920));
    };
    fit();
    window.addEventListener('resize', fit);
  }
})();

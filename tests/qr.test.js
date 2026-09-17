/** فحوص مولّد رمز QR مقابل جداول المواصفة ISO/IEC 18004 + فكّ ترميز عكسي. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encode, toSvg, byteCapacity, reedSolomon, formatBits, versionBits, rawDataModules,
} from '../src/lib/qr.js';

test('سعة نمط البايت تطابق جداول المواصفة المنشورة', () => {
  const published = {
    L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520],
    M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412],
    Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292],
    H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220],
  };
  for (const ecl of Object.keys(published)) {
    for (let v = 1; v <= 15; v += 1) {
      assert.equal(byteCapacity(v, ecl), published[ecl][v - 1], `الإصدار ${v} مستوى ${ecl}`);
    }
  }
});

test('Reed–Solomon يطابق متّجه الاختبار في المواصفة', () => {
  const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  const expected = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];
  assert.deepEqual(Array.from(reedSolomon(data, 10)), expected);
});

test('معلومات النسق والإصدار تطابق الجداول', () => {
  const fmt = {
    L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
    M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
    Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
    H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
  };
  for (const ecl of Object.keys(fmt)) {
    for (let mask = 0; mask < 8; mask += 1) assert.equal(formatBits(ecl, mask), fmt[ecl][mask]);
  }
  const versions = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3, 15: 0x0f928 };
  for (const [v, bits] of Object.entries(versions)) assert.equal(versionBits(Number(v)), bits);
});

/* ------- فكّ ترميز مستقل: يقرأ المصفوفة كما يقرؤها الماسح ------- */
const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const ECC_PER_BLOCK = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24],
};
const NUM_BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18],
};
const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function functionMap(size, version) {
  const f = Array.from({ length: size }, () => new Uint8Array(size));
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) f[y][x] = 1; };
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) mark(cx + dx, cy + dy);
  }
  for (let i = 0; i < size; i += 1) { mark(6, i); mark(i, 6); }
  if (version >= 2) {
    const n = Math.floor(version / 7) + 2;
    const step = Math.ceil((size - 13) / (n * 2 - 2)) * 2;
    const pos = [6];
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = 0; j < pos.length; j += 1) {
        const corner = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0);
        if (corner) continue;
        for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) mark(pos[j] + dx, pos[i] + dy);
      }
    }
  }
  for (let i = 0; i < 9; i += 1) { mark(i, 8); mark(8, i); }
  for (let i = 0; i < 8; i += 1) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      mark(size - 11 + (i % 3), Math.floor(i / 3));
      mark(Math.floor(i / 3), size - 11 + (i % 3));
    }
  }
  return f;
}

/** يقرأ رمز QR من المصفوفة كما يفعل الماسح، بلا استخدام شيفرة المولّد. */
function decode(qr) {
  const { size, modules, version } = qr;
  // ١) معلومات النسق من النسخة الأولى
  let fmt = 0;
  const bitAt = (x, y) => modules[y][x];
  const seq = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  seq.forEach(([x, y], i) => { fmt |= bitAt(x, y) << i; });
  fmt ^= 0x5412;
  const data5 = fmt >> 10;
  const eclBits = data5 >> 3;
  const mask = data5 & 7;
  const ecl = Object.keys(ECL_BITS).find((k) => ECL_BITS[k] === eclBits);

  // ٢) إزالة القناع وقراءة البتّات بترتيب الزقزاق
  const fn = functionMap(size, version);
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fn[y][x]) continue;
        bits.push(modules[y][x] ^ (MASKS[mask](x, y) ? 1 : 0));
      }
    }
  }
  const codewords = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j += 1) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }

  // ٣) فكّ التشابك
  const numBlocks = NUM_BLOCKS[ecl][version - 1];
  const eccLen = ECC_PER_BLOCK[ecl][version - 1];
  const totalData = codewords.length - eccLen * numBlocks;
  const shortLen = Math.floor(totalData / numBlocks);
  const numShort = numBlocks - (totalData % numBlocks);
  const blocks = Array.from({ length: numBlocks }, () => []);
  let k = 0;
  for (let i = 0; i < shortLen + 1; i += 1) {
    for (let b = 0; b < numBlocks; b += 1) {
      if (i < shortLen + (b < numShort ? 0 : 1)) blocks[b].push(codewords[k++]);
    }
  }
  const data = blocks.flat();

  // ٤) قراءة الرسالة
  const dataBits = data.flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((s) => (b >> s) & 1));
  const read = (offset, len) => dataBits.slice(offset, offset + len).reduce((a, b) => (a << 1) | b, 0);
  assert.equal(read(0, 4), 0b0100, 'نمط البايت');
  const countBits = version < 10 ? 8 : 16;
  const len = read(4, countBits);
  const bytes = [];
  for (let i = 0; i < len; i += 1) bytes.push(read(4 + countBits + i * 8, 8));
  return { text: Buffer.from(bytes).toString('utf8'), ecl, mask, version };
}

test('ذهاب وإياب: ما يُرمَّز يُقرأ كما هو (عربي ولاتيني وروابط)', () => {
  const samples = [
    'ASTQ-9F2K7QD4',
    'https://club.utas.edu.om/t/ASTQ-9F2K7QD4',
    'تذكرة نادي الثقافة والأدب',
    'https://club.utas.edu.om/events/12/evaluate?src=qr',
    'ا'.repeat(100),
  ];
  for (const ecl of ['L', 'M', 'Q', 'H']) {
    for (const text of samples) {
      const qr = encode(text, { ecl });
      const out = decode(qr);
      assert.equal(out.text, text, `النصّ (${ecl})`);
      assert.equal(out.ecl, ecl, 'مستوى التصحيح المقروء');
      assert.equal(out.mask, qr.mask, 'القناع المقروء');
    }
  }
});

test('عدد الوحدات الحرّة يطابق ما تنصّ عليه المواصفة لكل إصدار', () => {
  // فحص بنيوي مستقلّ: لو أُسيء وضع أنماط المحاذاة لاختلّ هذا العدد.
  for (let version = 1; version <= 15; version += 1) {
    const size = version * 4 + 17;
    const fn = functionMap(size, version);
    let free = 0;
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (!fn[y][x]) free += 1;
    assert.equal(free, rawDataModules(version), `الإصدار ${version}`);
  }
});

test('الأنماط الثابتة في مواضعها', () => {
  const qr = encode('اختبار', { ecl: 'M' });
  for (const [ox, oy] of [[0, 0], [qr.size - 7, 0], [0, qr.size - 7]]) {
    assert.equal(qr.modules[oy][ox], 1, 'ركن نمط الكشف داكن');
    assert.equal(qr.modules[oy + 1][ox + 1], 0, 'الإطار الفاتح');
    assert.equal(qr.modules[oy + 3][ox + 3], 1, 'المربّع الداخلي');
  }
  assert.equal(qr.modules[qr.size - 8][8], 1, 'الوحدة الداكنة الثابتة');
});

test('SVG صالح ويحمل وصفًا للقارئات', () => {
  const svg = toSvg('ASTQ-TEST1234', { label: 'رمز التذكرة' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="[^"]+">رمز التذكرة<\/title>/);
  assert.match(svg, /<\/svg>$/);
});

test('يرفض ما لا يسعه الرمز برسالة عربية', () => {
  assert.throws(() => encode('ا'.repeat(1000), { ecl: 'H' }), /أطول ممّا يسعه/);
});

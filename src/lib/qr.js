/**
 * مولّد رمز QR — نمط البايت (UTF-8)، الإصدارات ١..١٥، بلا أي مكتبة خارجية.
 * مطابق للمواصفة ISO/IEC 18004: تصحيح Reed–Solomon، تشابك الكتل،
 * ثمانية أقنعة يُختار أصلحها بالجزاء، ومعلومات النسق والإصدار بترميز BCH.
 */

/* --------------------------- جداول المواصفة --------------------------- */
// عدد رموز التصحيح لكل كتلة (الفهرس ٠ = الإصدار ١)
const ECC_PER_BLOCK = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24],
};
// عدد كتل التصحيح
const NUM_BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18],
};
const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
export const MAX_VERSION = 15;

/** عدد وحدات البيانات الخام (بتّات) للإصدار. */
export function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** عدد رموز البيانات (بعد خصم رموز التصحيح). */
export function dataCodewords(version, ecl) {
  return Math.floor(rawDataModules(version) / 8)
    - ECC_PER_BLOCK[ecl][version - 1] * NUM_BLOCKS[ecl][version - 1];
}

/** أقصى عدد بايتات نصّية يسعها الإصدار في نمط البايت. */
export function byteCapacity(version, ecl) {
  const countBits = version < 10 ? 8 : 16;
  return Math.floor((dataCodewords(version, ecl) * 8 - 4 - countBits) / 8);
}

/* --------------------------- حسابات جالوا GF(256) --------------------------- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x = (x << 1) ^ ((x & 0x80) ? 0x11d : 0);   // كثير الحدود 0x11D
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** كثير حدود التوليد لدرجة معيّنة. */
function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];                       // الضرب في x
      next[j + 1] ^= gfMul(poly[j], EXP[i]);    // الضرب في α^i
    }
    poly = next;
  }
  return poly;
}

/** رموز تصحيح Reed–Solomon لكتلة بيانات. */
export function reedSolomon(data, eccLen) {
  const gen = generatorPoly(eccLen);
  const result = new Uint8Array(eccLen);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[eccLen - 1] = 0;
    for (let i = 0; i < eccLen; i += 1) result[i] ^= gfMul(gen[i + 1], factor);
  }
  return result;
}

/* ------------------------------ ترميز البيانات ----------------------------- */
function chooseVersion(byteLen, ecl, minVersion = 1) {
  for (let v = minVersion; v <= MAX_VERSION; v += 1) {
    if (byteLen <= byteCapacity(v, ecl)) return v;
  }
  throw new Error(`النصّ أطول ممّا يسعه رمز QR (${byteLen} بايت).`);
}

function buildCodewords(bytes, version, ecl) {
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4);                                   // نمط البايت
  push(bytes.length, version < 10 ? 8 : 16);         // عدّاد المحارف
  for (const b of bytes) push(b, 8);

  const capacityBits = dataCodewords(version, ecl) * 8;
  push(0, Math.min(4, capacityBits - bits.length));  // الخاتمة
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  for (let pad = 0xec; codewords.length < capacityBits / 8; pad ^= 0xec ^ 0x11) codewords.push(pad);
  return codewords;
}

/** تقسيم إلى كتل، حساب التصحيح، ثم التشابك. */
function interleave(codewords, version, ecl) {
  const numBlocks = NUM_BLOCKS[ecl][version - 1];
  const eccLen = ECC_PER_BLOCK[ecl][version - 1];
  const total = Math.floor(rawDataModules(version) / 8);
  const shortLen = Math.floor(codewords.length / numBlocks);
  const numShort = numBlocks - (codewords.length % numBlocks);

  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i += 1) {
    const len = shortLen + (i < numShort ? 0 : 1);
    const block = codewords.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    eccBlocks.push(reedSolomon(block, eccLen));
  }

  const out = [];
  for (let i = 0; i < shortLen + 1; i += 1) {
    for (let b = 0; b < numBlocks; b += 1) {
      if (i < dataBlocks[b].length) out.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < eccLen; i += 1) {
    for (let b = 0; b < numBlocks; b += 1) out.push(eccBlocks[b][i]);
  }
  if (out.length !== total) throw new Error('خلل داخلي في تشابك الرموز.');
  return out;
}

/* ------------------------------- رسم المصفوفة ------------------------------ */
function alignmentPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.ceil((size - 13) / (numAlign * 2 - 2)) * 2;
  const positions = [6];                       // الموضع الأول ثابت عند ٦
  for (let pos = size - 7; positions.length < numAlign; pos -= step) positions.splice(1, 0, pos);
  return positions;                            // تصاعديًّا: 6, 26, 46 …
}

function newMatrix(size) {
  return {
    size,
    modules: Array.from({ length: size }, () => new Uint8Array(size)),
    reserved: Array.from({ length: size }, () => new Uint8Array(size)),
  };
}

function setFunction(m, x, y, dark) {
  if (x < 0 || y < 0 || x >= m.size || y >= m.size) return;
  m.modules[y][x] = dark ? 1 : 0;
  m.reserved[y][x] = 1;
}

function drawFinder(m, cx, cy) {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunction(m, cx + dx, cy + dy, dist !== 2 && dist <= 3);
    }
  }
}

function drawFunctionPatterns(m, version) {
  const size = m.size;
  for (let i = 0; i < size; i += 1) {
    setFunction(m, 6, i, i % 2 === 0);          // التوقيت العمودي
    setFunction(m, i, 6, i % 2 === 0);          // التوقيت الأفقي
  }
  drawFinder(m, 3, 3);
  drawFinder(m, size - 4, 3);
  drawFinder(m, 3, size - 4);

  const align = alignmentPositions(version);
  for (let i = 0; i < align.length; i += 1) {
    for (let j = 0; j < align.length; j += 1) {
      const skipCorner = (i === 0 && j === 0)
        || (i === 0 && j === align.length - 1)
        || (i === align.length - 1 && j === 0);
      if (skipCorner) continue;
      const cx = align[j];
      const cy = align[i];
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFunction(m, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // حجز مواضع معلومات النسق
  for (let i = 0; i < 9; i += 1) {
    setFunction(m, i, 8, false);
    setFunction(m, 8, i, false);
  }
  for (let i = 0; i < 8; i += 1) {
    setFunction(m, size - 1 - i, 8, false);
    setFunction(m, 8, size - 1 - i, false);
  }
  setFunction(m, 8, size - 8, true);            // الوحدة الداكنة الثابتة

  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(m, a, b, bit);
      setFunction(m, b, a, bit);
    }
  }
}

/** BCH(18,6) لمعلومات الإصدار. */
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return ((version << 12) | rem) >>> 0;
}

/** BCH(15,5) لمعلومات النسق (مستوى التصحيح + القناع). */
export function formatBits(ecl, mask) {
  const data = (ECL_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) >>> 0;
}

function drawFormat(m, ecl, mask) {
  const bits = formatBits(ecl, mask);
  const size = m.size;
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i += 1) setFunction(m, 8, i, bit(i));
  setFunction(m, 8, 7, bit(6));
  setFunction(m, 8, 8, bit(7));
  setFunction(m, 7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setFunction(m, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i += 1) setFunction(m, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) setFunction(m, 8, size - 15 + i, bit(i));
  setFunction(m, 8, size - 8, true);
}

function placeData(m, data) {
  const size = m.size;
  let index = 0;
  let bitIndex = 7;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;                 // تخطّي عمود التوقيت
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (m.reserved[y][x]) continue;
        let dark = false;
        if (index < data.length) {
          dark = ((data[index] >>> bitIndex) & 1) === 1;
          bitIndex -= 1;
          if (bitIndex < 0) { bitIndex = 7; index += 1; }
        }
        m.modules[y][x] = dark ? 1 : 0;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m, mask) {
  for (let y = 0; y < m.size; y += 1) {
    for (let x = 0; x < m.size; x += 1) {
      if (!m.reserved[y][x] && MASKS[mask](x, y)) m.modules[y][x] ^= 1;
    }
  }
}

/** جزاء القناع حسب القواعد الأربع في المواصفة. */
function penalty(m) {
  const size = m.size;
  const get = (x, y) => m.modules[y][x] === 1;
  let score = 0;

  for (let axis = 0; axis < 2; axis += 1) {
    for (let a = 0; a < size; a += 1) {
      let run = 1;
      let prev = axis === 0 ? get(0, a) : get(a, 0);
      const history = [];
      for (let b = 1; b < size; b += 1) {
        const cur = axis === 0 ? get(b, a) : get(a, b);
        if (cur === prev) {
          run += 1;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          history.push({ run, dark: prev });
          run = 1;
          prev = cur;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
      history.push({ run, dark: prev });

      // القاعدة ٣: النمط ١:١:٣:١:١ مع فراغ ٤
      for (let i = 0; i + 4 < history.length; i += 1) {
        const h = history.slice(i, i + 5);
        if (!h[2].dark) continue;
        const unit = h[0].run;
        const ratio = h[0].run === unit && h[1].run === unit && h[2].run === unit * 3
          && h[3].run === unit && h[4].run === unit && !h[0].dark;
        if (!ratio) continue;
        const before = i > 0 ? history[i - 1].run : 0;
        const after = i + 5 < history.length ? history[i + 5].run : 0;
        if (before >= unit * 4 || after >= unit * 4 || i === 0 || i + 5 === history.length) score += 40;
      }
    }
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = get(x, y);
      if (c === get(x + 1, y) && c === get(x, y + 1) && c === get(x + 1, y + 1)) score += 3;
    }
  }

  let dark = 0;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (get(x, y)) dark += 1;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/* --------------------------------- الواجهة -------------------------------- */
/**
 * @param {string} text
 * @param {{ecl?:'L'|'M'|'Q'|'H', minVersion?:number}} [options]
 * @returns {{size:number, modules:Uint8Array[], version:number, ecl:string, mask:number}}
 */
export function encode(text, { ecl = 'M', minVersion = 1 } = {}) {
  const bytes = Array.from(Buffer.from(String(text), 'utf8'));
  const version = chooseVersion(bytes.length, ecl, minVersion);
  const codewords = buildCodewords(bytes, version, ecl);
  const data = interleave(codewords, version, ecl);

  const size = version * 4 + 17;
  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const m = newMatrix(size);
    drawFunctionPatterns(m, version);
    placeData(m, data);
    drawFormat(m, ecl, mask);
    applyMask(m, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { score, matrix: m, mask };
  }
  return { size, modules: best.matrix.modules, version, ecl, mask: best.mask };
}

/**
 * رمز QR كصورة SVG — مسار واحد، حادّ في أي مقاس.
 * @param {string} text
 */
export function toSvg(text, {
  ecl = 'M', margin = 4, scale = 8, dark = '#1b0b20', light = '#ffffff',
  label = 'رمز الدخول', id = '',
} = {}) {
  const qr = encode(text, { ecl });
  const dim = qr.size + margin * 2;
  let path = '';
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.modules[y][x]) path += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }
  const titleId = `qr-title-${id || Math.random().toString(36).slice(2, 8)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" `
    + `width="${dim * scale}" height="${dim * scale}" role="img" aria-labelledby="${titleId}" `
    + `shape-rendering="crispEdges" class="qr">`
    + `<title id="${titleId}">${String(label).replace(/[<>&]/g, '')}</title>`
    + `<rect width="${dim}" height="${dim}" fill="${light}"/>`
    + `<path d="${path}" fill="${dark}"/></svg>`;
}

export default { encode, toSvg, byteCapacity, reedSolomon, formatBits, versionBits };

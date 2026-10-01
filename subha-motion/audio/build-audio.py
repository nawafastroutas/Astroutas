#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سبحة · SUBHA — توليد مؤثرات الانتقال.

لا موسيقى خلفية إطلاقًا: الملف صمتٌ تامّ تتخلّله مؤثرات عند لحظات الانتقال
فقط. وكل مؤثر مُركَّب هنا رياضيًا (لا عيّنات جاهزة ولا مكتبات خارجية — بيئة
التصيير مغلقة عن الإنترنت)، وبذور العشوائية ثابتة، فإعادة التوليد تعطي نفس
الملف بالبايت في كل مرة — تمامًا كما يفعل render.mjs مع الصورة.

التشغيل:
    python3 audio/build-audio.py index.html audio/subha-motion.wav
    python3 audio/build-audio.py gift.html  audio/subha-gifting.wav
    python3 audio/build-audio.py index.html out.wav --no-accents   # انتقالات فقط

الطبقتان:
    الانتقالات  — صوت لكل تغيير مشهد. هي المطلوب، ولا تُطفأ.
    اللمسات     — نقرات الخرز والرنّات الخفيفة. تُطفأ بـ --no-accents.
"""

import math
import random
import struct
import sys
import wave

SR = 48000


# ─────────────────────────── مُركِّبات المؤثرات ───────────────────────────

def click(f0=1200.0, dur=0.10, decay=52.0, noise=0.34, seed=0):
    """نقرة خرزة: جيبٌ مخمود سريعًا + نفخة ضجيج قصيرة تعطيها طابع الخشب."""
    rnd = random.Random(seed)
    n = int(dur * SR)
    out = [0.0] * n
    for k in range(n):
        t = k / SR
        env = math.exp(-t * decay)
        body = math.sin(2 * math.pi * f0 * t) * 0.62 \
             + math.sin(2 * math.pi * f0 * 2.74 * t) * 0.24
        tick = (rnd.random() * 2 - 1) * noise * math.exp(-t * 240)
        out[k] = body * env + tick
    return out


def sweep(dur=0.55, f_start=420.0, f_end=2600.0, q=0.78, shape=1.5, seed=1):
    """هسهسة انتقال: ضجيج أبيض عبر مرشّح نطاقي يتحرّك ترددُه أُسّيًا.
    مرشّح state-variable من مرتبتين — مخرجه النطاقي هو ما نسمعه."""
    rnd = random.Random(seed)
    n = int(dur * SR)
    out = [0.0] * n
    low = band = 0.0
    ratio = f_end / f_start
    for k in range(n):
        x = k / n
        f = f_start * (ratio ** x)
        F = 2.0 * math.sin(math.pi * min(f, SR * 0.45) / SR)
        inp = rnd.random() * 2 - 1
        low += F * band
        high = inp - low - q * band
        band += F * high
        out[k] = band * (math.sin(math.pi * x) ** shape)
    return out


def chime(f0=1318.0, dur=1.25, seed=2):
    """رنّة: توافقيات غير تامّة التناسب تخمد كلٌّ بسرعته — أقرب للمعدن منها للنغمة."""
    n = int(dur * SR)
    out = [0.0] * n
    parts = ((1.00, 1.00), (2.01, 0.40), (3.04, 0.19), (4.71, 0.09), (5.93, 0.05))
    for k in range(n):
        t = k / SR
        s = 0.0
        for r, a in parts:
            s += a * math.sin(2 * math.pi * f0 * r * t) * math.exp(-t * (3.0 + r * 1.7))
        out[k] = s * min(1.0, t / 0.004)
    return out


def thump(f0=96.0, f1=46.0, dur=0.60, decay=7.6):
    """دقّة منخفضة تحت الهسهسة، تعطي اللوح الداكن ثِقَلًا عند هبوطه."""
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0
    for k in range(n):
        t = k / SR
        f = f0 * ((f1 / f0) ** ((t / dur) ** 0.5))
        ph += 2 * math.pi * f / SR
        out[k] = math.sin(ph) * math.exp(-t * decay)
    return out


# ─────────────────────────── التركيب والكتابة ───────────────────────────

class Mixer:
    def __init__(self, duration):
        n = int(duration * SR) + SR          # ثانية احتياطية للذيول
        self.L = [0.0] * n
        self.R = [0.0] * n

    def put(self, t, samples, gain=1.0, pan=0.0):
        """pan: ‎-1 يسار، 0 وسط، 1 يمين — بقدرة ثابتة حتى لا يتغيّر الجهر بالتحريك."""
        gl = gain * math.cos((pan + 1) * math.pi / 4)
        gr = gain * math.sin((pan + 1) * math.pi / 4)
        i = int(t * SR)
        n = len(self.L)
        for k, v in enumerate(samples):
            j = i + k
            if 0 <= j < n:
                self.L[j] += v * gl
                self.R[j] += v * gr

    def put_wide(self, t, factory, gain=1.0, seed=0):
        """نسختان بضجيج مختلف لليمين واليسار — تعطي الهسهسة اتساعًا بلا تأثيرات."""
        self.put(t, factory(seed), gain, -0.85)
        self.put(t, factory(seed + 977), gain, 0.85)

    def write(self, path, end, peak=0.72, fade=0.5):
        """يُقَصّ الملف على طول الفيديو بالضبط، مع تلاشٍ في آخر نصف ثانية حتى
        لا تُقطع ذيول الرنّات قطعًا مفاجئًا."""
        n = int(end * SR)
        self.L = self.L[:n]
        self.R = self.R[:n]
        f = int(fade * SR)
        for k in range(f):
            g = 0.5 * (1 + math.cos(math.pi * k / f))
            self.L[n - f + k] *= g
            self.R[n - f + k] *= g
        hi = max(max(abs(v) for v in self.L), max(abs(v) for v in self.R)) or 1.0
        k = peak / hi
        frames = bytearray()
        for a, b in zip(self.L, self.R):
            frames += struct.pack('<hh',
                                  int(max(-1.0, min(1.0, a * k)) * 32767),
                                  int(max(-1.0, min(1.0, b * k)) * 32767))
        with wave.open(path, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(bytes(frames))
        return len(self.L) / SR


# ─────────────────────────── قوائم اللحظات ───────────────────────────
# الأزمنة مأخوذة من animation-delay في scene.css وgift.css. أي تعديل هناك
# يستلزم تعديلها هنا، وإلا انفصل الصوت عن الصورة.

def cues_main(m, accents):
    # ١ · الافتتاحية — سبع نقرات، واحدة لكل خرزة تهبط على الخيط
    if accents:
        for i, f in enumerate((1520, 1440, 1360, 1290, 1220, 1155, 1095)):
            m.put(1.00 + i * 0.13, click(f, seed=i), 0.30, (i - 3) * 0.12)
        m.put(2.55, chime(1318.0), 0.13, 0.05)          # المعيّن
    m.put_wide(1.95, lambda s: sweep(0.70, 700, 2100, 0.9, 1.7, s), 0.16, 11)   # انكشاف الشعار

    # الانتقال إلى اللوح الداكن
    m.put_wide(4.80, lambda s: sweep(0.62, 380, 2700, 0.7, 1.4, s), 0.52, 21)
    m.put(5.33, thump(), 0.46)
    if accents:
        m.put_wide(5.68, lambda s: sweep(0.34, 900, 2000, 1.0, 2.0, s), 0.09, 31)
        m.put_wide(6.02, lambda s: sweep(0.34, 900, 2000, 1.0, 2.0, s), 0.09, 41)

    # انحسار اللوح الداكن ← فاصل «أقسامنا»
    m.put_wide(8.12, lambda s: sweep(0.66, 2500, 420, 0.7, 1.4, s), 0.44, 51)
    if accents:
        m.put(8.42, chime(1760.0, 0.9), 0.12)

    # الأقسام الأربعة — هسهسة عند كل تغيير بطاقة
    for t, seed in ((9.32, 61), (12.92, 71), (16.52, 81), (20.12, 91)):
        m.put_wide(t, lambda s: sweep(0.42, 820, 2500, 0.85, 1.7, s), 0.30, seed)

    if accents:
        # السُّبَح: تتابع خرزات سريع وخافت أثناء تركّب الحلقة
        for k in range(12):
            m.put(10.16 + k * 0.052, click(1320 - k * 26, 0.07, 64, 0.30, 100 + k),
                  0.085, (k % 5 - 2) * 0.22)
        m.put(11.32, click(760, 0.13, 40, 0.22, 7), 0.13)            # الشاهد
        # الكركوشات: ثلاث نفضات قماش
        for i, t in enumerate((14.16, 14.29, 14.42)):
            m.put_wide(t, lambda s: sweep(0.30, 1500, 4200, 1.25, 2.2, s), 0.10, 110 + i)
        # التعليقات: ثلاث قطع تستقرّ
        for i, t in enumerate((17.92, 18.06, 18.20)):
            m.put(t, click(980 - i * 90, 0.11, 46, 0.26, 120 + i), 0.14, (i - 1) * 0.42)
        # المحفظات: المشبك ثم فتح الغطاء ثم الخرزات تطلّ
        m.put(21.85, click(640, 0.12, 40, 0.30, 9), 0.15)
        m.put_wide(22.00, lambda s: sweep(0.38, 300, 900, 1.1, 1.9, s), 0.13, 131)
        for k in range(5):
            m.put(22.26 + k * 0.07, click(1180 - k * 40, 0.07, 66, 0.28, 140 + k), 0.10,
                  (k - 2) * 0.24)

    # الانتقال إلى الإهداء
    m.put_wide(23.90, lambda s: sweep(0.62, 380, 2700, 0.7, 1.4, s), 0.52, 151)
    m.put(24.45, thump(), 0.46)
    if accents:
        m.put_wide(26.20, lambda s: sweep(0.40, 420, 1500, 1.0, 1.9, s), 0.12, 161)  # الغطاء
        for i in range(7):
            m.put(26.02 + i * 0.11, chime(2400 + i * 180, 0.55), 0.040, (i % 3 - 1) * 0.55)

    # الختام
    m.put_wide(27.50, lambda s: sweep(0.66, 2500, 420, 0.7, 1.4, s), 0.44, 171)
    m.put_wide(27.98, lambda s: sweep(0.62, 700, 2100, 0.9, 1.7, s), 0.16, 181)
    if accents:
        m.put(28.48, chime(1046.0), 0.13)
    m.put_wide(29.55, lambda s: sweep(0.52, 500, 1900, 0.9, 1.8, s), 0.20, 191)
    m.put(29.80, chime(1568.0, 1.6), 0.19)


def cues_gift(m, accents):
    # ١ · الافتتاح — يبدأ داكنًا، فتُفتح به دقّة ونَفَس صاعد
    m.put_wide(0.06, lambda s: sweep(0.70, 340, 2400, 0.7, 1.5, s), 0.46, 211)
    m.put(0.10, thump(84.0, 42.0, 0.62, 8.2), 0.30)
    if accents:
        m.put(0.34, click(1180, 0.11, 46, 0.26, 3), 0.20)          # شارة «جديد»
        for i in range(7):
            m.put(0.58 + i * 0.10, chime(2300 + i * 170, 0.55), 0.045, (i % 3 - 1) * 0.55)
    m.put_wide(0.52, lambda s: sweep(0.68, 700, 2000, 0.9, 1.7, s), 0.17, 221)

    # ٢ · عبارة الإهداء
    m.put_wide(3.08, lambda s: sweep(0.44, 820, 2500, 0.85, 1.7, s), 0.32, 231)
    if accents:
        m.put(4.00, click(520, 0.15, 34, 0.34, 5), 0.17)           # البطاقة تستقرّ
        for k in range(3):
            m.put(4.76 + k * 0.11, click(1420 - k * 70, 0.06, 72, 0.22, 150 + k), 0.065)
        m.put(5.14, chime(1480.0, 0.9), 0.12)                      # الختم الذهبي

    # ٣ · تغليفٌ وعلبة
    m.put_wide(6.28, lambda s: sweep(0.44, 820, 2500, 0.85, 1.7, s), 0.32, 241)
    if accents:
        m.put_wide(8.22, lambda s: sweep(0.34, 1400, 3800, 1.2, 2.1, s), 0.11, 251)  # العقدة
        m.put_wide(8.72, lambda s: sweep(0.40, 420, 1500, 1.0, 1.9, s), 0.13, 261)   # الغطاء
        for i in range(7):
            m.put(8.52 + i * 0.11, chime(2400 + i * 180, 0.55), 0.042, (i % 3 - 1) * 0.55)

    # ٤ · الختام
    m.put_wide(9.88, lambda s: sweep(0.56, 2300, 460, 0.75, 1.5, s), 0.38, 271)
    m.put_wide(10.50, lambda s: sweep(0.62, 700, 2100, 0.9, 1.7, s), 0.17, 281)
    if accents:
        m.put(10.98, chime(1046.0), 0.13)
    m.put_wide(11.95, lambda s: sweep(0.52, 500, 1900, 0.9, 1.8, s), 0.20, 291)
    m.put(12.18, chime(1568.0, 1.6), 0.19)


PAGES = {
    'index.html': (30.6, cues_main),
    'gift.html':  (13.0, cues_gift),
}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2 or args[0] not in PAGES:
        sys.exit('الاستعمال: build-audio.py <index.html|gift.html> <out.wav> [--no-accents]')
    page, out = args
    accents = '--no-accents' not in sys.argv
    duration, cues = PAGES[page]

    m = Mixer(duration)
    cues(m, accents)
    length = m.write(out, duration)
    print(f'✓ {out} — {length:.1f}s · {"انتقالات ولمسات" if accents else "انتقالات فقط"}')


if __name__ == '__main__':
    main()

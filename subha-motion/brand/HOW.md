# كيف وُلِّدت ملفات هذا المجلد

المصدر هو `subha-logo.png` (الشعار كما أُرسل: ١١٣٨×٦٠٤، حبر أسود على ورق كريمي).
قُصَّت منه كتلة الشعار والشعار الفرعي، وحُوِّلت خلفيتهما الكريمية إلى شفافية
عبر اشتقاق قناة ألفا من الإضاءة: الحبر يصبح معتمًا تمامًا، والورق شفافًا تمامًا.

```bash
# كتلة الشعار — حبر على خلفية شفافة (للمشاهد الفاتحة)
ffmpeg -y -i subha-logo.png -f lavfi -i color=c=0x0E0D0C:s=1056x326 -filter_complex \
  "[0:v]crop=1056:326:41:21,format=gray,geq=lum='clip((245-lum(X,Y))*255/238,0,255)'[a];\
   [1:v][a]alphamerge[o]" -map "[o]" -frames:v 1 mark-ink.png

# النسخة نفسها بلون الورق (للمشاهد الداكنة) — غيّر c= فقط
ffmpeg -y -i subha-logo.png -f lavfi -i color=c=0xF7F2EA:s=1056x326 -filter_complex \
  "[0:v]crop=1056:326:41:21,format=gray,geq=lum='clip((245-lum(X,Y))*255/238,0,255)'[a];\
   [1:v][a]alphamerge[o]" -map "[o]" -frames:v 1 mark-cream.png

# الشعار الفرعي «هوية عُمانية بتفاصيل راقية»
ffmpeg -y -i subha-logo.png -f lavfi -i color=c=0x7C6B5D:s=324x44 -filter_complex \
  "[0:v]crop=324:44:408:530,format=gray,geq=lum='clip((245-lum(X,Y))*255/238,0,255)'[a];\
   [1:v][a]alphamerge[o]" -map "[o]" -frames:v 1 tagline-ink.png
```

`crop=W:H:X:Y` محسوب من حدود المحتوى في الملف الأصلي:
كتلة الشعار `y 36–332`، المعيّن `y 356–437`، صف الخرزات `y 464–493`،
والشعار الفرعي `y 537–562`. لو تغيّر ملف الشعار فأعد قياس هذه الحدود أولًا.

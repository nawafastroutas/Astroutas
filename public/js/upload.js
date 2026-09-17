/**
 * ضغط الصور في المتصفّح قبل الرفع، ثم إرسالها خامًا (بلا multipart).
 * يعمل مع أي حقل: <input type="file" data-upload="/المسار">
 */
const MAX_DIMENSION = 1600;
const TARGET_BYTES = 900 * 1024;

async function compress(file) {
  if (!file.type.startsWith('image/')) throw new Error('اختر ملفّ صورة.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('تعذّرت قراءة الصورة.'); });

  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of [0.82, 0.7, 0.58, 0.45]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && (blob.size <= TARGET_BYTES || quality === 0.45)) return blob;
  }
  throw new Error('تعذّر ضغط الصورة.');
}

function statusNode(input) {
  return input.closest('.field')?.querySelector('[data-upload-status]')
      || input.parentElement?.querySelector('[data-upload-status]');
}

for (const input of document.querySelectorAll('[data-upload]')) {
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const status = statusNode(input);
    const say = (text) => { if (status) status.textContent = text; };

    say('جارٍ ضغط الصورة…');
    try {
      const blob = await compress(file);
      say(`جارٍ الرفع… (${Math.round(blob.size / 1024)} كيلوبايت)`);
      const response = await fetch(input.dataset.upload, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg', 'X-Requested-With': 'fetch' },
        body: blob,
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({ message: 'ردّ غير مفهوم من الخادم.' }));
      if (!response.ok || !data.ok) { say(data.message || 'تعذّر الرفع.'); return; }
      say('تمّ الرفع ✓');
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      say(error.message || 'تعذّر الرفع.');
    } finally {
      input.value = '';
    }
  });
}

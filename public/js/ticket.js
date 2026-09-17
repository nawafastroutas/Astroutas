/** حفظ التذكرة صورة PNG — يُرسَم الرمز والنصوص على لوحة. */
const button = document.querySelector('[data-save-ticket]');
const ticket = document.querySelector('[data-ticket]');

function textOf(selector) {
  return ticket.querySelector(selector)?.textContent.trim() || '';
}

async function svgToImage(svg) {
  const source = new XMLSerializer().serializeToString(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  const image = new Image();
  image.decoding = 'sync';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  return image;
}

button?.addEventListener('click', async () => {
  const original = button.textContent;
  button.textContent = 'جارٍ التجهيز…';
  try {
    const svg = ticket.querySelector('.ticket__qr svg');
    const qr = await svgToImage(svg);

    const W = 760;
    const H = 1180;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // ترويسة بنفسجية
    const gradient = ctx.createLinearGradient(0, 0, W, 300);
    gradient.addColorStop(0, '#4c1c53');
    gradient.addColorStop(1, '#1d0a21');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, 260);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText(textOf('.ticket__head h2').slice(0, 30), W / 2, 110);
    ctx.font = '400 26px "Segoe UI", Tahoma, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    const when = ticket.querySelectorAll('.ticket__head p')[0]?.textContent.trim() || '';
    ctx.fillText(when.slice(0, 48), W / 2, 165);
    const where = ticket.querySelectorAll('.ticket__head p')[1]?.textContent.trim() || '';
    ctx.fillText(where.slice(0, 48), W / 2, 210);

    // رمز QR
    const qrSize = 420;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((W - qrSize) / 2 - 16, 300, qrSize + 32, qrSize + 32);
    ctx.drawImage(qr, (W - qrSize) / 2, 316, qrSize, qrSize);

    // الرمز النصّي
    ctx.direction = 'ltr';
    ctx.fillStyle = '#1d0a21';
    ctx.font = '700 44px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText(textOf('[data-ticket-code]'), W / 2, 830);

    // البيانات
    ctx.direction = 'rtl';
    ctx.font = '400 26px "Segoe UI", Tahoma, sans-serif';
    ctx.fillStyle = '#6b5c70';
    let y = 900;
    for (const row of ticket.querySelectorAll('.ticket__meta div')) {
      const key = row.querySelector('.k')?.textContent.trim();
      const value = row.querySelector('.v')?.textContent.trim();
      if (!key) continue;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#6b5c70';
      ctx.fillText(key, W - 60, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#221626';
      ctx.fillText(value, 60, y);
      y += 46;
      if (y > H - 60) break;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#7fb3b0';
    ctx.font = '400 22px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText('نادي الثقافة والأدب — كلية التربية بالرستاق', W / 2, H - 30);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ticket-${textOf('[data-ticket-code]')}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    button.textContent = 'حُفظت ✓';
  } catch {
    button.textContent = 'تعذّر الحفظ';
  }
  setTimeout(() => { button.textContent = original; }, 2200);
});

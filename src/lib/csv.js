/** تصدير CSV بترميز UTF-8 مع BOM حتى تُقرأ العربية في Excel. */

const BOM = '﻿';

function cell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // يمنع تفسير Excel للخلية كصيغة حسابية
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {string[]} headers
 * @param {Array<Array<any>>} rows
 * @returns {Buffer}
 */
export function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return Buffer.from(BOM + lines.join('\r\n') + '\r\n', 'utf8');
}

export const csvHeaders = (filename) => ({
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  'Cache-Control': 'no-store',
});

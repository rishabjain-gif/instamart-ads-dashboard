import { parseCSV } from '@/lib/dataUtils';
import { ZEPTO_SHEETS } from '@/lib/zeptoConfig';

export async function GET() {
  const sheet = ZEPTO_SHEETS['2026-04'];
  const resp = await fetch(sheet.url);
  const text = await resp.text();
  const rows = parseCSV(text);
  const adTypeValues = [...new Set(rows.map(r => r['Ad type'] || '(empty)'))];
  const sample = rows.slice(0, 5).map(r => ({ adType: r['Ad type'], brand: r['BrandName'], cat: r['Category'] }));
  return Response.json({
    totalRows: rows.length,
    uniqueAdTypes: adTypeValues,
    sample,
  });
}

import { parseCSV } from '@/lib/dataUtils';
import { ZEPTO_SHEETS } from '@/lib/zeptoConfig';

export async function GET() {
  const sheet = ZEPTO_SHEETS['2026-04'];
  const resp = await fetch(sheet.url);
  const text = await resp.text();
  const lines = text.split('\n').filter(l => l.trim());
  const firstLine = lines[0];
  const rows = parseCSV(text);
  const firstRow = rows[0] || {};
  return Response.json({
    rawFirstLine: firstLine,
    headers: Object.keys(firstRow),
    firstRow,
  });
}

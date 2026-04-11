import { parseCSV } from '@/lib/dataUtils';
import { ZEPTO_SHEETS } from '@/lib/zeptoConfig';

export async function GET() {
  const sheet = ZEPTO_SHEETS['2026-04'];
  const resp = await fetch(sheet.url);
  const text = await resp.text();
  const rows = parseCSV(text);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const drinkMixRows = rows.filter(r => (r['Cat'] || r['Category'] || '').includes('Drink'));
  const kwSample = drinkMixRows.slice(0, 10).map(r => ({
    cat: r['Cat'] || r['Category'],
    kw: r['KeywordName'],
    kwText: r['Keyword'],
    spend: r['Spend'],
    allKeys: Object.keys(r).join('|')
  }));

  return Response.json({
    totalRows: rows.length,
    columns,
    drinkMixCount: drinkMixRows.length,
    kwSample,
  });
}

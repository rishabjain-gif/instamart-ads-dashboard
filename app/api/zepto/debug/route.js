import { parseCSV } from '@/lib/dataUtils';
import { ZEPTO_SHEETS } from '@/lib/zeptoConfig';

export async function GET() {
  const sheet = ZEPTO_SHEETS['2026-04'];
  const resp = await fetch(sheet.url);
  const text = await resp.text();
  const rows = parseCSV(text);

  // Find all rows with pediasure keyword
  const pediaRows = rows.filter(r => (r['KeywordName'] || '').toLowerCase().includes('pediasure'));
  const pediaSummary = pediaRows.map(r => ({
    adType: r['Ad type'],
    brand: r['BrandName'],
    cat: r['Category'],
    kw: r['KeywordName'],
    spend: r['Spend'],
  }));

  // Aggregate pediasure by adType
  const byAdType = {};
  for (const r of pediaRows) {
    const at = r['Ad type'] || 'unknown';
    if (!byAdType[at]) byAdType[at] = { count: 0, totalSpend: 0 };
    byAdType[at].count++;
    byAdType[at].totalSpend += parseFloat(r['Spend'] || 0);
  }

  return Response.json({
    totalPediaRows: pediaRows.length,
    byAdType,
    sample: pediaSummary.slice(0, 20),
  });
}

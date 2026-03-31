import { SHEETS, getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV, aggregateRows } from '@/lib/dataUtils';
export const dynamic = 'force-dynamic';
async function fetchSheet(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const { current } = getCurrentAndPreviousMonths();
    const key = monthParam || current.key;
    const sheet = SHEETS[key];
    if (!sheet) return Response.json({ error: 'Invalid month' }, { status: 400 });
    const rows = await fetchSheet(sheet.url);
    const kwRows = rows.filter(r => r['AD_PROPERTY'] === 'Keyword Based Ads');
    const groups = {};
    for (const row of kwRows) {
      const cat = row['category'] || row['Category'] || row['L1_CATEGORY'] || 'Unknown';
      const campaign = row['CAMPAIGN_NAME'] || 'Unknown';
      const keyword = row['KEYWORD'] || 'Unknown';
      const k = cat + '|||' + campaign + '|||' + keyword;
      if (!groups[k]) groups[k] = { category: cat, campaign, keyword, rows: [] };
      groups[k].rows.push(row);
    }
    const catTotals = {};
    const campTotals = {};
    const table = [];
    for (const [k, g] of Object.entries(groups)) {
      const agg = aggregateRows(g.rows);
      const [category, campaign, keyword] = k.split('|||');
      catTotals[category] = (catTotals[category] || 0) + agg.spend;
      const ck = category + '|||' + campaign;
      campTotals[ck] = (campTotals[ck] || 0) + agg.spend;
      table.push({ category, campaign, keyword, spend: agg.spend, roas: agg.roas > 0 ? agg.roas : null, cpc: agg.cpc > 0 ? agg.cpc : null, cvr: agg.cvr > 0 ? agg.cvr : null });
    }
    for (const row of table) {
      row.pctOfCat = catTotals[row.category] > 0 ? (row.spend / catTotals[row.category]) * 100 : 0;
    }
    table.sort((a, b) => {
      const cd = (catTotals[b.category]||0) - (catTotals[a.category]||0);
      if (cd !== 0) return cd;
      const ckA = a.category+'|||'+a.campaign, ckB = b.category+'|||'+b.campaign;
      const campD = (campTotals[ckB]||0) - (campTotals[ckA]||0);
      if (campD !== 0) return campD;
      return b.spend - a.spend;
    });
    const availableMonths = Object.entries(SHEETS).sort((a,b)=>b[0].localeCompare(a[0])).map(([k,v])=>({ key: k, label: v.label }));
    return Response.json({ monthLabel: sheet.label, monthKey: key, data: table, availableMonths });
  } catch (err) { console.error(err); return Response.json({ error: err.message }, { status: 500 }); }
}
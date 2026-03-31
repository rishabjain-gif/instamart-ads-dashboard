import { getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV, aggregateRows, calcPctChange } from '@/lib/dataUtils';
export const dynamic = 'force-dynamic';
async function fetchSheet(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}
export async function GET() {
  try {
    const { current, previous } = getCurrentAndPreviousMonths();
    const [currentRows, prevRows] = await Promise.all([fetchSheet(current.url), previous ? fetchSheet(previous.url) : Promise.resolve([])]);
    function groupRows(rows) {
      const groups = {};
      for (const row of rows) {
        const cat = row['Category'] || row['L1_CATEGORY'] || 'Unknown'; const adProp = row['AD_PROPERTY'] || 'Unknown';
        const key = cat + '|||' + adProp;
        if (!groups[key]) groups[key] = { category: cat, adProperty: adProp, rows: [] };
        groups[key].rows.push(row);
      }
      return groups;
    }
    const currGroups = groupRows(currentRows); const prevGroups = groupRows(prevRows);
    const allKeys = new Set([...Object.keys(currGroups), ...Object.keys(prevGroups)]);
    const results = [];
    for (const key of allKeys) {
      const [category, adProperty] = key.split('|||');
      const curr = currGroups[key] ? aggregateRows(currGroups[key].rows) : null;
      const prev = prevGroups[key] ? aggregateRows(prevGroups[key].rows) : null;
      results.push({ category, adProperty, currentSpend: curr?.spend ?? 0, prevRoas: prev?.roas ?? null, currentRoas: curr?.roas ?? null,
        roasChange: curr && prev ? calcPctChange(curr.roas, prev.roas) : null,
        cpcChange: curr && prev ? calcPctChange(curr.cpc, prev.cpc) : null,
        cvrChange: curr && prev ? calcPctChange(curr.cvr, prev.cvr) : null });
    }
    const catSpend = {};
    for (const r of results) catSpend[r.category] = (catSpend[r.category] || 0) + r.currentSpend;
    results.sort((a, b) => { const cd = (catSpend[b.category]||0)-(catSpend[a.category]||0); return cd !== 0 ? cd : b.currentSpend - a.currentSpend; });
    return Response.json({ currentLabel: current.label, previousLabel: previous?.label ?? null, data: results });
  } catch (err) { console.error(err); return Response.json({ error: err.message }, { status: 500 }); }
}
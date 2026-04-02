import { ZEPTO_SHEETS } from '@/lib/zeptoConfig';
import { parseCSV, aggregateZeptoRows, calcPctChange, parseZeptoDate } from '@/lib/dataUtils';

export const revalidate = 300;
const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now()-e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

function parseInputDate(str) { const [y,m,d] = str.split('-').map(Number); return new Date(y,m-1,d); }

async function fetchAndFilter(url, start, end) {
  const resp = await fetch(url, { next: { revalidate: 300 } });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  const rows = parseCSV(await resp.text());
  return rows.filter(row => {
    const d = parseZeptoDate(row['Date']);
    return d && d >= start && d <= end;
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get('month'), startA = searchParams.get('startA'), endA = searchParams.get('endA'), startB = searchParams.get('startB'), endB = searchParams.get('endB');
    if (!monthKey||!startA||!endA||!startB||!endB) return Response.json({ error: 'Missing parameters' }, { status: 400 });
    const sheet = ZEPTO_SHEETS[monthKey];
    if (!sheet) return Response.json({ error: 'Invalid month' }, { status: 400 });

    const cacheKey = 'zc_' + monthKey + '_' + startA + '_' + endA + '_' + startB + '_' + endB;
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    const [rowsA, rowsB] = await Promise.all([
      fetchAndFilter(sheet.url, parseInputDate(startA), parseInputDate(endA)),
      fetchAndFilter(sheet.url, parseInputDate(startB), parseInputDate(endB))
    ]);

    function groupBrand(rows) {
      const g = {};
      for (const row of rows) {
        const cat = row['Cat'] || row['Category'] || 'Unknown';
        const brand = row['BrandName'] || 'Unknown';
        const key = cat + '|||' + brand;
        if (!g[key]) g[key] = { category: cat, adProperty: brand, rows: [] };
        g[key].rows.push(row);
      }
      return g;
    }

    const apA = groupBrand(rowsA), apB = groupBrand(rowsB);
    const apKeys = new Set([...Object.keys(apA), ...Object.keys(apB)]);
    const table1 = [];
    for (const key of apKeys) {
      const [category, adProperty] = key.split('|||');
      const a = apA[key] ? aggregateZeptoRows(apA[key].rows) : null;
      const b = apB[key] ? aggregateZeptoRows(apB[key].rows) : null;
      table1.push({ category, adProperty, spendA: a?.spend ?? 0,
        roasA: a?.roas ?? null, roasB: b?.roas ?? null,
        roasChange: a && b ? calcPctChange(b.roas, a.roas) : null,
        cpcChange: a && b ? calcPctChange(b.cpc, a.cpc) : null,
        cvrChange: a && b ? calcPctChange(b.cvr, a.cvr) : null });
    }
    const catSpend1 = {};
    for (const r of table1) catSpend1[r.category] = (catSpend1[r.category] || 0) + r.spendA;
    table1.sort((a, b) => { const cd = (catSpend1[b.category]||0)-(catSpend1[a.category]||0); return cd !== 0 ? cd : b.spendA - a.spendA; });

    function groupKeyword(rows) {
      const g = {};
      for (const row of rows) {
        const cat = row['Cat'] || row['Category'] || 'Unknown';
        const campaign = row['Campaign_name'] || 'Unknown';
        const keyword = row['KeywordName'] || 'Unknown';
        const key = cat + '|||' + campaign + '|||' + keyword;
        if (!g[key]) g[key] = { category: cat, campaign, keyword, rows: [] };
        g[key].rows.push(row);
      }
      return g;
    }

    const kwGA = groupKeyword(rowsA), kwGB = groupKeyword(rowsB);
    const kwKeys = new Set([...Object.keys(kwGA), ...Object.keys(kwGB)]);
    const catTotalA = {};
    for (const key of kwKeys) { const [cat] = key.split('|||'); const a = kwGA[key] ? aggregateZeptoRows(kwGA[key].rows) : null; catTotalA[cat] = (catTotalA[cat] || 0) + (a?.spend ?? 0); }
    const table2 = [];
    for (const key of kwKeys) {
      const [category, campaign, keyword] = key.split('|||');
      const a = kwGA[key] ? aggregateZeptoRows(kwGA[key].rows) : null;
      const b = kwGB[key] ? aggregateZeptoRows(kwGB[key].rows) : null;
      const spendA = a?.spend ?? 0;
      table2.push({ category, campaign, keyword, spendA, pctOfCatSpend: catTotalA[category] > 0 ? (spendA / catTotalA[category]) * 100 : 0,
        roasA: a?.roas ?? null, roasB: b?.roas ?? null,
        roasChange: a && b ? calcPctChange(b.roas, a.roas) : null,
        cpcChange: a && b ? calcPctChange(b.cpc, a.cpc) : null,
        cvrChange: a && b ? calcPctChange(b.cvr, a.cvr) : null });
    }
    const catSpend2 = {}, campSpend2 = {};
    for (const r of table2) { catSpend2[r.category] = (catSpend2[r.category] || 0) + r.spendA; const ck = r.category + '|||' + r.campaign; campSpend2[ck] = (campSpend2[ck] || 0) + r.spendA; }
    table2.sort((a, b) => {
      const cd = (catSpend2[b.category]||0)-(catSpend2[a.category]||0); if (cd !== 0) return cd;
      const ckA = a.category + '|||' + a.campaign, ckB = b.category + '|||' + b.campaign;
      const campD = (campSpend2[ckB]||0)-(campSpend2[ckA]||0); return campD !== 0 ? campD : b.spendA - a.spendA;
    });

    const result = { table1, table2 };
    setCached(cacheKey, result);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=86400' }
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

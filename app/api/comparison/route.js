import { SHEETS } from '@/lib/config';
import { parseCSV, toNum } from '@/lib/dataUtils';

export const revalidate = 300;

const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now()-e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

// Parse YYYY-MM-DD input from date picker
function parseInputDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Parse DD/MM/YY or DD/MM/YYYY or DD-MM-YYYY from sheet data
function parseRowDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  const sep = s.includes('/') ? '/' : '-';
  const parts = s.split(sep).map(Number);
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y) return null;
  const fullY = y < 100 ? 2000 + y : y;
  const date = new Date(fullY, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

async function fetchSheet(url) {
  const resp = await fetch(url, { next: { revalidate: 300 } });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}

function agg(rows) {
  let spend = 0, gmv = 0, clicks = 0, convs = 0;
  for (const r of rows) {
    spend += toNum(r['TOTAL_BUDGET_BURNT']);
    gmv += toNum(r['TOTAL_DIRECT_GMV_7_DAYS']);
    clicks += toNum(r['TOTAL_CLICKS']);
    convs += toNum(r['TOTAL_CONVERSIONS']);
  }
  return { spend, gmv, clicks, convs, roas: spend > 0 ? gmv / spend : 0 };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startA = searchParams.get('startA'), endA = searchParams.get('endA');
    const startB = searchParams.get('startB'), endB = searchParams.get('endB');
    if (!startA || !endA || !startB || !endB) {
      return Response.json({ error: 'Missing parameters: startA, endA, startB, endB required' }, { status: 400 });
    }

    const cacheKey = `cmp_im_${startA}_${endA}_${startB}_${endB}`;
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    // Auto-detect which sheets to fetch based on date range
    const boundaries = [startA, endA, startB, endB].map(parseInputDate);
    const minDate = new Date(Math.min(...boundaries.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...boundaries.map(d => d.getTime())));

    const sheetsToFetch = Object.values(SHEETS).filter(v => {
      const sheetStart = new Date(v.year, v.month - 1, 1);
      const sheetEnd = new Date(v.year, v.month, 0); // last day of month
      return sheetEnd >= minDate && sheetStart <= maxDate;
    });

    if (sheetsToFetch.length === 0) {
      return Response.json({ error: 'No data available for the selected date range' }, { status: 400 });
    }

    const fetched = await Promise.all(sheetsToFetch.map(v => fetchSheet(v.url)));
    const allRows = fetched.flat();

    const sA = parseInputDate(startA), eA = parseInputDate(endA);
    const sB = parseInputDate(startB), eB = parseInputDate(endB);
    eA.setHours(23, 59, 59, 999);
    eB.setHours(23, 59, 59, 999);

    const rowsA = allRows.filter(r => { const d = parseRowDate(r['METRICS_DATE']); return d && d >= sA && d <= eA; });
    const rowsB = allRows.filter(r => { const d = parseRowDate(r['METRICS_DATE']); return d && d >= sB && d <= eB; });

    // Group rows by Brand > Category > Campaign > Keyword
    function groupRows(rows) {
      const g = {};
      for (const r of rows) {
        const brand = ((r['Brand'] || '').trim().replace(/^#N\/A$/, '')) || 'Unbranded';
        const cat = (r['L1_CATEGORY'] || r['Category'] || 'Unknown').trim();
        const camp = (r['CAMPAIGN_NAME'] || 'Unknown').trim();
        const kw = (r['KEYWORD'] || '').trim();
        const key = brand + '|||' + cat + '|||' + camp + '|||' + kw;
        if (!g[key]) g[key] = { brand, cat, camp, kw, rows: [] };
        g[key].rows.push(r);
      }
      return g;
    }

    const gA = groupRows(rowsA);
    const gB = groupRows(rowsB);
    const allKeys = new Set([...Object.keys(gA), ...Object.keys(gB)]);

    const rows = [];
    for (const key of allKeys) {
      const [brand, cat, camp, kw] = key.split('|||');
      const a = gA[key] ? agg(gA[key].rows) : { spend: 0, gmv: 0, roas: 0 };
      const b = gB[key] ? agg(gB[key].rows) : { spend: 0, gmv: 0, roas: 0 };
      rows.push({
        brand, cat, camp, kw,
        spendA: a.spend, gmvA: a.gmv, roasA: a.roas,
        spendB: b.spend, gmvB: b.gmv, roasB: b.roas,
      });
    }

    const result = {
      rows,
      periodA: { start: startA, end: endA },
      periodB: { start: startB, end: endB },
      rowCountA: rowsA.length,
      rowCountB: rowsB.length,
    };
    setCached(cacheKey, result);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=86400' }
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

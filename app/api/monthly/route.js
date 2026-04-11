import { getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV, aggregateRows, calcPctChange } from '@/lib/dataUtils';

export const revalidate = 300;

const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now()-e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }
function clearCached(k) { delete _cache[k]; }

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function daysElapsed(year, month) {
  const today = new Date();
  if (today.getFullYear() === year && today.getMonth() + 1 === month) return today.getDate();
  return daysInMonth(year, month);
}

async function fetchSheet(url) {
  const resp = await fetch(url, { next: { revalidate: 300 } });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}

export async function GET(request) {
  try {
    const { current, previous } = getCurrentAndPreviousMonths();
    const cacheKey = current.key + '_' + (previous ? previous.key : 'none');
    const bust = new URL(request.url).searchParams.get('bust') === 'true';
    if (bust) clearCached(cacheKey);
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    const [currentRows, prevRows] = await Promise.all([
      fetchSheet(current.url),
      previous ? fetchSheet(previous.url) : Promise.resolve([])
    ]);

    const currDays = daysElapsed(current.year, current.month);
    const prevDays = previous ? daysInMonth(previous.year, previous.month) : 1;

    function groupRows(rows) {
      const groups = {};
      for (const row of rows) {
        const cat = row['Category'] || '⚠️ No Category';
        const adProp = row['AD_PROPERTY'] || 'Unknown';
        const key = cat + '|||' + adProp;
        if (!groups[key]) groups[key] = { category: cat, adProperty: adProp, rows: [] };
        groups[key].rows.push(row);
      }
      return groups;
    }

    const currGroups = groupRows(currentRows);
    const prevGroups = groupRows(prevRows);
    const allKeys = new Set([...Object.keys(currGroups), ...Object.keys(prevGroups)]);

    const results = [];
    for (const key of allKeys) {
      const [category, adProperty] = key.split('|||');
      const curr = currGroups[key] ? aggregateRows(currGroups[key].rows) : null;
      const prev = prevGroups[key] ? aggregateRows(prevGroups[key].rows) : null;
      const currAvg = curr ? curr.spend / currDays : null;
      const prevAvg = prev ? prev.spend / prevDays : null;

      results.push({
        category, adProperty,
        currentSpend: curr?.spend ?? 0,
        prevSpend: prev?.spend ?? null,
        avgDailySpendChange: currAvg !== null && prevAvg ? calcPctChange(currAvg, prevAvg) : null,
        prevRoas: prev?.roas ?? null,
        currentRoas: curr?.roas ?? null,
        roasChange: curr && prev ? calcPctChange(curr.roas, prev.roas) : null,
        cpcChange: curr && prev ? calcPctChange(curr.cpc, prev.cpc) : null,
        cvrChange: curr && prev ? calcPctChange(curr.cvr, prev.cvr) : null,
      });
    }

    results.sort((a, b) => b.currentSpend - a.currentSpend);

    const result = {
      currentLabel: current.label,
      previousLabel: previous?.label ?? null,
      currDays,
      prevDays,
      fetchedAt: new Date().toISOString(),
      data: results
    };
    setCached(cacheKey, result);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

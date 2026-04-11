import { getZeptoCurrentAndPreviousMonths } from '@/lib/zeptoConfig';
import { parseCSV, aggregateZeptoRows, calcPctChange } from '@/lib/dataUtils';

export const revalidate = 300;

const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now()-e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

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

export async function GET() {
  try {
    const { current, previous } = getZeptoCurrentAndPreviousMonths();
    const cacheKey = 'z_' + current.key + '_' + (previous ? previous.key : 'none');
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    const [currentRows, prevRows] = await Promise.all([
      fetchSheet(current.url),
      previous ? fetchSheet(previous.url) : Promise.resolve([])
    ]);

    const currDays = daysElapsed(current.year, current.month);
    const prevDays = previous ? daysInMonth(previous.year, previous.month) : 1;

    function normalizeBrand(b) {
      const s = (b || '').trim().toLowerCase().replace(/\s+/g, '');
      if (s === 'bebodywise') return 'Be Bodywise';
      if (s === 'manmatters') return 'Man Matters';
      if (s === 'littlejoys') return 'Little Joys';
      return b || 'Unknown';
    }

    function groupRows(rows) {
      const groups = {};
      for (const row of rows) {
        const adType = (row['Ad type'] || 'Unknown').trim();
        const brand = normalizeBrand(row['BrandName']);
        const cat = (row['Cat'] || row['Category'] || 'Unknown').trim();
        const key = adType + '|||' + brand + '|||' + cat;
        if (!groups[key]) groups[key] = { adType, brand, category: cat, rows: [], byKeyword: {} };
        const kw = (row['KeywordName'] || '').trim() || '(no keyword)';
        if (!groups[key].byKeyword[kw]) groups[key].byKeyword[kw] = [];
        groups[key].byKeyword[kw].push(row);
        groups[key].rows.push(row);
      }
      return groups;
    }

    const currGroups = groupRows(currentRows);
    const prevGroups = groupRows(prevRows);
    const allKeys = new Set([...Object.keys(currGroups), ...Object.keys(prevGroups)]);

    const results = [];
    for (const key of allKeys) {
      const [adType, brand, category] = key.split('|||');
      const curr = currGroups[key] ? aggregateZeptoRows(currGroups[key].rows) : null;
      const prev = prevGroups[key] ? aggregateZeptoRows(prevGroups[key].rows) : null;
      const currAvg = curr ? curr.spend / currDays : null;
      const prevAvg = prev ? prev.spend / prevDays : null;

      // Build keyword list merging current + previous month data
      const currByKw = currGroups[key]?.byKeyword || {};
      const prevByKw = prevGroups[key]?.byKeyword || {};
      const allKwNames = new Set([...Object.keys(currByKw), ...Object.keys(prevByKw)]);

      const keywords = Array.from(allKwNames).map(keyword => {
        const kwAgg = currByKw[keyword] ? aggregateZeptoRows(currByKw[keyword]) : null;
        const prevKwAgg = prevByKw[keyword] ? aggregateZeptoRows(prevByKw[keyword]) : null;
        return {
          keyword,
          currentSpend: kwAgg?.spend ?? 0,
          currentRoas: kwAgg?.roas ?? null,
          prevSpend: prevKwAgg?.spend ?? null,
          prevRoas: prevKwAgg?.roas ?? null,
        };
      }).sort((a, b) => b.currentSpend - a.currentSpend);

      results.push({
        adType,
        brand,
        category,
        currentSpend: curr?.spend ?? 0,
        prevSpend: prev?.spend ?? null,
        avgDailySpendChange: currAvg !== null && prevAvg ? calcPctChange(currAvg, prevAvg) : null,
        prevRoas: prev?.roas ?? null,
        currentRoas: curr?.roas ?? null,
        roasChange: curr && prev ? calcPctChange(curr.roas, prev.roas) : null,
        cpcChange: curr && prev ? calcPctChange(curr.cpc, prev.cpc) : null,
        cvrChange: curr && prev ? calcPctChange(curr.cvr, prev.cvr) : null,
        keywords,
      });
    }

    const adTypeSpend = {};
    const brandSpend = {};
    for (const r of results) {
      adTypeSpend[r.adType] = (adTypeSpend[r.adType] || 0) + r.currentSpend;
      const bk = r.adType + '|||' + r.brand;
      brandSpend[bk] = (brandSpend[bk] || 0) + r.currentSpend;
    }

    results.sort((a, b) => {
      const ad = (adTypeSpend[b.adType] || 0) - (adTypeSpend[a.adType] || 0);
      if (ad !== 0) return ad;
      const bkA = a.adType + '|||' + a.brand;
      const bkB = b.adType + '|||' + b.brand;
      const bd = (brandSpend[bkB] || 0) - (brandSpend[bkA] || 0);
      if (bd !== 0) return bd;
      return b.currentSpend - a.currentSpend;
    });

    const result = {
      currentLabel: current.label,
      previousLabel: previous?.label ?? null,
      currDays,
      prevDays,
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

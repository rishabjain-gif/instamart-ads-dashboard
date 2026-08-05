import { getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV, toNum } from '@/lib/dataUtils';

export const revalidate = 300;

const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now() - e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

async function fetchSheet(url) {
  const resp = await fetch(url, { next: { revalidate: 300 } });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}

export async function GET() {
  try {
    const { current } = getCurrentAndPreviousMonths();
    const cacheKey = 'kw_cities_' + current.key;
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    const rows = await fetchSheet(current.url);

    // Group by keyword → city
    const kwMap = {};
    for (const r of rows) {
      const kw = (r['KEYWORD'] || '').trim();
      if (!kw) continue; // skip non-keyword (banner/browse) rows

      const city = (r['CITY'] || '').trim() || 'Unknown';
      const camp = (r['CAMPAIGN_NAME'] || '').trim();
      const brand = (r['Brand'] || '').trim();
      const spend = toNum(r['TOTAL_BUDGET_BURNT']);
      const gmv = toNum(r['TOTAL_DIRECT_GMV_7_DAYS']);

      if (!kwMap[kw]) kwMap[kw] = { keyword: kw, campaign: camp, brand, spend: 0, gmv: 0, cities: {} };
      kwMap[kw].spend += spend;
      kwMap[kw].gmv += gmv;

      if (!kwMap[kw].cities[city]) kwMap[kw].cities[city] = { city, spend: 0, gmv: 0 };
      kwMap[kw].cities[city].spend += spend;
      kwMap[kw].cities[city].gmv += gmv;
    }

    // Filter: only keywords with spend > 0 and ROAS < 1, sort by spend desc
    const keywords = Object.values(kwMap)
      .filter(kw => kw.spend > 0 && kw.gmv / kw.spend < 1)
      .map(kw => ({
        keyword: kw.keyword,
        campaign: kw.campaign,
        brand: kw.brand,
        spend: kw.spend,
        gmv: kw.gmv,
        roas: kw.spend > 0 ? kw.gmv / kw.spend : 0,
        cities: Object.values(kw.cities)
          .filter(c => c.spend > 0)
          .map(c => ({ city: c.city, spend: c.spend, gmv: c.gmv, roas: c.spend > 0 ? c.gmv / c.spend : 0 }))
          .sort((a, b) => b.spend - a.spend),
      }))
      .sort((a, b) => b.spend - a.spend);

    const result = { keywords, month: current.label, total: keywords.length };
    setCached(cacheKey, result);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=86400' }
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

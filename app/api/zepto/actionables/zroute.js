import { getZeptoCurrentAndPreviousMonths } from '@/lib/zeptoConfig';
import { parseCSV, toNum } from '@/lib/dataUtils';
import { ACTIONABLES_CONFIG as CFG } from '@/lib/actionablesConfig';

export const revalidate = 300;
const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now() - e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

function isBranded(kw) { const l = (kw || '').toLowerCase(); return CFG.brandedTerms.some(b => l.includes(b)); }

async function fetchSheet(url) {
  const resp = await fetch(url, { next: { revalidate: 300 } });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}

function agg(rows) {
  let spend = 0, gmv = 0, clicks = 0, conversions = 0;
  for (const r of rows) {
    spend += toNum(r['Spend']);
    gmv += toNum(r['Direct Sales'] || r['Direct Sale'] || 0);
    clicks += toNum(r['Clicks']);
    conversions += toNum(r['Same_skus']);
  }
  return { spend, gmv, clicks, conversions, roas: spend > 0 ? gmv / spend : 0 };
}

function parseFlexDate(s) {
  if (!s) return null;
  const parts = String(s).trim().split(/[\/\-]/);
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return { d, m, y };
}

export async function GET(request) {
  try {
    const { current } = getZeptoCurrentAndPreviousMonths();
    const bust = new URL(request.url).searchParams.get('bust');
    const cacheKey = 'actionables_zp_' + current.key;
    if (!bust) { const cached = getCached(cacheKey); if (cached) return Response.json(cached); }

    const rows = await fetchSheet(current.url);

    // ---------- Data health ----------
    let badDateCount = 0, badDateSpend = 0, noKwCount = 0, noKwSpend = 0, totalSpend = 0;
    for (const r of rows) {
      const sp = toNum(r['Spend']);
      totalSpend += sp;
      const dt = parseFlexDate(r['Date']);
      if (!dt || dt.m !== current.month || dt.y !== current.year) { badDateCount++; badDateSpend += sp; }
      if (!(r['KeywordName'] || '').trim()) { noKwCount++; noKwSpend += sp; }
    }
    const dataHealth = [];
    if (badDateCount > 0) dataHealth.push({ issue: 'Rows dated outside ' + current.label, count: badDateCount, spend: badDateSpend, detail: 'Date not in ' + current.label + ' — check the base tab for stray dates.' });
    if (noKwCount > 0) dataHealth.push({ issue: 'Spend with no keyword', count: noKwCount, spend: noKwSpend, detail: (totalSpend > 0 ? ((noKwSpend / totalSpend) * 100).toFixed(1) : 0) + '% of spend has a blank KeywordName — evaluated at campaign level below.' });

    // ---------- Grouping ----------
    const kwRows = rows.filter(r => (r['KeywordName'] || '').trim());
    const nonKwRows = rows.filter(r => !(r['KeywordName'] || '').trim());

    const kwGroups = {};
    for (const r of kwRows) {
      const key = (r['KeywordName'] || '').trim().toLowerCase() + '||' + (r['Campaign_name'] || 'Unknown');
      if (!kwGroups[key]) kwGroups[key] = { keyword: (r['KeywordName'] || '').trim(), campaign: r['Campaign_name'] || 'Unknown', brand: r['BrandName'] || '', rows: [] };
      kwGroups[key].rows.push(r);
    }
    const campGroups = {};
    for (const r of nonKwRows) {
      const key = r['Campaign_name'] || 'Unknown';
      if (!campGroups[key]) campGroups[key] = { keyword: null, campaign: key, brand: r['BrandName'] || '', adProperty: r['Ad type'] || 'Non-keyword', rows: [] };
      campGroups[key].rows.push(r);
    }

    const entries = [];
    for (const g of Object.values(kwGroups)) entries.push({ level: 'keyword', keyword: g.keyword, campaign: g.campaign, brand: g.brand, branded: isBranded(g.keyword), ...agg(g.rows) });
    for (const g of Object.values(campGroups)) entries.push({ level: 'campaign', keyword: '— ' + (g.adProperty || 'non-keyword') + ' —', campaign: g.campaign, brand: g.brand, branded: false, ...agg(g.rows) });

    // ---------- Rule lists ----------
    const pause = entries
      .filter(e => e.spend >= CFG.minPauseSpend && e.roas < CFG.breakevenRoas)
      .map(e => ({ ...e, estImpact: Math.max(0, e.spend - e.gmv), recommendation: 'Pause' + (e.level === 'keyword' ? ' keyword in this campaign' : ' campaign / rework creative') }))
      .sort((a, b) => b.spend - a.spend).slice(0, CFG.maxRows);

    const bidDown = entries
      .filter(e => e.spend >= CFG.minBidDownSpend && e.roas >= CFG.breakevenRoas && e.roas < CFG.bidDownRoasMax)
      .map(e => ({ ...e, estImpact: e.spend * CFG.bidDownSavingPct, recommendation: 'Cut bid 20-30%' }))
      .sort((a, b) => b.spend - a.spend).slice(0, CFG.maxRows);

    const scale = entries
      .filter(e => e.spend >= CFG.minScaleSpend && e.roas >= CFG.scaleRoasMin && !e.branded)
      .map(e => ({ ...e, estImpact: e.spend * CFG.scaleBudgetUpliftPct * e.roas, recommendation: 'Raise budget ~' + Math.round(CFG.scaleBudgetUpliftPct * 100) + '%' }))
      .sort((a, b) => (b.spend * b.roas) - (a.spend * a.roas)).slice(0, CFG.maxRows);

    const negatives = entries
      .filter(e => e.level === 'keyword' && e.clicks >= CFG.minNegativeClicks && e.conversions === 0)
      .map(e => ({ ...e, estImpact: e.spend, recommendation: 'Add as negative / pause' }))
      .sort((a, b) => b.clicks - a.clicks).slice(0, CFG.maxRows);

    // ---------- Branded spend guardrail ----------
    let brandedSpend = 0, kwSpend = 0;
    const brandedMap = {};
    for (const e of entries.filter(e => e.level === 'keyword')) {
      kwSpend += e.spend;
      if (e.branded) {
        brandedSpend += e.spend;
        const k = e.keyword.toLowerCase();
        if (!brandedMap[k]) brandedMap[k] = { keyword: e.keyword, spend: 0, gmv: 0 };
        brandedMap[k].spend += e.spend; brandedMap[k].gmv += e.gmv;
      }
    }
    const brandedSharePct = kwSpend > 0 ? (brandedSpend / kwSpend) * 100 : 0;
    const branded = {
      spend: brandedSpend, kwSpend, sharePct: brandedSharePct,
      breached: brandedSharePct > CFG.brandedSpendSharePct, thresholdPct: CFG.brandedSpendSharePct,
      top: Object.values(brandedMap).map(b => ({ ...b, roas: b.spend > 0 ? b.gmv / b.spend : 0 })).sort((a, b) => b.spend - a.spend).slice(0, 10),
    };

    const summary = {
      pauseCount: pause.length, pauseSpend: pause.reduce((s, e) => s + e.spend, 0),
      bidDownCount: bidDown.length, bidDownSaving: bidDown.reduce((s, e) => s + e.estImpact, 0),
      scaleCount: scale.length, scaleUpside: scale.reduce((s, e) => s + e.estImpact, 0),
      negativesCount: negatives.length,
      totalSpend,
    };

    const result = {
      platform: 'zepto', currentLabel: current.label, currentKey: current.key,
      config: { breakevenRoas: CFG.breakevenRoas, bidDownRoasMax: CFG.bidDownRoasMax, scaleRoasMin: CFG.scaleRoasMin },
      summary, pause, bidDown, scale, negatives, branded, cities: null, dataHealth,
      fetchedAt: new Date().toISOString(),
    };
    setCached(cacheKey, result);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

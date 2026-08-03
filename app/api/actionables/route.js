import { getCurrentAndPreviousMonths } from '@/lib/config';
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
    spend += toNum(r['TOTAL_BUDGET_BURNT']);
    gmv += toNum(r['TOTAL_DIRECT_GMV_7_DAYS']);
    clicks += toNum(r['TOTAL_CLICKS']);
    conversions += toNum(r['TOTAL_CONVERSIONS']);
  }
  return { spend, gmv, clicks, conversions, roas: spend > 0 ? gmv / spend : 0 };
}

function parseFlexDate(s) {
  if (!s) return null;
  const parts = String(s).trim().split(/[\/\-]/);
  if (parts.length !== 3) return null;
  const [d, m, yRaw] = parts.map(Number);
  if (!d || !m || !yRaw) return null;
  const y = yRaw < 100 ? 2000 + yRaw : yRaw; // handle DD/MM/YY (e.g. 01/08/26 → 2026)
  return { d, m, y };
}

export async function GET(request) {
  try {
    const { current } = getCurrentAndPreviousMonths();
    const bust = new URL(request.url).searchParams.get('bust');
    const cacheKey = 'actionables_im_' + current.key;
    if (!bust) { const cached = getCached(cacheKey); if (cached) return Response.json(cached); }

    const rows = await fetchSheet(current.url);

    // ---------- Data health ----------
    let badDateCount = 0, badDateSpend = 0, naBrandCount = 0, naBrandSpend = 0, unattrSpend = 0, totalSpend = 0;
    for (const r of rows) {
      const sp = toNum(r['TOTAL_BUDGET_BURNT']);
      totalSpend += sp;
      const dt = parseFlexDate(r['METRICS_DATE']);
      if (!dt || dt.m !== current.month || dt.y !== current.year) { badDateCount++; badDateSpend += sp; }
      const b = (r['Brand'] || '').trim();
      if (!b || b === '#N/A') { naBrandCount++; naBrandSpend += sp; }
      if (!(r['KEYWORD'] || '').trim()) unattrSpend += sp;
    }
    const dataHealth = [];
    if (badDateCount > 0) dataHealth.push({ issue: 'Rows dated outside ' + current.label, count: badDateCount, spend: badDateSpend, detail: 'METRICS_DATE not in ' + current.label + ' — check the base tab for stray dates (e.g. 2028 rows).' });
    if (naBrandCount > 0) dataHealth.push({ issue: 'Unmapped brand (#N/A / blank)', count: naBrandCount, spend: naBrandSpend, detail: 'Brand lookup failed for these rows — fix the mapping so brand-level ROAS is complete.' });
    if (unattrSpend > 0) dataHealth.push({ issue: 'Spend with no keyword (browse / banner / display)', count: null, spend: unattrSpend, detail: (totalSpend > 0 ? ((unattrSpend / totalSpend) * 100).toFixed(1) : 0) + '% of spend is non-keyword. It is evaluated at campaign level below, not in keyword lists.' });

    // ---------- Grouping ----------
    const kwRows = rows.filter(r => (r['AD_PROPERTY'] === 'Keyword Based Ads') && (r['KEYWORD'] || '').trim());
    const nonKwRows = rows.filter(r => r['AD_PROPERTY'] !== 'Keyword Based Ads');

    const kwGroups = {};
    for (const r of kwRows) {
      const key = (r['KEYWORD'] || '').trim().toLowerCase() + '||' + (r['CAMPAIGN_NAME'] || 'Unknown');
      if (!kwGroups[key]) kwGroups[key] = { keyword: (r['KEYWORD'] || '').trim(), campaign: r['CAMPAIGN_NAME'] || 'Unknown', brand: r['Brand'] || '', rows: [] };
      kwGroups[key].rows.push(r);
    }
    const campGroups = {};
    for (const r of nonKwRows) {
      const key = r['CAMPAIGN_NAME'] || 'Unknown';
      if (!campGroups[key]) campGroups[key] = { keyword: null, campaign: key, brand: r['Brand'] || '', adProperty: r['AD_PROPERTY'] || 'Non-keyword', rows: [] };
      campGroups[key].rows.push(r);
    }

    const entries = [];
    for (const g of Object.values(kwGroups)) entries.push({ level: 'keyword', keyword: g.keyword, campaign: g.campaign, brand: g.brand, branded: isBranded(g.keyword), ...agg(g.rows) });
    for (const g of Object.values(campGroups)) entries.push({ level: 'campaign', keyword: '— ' + (g.adProperty || 'non-keyword') + ' —', campaign: g.campaign, brand: g.brand, branded: false, ...agg(g.rows) });

    // ---------- Campaign budget utilisation (Instamart only) ----------
    // TOTAL_BUDGET is the campaign allocated budget cap repeated on every row.
    // Take MAX per campaign. Sum TOTAL_BUDGET_BURNT for total monthly spend.
    const campBudgetMap = {};
    for (const r of rows) {
      const camp = (r['CAMPAIGN_NAME'] || 'Unknown');
      if (!campBudgetMap[camp]) campBudgetMap[camp] = { burnt: 0, budget: 0 };
      campBudgetMap[camp].burnt += toNum(r['TOTAL_BUDGET_BURNT']);
      const b = toNum(r['TOTAL_BUDGET']);
      if (b > campBudgetMap[camp].budget) campBudgetMap[camp].budget = b;
    }
    for (const e of entries) {
      const cu = campBudgetMap[e.campaign];
      e.budgetUtilization = (cu && cu.budget > 0) ? cu.burnt / cu.budget : null;
    }

    // ---------- Rule lists ----------
    const pause = entries
      .filter(e => e.spend >= CFG.minPauseSpend && e.roas < CFG.breakevenRoas)
      .map(e => ({ ...e, estImpact: Math.max(0, e.spend - e.gmv), recommendation: 'Pause' + (e.level === 'keyword' ? ' keyword in this campaign' : ' campaign / rework creative') }))
      .sort((a, b) => b.spend - a.spend).slice(0, CFG.maxRows);

    const bidDown = entries
      .filter(e => e.spend >= CFG.minBidDownSpend && e.roas >= CFG.breakevenRoas && e.roas < CFG.bidDownRoasMax)
      .map(e => ({ ...e, estImpact: e.spend * CFG.bidDownSavingPct, recommendation: 'Cut bid 20–30%' }))
      .sort((a, b) => b.spend - a.spend).slice(0, CFG.maxRows);

    // Scale: only recommend raising budget when the campaign is exhausting
    // its allocated budget (>= budgetUtilizationThreshold). Null = unknown, excluded.
    const scale = entries
      .filter(e =>
        e.spend >= CFG.minScaleSpend &&
        e.roas >= CFG.scaleRoasMin &&
        !e.branded &&
        e.budgetUtilization !== null &&
        e.budgetUtilization >= CFG.budgetUtilizationThreshold
      )
      .map(e => ({
        ...e,
        estImpact: e.spend * CFG.scaleBudgetUpliftPct * e.roas,
        recommendation: 'Raise budget ~' + Math.round(CFG.scaleBudgetUpliftPct * 100) + '% (budget ' + Math.round(e.budgetUtilization * 100) + '% used)',
      }))
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

    // ---------- City reallocation ----------
    const cityMap = {};
    for (const r of rows) {
      const c = (r['CITY'] || '').trim();
      if (!c) continue;
      if (!cityMap[c]) cityMap[c] = [];
      cityMap[c].push(r);
    }
    const cityAggs = Object.entries(cityMap).map(([city, rs]) => ({ city, ...agg(rs) })).filter(c => c.spend >= CFG.minCitySpend);
    const cities = {
      shiftFrom: cityAggs.filter(c => c.roas < CFG.breakevenRoas).sort((a, b) => b.spend - a.spend).slice(0, 10),
      shiftTo: cityAggs.filter(c => c.roas >= CFG.scaleRoasMin).sort((a, b) => b.roas - a.roas).slice(0, 10),
    };

    const summary = {
      pauseCount: pause.length, pauseSpend: pause.reduce((s, e) => s + e.spend, 0),
      bidDownCount: bidDown.length, bidDownSaving: bidDown.reduce((s, e) => s + e.estImpact, 0),
      scaleCount: scale.length, scaleUpside: scale.reduce((s, e) => s + e.estImpact, 0),
      negativesCount: negatives.length,
      totalSpend,
    };

    const result = {
      platform: 'instamart', currentLabel: current.label, currentKey: current.key,
      config: { breakevenRoas: CFG.breakevenRoas, bidDownRoasMax: CFG.bidDownRoasMax, scaleRoasMin: CFG.scaleRoasMin, budgetUtilizationThreshold: CFG.budgetUtilizationThreshold },
      summary, pause, bidDown, scale, negatives, branded, cities, dataHealth,
      fetchedAt: new Date().toISOString(),
    };
    setCached(cacheKey, result);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

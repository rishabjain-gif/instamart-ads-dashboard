import { SHEETS, getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV, toNum, calcPctChange } from '@/lib/dataUtils';

export const revalidate = 300;
const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now()-e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

const BRANDS = ['man matters', 'be bodywise', 'little joys', 'bodywise'];
const ROAS_THRESHOLD = 1.5;
const MIN_3DAY_SPEND = 1000;
const DETERIORATION_THRESHOLD = 0.20;

function isBranded(keyword) {
  const lower = (keyword || '').toLowerCase();
  return BRANDS.some(b => lower.includes(b));
}

function fmtSpend(n) {
  if (!n || n === 0) return '₹0';
  if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

async function fetchSheet(url) {
  const resp = await fetch(url, { next: { revalidate: 300 } });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}

function aggRows(rows) {
  let spend = 0, gmv = 0, clicks = 0, conversions = 0;
  for (const r of rows) {
    spend += toNum(r['TOTAL_BUDGET_BURNT']);
    gmv += toNum(r['TOTAL_DIRECT_GMV_7_DAYS']);
    clicks += toNum(r['TOTAL_CLICKS']);
    conversions += toNum(r['TOTAL_CONVERSIONS']);
  }
  const roas = spend > 0 ? gmv / spend : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
  return { spend, gmv, roas, cpc, cvr };
}

export async function GET() {
  try {
    const { current, previous } = getCurrentAndPreviousMonths();
    const cacheKey = 'act_im_' + current.key + '_' + (previous ? previous.key : 'none');
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    const [currRows, prevRows] = await Promise.all([
      fetchSheet(current.url),
      previous ? fetchSheet(previous.url) : Promise.resolve([]),
    ]);

    const currKwRows = currRows.filter(r => r['AD_PROPERTY'] === 'Keyword Based Ads');
    const prevKwRows = prevRows.filter(r => r['AD_PROPERTY'] === 'Keyword Based Ads');

    const allDates = [...new Set(currKwRows.map(r => r['METRICS_DATE']).filter(Boolean))].sort();
    const last3Dates = new Set(allDates.slice(-3));
    const last7Dates = new Set(allDates.slice(-7));
    const earlierDates = new Set(allDates.slice(0, Math.max(0, allDates.length - 7)));
    const canSplit = allDates.length >= 8;

    const camps = {};
    for (const row of currKwRows) {
      const c = row['CAMPAIGN_NAME'] || 'Unknown';
      const k = row['KEYWORD'] || 'Unknown';
      const cat = row['Category'] || 'Unknown';
      if (!camps[c]) camps[c] = { category: cat, allRows: [], kwMap: {} };
      camps[c].allRows.push(row);
      if (!camps[c].kwMap[k]) camps[c].kwMap[k] = [];
      camps[c].kwMap[k].push(row);
    }

    const prevCamps = {};
    for (const row of prevKwRows) {
      const c = row['CAMPAIGN_NAME'] || 'Unknown';
      const k = row['KEYWORD'] || 'Unknown';
      const cat = row['Category'] || 'Unknown';
      if (!prevCamps[c]) prevCamps[c] = { category: cat, allRows: [], kwMap: {} };
      prevCamps[c].allRows.push(row);
      if (!prevCamps[c].kwMap[k]) prevCamps[c].kwMap[k] = [];
      prevCamps[c].kwMap[k].push(row);
    }

    const actions = [];

    for (const [campName, campData] of Object.entries(camps)) {
      const last3Spend = campData.allRows
        .filter(r => last3Dates.has(r['METRICS_DATE']))
        .reduce((s, r) => s + toNum(r['TOTAL_BUDGET_BURNT']), 0);
      if (last3Spend < MIN_3DAY_SPEND) continue;

      const mtd = aggRows(campData.allRows);
      const prev = prevCamps[campName] ? aggRows(prevCamps[campName].allRows) : null;

      let deteriorating = false;
      if (canSplit) {
        const last7 = aggRows(campData.allRows.filter(r => last7Dates.has(r['METRICS_DATE'])));
        const earlier = aggRows(campData.allRows.filter(r => earlierDates.has(r['METRICS_DATE'])));
        if (earlier.spend > 0 && last7.spend > 0 && earlier.roas > 0) {
          if (last7.roas < earlier.roas * (1 - DETERIORATION_THRESHOLD)) deteriorating = true;
        }
      }

      const kwList = Object.entries(campData.kwMap).map(([kwName, rows]) => {
        const agg = aggRows(rows);
        return { keyword: kwName, ...agg, branded: isBranded(kwName) };
      }).filter(k => k.spend >= 100).sort((a, b) => b.spend - a.spend);

      const cpcRising = prev && prev.cpc > 0 && mtd.cpc > 0 && calcPctChange(mtd.cpc, prev.cpc) > 15;
      const cvrFalling = prev && prev.cvr > 0 && mtd.cvr > 0 && calcPctChange(mtd.cvr, prev.cvr) < -10;

      if (cpcRising && cvrFalling) {
        const topKws = kwList.slice(0, 3).map(k => ({ keyword: k.keyword, spend: k.spend, roas: k.roas, branded: k.branded }));
        actions.push({
          type: 'investigate', priority: 'high', campaign: campName, category: campData.category,
          mtdSpend: mtd.spend, mtdRoas: mtd.roas, deteriorating,
          action: 'Investigate — CPC rising, CVR falling',
          detail: `CPC up ${calcPctChange(mtd.cpc, prev.cpc).toFixed(0)}%, CVR down ${Math.abs(calcPctChange(mtd.cvr, prev.cvr)).toFixed(0)}% vs last month. Check listing quality and bids.`,
          keywords: topKws,
        });
      }

      if (mtd.roas < ROAS_THRESHOLD) {
        const badKws = kwList.filter(k => k.roas < ROAS_THRESHOLD).slice(0, 3);
        const kwText = badKws.map(k => `"${k.keyword}"${k.branded ? ' [B]' : ''} (${fmtSpend(k.spend)}, ${k.roas.toFixed(2)}x)`).join(', ');
        actions.push({
          type: 'pause', priority: 'high', campaign: campName, category: campData.category,
          mtdSpend: mtd.spend, mtdRoas: mtd.roas, deteriorating,
          action: `Pause / reduce: ${kwText || campName}`,
          detail: `Campaign at ${mtd.roas.toFixed(2)}x ROAS (below 1.5x)${deteriorating ? ' — worsening this month' : ''}`,
          keywords: badKws.map(k => ({ keyword: k.keyword, spend: k.spend, roas: k.roas, branded: k.branded })),
        });
      } else if (!(cpcRising && cvrFalling)) {
        const goodKws = kwList.filter(k => k.roas >= ROAS_THRESHOLD).slice(0, 3);
        const kwText = goodKws.map(k => `"${k.keyword}"${k.branded ? ' [B]' : ''} (${k.roas.toFixed(2)}x)`).join(', ');
        actions.push({
          type: 'scale', priority: deteriorating ? 'medium' : 'low', campaign: campName, category: campData.category,
          mtdSpend: mtd.spend, mtdRoas: mtd.roas, deteriorating,
          action: `Scale up: ${kwText || campName}`,
          detail: `Campaign at ${mtd.roas.toFixed(2)}x ROAS${deteriorating ? ' — but recent days declining, monitor closely' : ''}`,
          keywords: goodKws.map(k => ({ keyword: k.keyword, spend: k.spend, roas: k.roas, branded: k.branded })),
        });
      }
    }

    for (const [campName, prevData] of Object.entries(prevCamps)) {
      if (camps[campName]) continue;
      const prev = aggRows(prevData.allRows);
      if (prev.roas >= ROAS_THRESHOLD && prev.spend >= 1000) {
        actions.push({
          type: 'confirm', priority: 'low', campaign: campName, category: prevData.category,
          mtdSpend: 0, mtdRoas: 0, deteriorating: false,
          action: 'Confirm if intentionally paused',
          detail: `Was at ${prev.roas.toFixed(2)}x ROAS (${fmtSpend(prev.spend)}) last month — no spend this month`,
          keywords: [],
        });
      }
    }

    actions.sort((a, b) => {
      const po = { high: 0, medium: 1, low: 2 };
      const pd = (po[a.priority] || 0) - (po[b.priority] || 0);
      return pd !== 0 ? pd : b.mtdSpend - a.mtdSpend;
    });

    const result = { actions, fetchedAt: new Date().toISOString(), currentLabel: current.label };
    setCached(cacheKey, result);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

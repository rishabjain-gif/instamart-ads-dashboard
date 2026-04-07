import { SHEETS, getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV, aggregateRows, calcPctChange } from '@/lib/dataUtils';

export const revalidate = 300;
const _kwCache = {};
function getCached(k) { const e = _kwCache[k]; return (e && Date.now()-e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _kwCache[k] = { data: d, ts: Date.now() }; }
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
function fmtS(n) {
  if (!n || n === 0) return '\u20b90';
  if (n >= 100000) return '\u20b9' + (n/100000).toFixed(1) + 'L';
  if (n >= 1000) return '\u20b9' + (n/1000).toFixed(1) + 'K';
  return '\u20b9' + n.toFixed(0);
}
function groupByKeyword(rows) {
  const groups = {};
  const kwRows = rows.filter(r => r['AD_PROPERTY'] === 'Keyword Based Ads');
  for (const row of kwRows) {
    const cat = row['Category'] || '\u26a0\ufe0f No Category';
    const campaign = row['CAMPAIGN_NAME'] || 'Unknown';
    const keyword = row['KEYWORD'] || 'Unknown';
    const k = cat + '|||' + campaign + '|||' + keyword;
    if (!groups[k]) groups[k] = { category: cat, campaign, keyword, rows: [] };
    groups[k].rows.push(row);
  }
  return groups;
}
function buildInsightText(curr, prev, campKeywords) {
  const cpcChg = (prev.cpc > 0 && curr.cpc > 0) ? calcPctChange(curr.cpc, prev.cpc) : null;
  const cvrChg = (prev.cvr > 0 && curr.cvr > 0) ? calcPctChange(curr.cvr, prev.cvr) : null;
  const spendChg = calcPctChange(curr.spend, prev.spend);
  const kws = campKeywords
    .filter(k => k.spend > 0)
    .sort((a, b) => {
      if (a.roas === null && b.roas === null) return b.spend - a.spend;
      if (a.roas === null) return -1;
      if (b.roas === null) return 1;
      return a.roas - b.roas;
    });
  const zeroRoasKws = kws.filter(k => (k.roas === null || k.roas === 0) && k.spend > 500);
  const lowRoasKws = kws.filter(k => k.roas !== null && k.roas > 0 && k.roas < 1.5);
  const highRoasKws = kws.filter(k => k.roas !== null && k.roas >= 3).sort((a, b) => b.roas - a.roas);
  const reasons = [];
  const actions = [];
  if (cpcChg !== null && cpcChg > 10) {
    reasons.push('CPC rose ' + cpcChg.toFixed(0) + '%');
    if (kws.length > 0) {
      const byHighCpc = [...kws].sort((a, b) => (b.cpc || 0) - (a.cpc || 0)).slice(0, 3);
      const names = byHighCpc.map(k => '"' + k.keyword + '" (CPC \u20b9' + (k.cpc ? k.cpc.toFixed(0) : '?') + ', ROAS ' + (k.roas !== null ? k.roas.toFixed(2) + 'x' : '0x') + ')').join(', ');
      actions.push('Reduce bids on ' + names);
    }
  }
  if (cvrChg !== null && cvrChg < -10) {
    reasons.push('CVR dropped ' + Math.abs(cvrChg).toFixed(0) + '%');
    actions.push('Check product listing quality, pricing, and stock — conversion rate declined');
  }
  if (zeroRoasKws.length > 0) {
    const names = zeroRoasKws.slice(0, 2).map(k => '"' + k.keyword + '" (' + fmtS(k.spend) + ' spent, 0x ROAS)').join(', ');
    actions.push('Pause ' + names + ' — spending with no returns');
  } else if (lowRoasKws.length > 0) {
    const names = lowRoasKws.slice(0, 2).map(k => '"' + k.keyword + '" (' + k.roas.toFixed(2) + 'x)').join(', ');
    actions.push('Reduce budget on ' + names + ' — ROAS below break-even');
  }
  if (highRoasKws.length > 0 && spendChg < 10) {
    const top = highRoasKws[0];
    actions.push('Increase bids on "' + top.keyword + '" — strong at ' + top.roas.toFixed(2) + 'x ROAS with budget headroom');
  }
  if (reasons.length === 0) reasons.push('ROAS declined month-over-month');
  if (actions.length === 0) {
    actions.push(kws.length > 0
      ? 'Audit keywords — worst performer: "' + kws[0].keyword + '" at ' + (kws[0].roas !== null ? kws[0].roas.toFixed(2) + 'x' : '0x') + ' ROAS'
      : 'Audit keyword bids and pause under-performers');
  }
  return { reason: reasons.join('; '), action: actions.join('; '), topKeywords: kws.slice(0, 5) };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const { current } = getCurrentAndPreviousMonths();
    const key = monthParam || current.key;
    const sheet = SHEETS[key];
    if (!sheet) return Response.json({ error: 'Invalid month' }, { status: 400 });
    const sortedKeys = Object.keys(SHEETS).sort();
    const keyIdx = sortedKeys.indexOf(key);
    const prevKey = keyIdx > 0 ? sortedKeys[keyIdx - 1] : null;
    const prevSheet = prevKey ? SHEETS[prevKey] : null;
    const cacheKey = key + '_' + (prevKey || '');
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    const [currRows, prevRows] = await Promise.all([
      fetchSheet(sheet.url),
      prevSheet ? fetchSheet(prevSheet.url) : Promise.resolve([]),
    ]);

    const currGroups = groupByKeyword(currRows);
    const prevGroups = prevRows.length ? groupByKeyword(prevRows) : {};

    const catTotals = {};
    const campTotals = {};
    const table = [];

    // Include ALL keywords from both months (so paused keywords are not skipped)
    const allKeywordKeys = new Set([...Object.keys(currGroups), ...Object.keys(prevGroups)]);
    for (const k of allKeywordKeys) {
      const g = currGroups[k];
      const prevG = prevGroups[k];
      const agg = g ? aggregateRows(g.rows) : { spend: 0, roas: 0, cpc: 0, cvr: 0 };
      const prevAgg = prevG ? aggregateRows(prevG.rows) : null;
      const parts = k.split('|||');
      const category = parts[0], campaign = parts[1], keyword = parts[2];
      catTotals[category] = (catTotals[category] || 0) + agg.spend;
      const ck = category + '|||' + campaign;
      campTotals[ck] = (campTotals[ck] || 0) + agg.spend;
      // Skip if no spend in either period
      if (agg.spend <= 0 && (!prevAgg || prevAgg.spend <= 0)) continue;
      table.push({
        category, campaign, keyword,
        spend: agg.spend,
        prevSpend: prevAgg ? prevAgg.spend : null,
        roas: agg.roas > 0 ? agg.roas : null,
        cpc: agg.cpc > 0 ? agg.cpc : null,
        cvr: agg.cvr > 0 ? agg.cvr : null,
        prevRoas: prevAgg && prevAgg.roas > 0 ? prevAgg.roas : null,
        roasChange: (agg.roas > 0 && prevAgg && prevAgg.roas > 0) ? calcPctChange(agg.roas, prevAgg.roas) : null,
        cpcChange: (agg.cpc > 0 && prevAgg && prevAgg.cpc > 0) ? calcPctChange(agg.cpc, prevAgg.cpc) : null,
        cvrChange: (agg.cvr > 0 && prevAgg && prevAgg.cvr > 0) ? calcPctChange(agg.cvr, prevAgg.cvr) : null,
      });
    }

    for (const row of table) {
      row.pctOfCat = catTotals[row.category] > 0 ? (row.spend / catTotals[row.category]) * 100 : 0;
    }
    table.sort((a, b) => {
      const cd = (catTotals[b.category]||0)-(catTotals[a.category]||0);
      if (cd !== 0) return cd;
      const ckA = a.category + '|||' + a.campaign;
      const ckB = b.category + '|||' + b.campaign;
      const campD = (campTotals[ckB]||0)-(campTotals[ckA]||0);
      if (campD !== 0) return campD;
      return b.spend - a.spend;
    });

    const campAggs = {};
    const campPrevAggs = {};
    for (const [k, g] of Object.entries(currGroups)) {
      const parts = k.split('|||');
      const ck = parts[0] + '|||' + parts[1];
      if (!campAggs[ck]) campAggs[ck] = { category: parts[0], campaign: parts[1], rows: [] };
      campAggs[ck].rows.push(...g.rows);
    }
    for (const [k, g] of Object.entries(prevGroups)) {
      const parts = k.split('|||');
      const ck = parts[0] + '|||' + parts[1];
      if (!campPrevAggs[ck]) campPrevAggs[ck] = { rows: [] };
      campPrevAggs[ck].rows.push(...g.rows);
    }

    const insights = [];
    for (const [ck, cd] of Object.entries(campAggs)) {
      const parts = ck.split('|||');
      const category = parts[0], campaign = parts[1];
      const curr = aggregateRows(cd.rows);
      const prevData = campPrevAggs[ck];
      const prev = prevData ? aggregateRows(prevData.rows) : null;
      if (!prev || !prev.roas || prev.roas <= 0 || curr.roas <= 0) continue;
      const roasChg = calcPctChange(curr.roas, prev.roas);
      if (roasChg >= 0) continue;
      const cpcChg = (prev.cpc > 0 && curr.cpc > 0) ? calcPctChange(curr.cpc, prev.cpc) : null;
      const cvrChg = (prev.cvr > 0 && curr.cvr > 0) ? calcPctChange(curr.cvr, prev.cvr) : null;
      const spendChg = calcPctChange(curr.spend, prev.spend);
      const campKws = table.filter(r => r.category === category && r.campaign === campaign);
      const { reason, action, topKeywords } = buildInsightText(curr, prev, campKws);
      insights.push({ category, campaign, spend: curr.spend, prevSpend: prev.spend, spendChange: spendChg, roas: curr.roas, prevRoas: prev.roas, roasChange: roasChg, cpc: curr.cpc, prevCpc: prev.cpc, cpcChange: cpcChg, cvr: curr.cvr, prevCvr: prev.cvr, cvrChange: cvrChg, reason, action, topKeywords });
    }
    insights.sort((a, b) => b.spend - a.spend);

    const strategicSuggestions = [];
    const adpropGroups = {};
    for (const row of currRows) {
      const cat = row['Category'] || '\u26a0\ufe0f No Category';
      const adProp = row['AD_PROPERTY'] || 'Unknown';
      const k = cat + '|||' + adProp;
      if (!adpropGroups[k]) adpropGroups[k] = { category: cat, adProperty: adProp, rows: [] };
      adpropGroups[k].rows.push(row);
    }
    const catAdProps = {};
    for (const [, g] of Object.entries(adpropGroups)) {
      const agg = aggregateRows(g.rows);
      if (agg.spend < 1000 || agg.roas <= 0) continue;
      if (!catAdProps[g.category]) catAdProps[g.category] = [];
      catAdProps[g.category].push({ adProperty: g.adProperty, roas: agg.roas, spend: agg.spend });
    }
    for (const [cat, props] of Object.entries(catAdProps)) {
      if (props.length < 2) continue;
      const sorted = props.sort((a, b) => b.roas - a.roas);
      const best = sorted[0], worst = sorted[sorted.length - 1];
      if (best.roas > worst.roas * 1.25) {
        strategicSuggestions.push({ type: 'ad_property_winner', category: cat, priority: 'medium', title: 'Shift budget to ' + best.adProperty + ' in ' + cat, detail: best.adProperty + ' delivers ' + best.roas.toFixed(2) + 'x ROAS vs ' + worst.roas.toFixed(2) + 'x for ' + worst.adProperty + '. Reallocate spend from ' + worst.adProperty + ' (' + fmtS(worst.spend) + ') to ' + best.adProperty + ' (' + fmtS(best.spend) + ').' });
      }
    }
    const allCampAggs = Object.entries(campAggs).map(([, cd]) => {
      const agg = aggregateRows(cd.rows);
      return { campaign: cd.campaign, category: cd.category, ...agg };
    }).filter(c => c.spend > 0);
    if (allCampAggs.length > 1) {
      const avgSpend = allCampAggs.reduce((s, c) => s + c.spend, 0) / allCampAggs.length;
      const validCvr = allCampAggs.filter(c => c.cvr > 0);
      const avgCvr = validCvr.length ? validCvr.reduce((s, c) => s + c.cvr, 0) / validCvr.length : 0;
      for (const camp of allCampAggs) {
        if (camp.cvr > avgCvr * 1.5 && camp.spend < avgSpend * 0.6 && camp.roas > 2) {
          strategicSuggestions.push({ type: 'scale_opportunity', category: camp.category, campaign: camp.campaign, priority: 'high', title: 'Scale up: ' + camp.campaign, detail: 'CVR of ' + camp.cvr.toFixed(1) + '% is ' + ((camp.cvr/avgCvr-1)*100).toFixed(0) + '% above average with ' + camp.roas.toFixed(2) + 'x ROAS, but only ' + fmtS(camp.spend) + ' spent. Increase budget to capture more conversions.' });
        }
      }
      for (const camp of allCampAggs) {
        if (camp.spend > avgSpend * 1.5 && camp.roas > 0 && camp.roas < 1.5) {
          strategicSuggestions.push({ type: 'budget_waste', category: camp.category, campaign: camp.campaign, priority: 'high', title: 'Reduce budget: ' + camp.campaign, detail: 'Spending ' + fmtS(camp.spend) + ' (' + ((camp.spend/avgSpend-1)*100).toFixed(0) + '% above avg) at only ' + camp.roas.toFixed(2) + 'x ROAS. Cut budget by 30-50% or pause until keywords are optimised.' });
        }
      }
      for (const [ck, cd] of Object.entries(campAggs)) {
        const curr = aggregateRows(cd.rows);
        const prevData = campPrevAggs[ck];
        if (!prevData || curr.spend < 500) continue;
        const prev = aggregateRows(prevData.rows);
        if (prev.cpc <= 0 || curr.cpc <= 0) continue;
        const cpcChg = calcPctChange(curr.cpc, prev.cpc);
        const roasChg = (curr.roas > 0 && prev.roas > 0) ? calcPctChange(curr.roas, prev.roas) : null;
        if (cpcChg > 20 && (roasChg === null || roasChg < 5)) {
          strategicSuggestions.push({ type: 'efficiency_decline', category: cd.category, campaign: cd.campaign, priority: 'medium', title: 'CPC efficiency declining: ' + cd.campaign, detail: 'CPC rose ' + cpcChg.toFixed(0) + '% to \u20b9' + curr.cpc.toFixed(0) + ' while ROAS ' + (roasChg !== null ? (roasChg > 0 ? 'only improved ' + roasChg.toFixed(0) + '%' : 'fell ' + Math.abs(roasChg).toFixed(0) + '%') : 'is flat') + '. Review keyword match types and reduce bids on non-converting terms.' });
        }
      }
    }
    strategicSuggestions.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority]||1) - ({ high: 0, medium: 1, low: 2 }[b.priority]||1));

    const availableMonths = Object.entries(SHEETS).sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ key: k, label: v.label }));
    const result = {
      monthLabel: sheet.label, monthKey: key, prevMonthLabel: prevSheet ? prevSheet.label : null,
      currDays: daysElapsed(sheet.year, sheet.month),
      prevDays: prevSheet ? daysInMonth(prevSheet.year, prevSheet.month) : null,
      data: table, insights, strategicSuggestions, availableMonths
    };
    setCached(cacheKey, result);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=86400' } });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

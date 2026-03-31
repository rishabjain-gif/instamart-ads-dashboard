import { SHEETS, getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV, aggregateRows, calcPctChange } from '@/lib/dataUtils';
export const dynamic = 'force-dynamic';

async function fetchSheet(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}

function groupByKeyword(rows) {
  const groups = {};
  const kwRows = rows.filter(r => r['AD_PROPERTY'] === 'Keyword Based Ads');
  for (const row of kwRows) {
    const cat = row['category'] || row['Category'] || row['L1_CATEGORY'] || 'Unknown';
    const campaign = row['CAMPAIGN_NAME'] || 'Unknown';
    const keyword = row['KEYWORD'] || 'Unknown';
    const k = cat + '|||' + campaign + '|||' + keyword;
    if (!groups[k]) groups[k] = { category: cat, campaign, keyword, rows: [] };
    groups[k].rows.push(row);
  }
  return groups;
}

function buildInsightText(roasChg, cpcChg, cvrChg, spendChg) {
  const reasons = [];
  const actions = [];
  if (cpcChg !== null && cpcChg > 10) {
    reasons.push('CPC rose ' + cpcChg.toFixed(0) + '%');
    actions.push('review high-CPC keywords and consider tightening match types or reducing bids');
  }
  if (cvrChg !== null && cvrChg < -10) {
    reasons.push('CVR dropped ' + Math.abs(cvrChg).toFixed(0) + '%');
    actions.push('check product page quality, pricing and stock availability');
  }
  if (spendChg > 20 && cpcChg !== null && cpcChg > 0) {
    reasons.push('spend scaled ' + spendChg.toFixed(0) + '%');
    actions.push('reduce budget on keywords with ROAS below target before scaling further');
  }
  if (reasons.length === 0) {
    actions.push('audit individual keyword ROAS below and pause under-performers');
  }
  return {
    reason: reasons.length ? reasons.join(', ') : 'general ROAS decline',
    action: actions.join('; '),
  };
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

    const [currRows, prevRows] = await Promise.all([
      fetchSheet(sheet.url),
      prevSheet ? fetchSheet(prevSheet.url) : Promise.resolve([]),
    ]);

    const currGroups = groupByKeyword(currRows);
    const prevGroups = prevRows.length ? groupByKeyword(prevRows) : {};

    const catTotals = {};
    const campTotals = {};
    const table = [];

    for (const [k, g] of Object.entries(currGroups)) {
      const agg = aggregateRows(g.rows);
      const parts = k.split('|||');
      const category = parts[0], campaign = parts[1], keyword = parts[2];
      catTotals[category] = (catTotals[category] || 0) + agg.spend;
      const ck = category + '|||' + campaign;
      campTotals[ck] = (campTotals[ck] || 0) + agg.spend;
      const prevAgg = prevGroups[k] ? aggregateRows(prevGroups[k].rows) : null;
      table.push({
        category, campaign, keyword,
        spend: agg.spend,
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
      const cd = (catTotals[b.category] || 0) - (catTotals[a.category] || 0);
      if (cd !== 0) return cd;
      const ckA = a.category + '|||' + a.campaign;
      const ckB = b.category + '|||' + b.campaign;
      const campD = (campTotals[ckB] || 0) - (campTotals[ckA] || 0);
      if (campD !== 0) return campD;
      return b.spend - a.spend;
    });

    const campAggs = {};
    const campPrevAggs = {};
    for (const [k, g] of Object.entries(currGroups)) {
      const parts = k.split('|||');
      const category = parts[0], campaign = parts[1];
      const ck = category + '|||' + campaign;
      if (!campAggs[ck]) campAggs[ck] = { category, campaign, rows: [] };
      campAggs[ck].rows.push(...g.rows);
    }
    for (const [k, g] of Object.entries(prevGroups)) {
      const parts = k.split('|||');
      const category = parts[0], campaign = parts[1];
      const ck = category + '|||' + campaign;
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
      const { reason, action } = buildInsightText(roasChg, cpcChg, cvrChg, spendChg);
      insights.push({
        category, campaign,
        spend: curr.spend, prevSpend: prev.spend, spendChange: spendChg,
        roas: curr.roas, prevRoas: prev.roas, roasChange: roasChg,
        cpc: curr.cpc, prevCpc: prev.cpc, cpcChange: cpcChg,
        cvr: curr.cvr, prevCvr: prev.cvr, cvrChange: cvrChg,
        reason, action,
      });
    }
    insights.sort((a, b) => b.spend - a.spend);

    const availableMonths = Object.entries(SHEETS)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => ({ key: k, label: v.label }));

    return Response.json({
      monthLabel: sheet.label,
      monthKey: key,
      prevMonthLabel: prevSheet ? prevSheet.label : null,
      data: table,
      insights,
      availableMonths,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

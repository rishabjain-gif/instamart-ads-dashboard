import { SHEETS } from '@/lib/config';
import { ZEPTO_SHEETS } from '@/lib/zeptoConfig';
import { parseCSV, aggregateRows, aggregateZeptoRows, parseDate, parseZeptoDate } from '@/lib/dataUtils';

export const revalidate = 300;

const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now() - e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

const CHANGELOG_URL = 'https://docs.google.com/spreadsheets/d/12HEyWZbuNhRDVQ3mjO_7r6UpUR-bCZ6bOeCpkzog7bw/export?format=csv&gid=0';

async function fetchSheet(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
  return parseCSV(await resp.text());
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function inWindow(date, start, end) {
  const d = startOfDay(date);
  return d >= start && d <= end;
}

export async function GET() {
  try {
    const today = startOfDay(new Date());
    const cacheKey = 'changelog_' + today.toISOString().slice(0, 10);
    const cached = getCached(cacheKey);
    if (cached) return Response.json(cached);

    const imKeys = Object.keys(SHEETS).sort().slice(-2);
    const zpKeys = Object.keys(ZEPTO_SHEETS).sort().slice(-2);

    const fetches = [
      fetchSheet(CHANGELOG_URL),
      ...imKeys.map(k => fetchSheet(SHEETS[k].url)),
      ...zpKeys.map(k => fetchSheet(ZEPTO_SHEETS[k].url)),
    ];

    const [changelogRows, ...sheetChunks] = await Promise.all(fetches);

    const imRows = sheetChunks.slice(0, imKeys.length).flat();
    const zpRows = sheetChunks.slice(imKeys.length).flat();

    const changes = [];

    for (const entry of changelogRows) {
      const campaignId = (entry['Campaign ID'] || '').trim();
      const dateStr = (entry['Date of change'] || '').trim();
      const campaignName = (entry['Campaign name'] || '').trim();
      const changeDone = (entry['Change done'] || '').trim();
      const current = (entry['Current'] || '').trim();
      const whatChange = (entry['What change'] || '').trim();
      const platform = (entry['Platform'] || '').trim();

      if (!campaignId || !dateStr) continue;

      const changeDate = parseZeptoDate(dateStr);
      if (!changeDate) continue;

      const beforeStart = startOfDay(addDays(changeDate, -7));
      const beforeEnd = startOfDay(addDays(changeDate, -1));
      const afterStart = startOfDay(changeDate);
      const afterEnd = startOfDay(addDays(changeDate, 6));
      const effectiveAfterEnd = afterEnd <= today ? afterEnd : today;

      const daysAfter = effectiveAfterEnd >= afterStart
        ? Math.round((effectiveAfterEnd - afterStart) / 86400000) + 1
        : 0;

      let beforeAgg = null;
      let afterAgg = null;

      if (platform.toLowerCase() === 'zepto') {
        const campRows = zpRows.filter(r => (r['Campaign_id'] || '').trim() === campaignId);
        const beforeRows = campRows.filter(r => {
          const d = parseZeptoDate(r['Date']);
          return d && inWindow(d, beforeStart, beforeEnd);
        });
        const afterRows = campRows.filter(r => {
          const d = parseZeptoDate(r['Date']);
          return d && inWindow(d, afterStart, effectiveAfterEnd);
        });
        if (beforeRows.length) beforeAgg = aggregateZeptoRows(beforeRows);
        if (afterRows.length) afterAgg = aggregateZeptoRows(afterRows);
      } else {
        const campRows = imRows.filter(r => (r['CAMPAIGN_ID'] || '').trim() === campaignId);
        const beforeRows = campRows.filter(r => {
          const d = parseDate(r['METRICS_DATE']);
          return d && inWindow(d, beforeStart, beforeEnd);
        });
        const afterRows = campRows.filter(r => {
          const d = parseDate(r['METRICS_DATE']);
          return d && inWindow(d, afterStart, effectiveAfterEnd);
        });
        if (beforeRows.length) beforeAgg = aggregateRows(beforeRows);
        if (afterRows.length) afterAgg = aggregateRows(afterRows);
      }

      changes.push({
        campaignId, campaignName, platform, date: dateStr,
        changeDone, current, whatChange,
        before: beforeAgg, after: afterAgg,
        daysAfter, complete: daysAfter >= 7,
      });
    }

    changes.sort((a, b) => {
      const da = parseZeptoDate(a.date);
      const db = parseZeptoDate(b.date);
      if (!da || !db) return 0;
      return db - da;
    });

    const result = { changes };
    setCached(cacheKey, result);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

import { getCurrentAndPreviousMonths } from '@/lib/config';
import { parseCSV } from '@/lib/dataUtils';

export const revalidate = 300;

const _cache = {};
function getCached(k) { const e = _cache[k]; return (e && Date.now()-e.ts < 300000) ? e.data : null; }
function setCached(k, d) { _cache[k] = { data: d, ts: Date.now() }; }

async function fetchSheet(url) {
    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status);
    return parseCSV(await resp.text());
  }

function parseIMDate(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    const parsed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

function dateKey(d) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  }

function fmtDate(dk) {
    const [, m, d] = dk.split('-');
    return `${d}/${m}`;
  }

export async function GET() {
    try {
          const { current, previous } = getCurrentAndPreviousMonths();
          const cacheKey = 'daily_' + current.key + '_' + (previous ? previous.key : 'none');
          const cached = getCached(cacheKey);
          if (cached) return Response.json(cached);

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const windowStart = new Date(today);
          windowStart.setDate(windowStart.getDate() - 20);

          const [currentRows, prevRows] = await Promise.all([
                  fetchSheet(current.url),
                  previous ? fetchSheet(previous.url) : Promise.resolve([]),
                ]);

          const allRows = [...currentRows, ...prevRows];
          const campaigns = {};

          for (const row of allRows) {
                  const campaign = row['CAMPAIGN_NAME'] || 'Unknown';
                  const dateStr = row['Date'] || row['date'];
                  if (!dateStr) continue;
                  const date = parseIMDate(dateStr);
                  if (!date || date < windowStart || date > today) continue;
                  const dk = dateKey(date);
                  const spend = parseFloat(row['TOTAL_BUDGET_BURNT']) || 0;
                  if (!campaigns[campaign]) campaigns[campaign] = {};
                  campaigns[campaign][dk] = (campaigns[campaign][dk] || 0) + spend;
                }

          const all20 = [];
          for (let i = 19; i >= 0; i--) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  all20.push(dateKey(d));
                }
          const last14 = all20.slice(6);

          const result = [];
          for (const [campaign, dateMap] of Object.entries(campaigns)) {
                  const totalSpend = last14.reduce((s, dk) => s + (dateMap[dk] || 0), 0);
                  if (totalSpend === 0) continue;

                  const dailyData = [];
                  let hasAlert = false;

                  for (const dk of last14) {
                            const spend = dateMap[dk] || 0;
                            const idx = all20.indexOf(dk);
                            const prevSlice = all20.slice(Math.max(0, idx - 7), idx);
                            const validPrev = prevSlice.filter(d => (dateMap[d] || 0) > 0);
                            const rollingAvg = validPrev.length >= 3
                              ? validPrev.reduce((s, d) => s + (dateMap[d] || 0), 0) / validPrev.length
                              : null;
                            const dropPct = (rollingAvg && rollingAvg > 0 && spend < rollingAvg * 0.9)
                              ? ((spend - rollingAvg) / rollingAvg) * 100 : null;
                            if (dropPct !== null) hasAlert = true;
                            dailyData.push({ date: dk, label: fmtDate(dk), spend, rollingAvg, dropPct });
                          }

                  result.push({ campaign, totalSpend, dailyData, hasAlert });
                }

          result.sort((a, b) => b.totalSpend - a.totalSpend);

          const out = {
                  dates: last14,
                  dateLabels: last14.map(fmtDate),
                  campaigns: result.slice(0, 20),
                };
          setCached(cacheKey, out);
          return new Response(JSON.stringify(out), {
                  headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=86400' }
                });
        } catch (err) {
          console.error(err);
          return Response.json({ error: err.message }, { status: 500 });
        }
  }

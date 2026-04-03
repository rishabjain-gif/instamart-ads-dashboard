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
    const s = str.trim();
    const sep = s.includes('/') ? '/' : '-';
    const parts = s.split(sep);
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
                  const dateStr = row['METRICS_DATE'];
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
            // Build per-day display data for the 14-day window
            const dailyData = last14.map(dk => ({
              date: dk,
              label: fmtDate(dk),
              spend: dateMap[dk] !== undefined ? dateMap[dk] : null,
            }));

            // Only count days that actually have data
            const daysWithData = last14.filter(dk => dateMap[dk] !== undefined);
            if (daysWithData.length === 0) continue;

            const totalSpend = daysWithData.reduce((s, dk) => s + dateMap[dk], 0);
            if (totalSpend === 0) continue;

            // 14-day avg based on actual data days present
            const avg14 = totalSpend / daysWithData.length;

            // Last 4 days with data (most recent first, then reversed)
            const last4WithData = daysWithData.slice(-4);
            const avg4 = last4WithData.reduce((s, dk) => s + dateMap[dk], 0) / last4WithData.length;

            // Alert: avg of last 4 data-days dropped vs avg of all data-days in window
            const hasAlert = avg14 > 0 && avg4 < avg14 * 0.9;
            const alertInfo = hasAlert ? {
              avg4,
              avg14,
              dropPct: ((avg4 - avg14) / avg14) * 100,
              daysUsed4: last4WithData.length,
              daysUsed14: daysWithData.length,
            } : null;

            result.push({ campaign, totalSpend, dailyData, hasAlert, alertInfo });
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

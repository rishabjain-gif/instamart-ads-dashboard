'use client';
import { useEffect, useState, Fragment } from 'react';

function fmtSpend(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '₹0';
  if (n >= 10000000) return '₹' + (n/10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

function ChangeCell({ value, invert = false }) {
  if (value === null || value === undefined) return <td className="px-2 py-2 text-center text-gray-400 text-xs">—</td>;
  const isPositive = invert ? value < 0 : value > 0;
  const color = isPositive ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50';
  const arrow = value > 0 ? '▲' : '▼';
  return <td className={'px-2 py-2 text-center text-xs font-medium ' + color}>{arrow} {Math.abs(value).toFixed(1)}%</td>;
}

function RoasCell({ value }) {
  if (value === null || value === undefined || value === 0) return <td className="px-2 py-2 text-center text-gray-400 text-xs">—</td>;
  return <td className="px-2 py-2 text-center text-xs text-gray-700">{value.toFixed(2)}x</td>;
}

function avgSpendChange(spend, prevSpend, currDays, prevDays) {
  if (!spend || !prevSpend || !currDays || !prevDays) return null;
  const curr = spend / currDays;
  const prev = prevSpend / prevDays;
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export default function KeywordAnalysis({ platform = 'instamart' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedCats, setExpandedCats] = useState({});
  const [expandedCamps, setExpandedCamps] = useState({});
  const [search, setSearch] = useState('');

  function loadData(month) {
    setLoading(true);
    setError(null);
    fetch((platform === 'zepto' ? '/api/zepto/keywords' : '/api/keywords') + (month ? '?month=' + month : ''))
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
        if (!selectedMonth && d.monthKey) setSelectedMonth(d.monthKey);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { loadData(''); }, []);

  const toggleCat = cat => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleCamp = key => setExpandedCamps(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading keyword data…</p>
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!data) return null;

  const hasPrev = !!data.prevMonthLabel;
  const currDays = data.currDays || null;
  const prevDays = data.prevDays || null;

  const searchLower = search.toLowerCase();
  const filtered = searchLower
    ? data.data.filter(r =>
        r.keyword.toLowerCase().includes(searchLower) ||
        r.campaign.toLowerCase().includes(searchLower) ||
        r.category.toLowerCase().includes(searchLower)
      )
    : data.data;

  const byCategory = {};
  for (const row of filtered) {
    if (!byCategory[row.category]) byCategory[row.category] = {};
    if (!byCategory[row.category][row.campaign]) byCategory[row.category][row.campaign] = [];
    byCategory[row.category][row.campaign].push(row);
  }
  const categories = Object.keys(byCategory);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        {hasPrev && (
          <div className="text-sm text-gray-500">
            Comparing <span className="font-semibold text-gray-700">{data.prevMonthLabel}</span>{prevDays ? ` (${prevDays} days)` : ''}
            {' '}vs{' '}
            <span className="font-semibold text-gray-700">{data.monthLabel} MTD</span>{currDays ? ` (${currDays} days elapsed)` : ''}
          </div>
        )}
        <div>
          <label className="text-sm text-gray-600 mr-2 font-medium">Month:</label>
          <select className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); loadData(e.target.value); }}>
            {(data.availableMonths || []).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <input type="text" placeholder="Search keyword / campaign…"
            className="text-sm border border-gray-300 rounded px-3 py-1 w-64 bg-white"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-xs text-gray-400 ml-auto">Keyword Based Ads only • Click to expand/collapse</div>
      </div>

      <div className="overflow-auto max-h-[70vh] rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-800 text-white">
              <th className="px-4 py-3 text-left font-semibold w-72">Category / Campaign / Keyword</th>
              <th className="px-3 py-3 text-right font-semibold">Prev Month Spend</th>
              <th className="px-3 py-3 text-right font-semibold text-xs">Prev Avg Daily</th>
              <th className="px-3 py-3 text-right font-semibold">Spend (MTD)</th>
              <th className="px-3 py-3 text-right font-semibold text-xs">MTD Avg Daily</th>
              <th className="px-3 py-3 text-center font-semibold">Avg Daily Spend Δ%<br/><span className="font-normal text-gray-400 text-xs">(vs prev month)</span></th>
              <th className="px-3 py-3 text-center font-semibold">Prev ROAS</th>
              <th className="px-3 py-3 text-center font-semibold">MTD ROAS</th>
              <th className="px-3 py-3 text-center font-semibold">ROAS Δ%</th>
              <th className="px-3 py-3 text-center font-semibold">CPC Δ%<br/><span className="font-normal text-gray-400 text-xs">(↑ bad)</span></th>
              <th className="px-3 py-3 text-center font-semibold">CVR Δ%<br/><span className="font-normal text-gray-400 text-xs">(↓ bad)</span></th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const campaigns = byCategory[cat];
              const campNames = Object.keys(campaigns);
              const catSpend = campNames.reduce((s, c) => s + campaigns[c].reduce((ss, r) => ss + (r.spend || 0), 0), 0);
              const catPrevSpend = campNames.reduce((s, c) => s + campaigns[c].reduce((ss, r) => ss + (r.prevSpend || 0), 0), 0);
              const catSpendChange = avgSpendChange(catSpend, catPrevSpend, currDays, prevDays);
              const isCatExp = expandedCats[cat] !== false;

              return (
                <Fragment key={cat}>
                  <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleCat(cat)}>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">
                      <span className="text-gray-400 text-xs mr-2">{isCatExp ? '▼' : '▶'}</span>{cat}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-500">{catPrevSpend > 0 ? fmtSpend(catPrevSpend) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{catPrevSpend > 0 && prevDays ? fmtSpend(catPrevSpend / prevDays) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{fmtSpend(catSpend)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{catSpend > 0 && currDays ? fmtSpend(catSpend / currDays) : '—'}</td>
                    {catSpendChange !== null
                      ? <td className={'px-3 py-2.5 text-center text-sm font-semibold ' + (catSpendChange > 0 ? 'text-green-700' : 'text-red-700')}>{catSpendChange > 0 ? '▲' : '▼'} {Math.abs(catSpendChange).toFixed(1)}%</td>
                      : <td className="px-3 py-2.5 text-center text-gray-400">—</td>
                    }
                    <td colSpan={5} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">{campNames.length} campaign{campNames.length !== 1 ? 's' : ''}</td>
                  </tr>
                  {isCatExp && campNames.map(campaign => {
                    const kwRows = campaigns[campaign];
                    const campSpend = kwRows.reduce((s, r) => s + (r.spend || 0), 0);
                    const campPrevSpend = kwRows.reduce((s, r) => s + (r.prevSpend || 0), 0);
                    const campSpendChange = avgSpendChange(campSpend, campPrevSpend, currDays, prevDays);
          const campCurrGMV = kwRows.reduce((s, r) => s + (r.roas || 0) * (r.spend || 0), 0);
          const campPrevGMV = kwRows.reduce((s, r) => s + (r.prevRoas || 0) * (r.prevSpend || 0), 0);
          const campCurrRoas = campSpend > 0 ? campCurrGMV / campSpend : null;
          const campPrevRoasVal = campPrevSpend > 0 ? campPrevGMV / campPrevSpend : null;
          const campRoasChange = campCurrRoas && campPrevRoasVal ? ((campCurrRoas - campPrevRoasVal) / Math.abs(campPrevRoasVal)) * 100 : null;
                    const campKey = cat + '|||' + campaign;
                    const isCampExp = expandedCamps[campKey] !== false;
                    const campInsight = data.insights ? data.insights.find(i => i.category === cat && i.campaign === campaign) : null;

                    return (
                      <Fragment key={campKey}>
                        <tr className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleCamp(campKey)}>
                          <td className="px-4 py-2 pl-8 font-semibold text-gray-700">
                            <span className="text-gray-400 text-xs mr-2">{isCampExp ? '▼' : '▶'}</span>
                            {campaign}
                            {campInsight && (
                              <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                ⚠ ROAS ↓{Math.abs(campInsight.roasChange).toFixed(0)}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-500 text-sm">{campPrevSpend > 0 ? fmtSpend(campPrevSpend) : '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-400 text-xs">{campPrevSpend > 0 && prevDays ? fmtSpend(campPrevSpend / prevDays) : '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-700 text-sm">{fmtSpend(campSpend)}</td>
                          <td className="px-3 py-2 text-right text-gray-600 text-xs">{campSpend > 0 && currDays ? fmtSpend(campSpend / currDays) : '—'}</td>
                          {campSpendChange !== null
                            ? <td className={'px-3 py-2 text-center text-xs font-semibold ' + (campSpendChange > 0 ? 'text-green-700' : 'text-red-700')}>{campSpendChange > 0 ? '▲' : '▼'} {Math.abs(campSpendChange).toFixed(1)}%</td>
                            : <td className="px-3 py-2 text-center text-gray-400 text-xs">—</td>
                          }
                          <td className="px-3 py-2 text-center text-gray-500 text-xs">{campPrevRoasVal ? campPrevRoasVal.toFixed(2) + 'x' : '—'}</td>
                <td className="px-3 py-2 text-center text-gray-700 text-xs font-semibold">{campCurrRoas ? campCurrRoas.toFixed(2) + 'x' : '—'}</td>
                {campRoasChange !== null ? <td className={'px-3 py-2 text-center text-xs font-semibold ' + (campRoasChange > 0 ? 'text-green-700' : 'text-red-700')}>{campRoasChange > 0 ? '▲' : '▼'} {Math.abs(campRoasChange).toFixed(1)}%</td> : <td className="px-3 py-2 text-center text-gray-400 text-xs">—</td>}
                <td colSpan={2} className="px-3 py-2 text-center text-gray-400 text-xs italic">{kwRows.length} kw</td>
                        </tr>
                        {isCampExp && kwRows.map((row, idx) => {
                          const rowSpendChange = avgSpendChange(row.spend, row.prevSpend, currDays, prevDays);
                          return (
                            <tr key={campKey + '-' + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2 pl-14 text-gray-600 text-xs"><span className="text-gray-300 mr-2">└</span>{row.keyword}{((row.spend === 0 && row.prevSpend > 0) || (row.recentSpend === 0 && row.spend > 0)) && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-xs bg-gray-200 text-gray-500 rounded-full font-medium">⏸ Paused</span>}</td>
                              <td className="px-3 py-2 text-right text-gray-500 text-xs">{row.prevSpend ? fmtSpend(row.prevSpend) : '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-400 text-xs">{row.prevSpend && prevDays ? fmtSpend(row.prevSpend / prevDays) : '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-700 text-xs">{fmtSpend(row.spend)}</td>
                              <td className="px-3 py-2 text-right text-gray-600 text-xs">{row.spend && currDays ? fmtSpend(row.spend / currDays) : '—'}</td>
                              <ChangeCell value={rowSpendChange} />
                              <RoasCell value={row.prevRoas} />
                              <RoasCell value={row.roas} />
                              <ChangeCell value={row.roasChange} />
                              <ChangeCell value={row.cpcChange} invert={true} />
                              <ChangeCell value={row.cvrChange} />
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Avg Daily = Total Spend / Days available • Avg Daily Spend Δ% = (MTD daily avg − Prev month daily avg) / Prev month daily avg • ROAS = 7-day GMV / Spend • CPC Δ% red = cost up (bad) • CVR Δ% red = conversions dropped (bad)
        {hasPrev && (' • Δ% vs ' + data.prevMonthLabel)}
      </p>
    </div>
  );
}

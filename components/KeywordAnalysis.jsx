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

function DeltaCell({ value, inverse }) {
  if (value === null || value === undefined) {
    return <td className="px-2 py-2 text-center text-gray-400 text-xs">&mdash;</td>;
  }
  const isGood = inverse ? value < 0 : value > 0;
  const isBad = inverse ? value > 0 : value < 0;
  const color = isGood ? 'text-green-600' : isBad ? 'text-red-600' : 'text-gray-500';
  const bg = Math.abs(value) > 5 ? (isGood ? 'bg-green-50' : isBad ? 'bg-red-50' : '') : '';
  const arrow = value > 0.5 ? '▲' : value < -0.5 ? '▼' : '';
  return (
    <td className={'px-2 py-2 text-center text-xs font-medium ' + color + ' ' + bg}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </td>
  );
}

function InsightCard({ ins, prevMonthLabel }) {
  const severity = ins.roasChange < -25 ? 'red' : 'orange';
  const borderColor = severity === 'red' ? 'border-red-200' : 'border-orange-200';
  const badgeBg = severity === 'red' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700';
  const prevLabel = prevMonthLabel ? prevMonthLabel.split(' ')[0] : 'Prev';
  return (
    <div className={'border ' + borderColor + ' rounded-lg p-4 bg-white shadow-sm'}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">{ins.category}</span>
            <span className="font-semibold text-gray-800 text-sm">{ins.campaign}</span>
          </div>
          <div className="text-xs text-gray-500 mb-2">
            Spend: <span className="font-medium text-gray-700">{fmtSpend(ins.spend)}</span>
            {ins.spendChange !== null && (
              <span className={'ml-1.5 ' + (ins.spendChange > 0 ? 'text-gray-600' : 'text-gray-500')}>
                ({ins.spendChange > 0 ? '+' : ''}{ins.spendChange.toFixed(0)}% vs {prevMonthLabel})
              </span>
            )}
          </div>
          <div className="flex gap-2 mb-2 flex-wrap">
            {ins.cpcChange !== null && (
              <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (ins.cpcChange > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                CPC {ins.cpcChange > 0 ? '▲' : '▼'} {Math.abs(ins.cpcChange).toFixed(0)}%
              </span>
            )}
            {ins.cvrChange !== null && (
              <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (ins.cvrChange < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                CVR {ins.cvrChange > 0 ? '▲' : '▼'} {Math.abs(ins.cvrChange).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">
            <span className="font-semibold text-gray-700">Why: </span>{ins.reason}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            <span className="font-semibold text-gray-700">Action: </span>{ins.action}
          </p>
        </div>
        <div className="flex gap-3 items-center shrink-0">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-0.5">{prevLabel} ROAS</div>
            <div className="text-sm font-medium text-gray-500">{ins.prevRoas.toFixed(2)}x</div>
          </div>
          <div className="text-gray-400 text-xs">→</div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-0.5">Now ROAS</div>
            <div className="text-sm font-medium text-gray-800">{ins.roas.toFixed(2)}x</div>
          </div>
          <div className={'text-center px-2.5 py-1.5 rounded-lg ' + badgeBg}>
            <div className="text-xs font-medium">ROAS Δ</div>
            <div className="text-sm font-bold">▼{Math.abs(ins.roasChange).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KeywordAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedCats, setExpandedCats] = useState({});
  const [expandedCamps, setExpandedCamps] = useState({});
  const [search, setSearch] = useState('');
  const [showInsights, setShowInsights] = useState(true);

  function loadData(month) {
    setLoading(true);
    setError(null);
    fetch('/api/keywords' + (month ? '?month=' + month : ''))
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

  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleCamp = (key) => setExpandedCamps(prev => ({ ...prev, [key]: !prev[key] }));

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

  const hasPrevMonth = !!data.prevMonthLabel;
  const searchLower = search.toLowerCase();
  const filtered = searchLower
    ? data.data.filter(r =>
        r.keyword.toLowerCase().includes(searchLower) ||
        r.campaign.toLowerCase().includes(searchLower) ||
        r.category.toLowerCase().includes(searchLower))
    : data.data;

  const byCategory = {};
  for (const row of filtered) {
    if (!byCategory[row.category]) byCategory[row.category] = {};
    if (!byCategory[row.category][row.campaign]) byCategory[row.category][row.campaign] = [];
    byCategory[row.category][row.campaign].push(row);
  }
  const categories = Object.keys(byCategory);
  const hasInsights = data.insights && data.insights.length > 0;
  const colCount = 6 + (hasPrevMonth ? 3 : 0);

  return (
    <div>
      {hasInsights && (
        <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div
            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
            onClick={() => setShowInsights(v => !v)}
          >
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 flex-wrap">
              <span>🔴</span>
              <span>Campaigns Needing Attention</span>
              <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">{data.insights.length}</span>
              {hasPrevMonth && (
                <span className="text-xs text-gray-400 font-normal">ROAS down vs {data.prevMonthLabel} • sorted by spend</span>
              )}
            </h2>
            <span className="text-xs text-gray-400 shrink-0">{showInsights ? '▲ collapse' : '▼ expand'}</span>
          </div>
          {showInsights && (
            <div className="p-4 grid grid-cols-1 gap-3 bg-gray-50">
              {data.insights.map((ins, i) => (
                <InsightCard key={i} ins={ins} prevMonthLabel={data.prevMonthLabel} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-sm text-gray-600 mr-2 font-medium">Month:</label>
          <select
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); loadData(e.target.value); }}
          >
            {(data.availableMonths || []).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <input
            type="text"
            placeholder="Search keyword / campaign…"
            className="text-sm border border-gray-300 rounded px-3 py-1 w-64 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-gray-400 ml-auto">Keyword Based Ads only • Click to expand/collapse • Sorted by spend</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-4 py-3 text-left font-semibold w-72">Category / Campaign / Keyword</th>
              <th className="px-3 py-3 text-right font-semibold">Spend</th>
              <th className="px-3 py-3 text-center font-semibold">% of Cat</th>
              <th className="px-3 py-3 text-center font-semibold">ROAS</th>
              {hasPrevMonth && <th className="px-2 py-3 text-center font-semibold text-xs leading-tight">ROAS Δ%</th>}
              <th className="px-3 py-3 text-center font-semibold">CPC (₹)</th>
              {hasPrevMonth && <th className="px-2 py-3 text-center font-semibold text-xs leading-tight text-orange-300">CPC Δ%<br/><span className="font-normal opacity-70">(↑ bad)</span></th>}
              <th className="px-3 py-3 text-center font-semibold">CVR %</th>
              {hasPrevMonth && <th className="px-2 py-3 text-center font-semibold text-xs leading-tight">CVR Δ%<br/><span className="font-normal opacity-70">(↓ bad)</span></th>}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const campaigns = byCategory[cat];
              const campNames = Object.keys(campaigns);
              const catTotalSpend = campNames.reduce((s, c) => s + campaigns[c].reduce((ss, r) => ss + r.spend, 0), 0);
              const isCatExp = expandedCats[cat] !== false;
              return (
                <Fragment key={cat}>
                  <tr className="bg-gray-800 text-white cursor-pointer hover:bg-gray-700" onClick={() => toggleCat(cat)}>
                    <td className="px-4 py-2.5 font-bold">
                      <span className="text-gray-400 text-xs mr-2">{isCatExp ? '▼' : '▶'}</span>{cat}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold">{fmtSpend(catTotalSpend)}</td>
                    <td colSpan={colCount - 2} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">
                      {campNames.length} campaign{campNames.length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                  {isCatExp && campNames.map(campaign => {
                    const kwRows = campaigns[campaign];
                    const campSpend = kwRows.reduce((s, r) => s + r.spend, 0);
                    const campKey = cat + '|||' + campaign;
                    const isCampExp = expandedCamps[campKey] !== false;
                    const campInsight = data.insights ? data.insights.find(i => i.category === cat && i.campaign === campaign) : null;
                    return (
                      <Fragment key={campKey}>
                        <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200" onClick={() => toggleCamp(campKey)}>
                          <td className="px-4 py-2 pl-8 font-semibold text-gray-700">
                            <span className="text-gray-400 text-xs mr-2">{isCampExp ? '▼' : '▶'}</span>
                            {campaign}
                            {campInsight && (
                              <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                ⚠ ROAS ↓{Math.abs(campInsight.roasChange).toFixed(0)}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-700">{fmtSpend(campSpend)}</td>
                          <td colSpan={colCount - 2} className="px-3 py-2 text-center text-gray-400 text-xs italic">
                            {kwRows.length} keyword{kwRows.length !== 1 ? 's' : ''}
                          </td>
                        </tr>
                        {isCampExp && kwRows.map((row, idx) => (
                          <tr key={campKey + '-' + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 pl-14 text-gray-600 text-xs">
                              <span className="text-gray-300 mr-2">└</span>{row.keyword}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700 text-xs">{fmtSpend(row.spend)}</td>
                            <td className="px-3 py-2 text-center text-gray-600 text-xs">{row.pctOfCat > 0 ? row.pctOfCat.toFixed(1) + '%' : '—'}</td>
                            <td className="px-3 py-2 text-center text-gray-700 text-xs">{row.roas ? row.roas.toFixed(2) + 'x' : '—'}</td>
                            {hasPrevMonth && <DeltaCell value={row.roasChange} inverse={false} />}
                            <td className="px-3 py-2 text-center text-gray-700 text-xs">{row.cpc ? '₹' + row.cpc.toFixed(1) : '—'}</td>
                            {hasPrevMonth && <DeltaCell value={row.cpcChange} inverse={true} />}
                            <td className="px-3 py-2 text-center text-gray-700 text-xs">{row.cvr ? row.cvr.toFixed(1) + '%' : '—'}</td>
                            {hasPrevMonth && <DeltaCell value={row.cvrChange} inverse={false} />}
                          </tr>
                        ))}
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
        ROAS = 7-day GMV / Spend • CPC = Spend / Clicks • CVR = Conversions / Clicks • % of Cat = keyword spend as % of total category keyword spend
        {hasPrevMonth && (' • Δ% vs ' + data.prevMonthLabel)}
      </p>
    </div>
  );
}

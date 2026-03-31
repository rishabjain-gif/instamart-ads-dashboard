'use client';
import { useEffect, useState, Fragment } from 'react';

function fmtSpend(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '₹0';
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export default function KeywordAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedCats, setExpandedCats] = useState({});
  const [expandedCamps, setExpandedCamps] = useState({});
  const [search, setSearch] = useState('');

  function loadData(month) {
    setLoading(true); setError(null);
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

  const searchLower = search.toLowerCase();
  const filtered = searchLower
    ? data.data.filter(r => r.keyword.toLowerCase().includes(searchLower) || r.campaign.toLowerCase().includes(searchLower) || r.category.toLowerCase().includes(searchLower))
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
            type="text" placeholder="Search keyword / campaign…"
            className="text-sm border border-gray-300 rounded px-3 py-1 w-64 bg-white"
            value={search} onChange={e => setSearch(e.target.value)}
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
              <th className="px-3 py-3 text-center font-semibold">% of Cat Spend</th>
              <th className="px-3 py-3 text-center font-semibold">ROAS</th>
              <th className="px-3 py-3 text-center font-semibold">CPC (₹)</th>
              <th className="px-3 py-3 text-center font-semibold">CVR %</th>
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
                    <td colSpan={4} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">{campNames.length} campaign{campNames.length !== 1 ? 's' : ''}</td>
                  </tr>
                  {isCatExp && campNames.map(campaign => {
                    const kwRows = campaigns[campaign];
                    const campSpend = kwRows.reduce((s, r) => s + r.spend, 0);
                    const campKey = cat + '|||' + campaign;
                    const isCampExp = expandedCamps[campKey] !== false;
                    return (
                      <Fragment key={campKey}>
                        <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200" onClick={() => toggleCamp(campKey)}>
                          <td className="px-4 py-2 pl-8 font-semibold text-gray-700">
                            <span className="text-gray-400 text-xs mr-2">{isCampExp ? '▼' : '▶'}</span>
                            <span className="truncate">{campaign}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-700">{fmtSpend(campSpend)}</td>
                          <td colSpan={4} className="px-3 py-2 text-center text-gray-400 text-xs italic">{kwRows.length} keyword{kwRows.length !== 1 ? 's' : ''}</td>
                        </tr>
                        {isCampExp && kwRows.map((row, idx) => (
                          <tr key={`${campKey}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 pl-14 text-gray-600 text-xs">
                              <span className="text-gray-300 mr-2">└</span>{row.keyword}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmtSpend(row.spend)}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{row.pctOfCat > 0 ? row.pctOfCat.toFixed(1) + '%' : '—'}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{row.roas ? row.roas.toFixed(2) + 'x' : '—'}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{row.cpc ? '₹' + row.cpc.toFixed(1) : '—'}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{row.cvr ? row.cvr.toFixed(1) + '%' : '—'}</td>
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
      <p className="mt-3 text-xs text-gray-400">ROAS = 7-day GMV / Spend • CPC = Spend / Clicks • CVR = Conversions / Clicks • % of Cat Spend = this keyword’s spend as % of total category keyword spend</p>
    </div>
  );
}
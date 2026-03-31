'use client';
import { useState } from 'react';
import { SHEETS } from '@/lib/config';

function fmtSpend(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function RoasCell({ value }) {
  if (value === null || value === undefined || value === 0)
    return <td className="px-3 py-2 text-center text-gray-400 text-sm">—</td>;
  return <td className="px-3 py-2 text-center text-sm text-gray-800">{value.toFixed(2)}x</td>;
}

function ChangeCell({ value, invert = false }) {
  if (value === null || value === undefined)
    return <td className="px-3 py-2 text-center text-gray-400 text-sm">—</td>;
  const isGood = invert ? value < 0 : value > 0;
  const color = isGood ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50';
  const arrow = value > 0 ? '▲' : '▼';
  return (
    <td className={`px-3 py-2 text-center text-sm font-medium ${color}`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </td>
  );
}

const sheetOptions = Object.entries(SHEETS).map(([key, val]) => ({ key, label: val.label }));

export default function PeriodComparison() {
  const latestKey = Object.keys(SHEETS).sort().at(-1);
  const [month, setMonth] = useState(latestKey);
  const [startA, setStartA] = useState('');
  const [endA, setEndA] = useState('');
  const [startB, setStartB] = useState('');
  const [endB, setEndB] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCats1, setExpandedCats1] = useState({});
  const [expandedCats2, setExpandedCats2] = useState({});

  const handleCompare = async () => {
    if (!startA || !endA || !startB || !endB) {
      setError('Please fill in all date fields.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ month, startA, endA, startB, endB });
      const r = await fetch(`/api/comparison?${params}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setExpandedCats1({});
      setExpandedCats2({});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle1 = (cat) => setExpandedCats1(p => ({ ...p, [cat]: !p[cat] }));
  const toggle2 = (cat) => setExpandedCats2(p => ({ ...p, [cat]: !p[cat] }));

  const byCategory1 = {};
  if (data?.table1) {
    for (const row of data.table1) {
      if (!byCategory1[row.category]) byCategory1[row.category] = [];
      byCategory1[row.category].push(row);
    }
  }

  const byCategory2 = {};
  if (data?.table2) {
    for (const row of data.table2) {
      if (!byCategory2[row.category]) byCategory2[row.category] = {};
      if (!byCategory2[row.category][row.campaign]) byCategory2[row.category][row.campaign] = [];
      byCategory2[row.category][row.campaign].push(row);
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Select Month & Date Ranges</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sheetOptions.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="border border-blue-100 rounded-lg p-3 bg-blue-50">
            <div className="text-xs font-semibold text-blue-700 mb-2">Period A (Base)</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={startA} onChange={e => setStartA(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={endA} onChange={e => setEndA(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="border border-orange-100 rounded-lg p-3 bg-orange-50">
            <div className="text-xs font-semibold text-orange-700 mb-2">Period B (Compare)</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={startB} onChange={e => setStartB(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={endB} onChange={e => setEndB(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleCompare}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Compare Periods'}
          </button>
          {loading && <p className="text-sm text-gray-500">Fetching data… may take 15–20 seconds</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      {data && (
        <>
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Category → Ad Property Breakdown</h3>
            <p className="text-xs text-gray-500 mb-3">
              ROAS Δ% = change from Period A to Period B. Red = deterioration.
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-3 text-left font-semibold w-64">Category / Ad Property</th>
                    <th className="px-3 py-3 text-right font-semibold">Spend A</th>
                    <th className="px-3 py-3 text-center font-semibold">ROAS A</th>
                    <th className="px-3 py-3 text-center font-semibold">ROAS B</th>
                    <th className="px-3 py-3 text-center font-semibold">ROAS Δ%</th>
                    <th className="px-3 py-3 text-center font-semibold">CPC Δ%<br/><span className="font-normal text-gray-400 text-xs">(↑ bad)</span></th>
                    <th className="px-3 py-3 text-center font-semibold">CVR Δ%<br/><span className="font-normal text-gray-400 text-xs">(↓ bad)</span></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(byCategory1).map((cat, catIdx) => {
                    const rows = byCategory1[cat];
                    const isExpanded = expandedCats1[cat] !== false;
                    const catSpend = rows.reduce((s, r) => s + r.spendA, 0);
                    return (
                      <>
                        <tr key={`t1-cat-${cat}`} className="bg-gray-100 cursor-pointer hover:bg-gray-200" onClick={() => toggle1(cat)}>
                          <td className="px-4 py-2.5 font-semibold text-gray-800 flex items-center gap-2">
                            <span className="text-gray-400 text-xs">{isExpanded ? '▼' : '▶'}</span>{cat}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{fmtSpend(catSpend)}</td>
                          <td colSpan={5} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">{rows.length} ad type{rows.length !== 1 ? 's' : ''}</td>
                        </tr>
                        {isExpanded && rows.map((row, idx) => (
                          <tr key={`t1-row-${catIdx}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2.5 pl-8 text-gray-700">
                              <span className="text-gray-400 mr-2">└</span>{row.adProperty}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmtSpend(row.spendA)}</td>
                            <RoasCell value={row.roasA} />
                            <RoasCell value={row.roasB} />
                            <ChangeCell value={row.roasChange} />
                            <ChangeCell value={row.cpcChange} invert={true} />
                            <ChangeCell value={row.cvrChange} />
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Category → Campaign → Keyword Breakdown</h3>
            <p className="text-xs text-gray-500 mb-3">
              Keyword Based Ads only • % of Category Spend based on Period A • Sorted by spend (high to low)
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-3 text-left font-semibold w-72">Category / Campaign / Keyword</th>
                    <th className="px-3 py-3 text-right font-semibold">Spend A</th>
                    <th className="px-3 py-3 text-center font-semibold">% of Cat Spend</th>
                    <th className="px-3 py-3 text-center font-semibold">ROAS A</th>
                    <th className="px-3 py-3 text-center font-semibold">ROAS B</th>
                    <th className="px-3 py-3 text-center font-semibold">ROAS Δ%</th>
                    <th className="px-3 py-3 text-center font-semibold">CPC Δ%</th>
                    <th className="px-3 py-3 text-center font-semibold">CVR Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(byCategory2).map((cat, catIdx) => {
                    const campaigns = byCategory2[cat];
                    const isExpanded = expandedCats2[cat] !== false;
                    const catSpend = Object.values(campaigns).flat().reduce((s, r) => s + r.spendA, 0);
                    return (
                      <>
                        <tr key={`t2-cat-${cat}`} className="bg-gray-100 cursor-pointer hover:bg-gray-200" onClick={() => toggle2(cat)}>
                          <td className="px-4 py-2.5 font-semibold text-gray-800 flex items-center gap-2">
                            <span className="text-gray-400 text-xs">{isExpanded ? '▼' : '▶'}</span>{cat}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{fmtSpend(catSpend)}</td>
                          <td colSpan={6} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">
                            {Object.keys(campaigns).length} campaign{Object.keys(campaigns).length !== 1 ? 's' : ''}
                          </td>
                        </tr>

                        {isExpanded && Object.keys(campaigns).map((campaign, campIdx) => {
                          const kwRows = campaigns[campaign];
                          const campSpend = kwRows.reduce((s, r) => s + r.spendA, 0);
                          return (
                            <>
                              <tr key={`t2-camp-${catIdx}-${campIdx}`} className="bg-blue-50">
                                <td className="px-4 py-2 pl-8 font-medium text-blue-800">
                                  <span className="text-gray-400 mr-2">└</span>{campaign}
                                </td>
                                <td className="px-3 py-2 text-right text-blue-800 font-medium">{fmtSpend(campSpend)}</td>
                                <td colSpan={6} className="px-3 py-2 text-center text-blue-400 text-xs italic">
                                  {kwRows.length} keyword{kwRows.length !== 1 ? 's' : ''}
                                </td>
                              </tr>
                              {kwRows.map((row, kwIdx) => (
                                <tr key={`t2-kw-${catIdx}-${campIdx}-${kwIdx}`} className={kwIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-2 pl-14 text-gray-600">
                                    <span className="text-gray-300 mr-2">└</span>{row.keyword}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">{fmtSpend(row.spendA)}</td>
                                  <td className="px-3 py-2 text-center text-gray-600">
                                    {row.pctOfCatSpend > 0 ? `${row.pctOfCatSpend.toFixed(1)}%` : '—'}
                                  </td>
                                  <RoasCell value={row.roasA} />
                                  <RoasCell value={row.roasB} />
                                  <ChangeCell value={row.roasChange} />
                                  <ChangeCell value={row.cpcChange} invert={true} />
                                  <ChangeCell value={row.cvrChange} />
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

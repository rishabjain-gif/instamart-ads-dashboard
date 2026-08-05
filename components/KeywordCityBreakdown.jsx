'use client';
import { useState, useEffect } from 'react';

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

function RoasBadge({ roas }) {
  const color = roas >= 1 ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50';
  return (
    <span className={'text-xs font-semibold px-1.5 py-0.5 rounded ' + color}>
      {roas.toFixed(2)}x
    </span>
  );
}

export default function KeywordCityBreakdown() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    fetch('/api/keyword-cities')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        // Auto-expand top 3 keywords
        const init = {};
        d.keywords.slice(0, 3).forEach((kw, i) => { init[i] = true; });
        setExpanded(init);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = i => setExpanded(p => ({ ...p, [i]: !p[i] }));

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Low ROAS Keywords — City Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">Keywords with MTD ROAS &lt; 1× | sorted by spend</p>
        </div>
      </div>
      <div className="px-5 py-8 text-center text-xs text-gray-400 animate-pulse">Loading…</div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 px-5 py-4 text-xs text-red-500">
      Error: {error}
    </div>
  );

  const { keywords = [], month = '' } = data || {};

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Low ROAS Keywords — City Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">{month} · Keywords with MTD ROAS &lt; 1× · sorted by spend ↓</p>
        </div>
        {keywords.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-red-200 text-red-600 bg-red-50">
            {keywords.length} keywords
          </span>
        )}
      </div>

      {keywords.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-gray-400">No keywords with ROAS &lt; 1× this month ✅</div>
      ) : (
        <div className="overflow-auto max-h-[70vh]">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-2.5 text-left font-semibold min-w-[240px] sticky left-0 bg-gray-800 z-20">Keyword / City</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-300">Campaign</th>
                <th className="px-3 py-2.5 text-right font-semibold min-w-[80px]">MTD Spend</th>
                <th className="px-3 py-2.5 text-right font-semibold min-w-[70px]">Sales</th>
                <th className="px-3 py-2.5 text-center font-semibold min-w-[70px]">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => {
                const isOpen = !!expanded[i];
                return [
                  /* Keyword row */
                  <tr
                    key={'kw-' + i}
                    className="bg-gray-900 text-white cursor-pointer hover:bg-gray-700 select-none"
                    onClick={() => toggle(i)}
                  >
                    <td className="px-4 py-2 font-semibold sticky left-0 bg-gray-900 z-10">
                      <span className="text-gray-400 text-xs mr-1.5">{isOpen ? '▼' : '▶'}</span>
                      {kw.keyword}
                    </td>
                    <td className="px-4 py-2 text-gray-300 text-xs truncate max-w-[200px]">
                      {kw.campaign.length > 30 ? kw.campaign.slice(0, 30) + '…' : kw.campaign}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(kw.spend)}</td>
                    <td className="px-3 py-2 text-right text-gray-300">{fmt(kw.gmv)}</td>
                    <td className="px-3 py-2 text-center">
                      <RoasBadge roas={kw.roas} />
                    </td>
                  </tr>,

                  /* City rows (expanded) */
                  ...(isOpen ? kw.cities.map((c, ci) => (
                    <tr
                      key={'kw-' + i + '-city-' + ci}
                      className={ci % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td
                        className="px-4 py-1.5 pl-10 text-gray-700 sticky left-0 z-10"
                        style={{ backgroundColor: ci % 2 === 0 ? '#ffffff' : '#f9fafb' }}
                      >
                        <span className="text-gray-400 mr-1.5">📍</span>
                        {c.city}
                      </td>
                      <td className="px-4 py-1.5 text-gray-400">—</td>
                      <td className="px-3 py-1.5 text-right text-gray-700 font-medium">{fmt(c.spend)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{fmt(c.gmv)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <RoasBadge roas={c.roas} />
                      </td>
                    </tr>
                  )) : [])
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

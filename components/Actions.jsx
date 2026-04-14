'use client';
import { useEffect, useState, useCallback } from 'react';

function fmtSpend(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '₹0';
  if (n >= 10000000) return '₹' + (n/10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

const ACTION_CONFIG = {
  pause:       { label: 'Pause / Reduce', bg: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500' },
  scale:       { label: 'Scale Up',       bg: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  investigate: { label: 'Investigate',   bg: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  confirm:     { label: 'Confirm Pause', bg: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400' },
};

export default function Actions({ platform = 'instamart' }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback((bust = false) => {
    if (bust) setRefreshing(true);
    else { setLoading(true); setData(null); setError(null); }
    const url = (platform === 'zepto' ? '/api/zepto/actions' : '/api/actions') + (bust ? '?bust=true' : '');
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLastUpdated(new Date());
        setLoading(false);
        setRefreshing(false);
      })
      .catch(e => { setError(e.message); setLoading(false); setRefreshing(false); });
  }, [platform]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Computing action items…</p>
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!data) return null;

  const { actions = [], currentLabel } = data;
  const highCount = actions.filter(a => a.priority === 'high').length;
  const medCount  = actions.filter(a => a.priority === 'medium').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Action Items — {currentLabel} MTD</h2>
          <p className="text-xs text-gray-500 mt-0.5">Campaigns with ≥ ₹1,000 spend in last 3 data days • Sorted by priority then MTD spend</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {highCount > 0 && <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full border border-red-200">{highCount} high priority</span>}
          {medCount  > 0 && <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full border border-yellow-200">{medCount} medium priority</span>}
          {lastUpdated && <span className="text-xs text-gray-400">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {actions.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-gray-500 text-sm font-medium">No action items — all qualifying campaigns are on track.</p>
          <p className="text-gray-400 text-xs mt-1">Campaigns below ₹1,000 spend in last 3 data days are excluded.</p>
        </div>
      )}

      {actions.length > 0 && (
        <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-3 text-left font-semibold w-6"></th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-left font-semibold">Campaign</th>
                <th className="px-3 py-3 text-center font-semibold">Action</th>
                <th className="px-3 py-3 text-right font-semibold">MTD Spend</th>
                <th className="px-3 py-3 text-center font-semibold">MTD ROAS</th>
                <th className="px-5 py-3 text-left font-semibold">What to do</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((item, idx) => {
                const cfg = ACTION_CONFIG[item.type] || ACTION_CONFIG.investigate;
                return (
                  <tr key={idx} className={'border-b border-gray-100 ' + (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                    {/* Priority dot */}
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dot}`}></span>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.category}</td>
                    {/* Campaign */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 text-sm">{item.campaign}</div>
                      {item.deteriorating && (
                        <span className="inline-block mt-0.5 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">↘ deteriorating</span>
                      )}
                    </td>
                    {/* Action badge */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg}`}>{cfg.label}</span>
                    </td>
                    {/* MTD Spend */}
                    <td className="px-3 py-3 text-right font-semibold text-gray-700 text-sm">{fmtSpend(item.mtdSpend)}</td>
                    {/* MTD ROAS */}
                    <td className="px-3 py-3 text-center">
                      {item.mtdRoas > 0
                        ? <span className={`text-sm font-bold ${item.mtdRoas >= 1.5 ? 'text-green-700' : 'text-red-600'}`}>{item.mtdRoas.toFixed(2)}x</span>
                        : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    {/* Action detail + keywords */}
                    <td className="px-5 py-3">
                      <div className="text-gray-800 text-xs font-semibold mb-0.5">{item.action}</div>
                      <div className="text-gray-500 text-xs leading-relaxed">{item.detail}</div>
                      {item.keywords && item.keywords.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.keywords.map((kw, ki) => (
                            <span
                              key={ki}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${kw.branded ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
                            >
                              {kw.keyword}
                              {kw.branded && <span className="text-purple-400 text-xs font-bold">B</span>}
                              {kw.roas > 0 && <span className="text-gray-400 font-normal">· {kw.roas.toFixed(1)}x</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Materiality: ≥ ₹1,000 in last 3 available data days • ROAS threshold: 1.5x • Deteriorating = last 7 days ROAS dropped &gt;20% vs earlier this month (only shown if ≥ 8 data days available) • <span className="text-purple-500 font-medium">B</span> = Branded keyword
      </p>
    </div>
  );
}

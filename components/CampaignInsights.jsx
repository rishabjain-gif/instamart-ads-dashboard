'use client';
import { useEffect, useState } from 'react';

function fmtSpend(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '₹0';
  if (n >= 10000000) return '₹' + (n/10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
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
          <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">Why: </span>{ins.reason}</p>
          <p className="text-xs text-gray-600 mt-0.5"><span className="font-semibold text-gray-700">Action: </span>{ins.action}</p>
          {ins.topKeywords && ins.topKeywords.length > 0 && (
            <div className="mt-2.5">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Keyword breakdown (worst ROAS first):</p>
              <div className="flex flex-wrap gap-1.5">
                {ins.topKeywords.map((kw, i) => (
                  <span key={i} className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (kw.roas === null || kw.roas === 0 ? 'bg-red-100 text-red-800' : kw.roas < 1.5 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800')}>
                    {kw.keyword} · {kw.roas !== null ? kw.roas.toFixed(2) + 'x' : '0x'}
                  </span>
                ))}
              </div>
            </div>
          )}
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

function StrategicSuggestions({ suggestions }) {
  if (!suggestions || suggestions.length === 0) return null;
  const typeLabels = {
    ad_property_winner: 'Budget Reallocation',
    scale_opportunity: 'Scale Opportunity',
    budget_waste: 'Budget Waste',
    efficiency_decline: 'Efficiency Alert',
  };
  const priorityCfg = {
    high: { icon: '🔴', badge: 'bg-red-100 text-red-700', border: 'border-l-red-400' },
    medium: { icon: '🟡', badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-400' },
    low: { icon: '🔵', badge: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400' },
  };
  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-gray-800 mb-3">Strategic Suggestions</h3>
      <div className="overflow-auto max-h-[70vh] rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-3 text-center font-semibold w-8"></th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Category</th>
              <th className="px-4 py-3 text-left font-semibold">Finding</th>
              <th className="px-4 py-3 text-left font-semibold">Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s, i) => {
              const cfg = priorityCfg[s.priority] || priorityCfg.medium;
              const label = typeLabels[s.type] || s.type;
              const dotIdx = s.detail.indexOf('. ');
              const finding = dotIdx > 0 ? s.detail.slice(0, dotIdx + 1) : s.detail;
              const action = dotIdx > 0 ? s.detail.slice(dotIdx + 2) : '';
              return (
                <tr key={i} className={(i % 2 === 0 ? 'bg-white' : 'bg-gray-50') + ' border-l-4 ' + cfg.border}>
                  <td className="px-3 py-3 text-center text-base">{cfg.icon}</td>
                  <td className="px-4 py-3"><span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + cfg.badge}>{label}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-medium">{s.category || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-xs">{finding}</td>
                  <td className="px-4 py-3 text-xs text-gray-800 font-medium max-w-xs">{action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CampaignInsights({ platform = 'instamart' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');

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

  useEffect(() => { loadData(''); }, [platform]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading insights…</p>
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!data) return null;

  const hasInsights = data.insights && data.insights.length > 0;

  return (
    <div>
      <div className="mb-5 flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-sm text-gray-600 mr-2 font-medium">Month:</label>
          <select
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); loadData(e.target.value); }}>
            {(data.availableMonths || []).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        {data.prevMonthLabel && <p className="text-xs text-gray-400">comparing vs {data.prevMonthLabel} • sorted by spend</p>}
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-3">Campaign Insights</h3>
      {hasInsights ? (
        <div className="grid grid-cols-1 gap-4">
          {data.insights.map((ins, i) => <InsightCard key={i} ins={ins} prevMonthLabel={data.prevMonthLabel} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-gray-700 font-semibold text-lg">All campaigns stable</p>
          <p className="text-gray-400 text-sm mt-1">No campaigns with deteriorated ROAS vs {data.prevMonthLabel || 'previous month'}</p>
        </div>
      )}
      <StrategicSuggestions suggestions={data.strategicSuggestions} />
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';

function fmtSpend(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '₹0';
  if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

export default function DailyCampaignSpend({ platform = 'instamart' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    const url = platform === 'zepto' ? '/api/zepto/daily-spend' : '/api/daily-spend';
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [platform]);

  if (loading) return <div className="mt-8 p-4 border border-gray-200 rounded-xl text-sm text-gray-400 animate-pulse">Loading daily spend data…</div>;
  if (error) return <div className="mt-8 p-4 text-red-600 bg-red-50 rounded-lg text-sm">Daily spend error: {error}</div>;
  if (!data || !data.campaigns || data.campaigns.length === 0) return null;

  const alertCamps = data.campaigns.filter(c => c.hasAlert);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h3 className="text-base font-semibold text-gray-800">Campaign Daily Spend — Last 14 Days</h3>
        {alertCamps.length > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠ {alertCamps.length} spend drop alert{alertCamps.length > 1 ? 's' : ''}</span>}
      </div>
      {alertCamps.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {alertCamps.map((camp) => (
            <div key={camp.campaign} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
              <span className="text-red-500 shrink-0 mt-0.5">⚠</span>
              <span>
                <span className="font-semibold text-red-800">{camp.campaign}</span>
                {' — avg last '}<span className="font-medium">{camp.alertInfo.daysUsed4} day{camp.alertInfo.daysUsed4 > 1 ? 's' : ''}</span>
                {' is '}<span className="font-semibold">{fmtSpend(camp.alertInfo.avg4)}</span>
                {' vs '}<span className="font-medium">{camp.alertInfo.daysUsed14}-day avg of </span>
                <span className="font-semibold">{fmtSpend(camp.alertInfo.avg14)}</span>
                {' ('}<span className="font-semibold text-red-700">{Math.abs(camp.alertInfo.dropPct).toFixed(0)}% drop</span>{')'}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-xs">
          <thead><tr className="bg-gray-800 text-white">
            <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-gray-800 z-10 min-w-[200px]">Campaign</th>
            {data.dateLabels.map((lbl, i) => <th key={i} className="px-2 py-2.5 text-center font-medium text-gray-300 min-w-[58px]">{lbl}</th>)}
          </tr></thead>
          <tbody>{data.campaigns.map((camp, ci) => (
            <tr key={ci} className={ci % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className={'px-3 py-2 font-medium text-gray-700 sticky left-0 z-10 ' + (ci % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                {camp.campaign.length > 30 ? camp.campaign.slice(0, 30) + '…' : camp.campaign}
                {camp.hasAlert && <span className="ml-1 text-red-500" title="Avg spend last 4 days dropped vs 14-day avg">⚠</span>}
              </td>
              {camp.dailyData.map((day, di) => {
                const noData = day.spend === null;
                const cls = 'px-2 py-2 text-center ' + (noData ? 'text-gray-300' : day.spend > 0 ? 'bg-blue-50 text-blue-800' : 'text-gray-300');
                return <td key={di} className={cls}>{noData ? '—' : day.spend > 0 ? fmtSpend(day.spend) : '—'}</td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">Red ⚠ = avg spend last 4 data-days dropped &gt;10% vs 14-day avg • Blue = normal spend • — = no data yet • Top 20 campaigns by spend</p>
    </div>
  );
}

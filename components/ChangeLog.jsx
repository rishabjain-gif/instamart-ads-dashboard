'use client';
import { useState, useEffect } from 'react';

function fmtSpend(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

function fmtRoas(n) {
  if (n === null || n === undefined || n === 0) return '—';
  return n.toFixed(2) + 'x';
}

function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2) + '%';
}

function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function Delta({ before, after, higherIsBetter = true }) {
  if (before === null || before === undefined || after === null || after === undefined) {
    return <span className="text-gray-300">—</span>;
  }
  if (before === 0) return <span className="text-gray-300">—</span>;
  const pct = ((after - before) / Math.abs(before)) * 100;
  const good = higherIsBetter ? pct >= 0 : pct <= 0;
  return (
    <span className={`font-semibold ${good ? 'text-green-600' : 'text-red-600'}`}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function MetricsTable({ before, after, daysAfter, complete }) {
  const metrics = [
    { label: 'Spend',  key: 'spend',  fmt: fmtSpend, higherIsBetter: false },
    { label: 'ROAS',   key: 'roas',   fmt: fmtRoas,  higherIsBetter: true  },
    { label: 'CPC',    key: 'cpc',    fmt: fmtSpend, higherIsBetter: false },
    { label: 'CVR',    key: 'cvr',    fmt: fmtPct,   higherIsBetter: true  },
    { label: 'Clicks', key: 'clicks', fmt: fmtNum,   higherIsBetter: true  },
  ];

  const afterLabel = complete ? 'After (7d)' : `After (${daysAfter}d so far)`;

  return (
    <div className="mt-3">
      {!complete && daysAfter > 0 && (
        <div className="mb-2 inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1">
          ⏳ Only {daysAfter} day{daysAfter !== 1 ? 's' : ''} of after-data so far — check back once 7 days have passed for a full comparison
        </div>
      )}
      {daysAfter === 0 && (
        <div className="mb-2 inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1">
          🕐 Change is today — after-window data not yet available
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Metric</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Before (7d)</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{afterLabel}</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metrics.map(m => {
              const bVal = before ? before[m.key] : null;
              const aVal = after ? after[m.key] : null;
              return (
                <tr key={m.key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{m.label}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                    {before ? m.fmt(bVal) : <span className="text-gray-300">No data</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                    {after ? m.fmt(aVal) : <span className="text-gray-300">{daysAfter === 0 ? 'Pending' : 'No data'}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Delta before={bVal} after={aVal} higherIsBetter={m.higherIsBetter} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function roasDelta(change) {
  if (!change.before || !change.after) return null;
  const b = change.before.roas;
  const a = change.after.roas;
  if (!b || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function ChangeCard({ change }) {
  const [open, setOpen] = useState(false);

  const isZepto = change.platform.toLowerCase() === 'zepto';
  const platformCls = isZepto
    ? 'bg-purple-100 text-purple-700 border-purple-200'
    : 'bg-orange-100 text-orange-700 border-orange-200';

  const delta = change.complete ? roasDelta(change) : null;

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${platformCls}`}>
              {change.platform}
            </span>
            <span className="text-xs text-gray-400 font-medium">{change.date}</span>
            {delta !== null && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                delta >= 0
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                ROAS {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {!change.complete && change.daysAfter > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                ⏳ {change.daysAfter}d after-data
              </span>
            )}
          </div>
          <div className="font-semibold text-gray-800 text-sm truncate">{change.campaignName}</div>
          <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-1 flex-wrap">
            <span className="font-medium text-gray-600">{change.changeDone}</span>
            {change.current && (
              <>
                <span className="text-gray-400">·</span>
                <span>{change.current}</span>
              </>
            )}
            {change.whatChange && (
              <>
                <span className="text-gray-400">→</span>
                <span className="text-blue-600 font-medium">{change.whatChange}</span>
              </>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-xs mt-1 flex-shrink-0 pt-0.5">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/30">
          <MetricsTable
            before={change.before}
            after={change.after}
            daysAfter={change.daysAfter}
            complete={change.complete}
          />
        </div>
      )}
    </div>
  );
}

export default function ChangeLog({ platform }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/changelog')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="text-center">
        <div className="text-4xl mb-3">📋</div>
        <div className="text-sm">Loading change log…</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      Failed to load: {error}
    </div>
  );

  const allChanges = data?.changes || [];
  const filtered = allChanges.filter(c =>
    c.platform.toLowerCase() === platform.toLowerCase()
  );

  if (allChanges.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <div className="text-5xl mb-3">📋</div>
      <div className="font-medium text-gray-600">No changes logged yet</div>
      <div className="text-sm mt-1">Add entries to the Google Sheet to see before/after impact here</div>
    </div>
  );

  if (filtered.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <div className="text-5xl mb-3">📋</div>
      <div className="font-medium text-gray-600">
        No changes logged for {platform === 'zepto' ? 'Zepto' : 'Instamart'} yet
      </div>
      <div className="text-sm mt-1">Switch platform or add entries to the Google Sheet</div>
    </div>
  );

  const complete = filtered.filter(c => c.complete).length;
  const pending = filtered.filter(c => !c.complete && c.daysAfter > 0).length;

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Campaign Change Log</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {filtered.length} change{filtered.length !== 1 ? 's' : ''} tracked
            {complete > 0 && ` · ${complete} with full 7-day comparison`}
            {pending > 0 && ` · ${pending} in progress`}
          </p>
        </div>
        <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
          📊 Each card shows 7-day before vs after impact<br />
          Click any row to expand metrics
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map((change, i) => (
          <ChangeCard key={i} change={change} />
        ))}
      </div>
    </div>
  );
}

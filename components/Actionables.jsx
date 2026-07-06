'use client';
import { useEffect, useState, useCallback } from 'react';

function fmtSpend(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '₹0';
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

function RoasBadge({ roas, breakeven }) {
  const good = roas >= breakeven;
  return <span className={'text-sm font-bold ' + (good ? 'text-green-700' : 'text-red-600')}>{roas.toFixed(2)}x</span>;
}

function SectionCard({ title, subtitle, badge, badgeColor, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {badge != null && (
          <span className={'px-2.5 py-1 text-xs font-semibold rounded-full border ' + badgeColor}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function EntryTable({ items, breakeven, impactLabel }) {
  if (!items || items.length === 0) {
    return <div className="px-5 py-6 text-center text-xs text-gray-400">Nothing qualifies this month ✅</div>;
  }
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-xs">
            <th className="px-4 py-2 text-left font-semibold">Keyword</th>
            <th className="px-4 py-2 text-left font-semibold">Campaign</th>
            <th className="px-3 py-2 text-left font-semibold">Brand</th>
            <th className="px-3 py-2 text-right font-semibold">Spend</th>
            <th className="px-3 py-2 text-right font-semibold">Sales</th>
            <th className="px-3 py-2 text-center font-semibold">ROAS</th>
            <th className="px-3 py-2 text-right font-semibold">{impactLabel}</th>
            <th className="px-4 py-2 text-left font-semibold">Recommended action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e, i) => (
            <tr key={i} className={'border-b border-gray-100 ' + (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
              <td className="px-4 py-2.5">
                <span className={'text-xs font-medium ' + (e.level === 'campaign' ? 'italic text-gray-500' : 'text-gray-800')}>{e.keyword}</span>
                {e.branded && <span className="ml-1.5 text-xs font-bold text-purple-500">B</span>}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-600">{e.campaign}</td>
              <td className="px-3 py-2.5 text-xs text-gray-500">{e.brand || '—'}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-700 text-xs">{fmtSpend(e.spend)}</td>
              <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmtSpend(e.gmv)}</td>
              <td className="px-3 py-2.5 text-center"><RoasBadge roas={e.roas} breakeven={breakeven} /></td>
              <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700">{fmtSpend(e.estImpact)}</td>
              <td className="px-4 py-2.5 text-xs text-gray-800 font-medium whitespace-nowrap">{e.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Actionables({ platform = 'instamart' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback((bust = false) => {
    if (bust) setRefreshing(true);
    else { setLoading(true); setData(null); setError(null); }
    const url = (platform === 'zepto' ? '/api/zepto/actionables' : '/api/actionables') + (bust ? '?bust=true' : '');
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
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
        <p className="text-gray-500 text-sm">Computing actionables…</p>
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!data) return null;

  const { summary, pause, bidDown, scale, negatives, branded, cities, dataHealth, currentLabel, config } = data;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Actionables — {currentLabel}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-computed from the latest month in the sheet config • Add next month&apos;s tab reference and this updates itself
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="text-xs text-red-600 font-medium">Pause candidates</div>
          <div className="text-xl font-bold text-red-700 mt-1">{summary.pauseCount}</div>
          <div className="text-xs text-red-500 mt-0.5">{fmtSpend(summary.pauseSpend)} spend below breakeven</div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <div className="text-xs text-orange-600 font-medium">Bid-down candidates</div>
          <div className="text-xl font-bold text-orange-700 mt-1">{summary.bidDownCount}</div>
          <div className="text-xs text-orange-500 mt-0.5">~{fmtSpend(summary.bidDownSaving)} est. monthly saving</div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="text-xs text-green-600 font-medium">Scale winners</div>
          <div className="text-xl font-bold text-green-700 mt-1">{summary.scaleCount}</div>
          <div className="text-xs text-green-500 mt-0.5">~{fmtSpend(summary.scaleUpside)} est. extra sales</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
          <div className="text-xs text-yellow-700 font-medium">Negative keywords</div>
          <div className="text-xl font-bold text-yellow-800 mt-1">{summary.negativesCount}</div>
          <div className="text-xs text-yellow-600 mt-0.5">clicks with zero conversions</div>
        </div>
      </div>

      {/* 1. Pause */}
      <SectionCard
        title="🔴 Pause — losing money"
        subtitle={'ROAS below ' + config.breakevenRoas.toFixed(1) + 'x breakeven at meaningful spend'}
        badge={pause.length + ' items'}
        badgeColor="bg-red-100 text-red-700 border-red-200">
        <EntryTable items={pause} breakeven={config.breakevenRoas} impactLabel="Est. loss" />
      </SectionCard>

      {/* 2. Bid down */}
      <SectionCard
        title="🟠 Bid down — marginal"
        subtitle={'ROAS between ' + config.breakevenRoas.toFixed(1) + 'x and ' + config.bidDownRoasMax.toFixed(1) + 'x — cut bids, keep presence'}
        badge={bidDown.length + ' items'}
        badgeColor="bg-orange-100 text-orange-700 border-orange-200">
        <EntryTable items={bidDown} breakeven={config.breakevenRoas} impactLabel="Est. saving" />
      </SectionCard>

      {/* 3. Negatives */}
      <SectionCard
        title="🟡 Add negatives — clicks, no conversions"
        subtitle="Keywords burning clicks with zero conversions this month"
        badge={negatives.length + ' items'}
        badgeColor="bg-yellow-100 text-yellow-700 border-yellow-200">
        {negatives.length === 0
          ? <div className="px-5 py-6 text-center text-xs text-gray-400">Nothing qualifies this month ✅</div>
          : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="px-4 py-2 text-left font-semibold">Keyword</th>
                    <th className="px-4 py-2 text-left font-semibold">Campaign</th>
                    <th className="px-3 py-2 text-right font-semibold">Clicks</th>
                    <th className="px-3 py-2 text-right font-semibold">Spend wasted</th>
                    <th className="px-4 py-2 text-left font-semibold">Recommended action</th>
                  </tr>
                </thead>
                <tbody>
                  {negatives.map((e, i) => (
                    <tr key={i} className={'border-b border-gray-100 ' + (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{e.keyword}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{e.campaign}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700">{e.clicks}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-red-600">{fmtSpend(e.spend)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-800 font-medium">{e.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </SectionCard>

      {/* 4. Scale */}
      <SectionCard
        title="🟢 Scale — winners"
        subtitle={'Non-branded, ROAS above ' + config.scaleRoasMin.toFixed(1) + 'x — push more budget'}
        badge={scale.length + ' items'}
        badgeColor="bg-green-100 text-green-700 border-green-200">
        <EntryTable items={scale} breakeven={config.breakevenRoas} impactLabel="Est. extra sales" />
      </SectionCard>

      {/* 5. Branded guardrail */}
      <SectionCard
        title="🟣 Branded spend check"
        subtitle="Branded keywords convert anyway — high share inflates blended ROAS"
        badge={branded.sharePct.toFixed(1) + '% of keyword spend' + (branded.breached ? ' — above ' + branded.thresholdPct + '% guardrail' : '')}
        badgeColor={branded.breached ? 'bg-red-100 text-red-700 border-red-200' : 'bg-purple-100 text-purple-700 border-purple-200'}>
        <div className="px-5 py-3">
          <p className="text-xs text-gray-500 mb-3">
            {fmtSpend(branded.spend)} of {fmtSpend(branded.kwSpend)} keyword spend is on your own brand terms.
            {branded.breached
              ? ' Consider capping branded bids and shifting budget to generic / competitor terms.'
              : ' Within guardrail — no action needed.'}
          </p>
          {branded.top && branded.top.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {branded.top.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  {b.keyword} <span className="text-gray-400 font-normal">· {fmtSpend(b.spend)} · {b.roas.toFixed(1)}x</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* 6. City reallocation (Instamart only) */}
      {cities && (
        <SectionCard
          title="🔵 City reallocation"
          subtitle="Shift budget from cities below breakeven to high-ROAS cities"
          badge={(cities.shiftFrom.length + cities.shiftTo.length) + ' cities'}
          badgeColor="bg-blue-100 text-blue-700 border-blue-200">
          <div className="grid md:grid-cols-2 gap-0 md:divide-x divide-gray-100">
            <div className="px-5 py-3">
              <div className="text-xs font-semibold text-red-600 mb-2">Reduce / exclude (below breakeven)</div>
              {cities.shiftFrom.length === 0 && <p className="text-xs text-gray-400">None ✅</p>}
              {cities.shiftFrom.map((c, i) => (
                <div key={i} className="flex justify-between items-center py-1 text-xs border-b border-gray-50">
                  <span className="text-gray-700 font-medium">{c.city}</span>
                  <span className="text-gray-500">{fmtSpend(c.spend)} · <span className="text-red-600 font-semibold">{c.roas.toFixed(2)}x</span></span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3">
              <div className="text-xs font-semibold text-green-600 mb-2">Add budget (high ROAS)</div>
              {cities.shiftTo.length === 0 && <p className="text-xs text-gray-400">None qualify</p>}
              {cities.shiftTo.map((c, i) => (
                <div key={i} className="flex justify-between items-center py-1 text-xs border-b border-gray-50">
                  <span className="text-gray-700 font-medium">{c.city}</span>
                  <span className="text-gray-500">{fmtSpend(c.spend)} · <span className="text-green-700 font-semibold">{c.roas.toFixed(2)}x</span></span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {/* 7. Data health */}
      <SectionCard
        title="⚪ Data health"
        subtitle="Issues in the base sheet that can distort every number above"
        badge={dataHealth.length + (dataHealth.length === 1 ? ' issue' : ' issues')}
        badgeColor={dataHealth.length > 0 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-gray-100 text-gray-600 border-gray-200'}>
        {dataHealth.length === 0
          ? <div className="px-5 py-6 text-center text-xs text-gray-400">Base sheet looks clean ✅</div>
          : (
            <div className="px-5 py-3">
              {dataHealth.map((d, i) => (
                <div key={i} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-800">{d.issue}</span>
                    <span className="text-xs text-gray-500">{d.count != null ? d.count + ' rows · ' : ''}{fmtSpend(d.spend)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{d.detail}</p>
                </div>
              ))}
            </div>
          )}
      </SectionCard>

      <p className="mt-2 text-xs text-gray-400">
        Rules &amp; thresholds live in <span className="font-mono">lib/actionablesConfig.js</span> — breakeven {config.breakevenRoas.toFixed(1)}x, bid-down band {config.breakevenRoas.toFixed(1)}–{config.bidDownRoasMax.toFixed(1)}x, scale ≥ {config.scaleRoasMin.toFixed(1)}x • <span className="text-purple-500 font-medium">B</span> = branded keyword • Italic rows = whole campaign (browse / banner / display, no keyword)
      </p>
    </div>
  );
}

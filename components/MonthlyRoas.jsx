'use client';
import { useEffect, useState, useCallback, Fragment } from 'react';
import DailyCampaignSpend from './DailyCampaignSpend';

function fmtSpend(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '₹0';
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function ChangeCell({ value, invert = false, bold = false }) {
  if (value === null || value === undefined) return <td className="px-3 py-2 text-center text-gray-400 text-sm">—</td>;
  const isPositive = invert ? value < 0 : value > 0;
  const color = isPositive ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50';
  const arrow = value > 0 ? '▲' : '▼';
  return <td className={`px-3 py-2 text-center text-sm ${bold ? 'font-bold' : 'font-medium'} ${color}`}>{arrow} {Math.abs(value).toFixed(1)}%</td>;
}

function RoasCell({ value, bold = false }) {
  if (value === null || value === undefined || value === 0) return <td className="px-3 py-2 text-center text-gray-400 text-sm">—</td>;
  return <td className={`px-3 py-2 text-center text-sm ${bold ? 'font-bold text-white' : 'text-gray-800'}`}>{value.toFixed(2)}x</td>;
}

function SpendCell({ value }) {
  if (value === null || value === undefined) return <td className="px-3 py-2 text-right text-gray-400 text-sm">—</td>;
  return <td className="px-3 py-2 text-right text-sm text-gray-700">{fmtSpend(value)}</td>;
}

export default function MonthlyRoas({ platform = 'instamart' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [expandedBrands, setExpandedBrands] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedAdTypes, setExpandedAdTypes] = useState({});

  const fetchData = useCallback((bust = false) => {
    const isRefresh = bust;
    if (isRefresh) setRefreshing(true); else { setLoading(true); setData(null); setError(null); }
    const base = platform === 'zepto' ? '/api/zepto/monthly' : '/api/monthly';
    const url = bust ? base + '?bust=true' : base;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLastUpdated(new Date());
        setLoading(false);
        setRefreshing(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
        setRefreshing(false);
      });
  }, [platform]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading data from Google Sheets…<br/>This may take 10–20 seconds for large datasets.</p>
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!data || !Array.isArray(data.data)) return null;

  const totalPrevSpend = data.data.reduce((s, r) => s + (r.prevSpend || 0), 0);
  const totalCurrentSpend = data.data.reduce((s, r) => s + (r.currentSpend || 0), 0);
  const totalPrevGMV = data.data.reduce((s, r) => s + ((r.prevRoas || 0) * (r.prevSpend || 0)), 0);
  const totalCurrentGMV = data.data.reduce((s, r) => s + ((r.currentRoas || 0) * (r.currentSpend || 0)), 0);
  const totalPrevRoas = totalPrevSpend > 0 ? totalPrevGMV / totalPrevSpend : null;
  const totalCurrentRoas = totalCurrentSpend > 0 ? totalCurrentGMV / totalCurrentSpend : null;
  const totalPrevAvg = totalPrevSpend > 0 && data.prevDays ? totalPrevSpend / data.prevDays : null;
  const totalCurrAvg = totalCurrentSpend > 0 && data.currDays ? totalCurrentSpend / data.currDays : null;
  const totalSpendChange = totalPrevAvg && totalCurrAvg ? ((totalCurrAvg - totalPrevAvg) / totalPrevAvg) * 100 : null;
  const totalRoasChange = (totalCurrentRoas && totalPrevRoas) ? ((totalCurrentRoas - totalPrevRoas) / Math.abs(totalPrevRoas)) * 100 : null;

  const grandTotalRow = (extraCol = false) => (
    <tr className="bg-gray-800 text-white">
      <td className="px-4 py-3 font-bold text-sm">Σ Grand Total</td>
      <td className="px-3 py-3 text-right font-bold text-sm text-gray-300">{totalPrevSpend > 0 ? fmtSpend(totalPrevSpend) : '—'}</td>
      <td className="px-3 py-3 text-right font-bold text-sm">{fmtSpend(totalCurrentSpend)}</td>
      {totalSpendChange !== null ? <td className={`px-3 py-3 text-center text-sm font-bold ${totalSpendChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{totalSpendChange > 0 ? '▲' : '▼'} {Math.abs(totalSpendChange).toFixed(1)}%</td> : <td className="px-3 py-3 text-center text-gray-400">—</td>}
      <td className="px-3 py-3 text-center font-bold text-sm text-gray-300">{totalPrevRoas ? totalPrevRoas.toFixed(2) + 'x' : '—'}</td>
      <td className="px-3 py-3 text-center font-bold text-sm">{totalCurrentRoas ? totalCurrentRoas.toFixed(2) + 'x' : '—'}</td>
      {totalRoasChange !== null ? <td className={`px-3 py-3 text-center text-sm font-bold ${totalRoasChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{totalRoasChange > 0 ? '▲' : '▼'} {Math.abs(totalRoasChange).toFixed(1)}%</td> : <td className="px-3 py-3 text-center text-gray-400">—</td>}
      <td className="px-3 py-3 text-center text-gray-400 text-sm">—</td>
      <td className="px-3 py-3 text-center text-gray-400 text-sm">—</td>
      {extraCol && <td className="px-3 py-3 text-center text-gray-400 text-sm">—</td>}
    </tr>
  );

  const metaLine = (
    <div className="mb-4 flex items-center gap-4 flex-wrap">
      <div className="text-sm text-gray-500">
        Comparing <span className="font-semibold text-gray-700">{data.previousLabel || 'Previous Month'}</span> ({data.prevDays} days){' '}vs{' '}
        <span className="font-semibold text-gray-700">{data.currentLabel} MTD</span> ({data.currDays} days elapsed)
      </div>
      <div className="text-xs text-gray-400">Sorted by spend (high to low) • Click to collapse/expand</div>
      <div className="ml-auto flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className={`inline-block ${refreshing ? 'animate-spin' : ''}`}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );

  const tableHeader = (label, extraColLabel = null) => (
    <thead className="sticky top-0 z-10">
      <tr className="bg-gray-800 text-white">
        <th className="px-4 py-3 text-left font-semibold w-64">{label}</th>
        <th className="px-3 py-3 text-right font-semibold">Prev Month Spend</th>
        <th className="px-3 py-3 text-right font-semibold">Spend (MTD)</th>
        <th className="px-3 py-3 text-center font-semibold">Avg Daily Spend Δ%<br/><span className="font-normal text-gray-400 text-xs">(vs prev month)</span></th>
        <th className="px-3 py-3 text-center font-semibold">Prev ROAS</th>
        <th className="px-3 py-3 text-center font-semibold">MTD ROAS</th>
        <th className="px-3 py-3 text-center font-semibold">ROAS Δ%</th>
        <th className="px-3 py-3 text-center font-semibold">CPC Δ%<br/><span className="font-normal text-gray-400 text-xs">(↑ bad)</span></th>
        <th className="px-3 py-3 text-center font-semibold">CVR Δ%<br/><span className="font-normal text-gray-400 text-xs">(↓ bad)</span></th>
        {extraColLabel && <th className="px-3 py-3 text-center font-semibold">{extraColLabel}</th>}
      </tr>
    </thead>
  );

  // ── ZEPTO: 4-level (Brand → Category → Ad Type → Keyword) ──
  if (platform === 'zepto') {
    // Build brand → category → [adType rows]
    const byBrand = {};
    for (const row of data.data) {
      if (!byBrand[row.brand]) byBrand[row.brand] = {};
      if (!byBrand[row.brand][row.category]) byBrand[row.brand][row.category] = [];
      byBrand[row.brand][row.category].push(row);
    }

    // Sort brands by total current spend desc
    const brandNames = Object.keys(byBrand).sort((a, b) => {
      const aS = Object.values(byBrand[a]).flat().reduce((s, r) => s + (r.currentSpend || 0), 0);
      const bS = Object.values(byBrand[b]).flat().reduce((s, r) => s + (r.currentSpend || 0), 0);
      return bS - aS;
    });

    const toggleBrand = (brand) => setExpandedBrands(prev => ({ ...prev, [brand]: !prev[brand] }));
    const toggleCategory = (key) => setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
    const toggleAdType = (key) => setExpandedAdTypes(prev => ({ ...prev, [key]: !prev[key] }));

    return (
      <div>
        {metaLine}
        <div className="overflow-auto max-h-[70vh] rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            {tableHeader('Brand / Category / Ad Type / Keyword', '% of Cat Spend')}
            <tbody>
              {brandNames.map((brand) => {
                const catMap = byBrand[brand];
                const allBrandRows = Object.values(catMap).flat();
                const brCurrentSpend = allBrandRows.reduce((s, r) => s + (r.currentSpend || 0), 0);
                const brPrevSpend = allBrandRows.reduce((s, r) => s + (r.prevSpend || 0), 0);
                const brPrevAvg = brPrevSpend > 0 && data.prevDays ? brPrevSpend / data.prevDays : null;
                const brCurrAvg = brCurrentSpend > 0 && data.currDays ? brCurrentSpend / data.currDays : null;
                const brSpendChange = brPrevAvg && brCurrAvg ? ((brCurrAvg - brPrevAvg) / brPrevAvg) * 100 : null;
                const isBrExp = expandedBrands[brand] !== false;

                // Sort categories within brand by spend desc
                const catNames = Object.keys(catMap).sort((a, b) => {
                  const aS = catMap[a].reduce((s, r) => s + (r.currentSpend || 0), 0);
                  const bS = catMap[b].reduce((s, r) => s + (r.currentSpend || 0), 0);
                  return bS - aS;
                });

                return (
                  <Fragment key={brand}>
                    {/* Brand row — dark header */}
                    <tr className="bg-gray-800 text-white cursor-pointer hover:bg-gray-700 transition-colors" onClick={() => toggleBrand(brand)}>
                      <td className="px-4 py-2.5 font-bold text-sm">
                        <span className="text-gray-400 text-xs mr-1.5">{isBrExp ? '▼' : '▶'}</span>{brand}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-sm text-gray-300">{brPrevSpend > 0 ? fmtSpend(brPrevSpend) : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-sm">{fmtSpend(brCurrentSpend)}</td>
                      {brSpendChange !== null ? <td className={`px-3 py-2.5 text-center text-sm font-bold ${brSpendChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{brSpendChange > 0 ? '▲' : '▼'} {Math.abs(brSpendChange).toFixed(1)}%</td> : <td className="px-3 py-2.5 text-center text-gray-400">—</td>}
                      <td colSpan={6} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">{catNames.length} categor{catNames.length !== 1 ? 'ies' : 'y'}</td>
                    </tr>

                    {isBrExp && catNames.map((category) => {
                      const adTypeRows = catMap[category].sort((a, b) => b.currentSpend - a.currentSpend);
                      const catCurrentSpend = adTypeRows.reduce((s, r) => s + (r.currentSpend || 0), 0);
                      const catPrevSpend = adTypeRows.reduce((s, r) => s + (r.prevSpend || 0), 0);
                      const catPrevAvg = catPrevSpend > 0 && data.prevDays ? catPrevSpend / data.prevDays : null;
                      const catCurrAvg = catCurrentSpend > 0 && data.currDays ? catCurrentSpend / data.currDays : null;
                      const catSpendChange = catPrevAvg && catCurrAvg ? ((catCurrAvg - catPrevAvg) / catPrevAvg) * 100 : null;
                      const catKey = brand + '|||' + category;
                      const isCatExp = expandedCategories[catKey] !== false;

                      return (
                        <Fragment key={catKey}>
                          {/* Category row — light gray */}
                          <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleCategory(catKey)}>
                            <td className="px-4 py-2 pl-6 font-semibold text-gray-800 text-sm">
                              <span className="text-gray-400 text-xs mr-1.5">{isCatExp ? '▼' : '▶'}</span>{category}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-500 text-sm">{catPrevSpend > 0 ? fmtSpend(catPrevSpend) : '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-700 text-sm">{fmtSpend(catCurrentSpend)}</td>
                            {catSpendChange !== null ? <td className={`px-3 py-2 text-center text-sm font-semibold ${catSpendChange > 0 ? 'text-green-700' : 'text-red-700'}`}>{catSpendChange > 0 ? '▲' : '▼'} {Math.abs(catSpendChange).toFixed(1)}%</td> : <td className="px-3 py-2 text-center text-gray-400">—</td>}
                            <td colSpan={6} className="px-3 py-2 text-center text-gray-400 text-xs italic">{adTypeRows.length} ad type{adTypeRows.length !== 1 ? 's' : ''}</td>
                          </tr>

                          {isCatExp && adTypeRows.map((row, idx) => {
                            const adTypeKey = catKey + '|||' + row.adType;
                            const isAtExp = expandedAdTypes[adTypeKey] === true;
                            const hasKw = row.keywords && row.keywords.length > 0;

                            return (
                              <Fragment key={adTypeKey + '-' + idx}>
                                {/* Ad Type row — white/striped */}
                                <tr
                                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${hasKw ? 'cursor-pointer hover:bg-blue-50' : ''} transition-colors`}
                                  onClick={() => hasKw && toggleAdType(adTypeKey)}
                                >
                                  <td className="px-4 py-2 pl-10 text-gray-700 text-sm">
                                    {hasKw && <span className="text-gray-400 text-xs mr-1">{isAtExp ? '▼' : '▶'}</span>}
                                    {!hasKw && <span className="text-gray-300 mr-1">└</span>}
                                    {row.adType}
                                  </td>
                                  <SpendCell value={row.prevSpend} />
                                  <td className="px-3 py-2 text-right text-gray-700 text-sm">{fmtSpend(row.currentSpend)}</td>
                                  <ChangeCell value={row.avgDailySpendChange} />
                                  <RoasCell value={row.prevRoas} />
                                  <RoasCell value={row.currentRoas} />
                                  <ChangeCell value={row.roasChange} />
                                  <ChangeCell value={row.cpcChange} invert={true} />
                                  <ChangeCell value={row.cvrChange} />
                                  <td className="px-3 py-2 text-center text-gray-400 text-xs">—</td>
                                </tr>

                                {isAtExp && hasKw && row.keywords.map((kw, kwIdx) => {
                                  const pctOfCat = catCurrentSpend > 0 ? (kw.currentSpend / catCurrentSpend * 100).toFixed(1) + '%' : '—';
                                  return (
                                    <tr key={adTypeKey + '-kw-' + kwIdx} className="bg-blue-50 border-l-2 border-blue-200">
                                      <td className="px-4 py-1.5 pl-14 text-gray-600 text-xs">
                                        <span className="text-blue-300 mr-1">└</span>{kw.keyword}{kw.currentSpend === 0 && kw.prevSpend > 0 && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-xs bg-gray-200 text-gray-500 rounded-full font-medium">⏸ Paused</span>}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-gray-600 text-xs">{kw.prevSpend ? fmtSpend(kw.prevSpend) : '—'}</td>
                                      <td className="px-3 py-1.5 text-right text-gray-700 text-xs font-medium">{fmtSpend(kw.currentSpend)}</td>
                                      <td className="px-3 py-1.5 text-center text-gray-400 text-xs">—</td>
                                      <td className="px-3 py-1.5 text-center text-gray-600 text-xs">{kw.prevRoas ? kw.prevRoas.toFixed(2) + 'x' : '—'}</td>
                                      <td className="px-3 py-1.5 text-center text-gray-700 text-xs">{kw.currentRoas ? kw.currentRoas.toFixed(2) + 'x' : '—'}</td>
                                      <td className="px-3 py-1.5 text-center text-gray-400 text-xs">—</td>
                                      <td className="px-3 py-1.5 text-center text-gray-400 text-xs">—</td>
                                      <td className="px-3 py-1.5 text-center text-gray-400 text-xs">—</td>
                                      <td className="px-3 py-1.5 text-center text-blue-700 text-xs font-medium">{pctOfCat}</td>
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
              {grandTotalRow(true)}
            </tbody>
          </table>
        </div>
        <DailyCampaignSpend platform={platform} />
        <p className="mt-3 text-xs text-gray-400">
          Avg Daily Spend Δ% = (Current MTD daily avg − Prev month daily avg) / Prev month daily avg • ROAS = 7-day GMV / Spend • Grand Total ROAS = spend-weighted average • CPC Δ% red = cost up (bad) • CVR Δ% red = conversions dropped (bad)
        </p>
      </div>
    );
  }

  // ── INSTAMART: 2-level (Category → Ad Property) ──
  const byCategory = {};
  for (const row of data.data) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push(row);
  }
  const categories = Object.keys(byCategory);
  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div>
      {metaLine}
      <div className="overflow-auto max-h-[70vh] rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          {tableHeader('Category / Ad Property')}
          <tbody>
            {categories.map((cat) => {
              const rows = byCategory[cat];
              const isExpanded = expandedCats[cat] !== false;
              const catCurrentSpend = rows.reduce((s, r) => s + (r.currentSpend || 0), 0);
              const catPrevSpend = rows.reduce((s, r) => s + (r.prevSpend || 0), 0);
              const catPrevAvg = catPrevSpend > 0 && data.prevDays ? catPrevSpend / data.prevDays : null;
              const catCurrAvg = catCurrentSpend > 0 && data.currDays ? catCurrentSpend / data.currDays : null;
              const catSpendChange = catPrevAvg && catCurrAvg ? ((catCurrAvg - catPrevAvg) / catPrevAvg) * 100 : null;
              return (
                <Fragment key={cat}>
                  <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleCat(cat)}>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">
                      <span className="text-gray-400 text-xs mr-2">{isExpanded ? '▼' : '▶'}</span>{cat}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-500">{catPrevSpend > 0 ? fmtSpend(catPrevSpend) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{fmtSpend(catCurrentSpend)}</td>
                    {catSpendChange !== null ? <td className={`px-3 py-2.5 text-center text-sm font-semibold ${catSpendChange > 0 ? 'text-green-700' : 'text-red-700'}`}>{catSpendChange > 0 ? '▲' : '▼'} {Math.abs(catSpendChange).toFixed(1)}%</td> : <td className="px-3 py-2.5 text-center text-gray-400">—</td>}
                    <td colSpan={5} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">{rows.length} ad type{rows.length !== 1 ? 's' : ''}</td>
                  </tr>
                  {isExpanded && rows.map((row, idx) => (
                    <tr key={`${cat}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2.5 pl-8 text-gray-700"><span className="text-gray-400 mr-2">└</span>{row.adProperty}</td>
                      <SpendCell value={row.prevSpend} />
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtSpend(row.currentSpend)}</td>
                      <ChangeCell value={row.avgDailySpendChange} />
                      <RoasCell value={row.prevRoas} />
                      <RoasCell value={row.currentRoas} />
                      <ChangeCell value={row.roasChange} />
                      <ChangeCell value={row.cpcChange} invert={true} />
                      <ChangeCell value={row.cvrChange} />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {grandTotalRow()}
          </tbody>
        </table>
      </div>
      <DailyCampaignSpend platform={platform} />
      <p className="mt-3 text-xs text-gray-400">
        Avg Daily Spend Δ% = (Current MTD daily avg − Prev month daily avg) / Prev month daily avg • ROAS = 7-day GMV / Spend • Grand Total ROAS = spend-weighted average • CPC Δ% red = cost up (bad) • CVR Δ% red = conversions dropped (bad)
      </p>
    </div>
  );
}

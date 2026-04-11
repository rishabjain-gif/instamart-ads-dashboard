'use client';
import { useEffect, useState, Fragment } from 'react';
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
  const [error, setError] = useState(null);
  // Instamart: 2-level expand
  const [expandedCats, setExpandedCats] = useState({});
  // Zepto: 3-level expand
  const [expandedAdTypes, setExpandedAdTypes] = useState({});
  const [expandedBrands, setExpandedBrands] = useState({});

  useEffect(() => {
    setLoading(true); setData(null); setError(null);
    const url = platform === 'zepto' ? '/api/zepto/monthly' : '/api/monthly';
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [platform]);

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

  // Grand totals
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

  const grandTotalRow = (
    <tr className="bg-gray-800 text-white">
      <td className="px-4 py-3 font-bold text-sm">Σ Grand Total</td>
      <td className="px-3 py-3 text-right font-bold text-sm text-gray-300">{totalPrevSpend > 0 ? fmtSpend(totalPrevSpend) : '—'}</td>
      <td className="px-3 py-3 text-right font-bold text-sm">{fmtSpend(totalCurrentSpend)}</td>
      {totalSpendChange !== null
        ? <td className={`px-3 py-3 text-center text-sm font-bold ${totalSpendChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{totalSpendChange > 0 ? '▲' : '▼'} {Math.abs(totalSpendChange).toFixed(1)}%</td>
        : <td className="px-3 py-3 text-center text-gray-400">—</td>}
      <td className="px-3 py-3 text-center font-bold text-sm text-gray-300">{totalPrevRoas ? totalPrevRoas.toFixed(2) + 'x' : '—'}</td>
      <td className="px-3 py-3 text-center font-bold text-sm">{totalCurrentRoas ? totalCurrentRoas.toFixed(2) + 'x' : '—'}</td>
      {totalRoasChange !== null
        ? <td className={`px-3 py-3 text-center text-sm font-bold ${totalRoasChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{totalRoasChange > 0 ? '▲' : '▼'} {Math.abs(totalRoasChange).toFixed(1)}%</td>
        : <td className="px-3 py-3 text-center text-gray-400">—</td>}
      <td className="px-3 py-3 text-center text-gray-400 text-sm">—</td>
      <td className="px-3 py-3 text-center text-gray-400 text-sm">—</td>
    </tr>
  );

  const metaLine = (
    <div className="mb-4 flex items-center gap-4 flex-wrap">
      <div className="text-sm text-gray-500">
        Comparing <span className="font-semibold text-gray-700">{data.previousLabel || 'Previous Month'}</span> ({data.prevDays} days)
        {' '}vs{' '}
        <span className="font-semibold text-gray-700">{data.currentLabel} MTD</span> ({data.currDays} days elapsed)
      </div>
      <div className="text-xs text-gray-400">Sorted by spend (high to low) • Click to collapse/expand</div>
    </div>
  );

  // ── ZEPTO: 3-level (Ad Type → Brand → Category) ──
  if (platform === 'zepto') {
    const byAdType = {};
    for (const row of data.data) {
      if (!byAdType[row.adType]) byAdType[row.adType] = {};
      if (!byAdType[row.adType][row.brand]) byAdType[row.adType][row.brand] = [];
      byAdType[row.adType][row.brand].push(row);
    }
    const adTypes = Object.keys(byAdType);
    const toggleAdType = (at) => setExpandedAdTypes(prev => ({ ...prev, [at]: !prev[at] }));
    const toggleBrand = (key) => setExpandedBrands(prev => ({ ...prev, [key]: !prev[key] }));

    return (
      <div>
        {metaLine}
        <div className="overflow-auto max-h-[70vh] rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold w-64">Ad Type / Brand / Category</th>
                <th className="px-3 py-3 text-right font-semibold">Prev Month Spend</th>
                <th className="px-3 py-3 text-right font-semibold">Spend (MTD)</th>
                <th className="px-3 py-3 text-center font-semibold">Avg Daily Spend Δ%<br/><span className="font-normal text-gray-400 text-xs">(vs prev month)</span></th>
                <th className="px-3 py-3 text-center font-semibold">Prev ROAS</th>
                <th className="px-3 py-3 text-center font-semibold">MTD ROAS</th>
                <th className="px-3 py-3 text-center font-semibold">ROAS Δ%</th>
                <th className="px-3 py-3 text-center font-semibold">CPC Δ%<br/><span className="font-normal text-gray-400 text-xs">(↑ bad)</span></th>
                <th className="px-3 py-3 text-center font-semibold">CVR Δ%<br/><span className="font-normal text-gray-400 text-xs">(↓ bad)</span></th>
              </tr>
            </thead>
            <tbody>
              {adTypes.map((adType) => {
                const brands = byAdType[adType];
                const brandNames = Object.keys(brands);
                const allRows = brandNames.flatMap(b => brands[b]);
                const atCurrentSpend = allRows.reduce((s, r) => s + (r.currentSpend || 0), 0);
                const atPrevSpend = allRows.reduce((s, r) => s + (r.prevSpend || 0), 0);
                const atPrevAvg = atPrevSpend > 0 && data.prevDays ? atPrevSpend / data.prevDays : null;
                const atCurrAvg = atCurrentSpend > 0 && data.currDays ? atCurrentSpend / data.currDays : null;
                const atSpendChange = atPrevAvg && atCurrAvg ? ((atCurrAvg - atPrevAvg) / atPrevAvg) * 100 : null;
                const isAtExp = expandedAdTypes[adType] !== false;
                return (
                  <Fragment key={adType}>
                    {/* Ad Type row */}
                    <tr className="bg-gray-800 text-white cursor-pointer hover:bg-gray-700 transition-colors" onClick={() => toggleAdType(adType)}>
                      <td className="px-4 py-2.5 font-bold text-sm">
                        <span className="text-gray-400 text-xs mr-2">{isAtExp ? '▼' : '▶'}</span>{adType}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-sm text-gray-300">{atPrevSpend > 0 ? fmtSpend(atPrevSpend) : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-sm">{fmtSpend(atCurrentSpend)}</td>
                      {atSpendChange !== null
                        ? <td className={`px-3 py-2.5 text-center text-sm font-bold ${atSpendChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{atSpendChange > 0 ? '▲' : '▼'} {Math.abs(atSpendChange).toFixed(1)}%</td>
                        : <td className="px-3 py-2.5 text-center text-gray-400">—</td>}
                      <td colSpan={5} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">{brandNames.length} brand{brandNames.length !== 1 ? 's' : ''}</td>
                    </tr>
                    {isAtExp && brandNames.map((brand) => {
                      const catRows = brands[brand];
                      const brCurrentSpend = catRows.reduce((s, r) => s + (r.currentSpend || 0), 0);
                      const brPrevSpend = catRows.reduce((s, r) => s + (r.prevSpend || 0), 0);
                      const brPrevAvg = brPrevSpend > 0 && data.prevDays ? brPrevSpend / data.prevDays : null;
                      const brCurrAvg = brCurrentSpend > 0 && data.currDays ? brCurrentSpend / data.currDays : null;
                      const brSpendChange = brPrevAvg && brCurrAvg ? ((brCurrAvg - brPrevAvg) / brPrevAvg) * 100 : null;
                      const brandKey = adType + '|||' + brand;
                      const isBrExp = expandedBrands[brandKey] !== false;
                      return (
                        <Fragment key={brandKey}>
                          {/* Brand row */}
                          <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleBrand(brandKey)}>
                            <td className="px-4 py-2.5 pl-8 font-semibold text-gray-800">
                              <span className="text-gray-400 text-xs mr-2">{isBrExp ? '▼' : '▶'}</span>{brand}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-500">{brPrevSpend > 0 ? fmtSpend(brPrevSpend) : '—'}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{fmtSpend(brCurrentSpend)}</td>
                            {brSpendChange !== null
                              ? <td className={`px-3 py-2.5 text-center text-sm font-semibold ${brSpendChange > 0 ? 'text-green-700' : 'text-red-700'}`}>{brSpendChange > 0 ? '▲' : '▼'} {Math.abs(brSpendChange).toFixed(1)}%</td>
                              : <td className="px-3 py-2.5 text-center text-gray-400">—</td>}
                            <td colSpan={5} className="px-3 py-2.5 text-center text-gray-400 text-xs italic">{catRows.length} categor{catRows.length !== 1 ? 'ies' : 'y'}</td>
                          </tr>
                          {isBrExp && catRows.map((row, idx) => (
                            <tr key={brandKey + '-' + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2.5 pl-14 text-gray-700"><span className="text-gray-400 mr-2">└</span>{row.category}</td>
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
                  </Fragment>
                );
              })}
              {grandTotalRow}
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
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-800 text-white">
              <th className="px-4 py-3 text-left font-semibold w-56">Category / Ad Property</th>
              <th className="px-3 py-3 text-right font-semibold">Prev Month Spend</th>
              <th className="px-3 py-3 text-right font-semibold">Spend (MTD)</th>
              <th className="px-3 py-3 text-center font-semibold">Avg Daily Spend Δ%<br/><span className="font-normal text-gray-400 text-xs">(vs prev month)</span></th>
              <th className="px-3 py-3 text-center font-semibold">Prev ROAS</th>
              <th className="px-3 py-3 text-center font-semibold">MTD ROAS</th>
              <th className="px-3 py-3 text-center font-semibold">ROAS Δ%</th>
              <th className="px-3 py-3 text-center font-semibold">CPC Δ%<br/><span className="font-normal text-gray-400 text-xs">(↑ bad)</span></th>
              <th className="px-3 py-3 text-center font-semibold">CVR Δ%<br/><span className="font-normal text-gray-400 text-xs">(↓ bad)</span></th>
            </tr>
          </thead>
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
                    {catSpendChange !== null
                      ? <td className={`px-3 py-2.5 text-center text-sm font-semibold ${catSpendChange > 0 ? 'text-green-700' : 'text-red-700'}`}>{catSpendChange > 0 ? '▲' : '▼'} {Math.abs(catSpendChange).toFixed(1)}%</td>
                      : <td className="px-3 py-2.5 text-center text-gray-400">—</td>}
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
            {grandTotalRow}
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

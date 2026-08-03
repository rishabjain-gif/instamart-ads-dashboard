'use client';
import { useState, useEffect, Fragment } from 'react';

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n === 0) return '₹0';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

function roasFmt(n) {
  if (!n && n !== 0) return '—';
  return n.toFixed(2) + 'x';
}

function DeltaCell({ from, to, invert = false }) {
  if (!from && from !== 0) return <td className="px-2 py-1.5 text-center text-gray-300 text-xs">—</td>;
  if (!from) return <td className="px-2 py-1.5 text-center text-gray-300 text-xs">new</td>;
  const delta = ((to - from) / Math.abs(from)) * 100;
  const good = invert ? delta < 0 : delta > 0;
  const neutral = Math.abs(delta) < 0.5;
  const cls = neutral ? 'text-gray-400' : good ? 'text-green-700' : 'text-red-600';
  return (
    <td className={'px-2 py-1.5 text-center text-xs font-medium ' + cls}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
    </td>
  );
}

function getDefaults() {
  const today = new Date();
  const f = d => d.toISOString().split('T')[0];
  const endB = new Date(today);
  const startB = new Date(today); startB.setDate(today.getDate() - 6);
  const endA = new Date(today); endA.setDate(today.getDate() - 7);
  const startA = new Date(today); startA.setDate(today.getDate() - 13);
  return { startA: f(startA), endA: f(endA), startB: f(startB), endB: f(endB) };
}

function roas(gmv, spend) {
  return spend > 0 ? gmv / spend : 0;
}

function buildTree(rows) {
  const tree = {};
  for (const row of rows) {
    const { brand, cat, camp, kw, spendA, gmvA, spendB, gmvB } = row;

    if (!tree[brand]) tree[brand] = { spendA: 0, gmvA: 0, spendB: 0, gmvB: 0, cats: {} };
    tree[brand].spendA += spendA; tree[brand].gmvA += gmvA;
    tree[brand].spendB += spendB; tree[brand].gmvB += gmvB;

    const bNode = tree[brand];
    if (!bNode.cats[cat]) bNode.cats[cat] = { spendA: 0, gmvA: 0, spendB: 0, gmvB: 0, camps: {} };
    bNode.cats[cat].spendA += spendA; bNode.cats[cat].gmvA += gmvA;
    bNode.cats[cat].spendB += spendB; bNode.cats[cat].gmvB += gmvB;

    const cNode = bNode.cats[cat];
    if (!cNode.camps[camp]) cNode.camps[camp] = { spendA: 0, gmvA: 0, spendB: 0, gmvB: 0, kws: [] };
    cNode.camps[camp].spendA += spendA; cNode.camps[camp].gmvA += gmvA;
    cNode.camps[camp].spendB += spendB; cNode.camps[camp].gmvB += gmvB;

    if (kw) {
      cNode.camps[camp].kws.push(row);
    }
  }
  return tree;
}

function sortDesc(entries) {
  return [...entries].sort((a, b) => (b[1].spendA || 0) - (a[1].spendA || 0));
}

const COLS = (
  <tr className="bg-gray-800 text-white">
    <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-gray-800 z-10 min-w-[260px]">Brand / Category / Campaign / Keyword</th>
    <th className="px-3 py-2.5 text-right font-semibold min-w-[80px]">Spend A</th>
    <th className="px-3 py-2.5 text-right font-semibold min-w-[80px]">Spend B</th>
    <th className="px-2 py-2.5 text-center font-semibold min-w-[68px]">Δ Spend</th>
    <th className="px-3 py-2.5 text-center font-semibold min-w-[68px]">ROAS A</th>
    <th className="px-3 py-2.5 text-center font-semibold min-w-[68px]">ROAS B</th>
    <th className="px-2 py-2.5 text-center font-semibold min-w-[68px]">Δ ROAS</th>
  </tr>
);

export default function PeriodComparison({ platform = 'instamart' }) {
  const defs = getDefaults();
  const [startA, setStartA] = useState(defs.startA);
  const [endA, setEndA] = useState(defs.endA);
  const [startB, setStartB] = useState(defs.startB);
  const [endB, setEndB] = useState(defs.endB);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // expanded state: key → true (open) | false (closed); default open for brand, closed below
  const [exp, setExp] = useState({});

  const load = async (sA, eA, sB, eB) => {
    setLoading(true); setError(null); setData(null); setExp({});
    try {
      const p = new URLSearchParams({ startA: sA, endA: eA, startB: sB, endB: eB });
      const url = (platform === 'zepto' ? '/api/zepto/comparison' : '/api/comparison') + '?' + p;
      const r = await fetch(url);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { const d = getDefaults(); load(d.startA, d.endA, d.startB, d.endB); }, [platform]);

  const toggle = k => setExp(p => ({ ...p, [k]: !open(k, p) }));
  const open = (k, state = exp) => state[k] !== false; // default: open

  const tree = data?.rows ? buildTree(data.rows) : {};
  const hasData = Object.keys(tree).length > 0;

  return (
    <div className="space-y-4">
      {/* Period filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <span className="text-xs font-bold text-blue-700 shrink-0 w-16">Period A</span>
            <input type="date" value={startA} onChange={e => setStartA(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <span className="text-gray-400 text-xs">→</span>
            <input type="date" value={endA} onChange={e => setEndA(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2.5">
            <span className="text-xs font-bold text-orange-700 shrink-0 w-16">Period B</span>
            <input type="date" value={startB} onChange={e => setStartB(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
            <span className="text-gray-400 text-xs">→</span>
            <input type="date" value={endB} onChange={e => setEndB(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <button onClick={() => load(startA, endA, startB, endB)} disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Loading…' : 'Compare'}
          </button>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
        <p className="text-xs text-gray-400 mt-2">Δ ROAS: green = improved in Period B • Δ Spend: directional only</p>
      </div>

      {loading && (
        <div className="text-center py-12 text-sm text-gray-400 animate-pulse">Fetching comparison data…</div>
      )}

      {data && !hasData && (
        <div className="text-center py-12 text-sm text-gray-400">No data found for the selected date ranges.</div>
      )}

      {hasData && (
        <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm max-h-[75vh]">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-20">{COLS}</thead>
            <tbody>
              {sortDesc(Object.entries(tree)).map(([brand, bNode]) => {
                const bKey = 'b:' + brand;
                const bOpen = open(bKey);
                const bRoasA = roas(bNode.gmvA, bNode.spendA);
                const bRoasB = roas(bNode.gmvB, bNode.spendB);
                return (
                  <Fragment key={bKey}>
                    {/* Brand row */}
                    <tr className="bg-gray-900 text-white cursor-pointer hover:bg-gray-700 select-none"
                      onClick={() => toggle(bKey)}>
                      <td className="px-3 py-2 font-bold sticky left-0 bg-gray-900 z-10">
                        <span className="text-gray-400 text-xs mr-1.5">{bOpen ? '▼' : '▶'}</span>
                        {brand}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(bNode.spendA)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(bNode.spendB)}</td>
                      <DeltaCell from={bNode.spendA} to={bNode.spendB} />
                      <td className="px-3 py-2 text-center">{roasFmt(bRoasA)}</td>
                      <td className="px-3 py-2 text-center">{roasFmt(bRoasB)}</td>
                      <DeltaCell from={bRoasA} to={bRoasB} />
                    </tr>

                    {bOpen && sortDesc(Object.entries(bNode.cats)).map(([cat, cNode]) => {
                      const cKey = bKey + '|c:' + cat;
                      const cOpen = open(cKey);
                      const cRoasA = roas(cNode.gmvA, cNode.spendA);
                      const cRoasB = roas(cNode.gmvB, cNode.spendB);
                      return (
                        <Fragment key={cKey}>
                          {/* Category row */}
                          <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200 select-none"
                            onClick={() => toggle(cKey)}>
                            <td className="px-3 py-2 pl-7 font-semibold text-gray-800 sticky left-0 bg-gray-100 z-10">
                              <span className="text-gray-400 text-xs mr-1.5">{cOpen ? '▼' : '▶'}</span>
                              {cat}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-700">{fmt(cNode.spendA)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-700">{fmt(cNode.spendB)}</td>
                            <DeltaCell from={cNode.spendA} to={cNode.spendB} />
                            <td className="px-3 py-2 text-center text-gray-700">{roasFmt(cRoasA)}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{roasFmt(cRoasB)}</td>
                            <DeltaCell from={cRoasA} to={cRoasB} />
                          </tr>

                          {cOpen && sortDesc(Object.entries(cNode.camps)).map(([camp, campNode]) => {
                            const campKey = cKey + '|camp:' + camp;
                            const campOpen = open(campKey);
                            const campRoasA = roas(campNode.gmvA, campNode.spendA);
                            const campRoasB = roas(campNode.gmvB, campNode.spendB);
                            const hasKws = campNode.kws.length > 0;
                            return (
                              <Fragment key={campKey}>
                                {/* Campaign row */}
                                <tr className={'bg-blue-50 select-none ' + (hasKws ? 'cursor-pointer hover:bg-blue-100' : '')}
                                  onClick={() => hasKws && toggle(campKey)}>
                                  <td className="px-3 py-2 pl-12 font-medium text-blue-800 sticky left-0 bg-blue-50 z-10">
                                    {hasKws
                                      ? <span className="text-blue-300 text-xs mr-1.5">{campOpen ? '▼' : '▶'}</span>
                                      : <span className="text-blue-200 mr-1.5">•</span>}
                                    {camp.length > 40 ? camp.slice(0, 40) + '…' : camp}
                                  </td>
                                  <td className="px-3 py-2 text-right text-blue-800 font-medium">{fmt(campNode.spendA)}</td>
                                  <td className="px-3 py-2 text-right text-blue-800 font-medium">{fmt(campNode.spendB)}</td>
                                  <DeltaCell from={campNode.spendA} to={campNode.spendB} />
                                  <td className="px-3 py-2 text-center text-blue-700">{roasFmt(campRoasA)}</td>
                                  <td className="px-3 py-2 text-center text-blue-700">{roasFmt(campRoasB)}</td>
                                  <DeltaCell from={campRoasA} to={campRoasB} />
                                </tr>

                                {campOpen && campNode.kws
                                  .sort((a, b) => b.spendA - a.spendA)
                                  .map((row, ki) => (
                                    <tr key={campKey + '-kw-' + ki}
                                      className={ki % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      <td className="px-3 py-1.5 pl-[68px] text-gray-600 sticky left-0 z-10"
                                        style={{ backgroundColor: ki % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                        {row.kw}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-gray-700">{fmt(row.spendA)}</td>
                                      <td className="px-3 py-1.5 text-right text-gray-700">{fmt(row.spendB)}</td>
                                      <DeltaCell from={row.spendA} to={row.spendB} />
                                      <td className="px-3 py-1.5 text-center text-gray-700">{roasFmt(row.roasA)}</td>
                                      <td className="px-3 py-1.5 text-center text-gray-700">{roasFmt(row.roasB)}</td>
                                      <DeltaCell from={row.roasA} to={row.roasB} />
                                    </tr>
                                  ))}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

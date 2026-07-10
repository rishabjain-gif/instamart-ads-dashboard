// ============================================================
// ACTIONABLES CONFIG — edit all rule thresholds here.
// The Actionables tab always computes from the LATEST month in
// lib/config.js (SHEETS) and lib/zeptoConfig.js (ZEPTO_SHEETS).
// Add the new month's tab there each month — nothing else needed.
// ============================================================
export const ACTIONABLES_CONFIG = {
  // ROAS bands
  breakevenRoas: 1.0,     // below this = losing money -> PAUSE
  bidDownRoasMax: 1.3,    // breakeven to this = marginal -> BID DOWN
  scaleRoasMin: 3.0,      // above this = winner -> SCALE

  // Materiality (monthly spend needed to qualify)
  minPauseSpend: 5000,
  minBidDownSpend: 3000,
  minScaleSpend: 1000,
  minNegativeClicks: 25,  // clicks with 0 conversions -> negative keyword
  minCitySpend: 3000,     // city qualifies for reallocation check

  // Budget utilisation gate (Instamart only — TOTAL_BUDGET column)
  // Campaign must have spent >= this fraction of its allocated budget
  // before a "Raise budget" recommendation is shown.
  budgetUtilizationThreshold: 0.80,  // 80 %

  // Branded spend guardrail
  brandedSpendSharePct: 25,  // warn if branded keywords exceed this % of keyword spend
  brandedTerms: ['little joys', 'littlejoys', 'be bodywise', 'bodywise', 'man matters', 'manmatters', 'nutrimix'],

  // Impact estimation assumptions (display only)
  bidDownSavingPct: 0.25,
  scaleBudgetUpliftPct: 0.30,

  // Max rows shown per list
  maxRows: 50,
};

export const ZEPTO_SHEETS = {
  '2026-02': {
    label: 'February 2026',
    month: 2,
    year: 2026,
    url: 'https://docs.google.com/spreadsheets/d/19mKPsACuI_d4p77m8JuTmn2EtDRH9wdwl1QkTbWP6xs/export?format=csv&gid=1121379982'
  },
  '2026-03': {
    label: 'March 2026',
    month: 3,
    year: 2026,
    url: 'https://docs.google.com/spreadsheets/d/19mKPsACuI_d4p77m8JuTmn2EtDRH9wdwl1QkTbWP6xs/export?format=csv&gid=349584214'
  },
  '2026-04': {
    label: 'April 2026',
    month: 4,
    year: 2026,
    url: 'https://docs.google.com/spreadsheets/d/19mKPsACuI_d4p77m8JuTmn2EtDRH9wdwl1QkTbWP6xs/export?format=csv&gid=1692621893'
  },
};

export function getZeptoCurrentAndPreviousMonths() {
  const keys = Object.keys(ZEPTO_SHEETS).sort();
  const currentKey = keys[keys.length - 1];
  const prevKey = keys.length >= 2 ? keys[keys.length - 2] : null;
  return {
    current: { key: currentKey, ...ZEPTO_SHEETS[currentKey] },
    previous: prevKey ? { key: prevKey, ...ZEPTO_SHEETS[prevKey] } : null
  };
}

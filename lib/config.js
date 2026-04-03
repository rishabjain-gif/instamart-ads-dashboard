export const SHEETS = {
  '2026-02': { label: 'February 2026', month: 2, year: 2026, url: 'https://docs.google.com/spreadsheets/d/1fo29rN_otpnPfL_ShRTjkT-e2aEtVN_sR1dFiQHITjw/export?format=csv&gid=397602766' },
  '2026-03': { label: 'March 2026', month: 3, year: 2026, url: 'https://docs.google.com/spreadsheets/d/1RPz8ONTLYLoOY4Gu4X9Akd0FUso6YHry1coso5Kmoe8/export?format=csv&gid=22380786' },
      '2026-04': { label: 'April 2026', month: 4, year: 2026, url: 'https://docs.google.com/spreadsheets/d/1nU2dzFkTJq_huYxW8hMBobL3R836eURID_NrblltJTc/export?format=csv&gid=811114143' },
};
export function getCurrentAndPreviousMonths() {
  const keys = Object.keys(SHEETS).sort();
  const currentKey = keys[keys.length - 1];
  const prevKey = keys.length >= 2 ? keys[keys.length - 2] : null;
  return { current: { key: currentKey, ...SHEETS[currentKey] }, previous: prevKey ? { key: prevKey, ...SHEETS[prevKey] } : null };
}

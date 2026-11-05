/** Pure helpers — no framework, no database. */
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Normalised comparison key (lower-case, alphanumerics only). */
export const norm = (x: unknown): string => String(x ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function validYMD(y: number, m: number, d: number): boolean {
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
/** Excel serial (1900 system) → 'YYYY-MM-DD'. 25569 = 1970-01-01. */
export function serialToISO(serial: number): string {
  const dt = new Date(Math.round((Number(serial) - 25569) * 86400000));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
/** Parse a date from user/Excel input → 'YYYY-MM-DD' or null. Numeric d/m/y is read day-first (ASSUMPTION, OQ-19). */
export function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(+v) ? null : iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) { const n = Number(s); return n >= 25569 && n <= 73050 ? serialToISO(n) : null; }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return validYMD(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (m) { let y = +m[3]; if (m[3].length === 2) y += 2000; return validYMD(y, +m[2], +m[1]) ? iso(y, +m[2], +m[1]) : null; }
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,-]*(\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; return validYMD(+m[3], mo, +m[1]) ? iso(+m[3], mo, +m[1]) : null; }
  return null;
}
export const todayISO = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
export function addMonths(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, last));
}
export function diffDays(a: string, b: string): number {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
export function num(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/,/g, '').trim();
  return s === '' ? NaN : Number(s);
}
export const money = (n: number) => 'QAR ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const uniqSorted = (arr: unknown[]): string[] => [...new Set(arr.filter(Boolean) as string[])].sort((a, b) => String(a).localeCompare(String(b)));
export const sum = <T,>(arr: T[], fn: (x: T) => unknown): number => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
export const pctText = (a: number, b: number) => (b ? Math.round((a / b) * 100) + '%' : '—');
export const dateToISO = (d: Date | null | undefined): string => (d ? iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) : '');
/** 'YYYY-MM-DD' → Date at UTC midnight (for DATE columns); '' → null. */
export const isoToDate = (s: string | null | undefined): Date | null => (s ? new Date(s + 'T00:00:00.000Z') : null);

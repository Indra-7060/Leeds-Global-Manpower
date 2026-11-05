/** CSV parse + serialise. Quotes every value, neutralises spreadsheet formula injection, detects , ; and tab delimiters. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r\n|\n|\r/).find(l => l.trim()) ?? '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const c of first) { if (c === '"') q = !q; else if (!q && c in counts) counts[c]++; }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ',';
}

/** RFC-4180 style parser. Blank rows are dropped. */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = String(input ?? '').replace(/^﻿/, '');
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = []; let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(x => x.trim())) rows.push(row); row = []; field = '';
    } else field += c;
  }
  row.push(field); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

/** Text cells starting with = + @ tab CR (or '-' that is not a number) are prefixed with ' so Excel will not run them as formulas. */
export function guard(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  if (/^[=+@\t\r]/.test(v)) return "'" + v;
  if (/^-/.test(v) && !/^-\s*[\d.,]+$/.test(v)) return "'" + v;
  return v;
}
const cell = (v: unknown) => '"' + String(guard(v ?? '')).replace(/"/g, '""') + '"';
export const stringifyCsv = (rows: unknown[][]) => rows.map(r => r.map(cell).join(',')).join('\r\n');

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  return stringifyCsv([columns.map(c => c.label), ...rows.map(r => columns.map(c => r[c.key]))]);
}

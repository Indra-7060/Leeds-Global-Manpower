'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { norm } from '@/lib/util';

export interface TableRow { key: string; cells: ReactNode[]; search: string; filters: Record<string, string>; actions?: ReactNode }
export interface TableFilter { key: string; label: string; values: string[] }

/** Register table with instant search + dropdown filters (filtering runs in the browser on the rows the server sent). */
export default function DataTable({ columns, rows, filters = [], empty = 'No records yet.', searchLabel = 'Search' }: {
  columns: string[]; rows: TableRow[]; filters?: TableFilter[]; empty?: string; searchLabel?: string;
}) {
  const [q, setQ] = useState('');
  const [f, setF] = useState<Record<string, string>>({});
  const shown = useMemo(() => {
    const nq = norm(q);
    return rows.filter(r => (!nq || norm(r.search).includes(nq)) && Object.entries(f).every(([k, v]) => !v || v === 'All' || r.filters[k] === v));
  }, [rows, q, f]);
  const hasActions = rows.some(r => r.actions);
  return (
    <>
      <div className="toolbar">
        <input className="input grow" type="search" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} aria-label={searchLabel} />
        {filters.map(fl => (
          <select key={fl.key} className="input" aria-label={`Filter by ${fl.label}`} value={f[fl.key] ?? 'All'} onChange={e => setF(p => ({ ...p, [fl.key]: e.target.value }))}>
            <option value="All">All {fl.label}</option>
            {fl.values.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
        <span className="count">{shown.length} of {rows.length}</span>
      </div>
      {shown.length === 0 ? <div className="empty">{rows.length ? 'No records match the search/filters.' : empty}</div> : (
        <div className="scroll-x"><table>
          <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}{hasActions && <th />}</tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.key}>{r.cells.map((c, i) => <td key={i}>{c}</td>)}{hasActions && <td><div className="table-actions">{r.actions}</div></td>}</tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

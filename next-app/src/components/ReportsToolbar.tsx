'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { C } from '@/lib/config';
import { quickReports } from '@/lib/quick';
import { downloadFrom } from './download';
import { useToast } from './Toaster';

const HIDDEN = ['/', '/import-center', '/cv-inbox', '/vault', '/finance', '/settings', '/corporate', '/visa-master', '/reports', '/ai-reports'];

/** V6's "📊 Reports & Excel" bar: filters + quick-report chips that download CSV straight from the current section. */
export default function ReportsToolbar({ clients, countries }: { clients: string[]; countries: string[] }) {
  const path = usePathname(); const toast = useToast();
  const [f, setF] = useState({ client: 'All', country: 'All', stage: 'All' });
  const page = path.split('/').filter(Boolean)[0] ?? '';
  if (HIDDEN.includes(path) || path.startsWith('/soon') || path.startsWith('/api')) return null;
  const qs = (name: string) => `/api/export?report=${encodeURIComponent(name)}&client=${encodeURIComponent(f.client)}&country=${encodeURIComponent(f.country)}&stage=${encodeURIComponent(f.stage)}`;
  const quick = quickReports(page);
  const sel = (k: 'client' | 'country', label: string, vals: string[]) => (
    <select aria-label={label} value={f[k]} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))}><option value="All">All {label}</option>{vals.map(v => <option key={v}>{v}</option>)}</select>
  );
  return (
    <section className="v6-tools">
      <div className="row between"><div><strong>📊 Reports &amp; Excel</strong><div className="muted">Generate a report directly from this section</div></div>
        <div className="row"><Link href="/import-center" className="btn secondary" style={{ padding: '11px 14px' }}>⇧ Import Excel</Link>
          <button type="button" onClick={() => downloadFrom(qs(quick[0]), toast)}>⇩ Export Report (CSV)</button></div></div>
      <div className="v6-filter">{sel('client', 'Clients', clients)}{sel('country', 'Countries', countries)}
        <select aria-label="Stage" value={f.stage} onChange={e => setF(p => ({ ...p, stage: e.target.value }))}>{['All', ...C.stageFilters].map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="v6-reportlinks">{quick.map(x => <button key={x} type="button" onClick={() => downloadFrom(qs(x), toast)}>{x} ↓</button>)}</div>
      <small>Reports are calculated from the records in the database and download as CSV (opens in Excel). Native XLSX and PDF export are not available yet.</small>
    </section>
  );
}

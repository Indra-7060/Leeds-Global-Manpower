import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { keywordReport } from '@/lib/domain/reports';
import { can } from '@/lib/config';
import { Cards, Heading, Metric, Notice, Panel, Table } from '@/components/ui';
import DownloadButton from '@/components/DownloadButton';

const enc = encodeURIComponent;

export default async function AiReportsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, ws } = await requireUser();
  const { q } = await searchParams;
  const s = await loadState(ws), canFin = can(user.role, 'finance.export');
  const res = q ? keywordReport(q, s, user.role) : null;
  const presets = ['QVC pending', 'Flight pending', 'Visa printed', 'All candidates', 'All manpower orders', ...(canFin ? ['All finance transactions'] : [])];
  const imported = (arr: { _src?: unknown }[]) => arr.filter(x => x._src).length;
  return (
    <>
      <Heading title="AI Reports & Excel Exports" desc="Ask for pending QVC, flights, client status, agency accounts and more" />
      <Notice>This is a keyword-based report filter, NOT a connected AI model. It reads the records in this workspace and tells you how it understood your request. CSV opens in Excel; native .xlsx and natural-language reporting are not available yet.</Notice>
      <form className="panel" method="get">
        <h3>Ask for a report</h3>
        <label htmlFor="aiQuery">Report request</label>
        <input className="input" id="aiQuery" name="q" defaultValue={q ?? ''} placeholder={`e.g. Show QVC pending for ${s.clients[0]?.name ?? 'a client'} Nepal`} />
        <p><button className="btn" type="submit">Generate report</button></p>
        <div className="row" style={{ gap: 8 }}>{presets.map(p => <Link key={p} className="btn secondary" href={`/ai-reports?q=${enc(p)}`}>{p}</Link>)}</div>
      </form>
      {res && (res.error
        ? <Notice>{res.error}</Notice>
        : <Panel title={`Result — ${res.name}`} actions={<DownloadButton url={`/api/export?q=${enc(q!)}`} label="⇩ Export CSV" />}>
            <p className="muted">{res.interpretation?.join(' · ')}</p><p className="muted">{res.rows.length} record(s){res.rows.length > 100 ? ' — showing the first 100; export for all' : ''}</p>
            <Table head={res.columns.map(c => c.label)} rows={res.rows.slice(0, 100).map(r => res.columns.map(c => String(r[c.key] ?? '')))} empty="No matching records for these filters." /></Panel>)}
      <Panel title="One-click Exports">
        <div className="row" style={{ gap: 10 }}>
          {([['All Clients Visa Summary', 'Master Recruitment Report'], ['QVC Pending', 'QVC Pending'], ['Flight Pending', 'Flight Pending'], ['Manpower Orders', 'All Orders'], ['CV Intake', 'CV Intake']] as const).map(([l, n]) => <DownloadButton key={l} url={`/api/export?report=${enc(n)}`} label={l} />)}
          {canFin && <DownloadButton url={`/api/export?report=${enc('Private Finance')}`} label="Private Finance" />}
        </div>
      </Panel>
      <Panel title="Record Counts"><Cards><Metric label="Candidates" value={s.candidates.length} sub={`${imported(s.candidates)} imported from files`} /><Metric label="Orders" value={s.orders.length} sub={`${imported(s.orders)} imported from files`} />
        {canFin && <Metric label="Finance entries" value={s.finance.length} sub={`${s.finance.filter(f => f._key).length} imported from files`} />}<Metric label="CV intake files" value={s.cvInbox.length} sub="Metadata only" /></Cards></Panel>
    </>
  );
}

import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { computeAlerts } from '@/lib/domain/alerts';
import { runReport } from '@/lib/domain/reports';
import { roleLabel } from '@/lib/config';
import { todayISO } from '@/lib/util';
import { Badge, Heading, Notice, Panel, Table } from '@/components/ui';
import DownloadButton from '@/components/DownloadButton';

const PLANNED: [string, string][] = [['Country-wise Recruitment', 'Orders, CVs, selection and deployment'], ['Agent Performance', 'CVs, selection ratio, arrivals (CV quality not defined — open question)'],
  ['Warranty Expiry', 'Upcoming expiries and open complaints'], ['Demand & Sales Visits', 'Follow-up, conversion and open demand']];
const enc = encodeURIComponent;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { user, ws } = await requireUser();
  const { preview } = await searchParams;
  const s = await loadState(ws), alerts = computeAlerts(s);
  const pv = preview && PLANNED.some(p => p[0] === preview) ? runReport(preview, s, { today: todayISO() }, user.role) : null;
  return (
    <>
      <Heading title="Reports, Reminders & Audit" desc="Management-wide reports and pending operational actions" />
      <Panel title="Management Reports">
        <Table head={['Report', 'Purpose', 'Open']} rows={[
          ['All Clients Visa Summary', 'One-page company-wise visa position', <span key="m" className="row"><Link className="btn secondary small" href="/visa-master">Open</Link><DownloadButton url={`/api/export?report=${enc('Master Recruitment Report')}`} label="Export" cls="ghost small" /></span>],
          ...PLANNED.map(([n, p]) => [n, p, <span key={n} className="row"><Link className="btn secondary small" href={`/reports?preview=${enc(n)}`}>Preview</Link><DownloadButton url={`/api/export?report=${enc(n)}`} label="Export" cls="ghost small" /></span>])]} />
      </Panel>
      {pv && <Panel title={`Preview — ${pv.name}`} actions={<DownloadButton url={`/api/export?report=${enc(pv.name)}`} label="⇩ Export CSV" />}>
        <p className="muted">{pv.rows.length} record(s)</p>
        <Table head={pv.columns.map(c => c.label)} rows={pv.rows.slice(0, 100).map(r => pv.columns.map(c => String(r[c.key] ?? '')))} empty="No matching records." /></Panel>}
      <Panel title="Reminders">
        <Table head={['Priority', 'Action', 'Assigned To', 'Count', 'Items', '']} rows={alerts.map(a => [<Badge key="b" text="Pending" />, a.action, a.assigned, a.count,
          <span key="i">{a.items.slice(0, 3).map(x => <span className="tag" key={x}>{x}</span>)}{a.count > 3 && <span className="muted">+{a.count - 3} more</span>}</span>, <Link key="o" className="btn secondary small" href={`/${a.page}`}>Open</Link>])} empty="No pending reminders. Everything is up to date." />
        <p className="muted">Reminders are calculated from live records each time this page opens. They are in-app only: e-mail / WhatsApp / scheduled delivery needs a notification service (open question OQ-17).</p>
      </Panel>
      <Panel title="Audit Log (latest 100 changes)" actions={<DownloadButton url={`/api/export?report=${enc('Audit Log')}`} label="Export audit log" cls="secondary small" />}>
        <Table head={['When', 'Role', 'Client', 'Activity']} rows={s.activity.slice(0, 100).map(a => [String(a.at).slice(0, 16).replace('T', ' '), a.role ? roleLabel(a.role) : '—', a.client || '—', a.text])} empty="No activity recorded yet." />
      </Panel>
      <Notice>Financial reports remain private (Managing Director and Admin Manager) and are checked on the server. The audit log is stored in the database with the user and role of every change.</Notice>
    </>
  );
}

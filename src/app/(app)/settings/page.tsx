import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { prisma } from '@/lib/db';
import { loadState } from '@/lib/repo/state';
import { C, can, roleLabel } from '@/lib/config';
import { diffDays, sum, todayISO } from '@/lib/util';
import { Heading, Notice, Panel, Table } from '@/components/ui';
import DownloadButton from '@/components/DownloadButton';
import DangerZone from './danger-zone';
import PasswordForm from './password-form';
import UsersAdmin from './users-admin';
import { ListEditor } from '@/components/V8Controls';
import { LIST_KINDS } from '@/lib/repo/mutations-v8b';

const TRAVEL = ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];

export default async function SettingsPage() {
  const { user, ws } = await requireUser();
  const s = await loadState(ws), today = todayISO();
  const listItems = await prisma.listItem.findMany({ where: { workspace: ws }, orderBy: { value: 'asc' } });
  const canLists = can(user.role, 'lists.manage');
  const users = can(user.role, 'users.manage') ? await prisma.user.findMany({ orderBy: { id: 'asc' }, select: { id: true, email: true, name: true, role: true, active: true } }) : [];
  const counts: [string, number][] = [['Clients', s.clients.length], ['Orders', s.orders.length], ['Candidates', s.candidates.length], ['Visits', s.visits.length], ['Demand letters', s.demands.length], ['Agency allocations', s.allocations.length],
    ['Interviews', s.interviews.length], ['Travel records', s.tickets.length], ['Warranty cases', s.warranties.length], ['Domestic cases', s.domestic.length], ['Credential records', s.credentials.length],
    ...(can(user.role, 'finance.view') ? [['Finance entries', s.finance.length] as [string, number]] : []), ['CV intake files', s.cvInbox.length]];
  const checks: [string, number, string][] = [
    ['Candidates not linked to an order', s.candidates.filter(c => !c.order_id).length, '/candidates'],
    ['Orders with no linked candidates', s.orders.filter(o => !s.candidates.some(c => c.order_id === o.id)).length, '/orders'],
    ['Orders whose agency allocations exceed the ordered quantity', s.orders.filter(o => sum(s.allocations.filter(a => a.order_id === o.id), a => a.allocated) > o.qty).length, '/agencies'],
    ['Candidates at Visa Printed or later without a travel record', s.candidates.filter(c => TRAVEL.includes(c.status) && !s.tickets.some(t => t.candidate_id === c.id)).length, '/tickets'],
    ['Open warranty cases past their expiry date', s.warranties.filter(w => w.status !== 'Closed' && w.warranty_expiry && diffDays(today, w.warranty_expiry) < 0).length, '/warranty'],
    ['Clients with no orders and no visits', s.clients.filter(c => !s.orders.some(o => o.client === c.name) && !s.visits.some(v => v.client === c.name)).length, '/clients'],
  ];
  const cfg: [string, string, string][] = [
    ['Candidate stages and order', C.stages.join(' → '), 'From V6'], ['Optional (skippable) stages', C.optionalStages.join(', '), 'From V6 notes'], ['Reject allowed from', C.rejectableFrom.join(', '), 'ASSUMPTION · OQ-1'],
    ['Dashboard pipeline groups', C.pipelineGroups.map(g => `${g.label}: ${g.stages.join(', ')}`).join(' | '), 'ASSUMPTION · OQ-2'], ['Flight Pending', C.stageSets['Flight Pending'].join(', '), 'V6 conflicting · OQ-4'],
    ['Deployed (master report)', C.stageSets.Deployed.join(', '), 'ASSUMPTION · OQ-5'], ['Order stages / closed', `${C.orderStatuses.join(', ')} — closed: ${C.orderClosed.join(', ')}`, 'Mixed · OQ-3'],
    ['Labour warranty (months)', String(C.warrantyMonths.Labour), 'V6 “illustrative” · OQ-8'], ['Domestic warranty', 'not set — enter expiry manually', 'V6: verify law · OQ-8'], ['Warranty alert window (days)', String(C.warrantyAlertDays), 'ASSUMPTION · OQ-21'],
    ['Candidate ID prefixes', Object.entries(C.countryPrefix).map(([k, v]) => `${k}=${v}`).join(', '), 'BD/NP from V6 · OQ-22'], ['Currency', C.app.currency, 'From V6 · OQ-24'],
  ];
  return (
    <>
      <Heading title="Settings & Data" desc="Workspace, backups, data quality, users and configuration" />
      <Panel title="Workspace">
        <p>You are working in the <span className={`mode-pill ${ws === 'demo' ? 'mode-demo' : 'mode-live'}`} style={{ cursor: 'default' }}>{ws.toUpperCase()}</span> workspace.</p>
        <p className="muted">{ws === 'demo' ? 'The DEMO workspace holds fictional sample data. It is stored separately from the LIVE workspace (every record carries its workspace), and exports are labelled DEMO.' : 'The LIVE workspace holds the real business records and is completely separate from the DEMO data. Exports are labelled LIVE.'} {can(user.role, 'workspace.switch') ? 'Switch with the DEMO/LIVE button at the top of the page.' : 'Only the Managing Director or Admin Manager can switch workspace.'}</p>
        <Table head={['Data set', 'Records']} rows={counts} />
      </Panel>
      <Panel title="Backup & Export">
        <p className="muted">A JSON export is a readable copy of this workspace’s records. It is <b>not</b> a database backup. For real backups use phpMyAdmin → <i>leeds_global_manpower</i> → Export, or run <span className="mono">C:\xampp\mysql\bin\mysqldump.exe -u root leeds_global_manpower &gt; backup.sql</span> regularly and keep copies off this computer.</p>
        {can(user.role, 'data.backup') ? <DownloadButton url="/api/backup" label="Download workspace export (JSON)" /> : <p className="muted">Only the Managing Director or Admin Manager can export workspace data.</p>}
      </Panel>
      <Panel title="Data Tools"><DangerZone ws={ws} canReset={can(user.role, 'data.reset')} /></Panel>
      <Panel title="Editable lists">
        <p className="muted" style={{ marginTop: 0 }}>Standard choices (grey) are fixed; you can add your own (green) and remove them again. Existing records keep the value they were saved with.</p>
        {(Object.keys(LIST_KINDS) as (keyof typeof LIST_KINDS)[]).map(k => canLists ? <ListEditor key={k} kind={k} label={LIST_KINDS[k].label} base={LIST_KINDS[k].base} items={listItems.filter(i => i.kind === k).map(i => ({ id: i.id, value: i.value }))} /> : <p key={k}><b>{LIST_KINDS[k].label}:</b> {[...LIST_KINDS[k].base, ...listItems.filter(i => i.kind === k).map(i => i.value)].join(', ')}</p>)}
        {!canLists && <p className="muted">Only the Managing Director or Admin Manager can change these lists.</p>}
      </Panel>
      <Panel title="Data Quality Checks">
        <Table head={['Check', 'Count', '']} rows={checks.map(([l, n, href]) => [l, <span key="n" className={`pill ${n ? 'orange' : 'green'}`}>{n}</span>, <Link key="v" className="btn ghost small" href={href}>View</Link>])} />
      </Panel>
      <Panel title="My Account"><p className="muted">Signed in as {user.email} ({roleLabel(user.role)}).</p><PasswordForm /></Panel>
      {users.length > 0 && <Panel title="Users"><UsersAdmin users={users} meId={user.userId} roles={C.roles} /></Panel>}
      <Panel title="Configuration in force (read-only)">
        <Table head={['Setting', 'Value', 'Origin']} rows={cfg} />
        <p className="muted">Everything marked ASSUMPTION is a placeholder pending client confirmation; it lives in <span className="mono">src/lib/config.ts</span>.</p>
      </Panel>
      <Notice>Roles are enforced on the server for every action. Passwords are stored as salted hashes. There is no e-mail password reset yet — the Managing Director resets passwords here.</Notice>
    </>
  );
}

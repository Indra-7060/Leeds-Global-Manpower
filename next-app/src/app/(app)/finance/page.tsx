import Link from 'next/link';
import { requirePermission } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { financeTotals } from '@/lib/domain/metrics';
import { C } from '@/lib/config';
import { money } from '@/lib/util';
import { Badge, Cards, Heading, Metric, Muted, Notice, Panel, Table } from '@/components/ui';
import { prisma } from '@/lib/db';
import { can } from '@/lib/config';
import * as V from '@/lib/domain/v8';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { AllocationDecision } from '@/components/V8Controls';
import DataTable, { type TableRow } from '@/components/DataTable';
import DownloadButton from '@/components/DownloadButton';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';
import ClearFinanceButton from './clear-finance';
import CostingCalculator from './costing';

const TABS: [string, string][] = [['labour', 'Blue-Collar · Cash'], ['domestic', 'Domestic Workers · QIIB'], ['all', 'Consolidated']];

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { user, ws } = await requirePermission('finance.view'); // server-side: Operations Staff are redirected
  const { d: dq } = await searchParams;
  const div = dq === 'domestic' || dq === 'all' ? dq : 'labour';
  const s = await loadState(ws), t = financeTotals(s, div), lookups = { ...buildLookups(s), ...(await v8Lookups(ws, user.role)) };
  const deposits = await prisma.financeEntry.findMany({ where: { workspace: ws, category: C.v8.allocationCategory, direction: 'Incoming' }, include: { allocations: { include: { order: true, candidate: true }, orderBy: { id: 'asc' } } }, orderBy: { date: 'desc' } });
  const canApprove = can(user.role, 'allocation.approve');
  const unalloc = deposits.reduce((a, e) => a + V.unallocated(Number(e.amount), e.allocations.map(x => ({ status: x.status, amount: Number(x.amount) }))).unallocated, 0);
  const today = new Date().toISOString().slice(0, 10), defDiv = div === 'all' ? 'labour' : div;
  const rows: TableRow[] = s.finance.filter(f => div === 'all' || f.division === div).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map(f => ({
    key: String(f.id), search: `${f.date} ${f.party} ${f.client} ${f.country} ${f.category} ${f.ref} ${f.order}`, filters: { category: f.category, account: f.account, direction: f.direction },
    cells: [f.date, f.party, [f.client, f.country].filter(Boolean).join(' / '), f.category, f.account, f.direction === 'Incoming' ? money(f.amount) : '—', f.direction === 'Outgoing' ? money(f.amount) : '—'],
    actions: <><EntityForm entity="finance" id={f.id} label="Edit" cls="secondary small" values={f} lookups={lookups} /><DeleteButton entity="finance" id={f.id} what={`${f.date} ${f.party}`} /></>,
  }));
  return (
    <>
      <Heading title="Private Accounts & Finance" desc="Two separate divisions • daily receipts and payments • client costing • partner settlements" />
      <Notice tone={ws === 'live' ? 'live' : undefined}>{ws === 'demo' ? 'DEMO FINANCE — fictional entries only. Never enter real financial data in the demo workspace.' : 'LIVE finance data. Access is limited to the Managing Director and Admin Manager and is checked on the server; every change is logged.'}</Notice>
      <div className="tabs">{TABS.map(([id, label]) => <Link key={id} href={`/finance?d=${id}`} className={`tab ${div === id ? 'selected' : ''}`}>{label}</Link>)}</div>
      <Cards><Metric label="Money Received" value={money(t.incoming)} sub="Selected division" /><Metric label="Money Paid" value={money(t.outgoing)} sub="Selected division" /><Metric label="Net Cash Movement" value={money(t.net)} sub="Not accounting profit" /><Metric label="Transactions" value={t.count} sub="Cashbook entries" /></Cards>
      <Panel title={`Daily Cashbook — ${div === 'all' ? 'All Divisions' : div === 'labour' ? 'Blue-Collar' : 'Domestic Workers'}`}
        actions={<><EntityForm entity="finance" label={ws === 'demo' ? '+ Save Sample Transaction' : '+ Record Transaction'} values={{ date: today, division: defDiv, account: C.financeDefaultAccount[defDiv] }} lookups={lookups} />
          <DownloadButton url={`/api/export?report=${encodeURIComponent('Private Finance')}&division=${div}`} label="Export Excel" /><ClearFinanceButton count={s.finance.length} demo={ws === 'demo'} /></>}>
        <DataTable columns={['Date', 'Agency / Customer', 'Client / Country', 'Category', 'Account', 'Incoming', 'Outgoing']} rows={rows}
          filters={[{ key: 'category', label: 'Categories', values: [...C.financeCategories] }, { key: 'account', label: 'Accounts', values: [...C.financeAccounts] }, { key: 'direction', label: 'Directions', values: ['Incoming', 'Outgoing'] }]}
          empty="No transactions yet. Record one or import a finance sheet." />
      </Panel>
      <Panel title="Agency Deposits & Allocations" actions={<EntityForm entity="fundAllocations" label="+ Propose Allocation" lookups={lookups} />}>
        <p className="muted" style={{ marginTop: 0 }}>Agency deposits stay <b>unallocated</b> until the Managing Director approves an explicit allocation. Nothing is allocated automatically. Unallocated now: <b>{money(unalloc)}</b>.</p>
        <Table head={['Date', 'Agency', 'Client / country', 'Deposit', 'Allocated (approved)', 'Unallocated', 'Allocations']}
          rows={deposits.map(e => { const u = V.unallocated(Number(e.amount), e.allocations.map(x => ({ status: x.status, amount: Number(x.amount) }))); return [e.date.toISOString().slice(0, 10), e.party, [e.client, e.country].filter(Boolean).join(' / ') || '—', money(Number(e.amount)), money(u.allocated), <b key="u">{money(u.unallocated)}</b>,
            e.allocations.length ? <div key="a">{e.allocations.map(a => <div key={a.id} className="row" style={{ gap: 8, margin: '3px 0' }}><span>{money(Number(a.amount))} → {a.order?.code ?? a.candidate?.code ?? '—'}</span><Badge text={a.status} />{a.status === 'Proposed' && canApprove && <AllocationDecision id={a.id} />}{a.status === 'Proposed' && <DeleteButton entity="fundAllocations" id={a.id} what="This proposal" />}</div>)}</div> : <span key="n" className="muted">none</span>]; })}
          empty="No incoming “Agency advance” deposits recorded." />
        {!canApprove && <Muted>Only the Managing Director can approve an allocation.</Muted>}
      </Panel>
      <Panel title={`Client & Country Costing — ${ws === 'demo' ? 'Sample' : 'Projection'}`}><CostingCalculator /></Panel>
      <Panel title="Accounting Rules & Approvals">
        <p><b>Blue-Collar:</b> default Cash. <b>Domestic Workers:</b> default QIIB. Both can have exceptions; record transfers separately from income.</p>
        <p>Overseas agency advances remain unallocated liabilities. Nepal candidate charges of QAR 1,500 arise only on <b>verified Qatar arrival</b>. Every manual advance allocation needs Managing Director approval (see Agency Deposits & Allocations above). Partner liabilities and visa investments must be tracked separately.</p>
        <Muted>These accounting rules are stated in V6 as text only. This version records and totals transactions; allocations are approved by the Managing Director (above); the arrival-triggered agency charge, reversals and bank reconciliation are not automated (open question OQ-9).</Muted>
      </Panel>
    </>
  );
}

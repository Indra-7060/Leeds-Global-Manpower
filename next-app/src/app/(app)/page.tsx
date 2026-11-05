import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { C } from '@/lib/config';
import * as M from '@/lib/domain/metrics';
import { computeAlerts } from '@/lib/domain/alerts';
import { sum } from '@/lib/util';
import { Bar, Cards, Flow, Heading, Metric, Notice, Panel, Table } from '@/components/ui';
import { overview } from '@/lib/repo/dashboard-v8';
import { money } from '@/lib/util';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; denied?: string }> }) {
  const { user, ws } = await requireUser();
  const { tab = 'labour', denied } = await searchParams;
  const s = await loadState(ws);
  const tabs: [string, string][] = [['labour', 'Overseas Labour · Active'], ['domestic', 'Domestic Workers · Active'], ['corporate', 'Corporate Recruitment'], ['overview', 'Management Overview']];

  return (
    <>
      <Heading title="Management Dashboard" desc="Overview of the three recruitment divisions" />
      {denied && <Notice>You do not have permission for that action ({denied}).</Notice>}
      <div className="tabs">{tabs.map(([id, label]) => <Link key={id} href={`/?tab=${id}`} className={`tab ${tab === id ? 'selected' : ''}`}>{label}</Link>)}</div>

      {tab === 'labour' && (() => {
        const m = M.labour(s), total = Math.max(1, sum(m.groups, g => g.count));
        return (
          <>
            <Cards>
              <Metric label="Open Orders" value={m.openOrders} sub="Across active clients" /><Metric label="CVs Received" value={m.cvsReceived.toLocaleString('en-US')} sub="Candidate records" />
              <Metric label="Visa Pipeline" value={m.visaPipeline} sub="Across visa stages" /><Metric label="Ready to Fly" value={m.readyToFly} sub="Deployment queue" />
            </Cards>
            <div className="split">
              <Panel title="Live Recruitment Pipeline">
                {m.groups.map(g => <Bar key={g.label} label={g.label} count={g.count} pct={(g.count / total) * 100} />)}
                <p className="muted">Each candidate is counted once, in their current stage group. Deployed and rejected candidates are not shown here.</p>
              </Panel>
              <Panel title="Recent Activity">
                <Table head={['Client', 'Update', 'Date']} rows={s.activity.filter(a => a.text).slice(0, 7).map(a => [a.client || '—', a.text, String(a.at).slice(0, 10)])} empty="No activity yet — add or import records and the latest changes appear here." />
              </Panel>
            </div>
            <Panel title="Pending Actions">
              <Table head={['Pending action', 'Assigned to', 'Count']} rows={computeAlerts(s).slice(0, 6).map(a => [a.action, a.assigned, a.count])} empty="Nothing pending." />
            </Panel>
          </>
        );
      })()}

      {tab === 'domestic' && (() => {
        const m = M.domestic(s);
        return (
          <>
            <Cards><Metric label="Enquiries" value={m.enquiries} sub="Cases" /><Metric label="Profiles Shared" value={m.profilesShared} sub="Profiles stage or later" /><Metric label="Visa Cases" value={m.visaCases} sub="Visa & Travel" /><Metric label="Handovers" value={m.handovers} sub="Arrival / guarantee" /></Cards>
            <Panel title="Domestic Worker Journey"><Flow items={C.domesticStatuses} /></Panel>
          </>
        );
      })()}

      {tab === 'corporate' && (async () => {
        const o = await overview(ws, user.role, user.userId);
        return (
          <>
            <Cards cols={3}><Metric label="Open Vacancies" value={o.openVacancies} sub="Companies hiring" /><Metric label="Candidates" value={o.corporateCandidates} sub="Local and overseas" /><Metric label="Placement fees" value={o.money ? money(o.money.placementOut) : 'Management only'} sub="Outstanding" /></Cards>
            <Panel title="Corporate Journey"><Flow items={['Company Vacancy', 'Candidate Sourcing', 'Interview', 'Offer', 'Confirmed Joining', 'Placement Fee']} /></Panel>
            <p><Link href="/corporate" className="btn secondary">Open Corporate Recruitment</Link></p>
          </>
        );
      })()}

      {tab === 'overview' && (async () => {
        const o = await overview(ws, user.role, user.userId);
        const K = ({ label, value, sub, href }: { label: string; value: React.ReactNode; sub: string; href: string }) => <Link href={href} className="card" style={{ textDecoration: 'none', color: 'inherit' }}><div className="muted">{label}</div><div className="num">{value}</div><div className="muted">{sub} →</div></Link>;
        const m = o.money;
        return (
          <>
            <Cards><K label="Overdue tasks" value={o.overdueTasks} sub={`${o.openTasks} open`} href="/tasks" /><K label="Contracts expiring" value={o.expiringContracts} sub="Within 90 days or expired" href="/contracts" /><K label="Joined this month" value={o.joinedThisMonth} sub="Blue-collar" href="/deployment" /><K label="Warranty cases open" value={o.openWarranty} sub="Blue-collar and domestic" href="/warranty" /></Cards>
            <Cards><K label="Domestic sponsor cases" value={o.domesticCases} sub="Individual sponsors" href="/domestic" /><K label="Open vacancies" value={o.openVacancies} sub="Corporate" href="/corporate" /><K label="Active orders" value={M.labour(s).openOrders} sub="Blue-collar" href="/orders" /><K label="Flight pending" value={M.labour(s).readyToFly} sub="Ready to fly" href="/tickets" /></Cards>
            {m ? (
              <Panel title="Finance — Managing Director & Admin Manager only">
                <Cards><K label="Blue-collar cash (net)" value={money(m.cash)} sub="Cashbook movement" href="/finance?d=labour" /><K label="Domestic QIIB (net)" value={money(m.qiib)} sub="Cashbook movement" href="/finance?d=domestic" /><K label="Client receivables" value={money(m.domesticDue + m.placementOut)} sub="Sponsor balances + placement fees" href="/domestic/payments" /><K label="Agency deposits unallocated" value={money(m.unallocated)} sub="Waiting for MD allocation" href="/finance" /></Cards>
                <Cards><K label="Placement fees outstanding" value={money(m.placementOut)} sub="Corporate" href="/corporate/fees" /><K label="Service charges outstanding" value={`USD ${m.serviceUsd.toLocaleString('en-US')}`} sub={m.serviceQar ? `+ QAR ${m.serviceQar}` : 'Blue-collar'} href="/service-fees" /><K label="Pending refund claims" value={m.pendingRefunds} sub="Need MD decision" href="/domestic/warranty" /><K label="Pending allocations" value={m.pendingAllocations} sub="Need MD approval" href="/finance" /></Cards>
                <p className="muted">Cash movement is not accounting profit. Division profitability needs candidate-level costing, which is a remaining requirement.</p>
              </Panel>
            ) : <Notice>Financial widgets are restricted to the Managing Director and Admin Manager.</Notice>}
          </>
        );
      })()}

      <Notice tone={ws === 'live' ? 'live' : undefined}>
        {ws === 'demo' ? 'DEMO WORKSPACE — all candidates, clients and transactions are fictional. Counters are calculated from the database records.' : 'LIVE WORKSPACE — counters are calculated from the records stored in the database.'}
      </Notice>
    </>
  );
}

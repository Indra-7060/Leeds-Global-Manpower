import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { C, roleLabel } from '@/lib/config';
import * as M from '@/lib/domain/metrics';
import { computeAlerts } from '@/lib/domain/alerts';
import { sum } from '@/lib/util';
import { Cards, Donut, Flow, Metric, Notice, Panel, Timeline } from '@/components/ui';
import Icon from '@/components/icons';
import { overview } from '@/lib/repo/dashboard-v8';
import { money } from '@/lib/util';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; denied?: string }> }) {
  const { user, ws } = await requireUser();
  const { tab = 'labour', denied } = await searchParams;
  const s = await loadState(ws);
  const tabs: [string, string][] = [['labour', 'Overseas Labour · Active'], ['domestic', 'Domestic Workers · Active'], ['corporate', 'Corporate Recruitment'], ['overview', 'Management Overview']];

  return (
    <>
      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="eyebrow">Management dashboard</div>
          <h1>{user.name === roleLabel(user.role) ? 'Welcome back' : `Welcome back, ${user.name.split(' ')[0]}`}</h1>
          <p>Orders, candidates, visas and money across Blue-Collar, Domestic and Corporate recruitment — {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}.</p>
        </div>
        <div className="hero-actions"><Link href="/orders" className="btn"><Icon name="plus" size={15} /> New order</Link><Link href="/candidates" className="btn secondary">Candidates</Link><Link href="/tasks" className="btn secondary">Tasks &amp; alerts</Link></div>
      </section>
      {denied && <Notice>You do not have permission for that action ({denied}).</Notice>}
      <div className="tabs">{tabs.map(([id, label]) => <Link key={id} href={`/?tab=${id}`} className={`tab ${tab === id ? 'selected' : ''}`}>{label}</Link>)}</div>

      {tab === 'labour' && (() => {
        const m = M.labour(s), total = Math.max(1, sum(m.groups, g => g.count));
        return (
          <>
            <Cards>
              <Metric label="Open Orders" value={m.openOrders} sub="Across active clients" icon="orders" solid="teal" /><Metric label="CVs Received" value={m.cvsReceived.toLocaleString('en-US')} sub="Candidate records" icon="candidates" solid="ink" />
              <Metric label="Visa Pipeline" value={m.visaPipeline} sub="Across visa stages" icon="visas" solid="gold" /><Metric label="Ready to Fly" value={m.readyToFly} sub="Deployment queue" icon="deployment" solid="sage" />
            </Cards>
            <div className="split">
              <Panel title="Live Recruitment Pipeline">
                <Donut data={m.groups.map(g => ({ label: g.label, value: g.count }))} centre={{ value: total === 1 && m.groups.every(g => g.count === 0) ? 0 : sum(m.groups, g => g.count), label: 'in pipeline' }} />
                <p className="muted" style={{ marginBottom: 0 }}>Each candidate is counted once, in their current stage group. Deployed and rejected candidates are not shown here.</p>
              </Panel>
              <Panel title="Recent Activity">
                <Timeline items={s.activity.filter(a => a.text).slice(0, 6).map(a => ({ title: a.text, sub: `${a.client ? a.client + ' · ' : ''}${String(a.at).slice(0, 10)}` }))} empty="No activity yet — add or import records and the latest changes appear here." />
              </Panel>
            </div>
            <Panel title="Pending Actions">
              {computeAlerts(s).length === 0 ? <div className="empty">Nothing pending.</div> : <div className="action-list">{computeAlerts(s).slice(0, 6).map(a => <div key={a.id} className="action-item"><Icon name="alert" size={17} /><span>{a.action}<span className="muted"> · {a.assigned}</span></span><span className="n">{a.count}</span></div>)}</div>}
            </Panel>
          </>
        );
      })()}

      {tab === 'domestic' && (() => {
        const m = M.domestic(s);
        return (
          <>
            <Cards><Metric label="Enquiries" value={m.enquiries} sub="Sponsor cases" icon="domestic" /><Metric label="Profiles Shared" value={m.profilesShared} sub="Profiles stage or later" icon="candidates" tone="info" /><Metric label="Visa Cases" value={m.visaCases} sub="Visa & Travel" icon="visas" tone="gold" /><Metric label="Handovers" value={m.handovers} sub="Arrival / guarantee" icon="warranty" tone="ok" /></Cards>
            <Panel title="Domestic Worker Journey"><Flow items={C.domesticStatuses} /></Panel>
          </>
        );
      })()}

      {tab === 'corporate' && (async () => {
        const o = await overview(ws, user.role, user.userId);
        return (
          <>
            <Cards cols={3}><Metric label="Open Vacancies" value={o.openVacancies} sub="Companies hiring" icon="corporate" /><Metric label="Candidates" value={o.corporateCandidates} sub="Local and overseas" icon="candidates" tone="info" /><Metric label="Placement fees" value={o.money ? money(o.money.placementOut) : 'Management only'} sub="Outstanding" icon="fees" tone="gold" /></Cards>
            <Panel title="Corporate Journey"><Flow items={['Company Vacancy', 'Candidate Sourcing', 'Interview', 'Offer', 'Confirmed Joining', 'Placement Fee']} /></Panel>
            <p><Link href="/corporate" className="btn secondary">Open Corporate Recruitment</Link></p>
          </>
        );
      })()}

      {tab === 'overview' && (async () => {
        const o = await overview(ws, user.role, user.userId);
        const K = ({ label, value, sub, href }: { label: string; value: React.ReactNode; sub: string; href: string }) => <Link href={href} className="card" style={{ textDecoration: 'none', color: 'inherit' }}><span className="ico"><Icon name={href.split('?')[0].replace(/^\//, '') || 'dashboard'} size={20} /></span><div className="muted">{label}</div><div className="num">{value}</div><div className="muted">{sub} →</div></Link>;
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

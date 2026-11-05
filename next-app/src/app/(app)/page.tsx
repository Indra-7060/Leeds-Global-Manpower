import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { C } from '@/lib/config';
import * as M from '@/lib/domain/metrics';
import { computeAlerts } from '@/lib/domain/alerts';
import { sum } from '@/lib/util';
import { Bar, Cards, Flow, Heading, Metric, Notice, Panel, Table } from '@/components/ui';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; denied?: string }> }) {
  const { ws } = await requireUser();
  const { tab = 'labour', denied } = await searchParams;
  const s = await loadState(ws);
  const tabs: [string, string][] = [['labour', 'Overseas Labour · Active'], ['domestic', 'Domestic Workers · Active'], ['corporate', 'Local Corporate · Future']];

  return (
    <>
      <Heading title="Management Dashboard" desc="Overview of both operating recruitment divisions" />
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

      {tab === 'corporate' && (
        <Panel title="Future Division">
          <p>Local Qatar corporate recruitment has <b>not yet started</b>. When activated, the client pays a negotiated placement fee, typically half or one month of the candidate’s basic salary, with the payment trigger determined by the client agreement.</p>
        </Panel>
      )}

      <Notice tone={ws === 'live' ? 'live' : undefined}>
        {ws === 'demo' ? 'DEMO WORKSPACE — all candidates, clients and transactions are fictional. Counters are calculated from the database records.' : 'LIVE WORKSPACE — counters are calculated from the records stored in the database.'}
      </Notice>
    </>
  );
}

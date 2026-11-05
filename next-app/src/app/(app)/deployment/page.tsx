import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { deployCards, deploymentChecklist } from '@/lib/domain/metrics';
import { moves, previousStage } from '@/lib/domain/lifecycle';
import { can } from '@/lib/config';
import { Badge, Cards, Heading, Metric, Muted, Panel, Table } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import { StageButton, UndoButton } from '@/components/RowButtons';

const DEPLOY_STAGES = ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];
const STEPS = ['Visa printed', 'Ticket requested', 'Arrival notice', 'Driver details', 'Arrival verified', 'Warranty started'];

export default async function DeploymentPage() {
  const { user, ws } = await requireUser();
  const s = await loadState(ws);
  const d = deployCards(s), canUndo = can(user.role, 'stage.undo');
  const tick = (done: boolean) => (done ? <span className="pill green">✓</span> : <span className="muted">—</span>);
  const rows: TableRow[] = s.candidates.filter(c => DEPLOY_STAGES.includes(c.status)).map(c => {
    const chk = deploymentChecklist(s, c), prev = previousStage(c.history.map((h: { stage: string }) => h.stage));
    return {
      key: c.id, search: `${c.id} ${c.name} ${c.client}`, filters: { client: c.client, status: c.status },
      cells: [`${c.id} · ${c.name}`, c.client, <Badge key="b" text={c.status} />, ...chk.map((x, i) => <span key={i}>{tick(x.done)}</span>)],
      actions: <>
        {moves(c.status).filter(m => m.kind !== 'reject').map(m => <StageButton key={m.to} id={c.dbId} to={m.to} kind={m.kind} label={m.label} name={c.name} />)}
        {canUndo && prev && <UndoButton id={c.dbId} name={c.name} prev={prev} />}
        <Link className="btn ghost small" href="/tickets">Travel</Link>
      </>,
    };
  });
  const uniq = (k: string) => [...new Set(rows.map(r => r.filters[k]))].sort();
  return (
    <>
      <Heading title="Deployment & Arrival" desc="Ticket booking, arrival notice, pickup driver and joining verification" />
      <Cards><Metric label="Ready to Fly" value={d.readyToFly} sub="Visa printed / deployment ready" /><Metric label="Tickets Pending" value={d.ticketsPending} sub="Flight details not yet shared" /><Metric label="Arrival Notices" value={d.arrivalNotices} sub="Sent to clients" /><Metric label="Arrivals Verified" value={d.arrivalsVerified} sub="Arrived / joined / warranty" /></Cards>
      <Panel title="Deployment Checklist">
        <DataTable columns={['Candidate', 'Client', 'Stage', ...STEPS]} rows={rows} filters={[{ key: 'client', label: 'Clients', values: uniq('client') }, { key: 'status', label: 'Stages', values: DEPLOY_STAGES }]} empty="No candidates have reached Visa Printed yet." />
      </Panel>
      <Panel title="Checklist steps and who is responsible">
        <Table head={['Step', 'Responsible', 'Completed when…']} rows={[
          ['Confirm visa printed', 'Operations', 'Candidate stage is Visa Printed or later'], ['Request ticket / inform agent', 'Operations', 'Travel record status is Request Booking or later'],
          ['Send client arrival notice', 'Operations', 'Travel record status is Arrival Notice'], ['Collect pickup driver name & phone', 'Client', 'Driver name and phone are recorded'],
          ['Verify arrival and client joining', 'Operations', 'Candidate stage is Arrived or later'], ['Start applicable warranty', 'Operations', 'Stage is Warranty, or a warranty case is linked']]} />
      </Panel>
      <Panel title="Post-Arrival"><p>Verified arrival creates the basis for an overseas agency charge according to the applicable agreement. Finance staff separately handle payment requests, deposits, manual allocations and Managing Director approvals.</p>
        <Muted>The agency-charge calculation is not automated: V6 states the rule only in text (open question OQ-9).</Muted></Panel>
    </>
  );
}

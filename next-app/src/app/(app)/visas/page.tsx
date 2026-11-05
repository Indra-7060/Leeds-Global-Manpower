import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { visaCards } from '@/lib/domain/metrics';
import { moves, previousStage } from '@/lib/domain/lifecycle';
import { C, can } from '@/lib/config';
import { Badge, Cards, Flow, Heading, Metric, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { StageButton, UndoButton } from '@/components/RowButtons';

export default async function VisasPage() {
  const { user, ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = buildLookups(s), c = visaCards(s), canUndo = can(user.role, 'stage.undo');
  const rows: TableRow[] = s.candidates.filter(x => C.visaStages.includes(x.status)).map(x => {
    const prev = previousStage(x.history.map((h: { stage: string }) => h.stage));
    return {
      key: x.id, search: `${x.id} ${x.name} ${x.client} ${x.visa_number}`, filters: { client: x.client, status: x.status, country: x.country },
      cells: [`${x.id} · ${x.name}`, x.client, <Badge key="b" text={x.status} />, x.visa_number, x.qvc_date, C.visaActions[x.status] ?? '—'],
      actions: <>
        {moves(x.status).filter(m => m.kind !== 'reject').map(m => <StageButton key={m.to} id={x.dbId} to={m.to} kind={m.kind} label={m.label} name={x.name} />)}
        {canUndo && prev && <UndoButton id={x.dbId} name={x.name} prev={prev} />}
        <EntityForm entity="candidates" id={x.dbId} label="Edit visa details" cls="secondary small" values={x} lookups={lookups} />
      </>,
    };
  });
  const uniq = (k: string) => [...new Set(rows.map(r => r.filters[k]))].sort();
  return (
    <>
      <Heading title="Visa Processing" desc="Apply → QVC → RTP → Print, with country-specific exceptions" />
      <Cards><Metric label="Visa Applied" value={c.applied} sub="Current stage" /><Metric label="QVC" value={c.qvc} sub="Current stage" /><Metric label="RTP" value={c.rtp} sub="Ready to print" /><Metric label="Visa Printed" value={c.printed} sub="Current stage" /></Cards>
      <Panel title="Visa Tracking">
        <DataTable columns={['Candidate', 'Client', 'Current Stage', 'Visa No.', 'QVC date', 'Action']} rows={rows}
          filters={[{ key: 'client', label: 'Clients', values: uniq('client') }, { key: 'status', label: 'Stages', values: [...C.visaStages] }, { key: 'country', label: 'Countries', values: uniq('country') }]} empty="No candidates are in a visa stage yet." />
      </Panel>
      <Panel title="Process Stages"><Flow items={['Offer Accepted', 'Pre-Medical if Required', 'Visa Applied', 'QVC if Applicable', 'RTP', 'Visa Printed']} /></Panel>
    </>
  );
}

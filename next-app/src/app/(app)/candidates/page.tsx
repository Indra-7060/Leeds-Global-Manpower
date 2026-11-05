import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { C, can } from '@/lib/config';
import { moves, previousStage } from '@/lib/domain/lifecycle';
import { uniqSorted } from '@/lib/util';
import { Badge, Flow, Heading, Notice, Panel, StageBar } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton, StageButton, UndoButton } from '@/components/RowButtons';

export default async function CandidatesPage() {
  const { user, ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = {
    clients: s.clients.map(c => ({ value: c.name, label: c.name })), countries: C.countries.map(x => ({ value: x, label: x })),
    orders: s.orders.map(o => ({ value: o.id, label: `${o.id} · ${o.client} · ${o.trade}` })),
    agencies: uniqSorted([...s.allocations.map(a => a.agency), ...s.candidates.map(c => c.agency)]).map(x => ({ value: x, label: x })),
  };
  const canUndo = can(user.role, 'stage.undo');
  const rows: TableRow[] = s.candidates.map(c => {
    const hist: string[] = c.history.map((h: { stage: string }) => h.stage); const prev = previousStage(hist);
    return {
      key: c.id, search: `${c.id} ${c.name} ${c.passport} ${c.client} ${c.trade} ${c.agency} ${c.order_id}`, filters: { client: c.client, country: c.country, status: c.status, agency: c.agency },
      cells: [c.id, <span key="n">{c.name}{c._src && <span className="src">imported</span>}</span>, c.client, c.trade, c.country, <span key="s"><Badge text={c.status} /><StageBar stage={c.status} stages={C.stages} /></span>],
      actions: <>
        {moves(c.status).map(m => <StageButton key={m.to} id={c.dbId} to={m.to} kind={m.kind} label={m.label} name={c.name} />)}
        {canUndo && prev && <UndoButton id={c.dbId} name={c.name} prev={prev} />}
        <EntityForm entity="candidates" id={c.dbId} label="Edit" cls="secondary small" values={c} lookups={lookups} />
        <DeleteButton entity="candidates" id={c.dbId} what={`${c.id} ${c.name}`} />
      </>,
    };
  });
  return (
    <>
      <Heading title="Candidates & CVs" desc="Candidate status is tracked individually against each client order" />
      <Panel title="Candidate Register" actions={<EntityForm entity="candidates" label="+ Add Candidate" lookups={lookups} />}>
        <DataTable columns={['Candidate ID', 'Candidate', 'Client', 'Trade', 'Country', 'Current Stage']} rows={rows}
          filters={[{ key: 'client', label: 'Clients', values: uniqSorted(s.candidates.map(c => c.client)) }, { key: 'country', label: 'Countries', values: uniqSorted(s.candidates.map(c => c.country)) },
            { key: 'status', label: 'Stages', values: [...C.stages, C.rejectedStage] }, { key: 'agency', label: 'Agencies', values: uniqSorted(s.candidates.map(c => c.agency)) }]}
          empty="No candidates yet. Add one." />
      </Panel>
      <Panel title="Full Candidate Lifecycle"><Flow items={C.stages} /></Panel>
      <Notice>Stage changes follow the lifecycle: one step at a time; Pre-Medical and QVC may be skipped when not applicable; Reject is available only during screening (CV Submitted, Client Review, Interview). Editing a candidate never changes the stage. Rules are enforced on the server.</Notice>
    </>
  );
}

import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { C } from '@/lib/config';
import { todayISO, uniqSorted } from '@/lib/util';
import { Badge, Flow, Heading, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function VisitsPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = buildLookups(s);
  const rows: TableRow[] = s.visits.map(v => ({
    key: String(v.id), search: `${v.client} ${v.contact} ${v.next_action} ${v.salesperson}`, filters: { outcome: v.outcome, client: v.client },
    cells: [v.client, v.contact, v.date, <Badge key="b" text={v.outcome} />, v.pipeline_stage, v.next_action],
    actions: <>
      {v.outcome === 'Order Received' && <EntityForm entity="orders" label="Create order →" cls="secondary small" values={{ client: v.client }} lookups={lookups} title={`New order for ${v.client}`} />}
      <EntityForm entity="visits" id={v.id} label="Edit" cls="secondary small" values={v} lookups={lookups} /><DeleteButton entity="visits" id={v.id} what={`Visit to ${v.client}`} />
    </>,
  }));
  return (
    <>
      <Heading title="Sales Visits & Follow-ups" desc="Track field marketing from first company visit to confirmed manpower order" />
      <Panel title="Client Visit Register" actions={<EntityForm entity="visits" label="+ Record Visit" values={{ date: todayISO() }} lookups={lookups} />}>
        <DataTable columns={['Client', 'Contact', 'Visit / Follow-up', 'Outcome', 'Pipeline stage', 'Next Action']} rows={rows}
          filters={[{ key: 'outcome', label: 'Outcomes', values: [...C.visitOutcomes] }, { key: 'client', label: 'Clients', values: uniqSorted(s.visits.map(v => v.client)) }]} empty="No visits recorded yet." />
      </Panel>
      <Panel title="Sales Pipeline"><Flow items={C.salesPipeline} /></Panel>
    </>
  );
}

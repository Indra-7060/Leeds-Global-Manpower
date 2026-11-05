import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { C } from '@/lib/config';
import { uniqSorted } from '@/lib/util';
import { Badge, Flow, Heading, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function DemandsPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = buildLookups(s);
  const rows: TableRow[] = s.demands.map(d => ({
    key: d.id, search: `${d.id} ${d.client} ${d.countries} ${d.trades} ${d.order_id}`, filters: { status: d.status, client: d.client },
    cells: [d.id, d.client, d.order_id, d.countries, d.trades, d.signed, <Badge key="b" text={d.status} />],
    actions: <><EntityForm entity="demands" id={d.dbId} label="Edit" cls="secondary small" values={d} lookups={lookups} /><DeleteButton entity="demands" id={d.dbId} what={d.id} /></>,
  }));
  return (
    <>
      <Heading title="Demand Letters & Documents" desc="Keep client demand, trade-wise quantities, approvals and revisions in one place" />
      <Panel title="Demand Letter Register" actions={<EntityForm entity="demands" label="+ Add Demand Letter" lookups={lookups} />}>
        <DataTable columns={['Reference', 'Client', 'Order', 'Countries', 'Trades', 'Signed', 'Status']} rows={rows}
          filters={[{ key: 'status', label: 'Statuses', values: [...C.demandStatuses] }, { key: 'client', label: 'Clients', values: uniqSorted(s.demands.map(d => d.client)) }]} empty="No demand letters yet." />
      </Panel>
      <Panel title="Required Fields"><Flow items={['Client & Order', 'Letter Date', 'Trades & Quantities', 'Nationality', 'Salary & Benefits', 'Signed Letter', 'Agency Allocation']} /></Panel>
      <Notice>Not available yet (needs secure file storage): version history, scanned originals of the signed letter, document approvals. This version records the letter details and links to the order.</Notice>
    </>
  );
}

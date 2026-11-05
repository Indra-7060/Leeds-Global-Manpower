import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { allocationStats } from '@/lib/domain/metrics';
import { C } from '@/lib/config';
import { uniqSorted } from '@/lib/util';
import { Badge, Flow, Heading, Muted, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function AgenciesPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = buildLookups(s);
  const rows: TableRow[] = s.allocations.map(a => ({
    key: String(a.id), search: `${a.agency} ${a.country} ${a.order_id}`, filters: { agency: a.agency, status: a.status },
    cells: [a.agency, a.country, a.order_id, a.allocated, allocationStats(s, a).cvs, <Badge key="b" text={a.status} />],
    actions: <><EntityForm entity="allocations" id={a.id} label="Edit" cls="secondary small" values={a} lookups={lookups} /><DeleteButton entity="allocations" id={a.id} what={`${a.agency} on ${a.order_id}`} /></>,
  }));
  return (
    <>
      <Heading title="Overseas Agents" desc="Allocate manpower demand and track each agent’s recruitment progress" />
      <Panel title="Agency Allocation" actions={<EntityForm entity="allocations" label="+ Allocate to Agency" lookups={lookups} />}>
        <DataTable columns={['Agency', 'Country', 'Order', 'Allocated', 'CVs Received', 'Status']} rows={rows}
          filters={[{ key: 'agency', label: 'Agencies', values: uniqSorted(s.allocations.map(a => a.agency)) }, { key: 'status', label: 'Statuses', values: [...C.agencyStatuses] }]} empty="No allocations yet." />
      </Panel>
      <Panel title="Agency Tasks"><Flow items={['Receive Demand', 'Submit CVs', 'Schedule Interviews', 'Send Selected List', 'Upload Passports', 'Pre-Medical', 'Visa & Ticket Follow-up']} />
        <Muted>“CVs Received” counts candidates with the same agency and order. A warning appears if allocations exceed the ordered quantity. Separate secure agent portals (each agent sees only their own orders) are a later requirement.</Muted></Panel>
    </>
  );
}

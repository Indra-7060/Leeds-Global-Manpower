import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import * as M from '@/lib/domain/metrics';
import { C } from '@/lib/config';
import { uniqSorted } from '@/lib/util';
import { Badge, Flow, Heading, Muted, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function OrdersPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const prog = Object.fromEntries(M.orderProgress(s).map(p => [p.id, p]));
  const lookups = {
    clients: s.clients.map(c => ({ value: c.name, label: c.name })), countries: C.countries.map(x => ({ value: x, label: x })),
    agencies: uniqSorted([...s.allocations.map(a => a.agency), ...s.candidates.map(c => c.agency)]).map(x => ({ value: x, label: x })),
  };
  const rows: TableRow[] = s.orders.map(o => ({
    key: o.id, search: `${o.id} ${o.client} ${o.country} ${o.trade} ${o.status}`, filters: { client: o.client, country: o.country, status: o.status },
    cells: [o.id, o.client, o.country, o.trade, o.qty, <Badge key="b" text={o.status} />, prog[o.id]?.cvs ?? 0, prog[o.id]?.deployed ?? 0],
    actions: <><EntityForm entity="orders" id={o.dbId} label="Edit" cls="secondary small" values={o} lookups={lookups} /><DeleteButton entity="orders" id={o.dbId} what={o.id} /></>,
  }));
  return (
    <>
      <Heading title="Manpower Orders" desc="Client orders allocated to overseas agencies by country and trade" />
      <Panel title="Active Demand Orders" actions={<EntityForm entity="orders" label={ws === 'demo' ? '+ Sample New Order' : '+ New Order'} lookups={lookups} />}>
        <DataTable columns={['Order', 'Client', 'Country', 'Trade', 'Qty', 'Stage', 'CVs linked', 'Deployed']} rows={rows}
          filters={[{ key: 'client', label: 'Clients', values: uniqSorted(s.orders.map(o => o.client)) }, { key: 'country', label: 'Countries', values: uniqSorted(s.orders.map(o => o.country)) }, { key: 'status', label: 'Stages', values: [...C.orderStatuses] }]}
          empty="No orders yet. Add an order." />
      </Panel>
      <Panel title="Order to Deployment Workflow"><Flow items={['Client Order', 'Country Allocation', 'Agency Sourcing', 'CV Review', 'Interviews', 'Selection', 'Offer', 'Visa', 'Deployment']} /></Panel>
      <Muted>“CVs linked” counts candidates whose Order field points at the order. Order stage is set manually (V6 has no rule that derives it from candidates). Order numbers (ORD-1001…) are never reused after a delete.</Muted>
    </>
  );
}

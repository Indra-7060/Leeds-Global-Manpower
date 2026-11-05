import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import * as M from '@/lib/domain/metrics';
import { norm, uniqSorted } from '@/lib/util';
import { C } from '@/lib/config';
import { Badge, Cards, Heading, Metric, Muted, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function ClientsPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const m = M.crm(s);
  const lookups = { clients: s.clients.map(c => ({ value: c.name, label: c.name })), countries: C.countries.map(x => ({ value: x, label: x })) };
  const rows: TableRow[] = s.clients.map(c => ({
    key: String(c.id), search: `${c.name} ${c.sector} ${c.next_action}`, filters: { stage: c.stage, sector: c.sector },
    cells: [c.name, c.sector, <Badge key="b" text={c.stage} />, c.next_action, s.orders.filter(o => norm(o.client) === norm(c.name)).length],
    actions: <>
      <EntityForm entity="orders" label="+ Order" cls="secondary small" values={{ client: c.name }} lookups={lookups} title={`New order for ${c.name}`} />
      <EntityForm entity="clients" id={c.id} label="Edit" cls="secondary small" values={c} lookups={lookups} />
      <DeleteButton entity="clients" id={c.id} what={c.name} />
    </>,
  }));
  return (
    <>
      <Heading title="Client CRM" desc="Market visits → company introduction → enquiry → client order" />
      <Cards><Metric label="Clients" value={m.clients} sub="Registered" /><Metric label="Visits" value={m.visits} sub="Recorded" /><Metric label="Follow-ups" value={m.followUps} sub="Pending" /><Metric label="Orders Won" value={m.ordersWon} sub="Open" /></Cards>
      <Panel title="Client Register" actions={<EntityForm entity="clients" label="+ Add Client" lookups={lookups} />}>
        <DataTable columns={['Client', 'Sector', 'Stage', 'Next Action', 'Orders']} rows={rows}
          filters={[{ key: 'stage', label: 'Stages', values: [...C.clientStages] }, { key: 'sector', label: 'Sectors', values: uniqSorted(s.clients.map(c => c.sector)) }]}
          empty="No clients yet. Add your first client." />
      </Panel>
      <Muted>Renaming a client updates every order and candidate automatically (they are linked by record, not by typed name). A client that is used by orders or candidates cannot be deleted.</Muted>
    </>
  );
}

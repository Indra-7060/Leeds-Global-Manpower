import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { domestic } from '@/lib/domain/metrics';
import { C } from '@/lib/config';
import { uniqSorted } from '@/lib/util';
import { Badge, Cards, Flow, Heading, Metric, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { AdvanceButton, DeleteButton } from '@/components/RowButtons';

export default async function DomesticPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = buildLookups(s), m = domestic(s);
  const rows: TableRow[] = s.domestic.map(d => {
    const next = C.domesticStatuses[C.domesticStatuses.indexOf(d.status) + 1];
    return {
      key: d.id, search: `${d.id} ${d.customer} ${d.origin} ${d.next_action}`, filters: { status: d.status, origin: d.origin },
      cells: [d.id, d.customer, d.origin, <Badge key="b" text={d.status} />, d.next_action],
      actions: <>{next && <AdvanceButton entity="domestic" id={d.dbId} next={next} />}<EntityForm entity="domestic" id={d.dbId} label="Edit" cls="secondary small" values={d} lookups={lookups} /><DeleteButton entity="domestic" id={d.dbId} what={d.id} /></>,
    };
  });
  return (
    <>
      <Heading title="Domestic Workers" desc="Active division — household client recruitment under applicable Qatar regulations" />
      <Cards><Metric label="Enquiries" value={m.enquiries} sub="Cases" /><Metric label="Workers Shared" value={m.profilesShared} sub="Profiles stage or later" /><Metric label="Visa Cases" value={m.visaCases} sub="Visa & Travel" /><Metric label="Handovers" value={m.handovers} sub="Arrival / guarantee" /></Cards>
      <Panel title="Domestic Worker Workflow"><Flow items={C.domesticStatuses} /></Panel>
      <Panel title="Customer Cases" actions={<EntityForm entity="domestic" label="+ New Case" lookups={lookups} />}>
        <DataTable columns={['Case', 'Customer', 'Worker Origin', 'Status', 'Next Action']} rows={rows}
          filters={[{ key: 'status', label: 'Statuses', values: [...C.domesticStatuses] }, { key: 'origin', label: 'Origins', values: uniqSorted(s.domestic.map(d => d.origin)) }]} empty="No domestic cases yet." />
      </Panel>
      <Notice>Fees, payment timing, guarantees, refunds and replacements must be configured and validated against current Qatar law and the signed recruitment contract. This version tracks case progress only; it does not calculate fees or refunds.</Notice>
    </>
  );
}

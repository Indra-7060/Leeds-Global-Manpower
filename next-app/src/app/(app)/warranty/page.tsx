import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { C } from '@/lib/config';
import { diffDays, todayISO } from '@/lib/util';
import { Badge, Flow, Heading, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { AdvanceButton, DeleteButton } from '@/components/RowButtons';

export default async function WarrantyPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = buildLookups(s), today = todayISO();
  const expiry = (w: Record<string, any>) => {
    if (!w.warranty_expiry) return <span className="muted">—</span>;
    const left = diffDays(today, w.warranty_expiry);
    return <span>{w.warranty_expiry} {w.status !== 'Closed' && (left < 0 ? <span className="pill red">Expired</span> : left <= C.warrantyAlertDays ? <span className="pill orange">{left} d left</span> : null)}</span>;
  };
  const rows: TableRow[] = s.warranties.map(w => {
    const i = C.warrantyStatuses.indexOf(w.status), next = C.warrantyStatuses[i + 1];
    return {
      key: w.id, search: `${w.id} ${w.client} ${w.issue} ${w.candidate_id}`, filters: { division: w.division, status: w.status },
      cells: [w.id, w.division, w.client, w.candidate_id, w.issue, <Badge key="b" text={w.status} />, w.warranty_start, expiry(w)],
      actions: <>{next && <AdvanceButton entity="warranties" id={w.dbId} next={next} />}<EntityForm entity="warranties" id={w.dbId} label="Edit" cls="secondary small" values={w} lookups={lookups} /><DeleteButton entity="warranties" id={w.dbId} what={w.id} /></>,
    };
  });
  return (
    <>
      <Heading title="Warranty & Replacements" desc="Track labour client warranty and domestic-worker statutory guarantees separately" />
      <Panel title="Warranty Cases" actions={<EntityForm entity="warranties" label="+ New Case" lookups={lookups} />}>
        <DataTable columns={['Case', 'Division', 'Client', 'Candidate', 'Issue', 'Status', 'Start', 'Expiry']} rows={rows}
          filters={[{ key: 'division', label: 'Divisions', values: [...C.warrantyDivisions] }, { key: 'status', label: 'Statuses', values: [...C.warrantyStatuses] }]} empty="No warranty cases." />
      </Panel>
      <Panel title="Case Workflow"><Flow items={['Client Complaint', 'Check Agreement & Dates', 'Record Evidence', 'Return / Replacement Decision', 'Coordinate Agency', 'Close Case']} /></Panel>
      <Notice>Labour: illustrative 3-month contractual warranty — the expiry is filled automatically from the start date and can be overwritten. Domestic: legal guarantee/refund rules must be verified against current Qatar requirements, so no period is assumed; enter the expiry manually.</Notice>
    </>
  );
}

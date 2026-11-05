import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { inStages } from '@/lib/domain/metrics';
import { C } from '@/lib/config';
import { uniqSorted } from '@/lib/util';
import { Badge, Flow, Heading, Muted, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function InterviewsPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = buildLookups(s);
  const rows: TableRow[] = s.interviews.slice().sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).map(i => ({
    key: String(i.id), search: `${i.client} ${i.method} ${i.country}`, filters: { client: i.client, method: i.method, status: i.status },
    cells: [i.client, i.method, i.country, i.date || '—', i.candidates, <Badge key="b" text={i.status} />],
    actions: <><EntityForm entity="interviews" id={i.id} label="Edit" cls="secondary small" values={i} lookups={lookups} /><DeleteButton entity="interviews" id={i.id} what={`Interview for ${i.client}`} /></>,
  }));
  return (
    <>
      <Heading title="Interviews & Selection" desc="Client CV review, Zoom interviews and overseas selection drives" />
      <Panel title="Interview Events" actions={<EntityForm entity="interviews" label="+ Schedule Interview" lookups={lookups} />}>
        <DataTable columns={['Client', 'Method', 'Country', 'Date', 'Candidates', 'Status']} rows={rows}
          filters={[{ key: 'client', label: 'Clients', values: uniqSorted(s.interviews.map(i => i.client)) }, { key: 'method', label: 'Methods', values: [...C.interviewMethods] }, { key: 'status', label: 'Statuses', values: [...C.interviewStatuses] }]} empty="No interviews scheduled." />
      </Panel>
      <Panel title="Candidates at interview / selection"><Muted>Candidates move Interview → Selected on the Candidates page. Currently: <b>{inStages(s, ['Interview']).length}</b> at Interview, <b>{inStages(s, ['Selected']).length}</b> Selected, <b>{inStages(s, ['Rejected']).length}</b> Rejected.</Muted></Panel>
      <Panel title="After Selection"><Flow items={['Selected Candidate List', 'Passport & CV', 'Client Offer Letter', 'Candidate Acceptance', 'Pre-Medical if Required', 'Visa Application']} /></Panel>
      <Muted>Interview attendance is not tracked because V6 defines no attendance field.</Muted>
    </>
  );
}

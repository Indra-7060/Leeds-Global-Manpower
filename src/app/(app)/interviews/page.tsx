import { requireUser } from '@/lib/auth/dal';
import { prisma } from '@/lib/db';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { dateToISO } from '@/lib/util';
import DownloadButton from '@/components/DownloadButton';
import { Table } from '@/components/ui';
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
  const { user, ws } = await requireUser();
  const s = await loadState(ws);
  const lookups = { ...buildLookups(s), ...(await v8Lookups(ws, user.role)) };
  const entries = await prisma.interviewEntry.findMany({ where: { workspace: ws }, include: { interview: { include: { client: true } }, candidate: true }, orderBy: [{ interviewId: 'asc' }, { id: 'asc' }] });
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
      <Panel title="Attendance & Client Decision" actions={<><EntityForm entity="interviewEntries" label="+ Record Result" lookups={lookups} /><DownloadButton url={`/api/export?report=${encodeURIComponent('Interview Attendance')}`} label="⇩ Attendance (Excel)" /></>}>
        <Table head={['Interview', 'Candidate', 'Attended', 'Decision', 'Note', '']} empty="No attendance recorded yet. Use “Record Result” for each candidate who was called."
          rows={entries.map(e => [`${dateToISO(e.interview.date) || 'no date'} · ${e.interview.client.name} · ${e.interview.method}`, `${e.candidate.code} · ${e.candidate.name}`, <Badge key="a" text={e.attended || 'Not recorded'} />, <Badge key="d" text={e.decision} />, e.note || '—',
            <div key="x" className="table-actions"><EntityForm entity="interviewEntries" id={e.id} label="Edit" cls="secondary small" values={{ interview_id: String(e.interviewId), candidate_id: String(e.candidateId), attended: e.attended, decision: e.decision, note: e.note }} lookups={lookups} /><DeleteButton entity="interviewEntries" id={e.id} what="This result" /></div>])} />
      </Panel>
      <Panel title="After Selection"><Flow items={['Selected Candidate List', 'Passport & CV', 'Client Offer Letter', 'Candidate Acceptance', 'Pre-Medical if Required', 'Visa Application']} /></Panel>
    </>
  );
}

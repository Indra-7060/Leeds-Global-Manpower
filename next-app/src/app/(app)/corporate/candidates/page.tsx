import { requireUser } from '@/lib/auth/dal';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import { C, can } from '@/lib/config';
import { dateToISO } from '@/lib/util';
import { Badge, Flow, Heading, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function CorporateCandidates() {
  const { user, ws } = await requireUser();
  const fin = can(user.role, 'finance.view'), lookups = await v8Lookups(ws, user.role);
  const ps = await prisma.corporatePlacement.findMany({ where: { workspace: ws }, include: { vacancy: { include: { client: true } }, fee: true }, orderBy: { code: 'asc' } });
  const rows: TableRow[] = ps.map(p => ({
    key: String(p.id), search: `${p.code} ${p.candidateName} ${p.vacancy.client.name} ${p.vacancy.title} ${p.country}`, filters: { stage: p.stage, source: p.source },
    cells: [p.code, p.candidateName, `${p.vacancy.code} · ${p.vacancy.title}`, p.vacancy.client.name, p.source + (p.country ? ` (${p.country})` : ''), <Badge key="b" text={p.stage} />, dateToISO(p.offerDate) || '—', dateToISO(p.joiningDate) || '—'],
    actions: <><EntityForm entity="placements" id={p.id} label="Edit" cls="secondary small" values={{ vacancy_id: String(p.vacancyId), candidate_name: p.candidateName, source: p.source, country: p.country, stage: p.stage, offer_date: dateToISO(p.offerDate), joining_date: dateToISO(p.joiningDate), notes: p.notes }} lookups={lookups} />
      {fin && <EntityForm entity="placementFees" label={p.fee ? 'Edit fee' : 'Set fee'} cls="secondary small" values={p.fee ? { placement_id: String(p.id), basic_salary: Number(p.fee.basicSalary), basis: p.fee.basis, custom_fee: p.fee.basis === 'custom' ? Number(p.fee.feeAmount) : '', due_months: String(p.fee.dueMonths), invoice_no: p.fee.invoiceNo, invoice_date: dateToISO(p.fee.invoiceDate), credit_note: Number(p.fee.creditNote), credit_reason: p.fee.creditReason, note: p.fee.note } : { placement_id: String(p.id) }} lookups={lookups} title={`Placement fee — ${p.code}`} />}
      <DeleteButton entity="placements" id={p.id} what={`${p.code} ${p.candidateName}`} /></>,
  }));
  return (
    <>
      <Heading title="Corporate Candidates" desc="Local Qatar candidates and overseas sourcing, from shortlist to confirmed joining" />
      <Panel title="Sourcing Paths">
        <p className="muted" style={{ marginTop: 0 }}><b>Local Qatar:</b> QID / work authorisation, availability, notice period, Qatar experience, expected salary, interview, offer, joining.</p>
        <Flow items={['Local candidate', 'Shortlist', 'Interview', 'Offer', 'Confirmed joining']} />
        <p className="muted"><b>Overseas:</b> source country, overseas agency, CV review, interview, offer, visa, travel, arrival, joining.</p>
        <Flow items={['Overseas candidate', 'CV review', 'Interview', 'Offer', 'Visa & travel', 'Arrival', 'Confirmed joining']} />
      </Panel>
      <Panel title="Candidate Placements" actions={<EntityForm entity="placements" label="+ Add Candidate" lookups={lookups} />}>
        <DataTable columns={['Placement', 'Candidate', 'Vacancy', 'Company', 'Source', 'Stage', 'Offer date', 'Confirmed joining']} rows={rows}
          filters={[{ key: 'stage', label: 'Stages', values: [...C.v8.placementStages] }, { key: 'source', label: 'Sources', values: [...C.v8.placementSources] }]} empty="No corporate candidates yet — open a vacancy first." />
      </Panel>
    </>
  );
}

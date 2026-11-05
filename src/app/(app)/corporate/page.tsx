import { requireUser } from '@/lib/auth/dal';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import { C } from '@/lib/config';
import { Badge, Cards, Flow, Heading, Metric, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function CorporatePage() {
  const { user, ws } = await requireUser();
  const lookups = await v8Lookups(ws, user.role);
  const companies = await prisma.client.findMany({ where: { workspace: ws, segment: { not: 'Blue-Collar' } }, include: { vacancies: true }, orderBy: { name: 'asc' } });
  const compRows: TableRow[] = companies.map(c => ({ key: 'c' + c.id, search: `${c.name} ${c.sector}`, filters: { stage: c.stage },
    cells: [c.name, c.sector || '—', c.segment === 'Both' ? 'Corporate + Blue-Collar' : 'Corporate', <Badge key="b" text={c.stage} />, c.nextAction || '—', `${c.vacancies.filter(v => v.status === 'Open').length} open / ${c.vacancies.length}`],
    actions: <><EntityForm entity="clients" id={c.id} label="Edit" cls="secondary small" values={{ name: c.name, sector: c.sector, stage: c.stage, segment: c.segment, next_action: c.nextAction }} lookups={{}} /><DeleteButton entity="clients" id={c.id} what={c.name} /></> }));
  const vacs = await prisma.corporateVacancy.findMany({ where: { workspace: ws }, include: { client: true, placements: true }, orderBy: { code: 'asc' } });
  const open = vacs.filter(v => v.status === 'Open'), cands = vacs.flatMap(v => v.placements);
  const rows: TableRow[] = vacs.map(v => ({
    key: String(v.id), search: `${v.code} ${v.client.name} ${v.title} ${v.category}`, filters: { status: v.status, source: v.source },
    cells: [v.code, v.client.name, v.title, v.category || '—', v.quantity, v.source, `${v.placements.length} (${v.placements.filter(p => p.stage === 'Joined').length} joined)`, <Badge key="b" text={v.status} />],
    actions: <><EntityForm entity="vacancies" id={v.id} label="Edit" cls="secondary small" values={{ client: v.client.name, title: v.title, category: v.category, quantity: v.quantity, source: v.source, status: v.status, notes: v.notes }} lookups={lookups} /><DeleteButton entity="vacancies" id={v.id} what={`${v.code} and its candidate placements`} /></>,
  }));
  return (
    <>
      <Heading title="Corporate Recruitment" desc="Company clients — candidates sourced locally in Qatar or overseas" />
      <Cards><Metric label="Open Vacancies" value={open.length} sub={`${open.reduce((n, v) => n + v.quantity, 0)} positions`} /><Metric label="Candidates" value={cands.length} sub="All stages" />
        <Metric label="Local / Overseas" value={`${cands.filter(c => c.source === 'Local Qatar').length} / ${cands.filter(c => c.source === 'Overseas').length}`} sub="Candidates by source" /><Metric label="Joined" value={cands.filter(c => c.stage === 'Joined').length} sub="Confirmed joinings" /></Cards>
      <Panel title="Corporate Workflow"><Flow items={['Company Vacancy', 'Candidate Sourcing', 'Shortlist', 'Interview', 'Offer', 'Confirmed Joining', 'Placement Fee']} /></Panel>
      <Panel title="Corporate Companies" actions={<EntityForm entity="clients" label="+ New Company" values={{ segment: 'Corporate', stage: 'Prospect' }} lookups={{}} title="New corporate company" />}>
        <DataTable columns={['Company', 'Sector', 'Division', 'Stage', 'Next action', 'Vacancies']} rows={compRows} filters={[{ key: 'stage', label: 'Stages', values: [...C.clientStages] }]} empty="No corporate companies yet — add one with “+ New Company”." />
      </Panel>
      <Panel title="Company Vacancies" actions={<EntityForm entity="vacancies" label="+ New Vacancy" lookups={lookups} />}>
        <DataTable columns={['Vacancy', 'Company', 'Job title', 'Category', 'Positions', 'Source', 'Candidates', 'Status']} rows={rows}
          filters={[{ key: 'status', label: 'Statuses', values: [...C.v8.vacancyStatuses] }, { key: 'source', label: 'Sources', values: [...C.v8.vacancySources] }]} empty="No vacancies yet — add a company under Client CRM, then open a vacancy." />
      </Panel>
      <Notice>The client is always a company. Placement fees and payment milestones are stored separately from candidate salaries and are visible to the Managing Director and Admin Manager only. This division follows the client’s V8 description; amounts and triggers must match each signed agreement.</Notice>
    </>
  );
}

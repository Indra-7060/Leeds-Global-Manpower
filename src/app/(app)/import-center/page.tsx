import { requireUser } from '@/lib/auth/dal';
import { prisma } from '@/lib/db';
import { can } from '@/lib/config';
import { Heading, Notice, Panel, Table } from '@/components/ui';
import DownloadButton from '@/components/DownloadButton';
import ImportWizard from './import-wizard';

const LABEL: Record<string, string> = { candidates: 'Candidates / Visa Status', orders: 'Manpower Orders', finance: 'Private Finance' };

export default async function ImportCenterPage() {
  const { user, ws } = await requireUser();
  const history = await prisma.importRecord.findMany({ where: { workspace: ws }, orderBy: { at: 'desc' }, take: 20 });
  const canFinance = can(user.role, 'finance.import');
  return (
    <>
      <Heading title="Excel Import Center" desc="Upload your existing projects, candidate lists and finance sheets; map columns, validate, then import" />
      <Notice>Supports CSV, TSV and standard XLSX (one worksheet at a time), up to 10 MB and 20,000 rows. Rows are validated with the same rules as manual entry; duplicates are skipped; rejected rows are listed with the reason, and nothing is written until you confirm. Imported records go into the {ws.toUpperCase()} workspace and appear on the normal pages immediately. Clients named in a sheet that are not yet registered are added as Prospects. Old .xls must be saved as .xlsx first. {ws === 'demo' ? 'Use fictional data only in the demo workspace.' : ''}</Notice>
      <ImportWizard canFinance={canFinance} />
      <Panel title="Import History">
        <Table head={['File', 'Module', 'Added', 'Duplicates', 'Rejected', 'Date']} rows={history.map(h => [h.file, LABEL[h.target] ?? h.target, h.added, h.duplicates, h.invalid, h.at.toISOString().slice(0, 16).replace('T', ' ')])} empty="No imports yet in this workspace." />
      </Panel>
      <Panel title="Export workspace data">
        <div className="row">
          <DownloadButton url={`/api/export?report=${encodeURIComponent('Candidate List')}`} label="Export Candidates CSV" />
          <DownloadButton url={`/api/export?report=${encodeURIComponent('All Orders')}`} label="Export Orders CSV" />
          {can(user.role, 'finance.export') && <DownloadButton url={`/api/export?report=${encodeURIComponent('Private Finance')}`} label="Export Finance CSV" />}
        </div>
      </Panel>
    </>
  );
}

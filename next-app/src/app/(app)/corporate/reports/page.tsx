import { requireUser } from '@/lib/auth/dal';
import { can } from '@/lib/config';
import { Heading, Panel } from '@/components/ui';
import DownloadButton from '@/components/DownloadButton';

export default async function CorporateReports() {
  const { user } = await requireUser();
  const fin = can(user.role, 'finance.export');
  const list: [string, string, boolean][] = [['Corporate Vacancies', 'Open vacancies, candidates and joinings per company', false], ['Corporate Placements', 'Local and overseas candidates by stage', false],
    ['Placement Fees', 'Accrued, invoiced, collected, outstanding, due dates and overdue', true], ['Receipts Ledger', 'All receipts (domestic, corporate, service charges)', true]];
  return (
    <>
      <Heading title="Corporate Reports" desc="Excel (.xlsx) workbooks with a Summary sheet and a Detail sheet" />
      <Panel title="Available reports">
        <div className="v8grid">{list.filter(([, , m]) => !m || fin).map(([name, desc]) => <div key={name} className="v8tile"><h4>{name}</h4><p>{desc}</p><DownloadButton url={`/api/export?report=${encodeURIComponent(name)}`} label="⇩ Excel (.xlsx)" /></div>)}</div>
        {!fin && <p className="muted">Fee and receipt reports are available to the Managing Director and Admin Manager only.</p>}
      </Panel>
    </>
  );
}

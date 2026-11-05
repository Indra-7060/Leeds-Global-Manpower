import { requireUser } from '@/lib/auth/dal';
import { can } from '@/lib/config';
import { Heading, Panel } from '@/components/ui';
import DownloadButton from '@/components/DownloadButton';

const REPORTS: [string, string, boolean][] = [
  ['Domestic Sponsor Cases', 'Sponsor enquiries and worker selections', false], ['Domestic Warranty', 'Guarantee windows and days left', false],
  ['Domestic Balances', 'Agreed fee, advance received and deployment balance due per sponsor', true], ['Domestic Collections', 'Every receipt and refund payment (domestic ledger)', true],
  ['Refund Claims', 'Claims, estimates and decisions', true], ['Contract Expiry', 'Contracts by expiry date (all divisions)', false],
];

export default async function DomesticReports() {
  const { user } = await requireUser();
  const fin = can(user.role, 'finance.export'), contracts = can(user.role, 'contracts.view');
  return (
    <>
      <Heading title="Domestic Reports" desc="Excel (.xlsx) workbooks with a Summary sheet and a Detail sheet" />
      <Panel title="Available reports">
        <div className="v8grid">{REPORTS.filter(([n, , money]) => (!money || fin) && (n !== 'Contract Expiry' || contracts)).map(([name, desc]) => (
          <div key={name} className="v8tile"><h4>{name}</h4><p>{desc}</p><DownloadButton url={`/api/export?report=${encodeURIComponent(name)}`} label="⇩ Excel (.xlsx)" /></div>))}</div>
        {!fin && <p className="muted">Money reports (balances, collections, refunds) are available to the Managing Director and Admin Manager only.</p>}
      </Panel>
    </>
  );
}

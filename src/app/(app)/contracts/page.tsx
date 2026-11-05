import { requirePermission } from '@/lib/auth/dal';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import * as V from '@/lib/domain/v8';
import { C, can } from '@/lib/config';
import { dateToISO, todayISO } from '@/lib/util';
import { Cards, Heading, Metric, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import DownloadButton from '@/components/DownloadButton';
import { ArchiveButton, ContractUpload } from '@/components/V8Controls';
import Link from 'next/link';

const bandClass = (b: string) => (b === 'Expired' || b === 'Within 7 days' ? 'red' : b ? 'orange' : 'green');

export default async function Contracts({ searchParams }: { searchParams: Promise<{ division?: string; archived?: string }> }) {
  const { user, ws } = await requirePermission('contracts.view');
  const { division = 'all', archived: arch } = await searchParams, showArchived = arch === '1', manage = can(user.role, 'contracts.manage'), today = todayISO();
  const lookups = await v8Lookups(ws, user.role);
  const all = await prisma.contract.findMany({ where: { workspace: ws }, include: { client: true, domesticCase: true, versions: { orderBy: { version: 'asc' } }, order: true }, orderBy: [{ expiryDate: 'asc' }, { code: 'asc' }] });
  const active = all.filter(c => !c.archivedAt), archivedCount = all.length - active.length;
  const pool = showArchived ? all.filter(c => c.archivedAt) : active;
  const list = division === 'all' ? pool : pool.filter(c => c.division === division);
  const bands = active.map(c => V.expiryBand(dateToISO(c.expiryDate), today));
  const rows: TableRow[] = list.map(c => {
    const band = V.expiryBand(dateToISO(c.expiryDate), today), owner = c.client?.name ?? c.domesticCase?.customer ?? '—', last = c.versions[c.versions.length - 1];
    return {
      key: String(c.id), search: `${c.code} ${owner} ${c.title} ${c.agreementType}`, filters: { division: c.division, alert: band || 'OK' },
      cells: [c.code, C.v8.contractDivisions.find(d => d[0] === c.division)?.[1] ?? c.division, <><b>{owner}</b><div className="muted">{c.domesticCase ? 'Individual sponsor' : 'Company'}</div></>, <>{c.title}<div className="muted">{c.agreementType}{c.order ? ` · ${c.order.code}` : ''}</div></>,
        dateToISO(c.expiryDate) ? <>{dateToISO(c.expiryDate)}<div><span className={`pill ${bandClass(band)}`}>{band || 'OK'}</span></div></> : '—',
        c.versions.length ? <div className="table-actions">{c.versions.map(v => <DownloadButton key={v.id} url={`/api/contracts/download?version=${v.id}`} label={`⇩ v${v.version}`} cls={`secondary small${v === last ? '' : ' ghost'}`} />)}</div> : <span className="muted">No file yet</span>],
      actions: manage ? <><ContractUpload contractId={c.id} code={c.code} /><ArchiveButton id={c.id} archived={!!c.archivedAt} /><EntityForm entity="contracts" id={c.id} label="Edit" cls="secondary small" lookups={lookups}
        values={{ division: c.division, client: c.client?.name ?? '', case_id: c.domesticCaseId ? String(c.domesticCaseId) : '', title: c.title, agreement_type: c.agreementType, signed_date: dateToISO(c.signedDate), effective_date: dateToISO(c.effectiveDate), expiry_date: dateToISO(c.expiryDate), order_id: c.orderId ? String(c.orderId) : '', billing_terms: c.billingTerms, warranty_terms: c.warrantyTerms, notes: c.notes }} /></> : undefined,
    };
  });
  // one ZIP button per company / sponsor folder
  const folders = [...new Map(list.map(c => [c.clientId ? 'c' + c.clientId : 's' + c.domesticCaseId, { key: c.clientId ? 'client=' + c.clientId : 'case=' + c.domesticCaseId, name: c.client?.name ?? c.domesticCase?.customer ?? '?', n: 0, files: 0 }])).values()];
  for (const c of list) { const f = folders.find(x => x.key === (c.clientId ? 'client=' + c.clientId : 'case=' + c.domesticCaseId))!; f.n++; f.files += c.versions.length; }
  return (
    <>
      <Heading title="Contract Library" desc="Company folders for Blue-Collar and Corporate · individual sponsor folders for Domestic · every version kept" actions={manage ? <EntityForm entity="contracts" label="+ New Contract" lookups={lookups} values={division !== 'all' ? { division } : undefined} /> : undefined} />
      <div className="tabs">{[['all', 'All'], ...C.v8.contractDivisions].map(([id, label]) => <Link key={id} href={id === 'all' ? '/contracts' : `/contracts?division=${id}`} className={`tab ${division === id ? 'selected' : ''}`}>{label}</Link>)}</div>
      <Cards><Metric label="Contracts" value={active.length} sub={`${active.reduce((n, c) => n + c.versions.length, 0)} files stored${archivedCount ? ` · ${archivedCount} archived` : ''}`} /><Metric label="Expired" value={bands.filter(b => b === 'Expired').length} sub="Past expiry date" /><Metric label="Within 7 days" value={bands.filter(b => b === 'Within 7 days').length} sub="Urgent" /><Metric label="Within 30 / 90 days" value={`${bands.filter(b => b === 'Within 30 days').length} / ${bands.filter(b => b === 'Within 90 days').length}`} sub="Renewal planning" /></Cards>
      <div className="tabs"><Link href={division === 'all' ? '/contracts' : `/contracts?division=${division}`} className={`tab ${!showArchived ? 'selected' : ''}`}>Active</Link><Link href={`/contracts?${division === 'all' ? '' : `division=${division}&`}archived=1`} className={`tab ${showArchived ? 'selected' : ''}`}>Archived ({archivedCount})</Link></div>
      <Panel title={showArchived ? 'Archived Contracts' : 'Contracts'}><DataTable columns={['Contract', 'Division', 'Company / Sponsor', 'Agreement', 'Expiry', 'Files (original + versions)']} rows={rows}
        filters={[{ key: 'alert', label: 'Expiry alerts', values: ['Expired', 'Within 7 days', 'Within 30 days', 'Within 90 days', 'OK'] }]} empty={showArchived ? "No archived contracts." : "No contracts yet."} /></Panel>
      {folders.length > 0 && <Panel title="Download a whole folder (ZIP)"><div className="row">{folders.filter(f => f.files).map(f => <DownloadButton key={f.key} url={`/api/contracts/zip?${f.key}`} label={`⇩ ${f.name} (${f.files} file${f.files > 1 ? 's' : ''})`} />)}
        {division !== 'all' && <DownloadButton url={`/api/contracts/zip?division=${division}`} label="⇩ Whole division" cls="" />}</div></Panel>}
      <Notice>Archiving hides a contract from alerts and the active list; <b>nothing is deleted</b> and every file stays downloadable under “Archived”. Files are stored <b>encrypted</b> on the server and are never overwritten — uploading again adds a new version. Every download and ZIP is written to the audit log, and each file’s checksum is verified on download so you receive the exact original. Virus scanning is <b>not installed</b> in this build (file type, size and content signature are checked). Contracts are visible to the Managing Director and Admin Manager only (assumption — change in settings with the client).</Notice>
    </>
  );
}

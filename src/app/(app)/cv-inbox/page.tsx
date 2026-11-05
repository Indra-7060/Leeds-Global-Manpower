import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { C } from '@/lib/config';
import { Badge, Heading, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import DownloadButton from '@/components/DownloadButton';
import EntityForm from '@/components/EntityForm';
import CvUpload from './cv-upload';
import { CvDelete, CvStatus } from './cv-actions';

export default async function CvInboxPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws), lookups = buildLookups(s);
  const rows: TableRow[] = s.cvInbox.map(x => ({
    key: String(x.id), search: `${x.filename} ${x.client} ${x.agency} ${x.extracted_email}`, filters: { status: x.status, source: x.source },
    cells: [x.filename, x.source, x.client, x.agency, x.extracted_email, <span key="s"><Badge text={x.status} /><span className="src">{x.note}</span></span>],
    actions: <>
      <EntityForm entity="candidates" label="Create candidate" cls="small" title={`New candidate from ${x.filename}`} hidden={{ _cv: String(x.id) }} lookups={lookups}
        values={{ client: x.client, agency: x.agency, country: x.country || 'Nepal', name: x.filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }} />
      <CvStatus id={x.id} status="Reviewed" label="Reviewed" /><CvStatus id={x.id} status="Ignored" label="Ignore" /><CvDelete id={x.id} name={x.filename} />
    </>,
  }));
  return (
    <>
      <Heading title="CV Intake Center" desc="Collect CVs from files, email attachments and WeTransfer downloads" />
      <Notice>This version cannot connect to Gmail, Outlook or WeTransfer links automatically. Download email attachments or WeTransfer archives first, then upload the files here. Only file details are recorded — the files themselves are not stored. Do not upload real passports or sensitive CVs until secure file storage exists.</Notice>
      <Panel title="Upload CVs and Attachments"><CvUpload clients={s.clients.map(c => c.name)} countries={[...C.countries]} sources={[...C.cvSources]} /></Panel>
      <Panel title="CV Intake Review Queue" actions={<DownloadButton url={`/api/export?report=${encodeURIComponent('CV Intake')}`} label="Export CV Intake CSV" />}>
        <DataTable columns={['File', 'Source', 'Client', 'Agency', 'Extracted E-mail', 'Status']} rows={rows}
          filters={[{ key: 'status', label: 'Statuses', values: [...C.cvStatuses] }, { key: 'source', label: 'Sources', values: [...C.cvSources] }]} empty="No files received yet." />
      </Panel>
      <Panel title="Production Automation Requirements"><p>Connect an authorized shared recruitment mailbox via Microsoft Graph or Gmail API, download attachments securely, support WeTransfer files after authorized retrieval, unpack ZIP/RAR, extract PDF/DOCX/CV text with OCR where necessary, identify passport and trade, detect duplicates, match orders and agencies, and send uncertain matches to staff review. Never automatically share confidential documents with the wrong client.</p></Panel>
    </>
  );
}

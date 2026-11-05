import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { Badge, Heading, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function VaultPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws), lookups = buildLookups(s);
  const rows: TableRow[] = s.credentials.map(c => ({
    key: String(c.id), search: `${c.client} ${c.portal} ${c.record}`, filters: { portal: c.portal },
    cells: [c.client, c.portal, c.record, <Badge key="b" text={c.access} />],
    actions: <><EntityForm entity="credentials" id={c.id} label="Edit" cls="secondary small" values={c} lookups={lookups} /><DeleteButton entity="credentials" id={c.id} what={`Record for ${c.client} (${c.portal})`} /></>,
  }));
  return (
    <>
      <Heading title="Client Credentials Register" desc="Restricted reference for government portal accounts and application tracking" />
      <Panel title="Register Records" actions={<EntityForm entity="credentials" label="+ Add Record" lookups={lookups} />}>
        <DataTable columns={['Client', 'Portal', 'Record', 'Access']} rows={rows} filters={[{ key: 'portal', label: 'Portals', values: [...new Set(s.credentials.map(c => c.portal))].sort() }]} empty="No records. This register holds descriptions only — never passwords." />
      </Panel>
      <Notice>SECURITY: this register stores descriptions only. The server refuses text that looks like a password, OTP or PIN. Do not put real passwords, OTPs, government login credentials or client documents here. A real secrets vault (encrypted, per-secret access, full audit) is required before credentials can be stored. Never expose passwords in reports or exports.</Notice>
    </>
  );
}

import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import { domestic } from '@/lib/domain/metrics';
import * as V from '@/lib/domain/v8';
import { C, can } from '@/lib/config';
import { mask } from '@/lib/crypto';
import { money, todayISO, uniqSorted } from '@/lib/util';
import { Badge, Cards, Flow, Heading, Metric, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { AdvanceButton, DeleteButton } from '@/components/RowButtons';

export default async function DomesticPage() {
  const { user, ws } = await requireUser();
  const fin = can(user.role, 'finance.view'), today = todayISO();
  const s = await loadState(ws);
  const lookups = { ...buildLookups(s), ...(await v8Lookups(ws, user.role)) };
  const m = domestic(s);
  // money is only read for users who may see it
  const acc = fin ? new Map((await prisma.domesticCase.findMany({ where: { workspace: ws }, include: { account: true, payments: true } })).map(c => [c.id, c.account ? V.domesticBalance(Number(c.account.agreedFee), c.payments.map(p => ({ direction: p.direction, category: p.category, amount: Number(p.amount) }))) : null])) : null;
  const rows: TableRow[] = s.domestic.map(d => {
    const next = C.domesticStatuses[C.domesticStatuses.indexOf(d.status) + 1], w = V.warrantyWindow(d.handover_date, today), b = acc?.get(d.dbId);
    return {
      key: d.id, search: `${d.id} ${d.customer} ${d.origin} ${d.category} ${d.mobile} ${d.next_action}`, filters: { status: d.status, origin: d.origin, category: d.category },
      cells: [d.id, <><b>{d.customer || '—'}</b><div className="muted">{d.sponsor_type} · {d.mobile || 'no mobile'}</div></>, mask(d.qid_last), d.category || '—', d.origin, <Badge key="b" text={d.status} />,
        d.handover_date ? <>{d.handover_date}<div className="muted">{w.state}{w.daysLeft != null && w.daysLeft >= 0 ? ` · ${w.daysLeft} d left` : ''}</div></> : '—',
        ...(fin ? [b ? <>{money(b.balance)}</> : <span className="muted">no fee agreement</span>] : [])],
      actions: <>{next && <AdvanceButton entity="domestic" id={d.dbId} next={next} />}<EntityForm entity="domestic" id={d.dbId} label="Edit" cls="secondary small" values={d} lookups={lookups} />
        {fin && <EntityForm entity="domAccount" label="Fee agreement" cls="secondary small" values={{ case_id: String(d.dbId) }} lookups={lookups} title={`Fee agreement — ${d.id}`} />}<DeleteButton entity="domestic" id={d.dbId} what={d.id} /></>,
    };
  });
  return (
    <>
      <Heading title="Domestic Workers" desc="Active division — individual Qatari and eligible resident sponsors (not corporate customers)" />
      <Cards><Metric label="Enquiries" value={m.enquiries} sub="Sponsor cases" /><Metric label="Workers Shared" value={m.profilesShared} sub="Profiles stage or later" /><Metric label="Visa Cases" value={m.visaCases} sub="Visa & Travel" /><Metric label="Handovers" value={m.handovers} sub="Arrival / guarantee" /></Cards>
      <Panel title="Domestic Worker Workflow"><Flow items={C.domesticStatuses} /></Panel>
      <Panel title="Sponsor Cases" actions={<EntityForm entity="domestic" label="+ New Sponsor Case" lookups={lookups} />}>
        <DataTable columns={['Case', 'Sponsor', 'QID', 'Category', 'Nationality', 'Status', 'Handover / guarantee', ...(fin ? ['Balance due'] : [])]} rows={rows}
          filters={[{ key: 'status', label: 'Statuses', values: [...C.domesticStatuses] }, { key: 'category', label: 'Categories', values: [...C.v8.domesticCategories] }, { key: 'origin', label: 'Nationalities', values: uniqSorted(s.domestic.map(d => d.origin)) }]} empty="No sponsor cases yet." />
      </Panel>
      <Notice>Sponsors are individuals — there are no company, CR or purchase-order fields. The QID is stored encrypted and shown masked. Fees, payment timing, guarantees and refunds must be validated against current Qatar law and the signed contract. {fin ? '' : 'Fee and payment details are visible to the Managing Director and Admin Manager only.'}</Notice>
    </>
  );
}

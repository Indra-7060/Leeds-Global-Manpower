import { requirePermission } from '@/lib/auth/dal';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import * as V from '@/lib/domain/v8';
import { dateToISO, money } from '@/lib/util';
import { Badge, Cards, Heading, Metric, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

export default async function DomesticPayments() {
  const { user, ws } = await requirePermission('finance.view');
  const lookups = await v8Lookups(ws, user.role);
  const cases = await prisma.domesticCase.findMany({ where: { workspace: ws }, include: { account: true, payments: { orderBy: [{ date: 'desc' }, { id: 'desc' }] } }, orderBy: { code: 'asc' } });
  const bal = (c: (typeof cases)[number]) => (c.account ? V.domesticBalance(Number(c.account.agreedFee), c.payments.map(p => ({ direction: p.direction, category: p.category, amount: Number(p.amount) }))) : null);
  const totals = cases.reduce((t, c) => { const b = bal(c); return b ? { fee: t.fee + Number(c.account!.agreedFee), received: t.received + b.received, balance: t.balance + b.balance } : t; }, { fee: 0, received: 0, balance: 0 });

  const accRows: TableRow[] = cases.map(c => {
    const b = bal(c);
    return { key: String(c.id), search: `${c.code} ${c.customer}`, filters: { state: !b ? 'No fee agreement' : b.balance > 0 ? 'Balance due' : 'Settled' },
      cells: [c.code, c.customer || '—', c.account ? money(Number(c.account.agreedFee)) : '—', b ? money(b.received) : '—', b ? money(b.balance) : '—', b ? <Badge text={b.balance > 0 ? 'Balance due' : 'Settled'} /> : <Badge text="No fee agreement" />],
      actions: <><EntityForm entity="domAccount" label={c.account ? 'Edit fee' : 'Set fee'} cls="secondary small" values={{ case_id: String(c.id), agreed_fee: c.account ? Number(c.account.agreedFee) : '', gov_fees: c.account ? Number(c.account.govFees) : '', notes: c.account?.notes ?? '' }} lookups={lookups} title={`Fee agreement — ${c.code}`} />
        <EntityForm entity="domPayments" label="+ Payment" cls="small" values={{ case_id: String(c.id) }} lookups={lookups} title={`Record payment — ${c.code}`} /></> };
  });
  const ledger: TableRow[] = cases.flatMap(c => c.payments.map(p => ({
    key: 'p' + p.id, search: `${c.code} ${c.customer} ${p.receiptNo} ${p.reference} ${p.category}`, filters: { direction: p.direction, category: p.category },
    cells: [dateToISO(p.date), p.receiptNo || '—', `${c.code} · ${c.customer}`, p.category, p.direction === 'Incoming' ? money(Number(p.amount)) : '—', p.direction === 'Outgoing' ? money(Number(p.amount)) : '—', p.account, p.reference || '—'],
    actions: <><EntityForm entity="domPayments" id={p.id} label="Edit" cls="secondary small" values={{ case_id: String(c.id), direction: p.direction, category: p.category, date: dateToISO(p.date), amount: Number(p.amount), account: p.account, reference: p.reference, note: p.note }} lookups={lookups} /><DeleteButton entity="domPayments" id={p.id} what={`Payment ${p.receiptNo || '#' + p.id}`} /></>,
  })));
  return (
    <>
      <Heading title="Sponsor Payments" desc="Advance + deployment balance per individual sponsor — domestic ledger (QIIB by default). Management only." />
      <Cards cols={3}><Metric label="Agreed fees" value={money(totals.fee)} sub="Cases with a fee agreement" /><Metric label="Received" value={money(totals.received)} sub="Receipts issued" /><Metric label="Balance due" value={money(totals.balance)} sub="Not counted as earned revenue" /></Cards>
      <Panel title="Sponsor Accounts"><DataTable columns={['Case', 'Sponsor', 'Agreed fee', 'Received', 'Balance due', 'Status']} rows={accRows} filters={[{ key: 'state', label: 'Statuses', values: ['Balance due', 'Settled', 'No fee agreement'] }]} empty="No sponsor cases yet." /></Panel>
      <Panel title="Receipt & Payment Ledger"><DataTable columns={['Date', 'Receipt', 'Case', 'Type', 'Received', 'Refund paid', 'Account', 'Reference']} rows={ledger} filters={[{ key: 'direction', label: 'Directions', values: ['Incoming', 'Outgoing'] }]} empty="No payments recorded yet." /></Panel>
      <Notice>Advances are tracked as received money, not earned revenue. A receipt number (RC-…) is issued automatically for every incoming payment. Amounts must respect applicable Ministry price caps and the approved contract. A refund is only ever recorded here as “Refund paid” <b>after</b> the Managing Director has approved the claim — the system never pays anything by itself.</Notice>
    </>
  );
}

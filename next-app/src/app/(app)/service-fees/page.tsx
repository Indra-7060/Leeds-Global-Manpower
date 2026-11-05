import { requirePermission } from '@/lib/auth/dal';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import * as V from '@/lib/domain/v8';
import { eligibleWorkers } from '@/lib/repo/mutations-v8';
import { C } from '@/lib/config';
import { dateToISO } from '@/lib/util';
import { Badge, Cards, Heading, Metric, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';

const fmt = (cur: string, n: number) => `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ServiceFees() {
  const { user, ws } = await requirePermission('finance.view');
  const lookups = await v8Lookups(ws, user.role), actor = { workspace: ws, role: user.role, userId: user.userId };
  const terms = await prisma.serviceFeeTerm.findMany({ where: { workspace: ws }, include: { client: true, order: true, invoices: { include: { payments: true } } }, orderBy: { id: 'asc' } });
  const view = await Promise.all(terms.map(async t => {
    const eligible = await eligibleWorkers(prisma as never, actor, t), invoicedWorkers = t.invoices.reduce((s, i) => s + i.workers, 0);
    const allowed = V.serviceInvoiceable(t, eligible, invoicedWorkers, t.invoices.length);
    return { t, eligible, allowed, invoiced: t.invoices.reduce((s, i) => s + Number(i.amount), 0), collected: t.invoices.reduce((s, i) => s + i.payments.reduce((q, p) => q + Number(p.amount), 0), 0), est: t.enabled ? V.serviceInvoiceAmount({ basis: t.basis, amount: Number(t.amount) }, t.basis === 'order' ? 1 : eligible) : 0 };
  }));
  const termRows: TableRow[] = view.map(({ t, eligible, allowed, invoiced, collected, est }) => ({
    key: String(t.id), search: `${t.client.name} ${t.order?.code ?? ''} ${t.trigger}`, filters: { enabled: t.enabled ? 'Enabled' : 'Not enabled', currency: t.currency },
    cells: [t.client.name, t.order?.code ?? 'All orders', <Badge key="e" text={t.enabled ? 'Active' : 'Not enabled'} />, `${fmt(t.currency, Number(t.amount))} · ${C.v8.serviceBasis[t.basis]}`, t.trigger, t.taxable ? 'Yes' : 'No',
      t.enabled ? `${eligible} reached · ${allowed} invoiceable` : '—', t.enabled ? fmt(t.currency, est) : '—', `${fmt(t.currency, invoiced)} / ${fmt(t.currency, collected)}`],
    actions: <>{t.enabled && allowed > 0 && <EntityForm entity="serviceInvoices" label="+ Invoice" cls="small" values={{ term_id: String(t.id), workers: t.basis === 'order' ? 1 : allowed, date: dateToISO(new Date()) }} lookups={lookups} title="Create service-charge invoice" />}
      <EntityForm entity="serviceTerms" id={t.id} label="Edit" cls="secondary small" values={{ client: t.client.name, order_id: t.order?.code ?? '', enabled: t.enabled ? 'Yes' : 'No', currency: t.currency, basis: t.basis, amount: Number(t.amount), trigger: t.trigger, taxable: t.taxable ? 'Yes' : 'No', notes: t.notes }} lookups={lookups} /><DeleteButton entity="serviceTerms" id={t.id} what="This agreement and its invoices" /></>,
  }));
  const invRows: TableRow[] = terms.flatMap(t => t.invoices.map(i => {
    const got = i.payments.reduce((s, p) => s + Number(p.amount), 0), out = V.round2(Number(i.amount) - got);
    return { key: 'i' + i.id, search: `${i.code} ${t.client.name} ${i.invoiceNo}`, filters: { state: out <= 0 ? 'Paid' : got > 0 ? 'Partial' : 'Unpaid' },
      cells: [i.code, t.client.name, dateToISO(i.date), i.invoiceNo || '—', t.basis === 'order' ? 'Per order' : `${i.workers} worker(s)`, fmt(t.currency, Number(i.amount)), fmt(t.currency, got), fmt(t.currency, out), <Badge key="s" text={out <= 0 ? 'Paid' : got > 0 ? 'Partial' : 'Unpaid'} />],
      actions: <>{out > 0 && <EntityForm entity="servicePayments" label="+ Receipt" cls="small" values={{ service_invoice_id: String(i.id), amount: out }} lookups={lookups} title={`Receipt — ${i.code}`} />}<DeleteButton entity="serviceInvoices" id={i.id} what={`${i.code} (and its receipts)`} /></> };
  }));
  const est = view.reduce((s, v) => s + (v.t.currency === 'USD' ? v.est : 0), 0);
  return (
    <>
      <Heading title="Blue-Collar Service Charges" desc="Optional client-paid service charge per deployed worker or per order — off unless the agreement enables it. Management only." actions={<EntityForm entity="serviceTerms" label="+ New Agreement" lookups={lookups} />} />
      <Cards cols={3}><Metric label="Agreements" value={terms.length} sub={`${terms.filter(t => t.enabled).length} enabled`} /><Metric label="Workers ready to invoice" value={view.reduce((s, v) => s + (v.t.basis === 'worker' ? v.allowed : 0), 0)} sub="Reached the agreed trigger, not yet invoiced" /><Metric label="Contractual estimate (USD)" value={fmt('USD', est)} sub="Not revenue until invoiced and received" /></Cards>
      <Panel title="Service-Charge Agreements"><DataTable columns={['Client', 'Order', 'Status', 'Negotiated charge', 'Trigger', 'Taxable', 'Workers', 'Estimate', 'Invoiced / collected']} rows={termRows} filters={[{ key: 'enabled', label: 'Statuses', values: ['Enabled', 'Not enabled'] }]} empty="No service-charge agreements. Clients are not charged unless an agreement is enabled." /></Panel>
      <Panel title="Invoices & Receipts"><DataTable columns={['Invoice', 'Client', 'Date', 'Invoice no.', 'Basis', 'Amount', 'Received', 'Outstanding', 'Status']} rows={invRows} filters={[{ key: 'state', label: 'Statuses', values: ['Unpaid', 'Partial', 'Paid'] }]} empty="No invoices yet." /></Panel>
      <Notice>Client-paid service charges are kept apart from agency-paid revenue and costs. An invoice can only be created once workers have reached the agreed trigger (“{C.v8.serviceTriggers.join('”, “')}”). A fixed per-order charge is invoiceable once, after any worker reaches the trigger (assumption — confirm with the client). Taxes are only flagged, not calculated.</Notice>
    </>
  );
}

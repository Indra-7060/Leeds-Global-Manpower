import { requirePermission } from '@/lib/auth/dal';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import * as V from '@/lib/domain/v8';
import { C } from '@/lib/config';
import { dateToISO, money, todayISO } from '@/lib/util';
import { Badge, Cards, Heading, Metric, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';
import FeeCalculator from '../fee-calculator';

export default async function PlacementFees() {
  const { user, ws } = await requirePermission('finance.view');
  const lookups = await v8Lookups(ws, user.role), today = todayISO();
  const fees = await prisma.placementFee.findMany({ where: { workspace: ws }, include: { payments: { orderBy: { date: 'asc' } }, placement: { include: { vacancy: { include: { client: true } } } } }, orderBy: { id: 'asc' } });
  const sums = fees.map(f => ({ f, s: V.placementFeeSummary({ feeAmount: Number(f.feeAmount), creditNote: Number(f.creditNote), joining: dateToISO(f.placement.joiningDate), dueMonths: f.dueMonths, invoiceDate: dateToISO(f.invoiceDate), paid: f.payments.filter(p => p.direction === 'Incoming').reduce((a, p) => a + Number(p.amount), 0), today }) }));
  const t = sums.reduce((a, { s }) => ({ accrued: a.accrued + s.accrued, invoiced: a.invoiced + s.invoiced, collected: a.collected + s.collected, outstanding: a.outstanding + s.outstanding }), { accrued: 0, invoiced: 0, collected: 0, outstanding: 0 });
  const rows: TableRow[] = sums.map(({ f, s }) => ({
    key: String(f.id), search: `${f.placement.code} ${f.placement.candidateName} ${f.placement.vacancy.client.name} ${f.invoiceNo}`, filters: { status: s.status },
    cells: [f.placement.code, f.placement.candidateName, f.placement.vacancy.client.name, dateToISO(f.placement.joiningDate) || '—', `${money(Number(f.feeAmount))}${Number(f.creditNote) ? ` − ${money(Number(f.creditNote))} credit` : ''}`,
      s.due || '—', f.invoiceNo ? `${f.invoiceNo} (${dateToISO(f.invoiceDate) || 'no date'})` : '—', money(s.collected), money(s.outstanding), <Badge key="b" text={s.status} />],
    actions: <><EntityForm entity="placePayments" label="+ Receipt" cls="small" values={{ placement_fee_id: String(f.id) }} lookups={lookups} title={`Record fee receipt — ${f.placement.code}`} />
      <EntityForm entity="placementFees" label="Edit" cls="secondary small" values={{ placement_id: String(f.placementId), basic_salary: Number(f.basicSalary), basis: f.basis, custom_fee: f.basis === 'custom' ? Number(f.feeAmount) : '', due_months: String(f.dueMonths), invoice_no: f.invoiceNo, invoice_date: dateToISO(f.invoiceDate), credit_note: Number(f.creditNote), credit_reason: f.creditReason, note: f.note }} lookups={lookups} />
      <DeleteButton entity="placementFees" id={f.id} what={`Fee for ${f.placement.code} (its receipts too)`} /></>,
  }));
  return (
    <>
      <Heading title="Placement Fees" desc="Half or one month of basic salary (or a custom fee), due 1 or 3 months after confirmed joining. Management only." />
      <Cards><Metric label="Accrued" value={money(t.accrued)} sub="Joined — fee earned" /><Metric label="Invoiced" value={money(t.invoiced)} sub="Invoice date entered" /><Metric label="Collected" value={money(t.collected)} sub="Cash actually received" /><Metric label="Outstanding" value={money(t.outstanding)} sub="Accrued − collected" /></Cards>
      <Panel title="Fees & Collections"><DataTable columns={['Placement', 'Candidate', 'Company', 'Confirmed joining', 'Fee', 'Due date', 'Invoice', 'Collected', 'Outstanding', 'Status']} rows={rows}
        filters={[{ key: 'status', label: 'Statuses', values: ['Awaiting joining', 'Not yet due', 'Due today', 'Overdue', 'Partial', 'Partial — overdue', 'Paid', 'Credited in full'] }]} empty="No placement fees yet — open Candidates and use “Set fee” on a placement." /></Panel>
      <Panel title="Illustrative Fee Calculator"><FeeCalculator /></Panel>
      <Notice>Four things are kept apart: <b>accrued</b> (candidate has joined), <b>invoiced</b> (an invoice date is entered), <b>due date</b> (confirmed joining + {C.v8.feeDueMonths.join(' or ')} calendar months) and <b>collected</b> (a receipt is recorded). A due date never counts as cash received. The signed agreement decides the real trigger — note any exception on the fee. VAT/taxes and replacement terms are not calculated here.</Notice>
    </>
  );
}

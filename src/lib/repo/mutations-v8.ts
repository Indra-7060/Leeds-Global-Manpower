import 'server-only';
import { prisma } from '@/lib/db';
import { C, can } from '@/lib/config';
import { validateInput } from '@/lib/forms';
import { canonicalCountry } from '@/lib/domain/rules';
import * as V from '@/lib/domain/v8';

import { d, fail, findClient, log, nextNumber, type Actor, type Result, type Tx } from './mutations';

/**
 * V8 write operations. Rules enforced HERE (server side), never only in the UI:
 *  • every table that holds money or fees requires the finance permission (MD + Nitija);
 *  • refunds and agency-deposit allocations are decided only by the Managing Director, and deciding never moves money;
 *  • contracts are never overwritten (new version) — see src/lib/repo/contracts.ts.
 */
const NO_FINANCE = 'Finance, fees and payments are restricted to the Managing Director and Admin Manager.';
const money = (n: unknown) => Number(n ?? 0);
const needFinance = (a: Actor) => (can(a.role, 'finance.view') ? null : fail({ _: NO_FINANCE }));
const bad = (entity: string, input: Record<string, unknown>, editing: boolean) => validateInput(entity, input, { editing });
const idOf = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
const codeOf = async (tx: Tx, a: Actor, kind: string, start: number, prefix: string, pad = 0) => {
  const n = await nextNumber(tx, a.workspace, kind, start); return prefix + (pad ? String(n).padStart(pad, '0') : String(n));
};

async function sponsorCase(tx: Tx, a: Actor, id: unknown) { const x = idOf(id); return x ? tx.domesticCase.findFirst({ where: { id: x, workspace: a.workspace } }) : null; }

// ───────────── domestic: fee agreement, payments, refund claims ─────────────

export async function saveDomAccount(a: Actor, input: Record<string, unknown>): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('domAccount', input, false); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const c = await sponsorCase(tx, a, clean.case_id); if (!c) return fail({ case_id: 'Sponsor case not found.' });
    const data = { agreedFee: money(clean.agreed_fee), govFees: money(clean.gov_fees), notes: clean.notes };
    await tx.domesticAccount.upsert({ where: { caseId: c.id }, create: { ...data, workspace: a.workspace, caseId: c.id }, update: data });
    await log(tx, a, 'domestic', c.code, '', `Fee agreement for ${c.code}: QAR ${data.agreedFee} (government fees ${data.govFees})`);
    return { ok: true, code: c.code } as Result;
  });
}

export async function saveDomPayment(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('domPayments', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const c = await sponsorCase(tx, a, clean.case_id); if (!c) return fail({ case_id: 'Sponsor case not found.' });
    if (clean.direction === 'Outgoing' && clean.category !== 'Refund paid') return fail({ category: 'Outgoing payments are for refunds — choose “Refund paid”.' });
    if (clean.direction === 'Incoming' && clean.category === 'Refund paid') return fail({ category: '“Refund paid” must be an Outgoing payment.' });
    const acct = await tx.domesticAccount.findUnique({ where: { caseId: c.id } });
    if (clean.direction === 'Incoming' && !acct) return fail({ case_id: 'Record the sponsor’s fee agreement first (Fee agreement button) so the balance can be calculated.' });
    const data = { direction: clean.direction, category: clean.category, date: d(clean.date)!, amount: money(clean.amount), currency: 'QAR', account: clean.account, reference: clean.reference, note: clean.note };
    if (id) {
      const x = await tx.receivablePayment.findFirst({ where: { id, workspace: a.workspace, domesticCaseId: c.id } }); if (!x) return fail({ _: 'Payment not found.' });
      await tx.receivablePayment.update({ where: { id }, data }); await log(tx, a, 'domestic', c.code, '', `Payment ${x.receiptNo || '#' + id} on ${c.code} corrected`);
      return { ok: true, code: x.receiptNo } as Result;
    }
    const receiptNo = clean.direction === 'Incoming' ? await codeOf(tx, a, 'receipt', 1001, 'RC-') : '';
    await tx.receivablePayment.create({ data: { ...data, workspace: a.workspace, domesticCaseId: c.id, receiptNo, createdById: a.userId } });
    await log(tx, a, 'domestic', c.code, '', `${clean.direction} QAR ${data.amount} ${clean.category} on ${c.code}${receiptNo ? ' — receipt ' + receiptNo : ''}`);
    return { ok: true, code: receiptNo || undefined } as Result;
  });
}

export async function saveRefund(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('refunds', input, !!id); if (Object.keys(errors).length) return fail(errors);
  if (clean.months_served > C.v8.refundRule.totalMonths) return fail({ months_served: `Enter 0–${C.v8.refundRule.totalMonths} (the guarantee period is ${C.v8.refundRule.totalMonths} months).` });
  return prisma.$transaction(async tx => {
    const c = await sponsorCase(tx, a, clean.case_id); if (!c) return fail({ case_id: 'Sponsor case not found.' });
    const [acct, pays] = await Promise.all([tx.domesticAccount.findUnique({ where: { caseId: c.id } }), tx.receivablePayment.findMany({ where: { domesticCaseId: c.id, direction: 'Incoming' } })]);
    const feePaid = clean.fee_paid ?? V.round2(pays.reduce((s, p) => s + money(p.amount), 0)), gov = clean.gov_fees ?? money(acct?.govFees);
    const est = V.refundEstimate({ fee: feePaid, govFees: gov, monthsServed: clean.months_served, reason: clean.reason });
    const data = { caseId: c.id, monthsServed: clean.months_served, reason: clean.reason, evidence: clean.evidence, feePaid, govFees: gov, estimate: est.estimate, ruleVersion: C.v8.refundRule.version };
    if (id) {
      const x = await tx.refundClaim.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Refund claim not found.' });
      if (x.status !== 'Pending review') return fail({ _: 'A decided claim cannot be edited. Open a new claim if circumstances changed.' });
      await tx.refundClaim.update({ where: { id }, data }); await log(tx, a, 'refunds', x.code, '', `Refund claim ${x.code} updated`);
      return { ok: true, code: x.code } as Result;
    }
    const code = await codeOf(tx, a, 'refund', 1, 'RF-', 3);
    await tx.refundClaim.create({ data: { ...data, workspace: a.workspace, code, requestedById: a.userId } });
    await log(tx, a, 'refunds', code, '', `Refund claim ${code} for ${c.code}: ${clean.reason}, ${clean.months_served} month(s), estimate ${est.estimate ?? 'review required'}`);
    return { ok: true, code } as Result;
  });
}

/** Records the decision only. Paying the sponsor is a separate, manual “Refund paid” entry — nothing is paid automatically. */
export async function decideRefund(a: Actor, id: number, decision: 'Approved' | 'Rejected', note: string): Promise<Result> {
  if (!can(a.role, 'refund.approve')) return fail({ _: 'Only the Managing Director can approve or reject refunds.' });
  if (!note.trim()) return fail({ _: 'A decision note is required.' });
  return prisma.$transaction(async tx => {
    const x = await tx.refundClaim.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Refund claim not found.' });
    if (x.status !== 'Pending review') return fail({ _: `Already ${x.status.toLowerCase()}.` });
    await tx.refundClaim.update({ where: { id }, data: { status: decision, decidedById: a.userId, decidedAt: new Date(), decisionNote: note.trim().slice(0, 500) } });
    await log(tx, a, 'refunds', x.code, '', `Refund claim ${x.code} ${decision.toLowerCase()} by the Managing Director — no payment made automatically`);
    return { ok: true, code: x.code } as Result;
  });
}

// ───────────── corporate: vacancies, placements, fees, receipts ─────────────

export async function saveVacancy(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('vacancies', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client); if (!client) return fail({ client: 'Company not found — add it with “+ New Company” first.' });
    if (client.segment === 'Blue-Collar') return fail({ client: 'This company is a Blue-Collar client. Set its division to “Corporate” or “Both” before opening a corporate vacancy.' });
    const data = { clientId: client.id, title: clean.title, category: clean.category, quantity: clean.quantity, source: clean.source, status: clean.status, notes: clean.notes };
    if (id) {
      const x = await tx.corporateVacancy.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Vacancy not found.' });
      await tx.corporateVacancy.update({ where: { id }, data }); await log(tx, a, 'vacancies', x.code, client.name, `Vacancy ${x.code} updated`); return { ok: true, code: x.code } as Result;
    }
    const code = await codeOf(tx, a, 'vacancy', 1001, 'VC-');
    await tx.corporateVacancy.create({ data: { ...data, workspace: a.workspace, code } }); await log(tx, a, 'vacancies', code, client.name, `Vacancy ${code} (${clean.title} × ${clean.quantity}) opened`);
    return { ok: true, code } as Result;
  });
}

export async function savePlacement(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('placements', input, !!id); if (Object.keys(errors).length) return fail(errors);
  if (clean.stage === 'Joined' && !clean.joining_date) return fail({ joining_date: 'Stage “Joined” needs the confirmed joining date.' });
  if (clean.joining_date && clean.stage !== 'Joined') return fail({ stage: 'A confirmed joining date means the stage must be “Joined”.' });
  return prisma.$transaction(async tx => {
    const vac = await tx.corporateVacancy.findFirst({ where: { id: idOf(clean.vacancy_id), workspace: a.workspace }, include: { client: true } }); if (!vac) return fail({ vacancy_id: 'Vacancy not found.' });
    const data = { vacancyId: vac.id, candidateName: clean.candidate_name, source: clean.source, country: clean.country ? canonicalCountry(clean.country) : '', stage: clean.stage,
      offerDate: d(clean.offer_date), joiningDate: d(clean.joining_date), notes: clean.notes };
    if (id) {
      const x = await tx.corporatePlacement.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Placement not found.' });
      await tx.corporatePlacement.update({ where: { id }, data }); await log(tx, a, 'placements', x.code, vac.client.name, `Placement ${x.code} updated (${clean.stage})`); return { ok: true, code: x.code } as Result;
    }
    const code = await codeOf(tx, a, 'placement', 1001, 'PL-');
    await tx.corporatePlacement.create({ data: { ...data, workspace: a.workspace, code } }); await log(tx, a, 'placements', code, vac.client.name, `Candidate ${clean.candidate_name} added to ${vac.code} as ${code}`);
    return { ok: true, code } as Result;
  });
}

export async function savePlacementFee(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('placementFees', input, !!id); if (Object.keys(errors).length) return fail(errors);
  if (clean.basis === 'custom' && clean.custom_fee == null) return fail({ custom_fee: 'Enter the custom fee amount.' });
  const feeAmount = V.placementFeeAmount(clean.basis, money(clean.basic_salary), clean.custom_fee);
  const credit = money(clean.credit_note);
  if (credit > feeAmount) return fail({ credit_note: `A credit note cannot exceed the fee (QAR ${feeAmount}).` });
  return prisma.$transaction(async tx => {
    const p = await tx.corporatePlacement.findFirst({ where: { id: idOf(clean.placement_id), workspace: a.workspace }, include: { vacancy: { include: { client: true } } } }); if (!p) return fail({ placement_id: 'Placement not found.' });
    const data = { basicSalary: money(clean.basic_salary), basis: clean.basis, feeAmount, dueMonths: Number(clean.due_months), invoiceNo: clean.invoice_no, invoiceDate: d(clean.invoice_date), creditNote: credit, creditReason: clean.credit_reason, note: clean.note };
    await tx.placementFee.upsert({ where: { placementId: p.id }, create: { ...data, workspace: a.workspace, placementId: p.id }, update: data });
    await log(tx, a, 'placements', p.code, p.vacancy.client.name, `Placement fee for ${p.code}: QAR ${feeAmount} (${C.v8.feeBasis[clean.basis]}), due ${clean.due_months} month(s) after confirmed joining`);
    return { ok: true, code: p.code } as Result;
  });
}

async function paid(tx: Tx, where: object) { const r = await tx.receivablePayment.aggregate({ where: { direction: 'Incoming', ...where }, _sum: { amount: true } }); return money(r._sum.amount); }

export async function savePlacementPayment(a: Actor, input: Record<string, unknown>): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('placePayments', input, false); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const f = await tx.placementFee.findFirst({ where: { id: idOf(clean.placement_fee_id), workspace: a.workspace }, include: { placement: { include: { vacancy: { include: { client: true } } } } } }); if (!f) return fail({ placement_fee_id: 'Placement fee not found.' });
    if (!f.placement.joiningDate) return fail({ placement_fee_id: 'Joining is not confirmed yet — no fee can be received before the candidate joins.' });
    const outstanding = V.round2(money(f.feeAmount) - money(f.creditNote) - (await paid(tx, { placementFeeId: f.id })));
    if (money(clean.amount) > outstanding + 0.001) return fail({ amount: `Only QAR ${outstanding} is outstanding on this fee.` });
    const receiptNo = await codeOf(tx, a, 'receipt', 1001, 'RC-');
    await tx.receivablePayment.create({ data: { workspace: a.workspace, direction: 'Incoming', date: d(clean.date)!, amount: money(clean.amount), currency: 'QAR', account: clean.account, category: 'Placement fee', receiptNo, reference: clean.reference, note: clean.note, placementFeeId: f.id, createdById: a.userId } });
    await log(tx, a, 'placements', f.placement.code, f.placement.vacancy.client.name, `Received QAR ${clean.amount} against ${f.placement.code} — receipt ${receiptNo}`);
    return { ok: true, code: receiptNo } as Result;
  });
}

// ───────────── blue-collar optional service charge ─────────────

export async function eligibleWorkers(tx: Tx, a: Actor, term: { clientId: number; orderId: number | null; trigger: string }): Promise<number> {
  const stages = V.triggerStages(term.trigger);
  if (!stages) { const r = await tx.order.aggregate({ where: { workspace: a.workspace, clientId: term.clientId, ...(term.orderId ? { id: term.orderId } : {}) }, _sum: { qty: true } }); return r._sum.qty ?? 0; }
  return tx.candidate.count({ where: { workspace: a.workspace, clientId: term.clientId, ...(term.orderId ? { orderId: term.orderId } : {}), status: { in: stages } } });
}

export async function saveServiceTerm(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('serviceTerms', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client); if (!client) return fail({ client: 'Client not found.' });
    if (client.segment === 'Corporate') return fail({ client: 'Service charges apply to Blue-Collar clients; this company is Corporate-only.' });
    let orderId: number | null = null;
    if (clean.order_id) {
      const o = await tx.order.findFirst({ where: { workspace: a.workspace, code: clean.order_id } }) ?? await tx.order.findFirst({ where: { workspace: a.workspace, id: idOf(clean.order_id) } });
      if (!o || o.clientId !== client.id) return fail({ order_id: 'That order does not belong to this client.' }); orderId = o.id;
    }
    const data = { clientId: client.id, orderId, enabled: clean.enabled === 'Yes', currency: clean.currency, basis: clean.basis, amount: money(clean.amount), trigger: clean.trigger, taxable: clean.taxable === 'Yes', notes: clean.notes };
    if (id) {
      const x = await tx.serviceFeeTerm.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Agreement not found.' });
      await tx.serviceFeeTerm.update({ where: { id }, data }); await log(tx, a, 'servicefees', '', client.name, `Service-charge terms updated (${data.enabled ? 'enabled' : 'disabled'})`); return { ok: true } as Result;
    }
    await tx.serviceFeeTerm.create({ data: { ...data, workspace: a.workspace } }); await log(tx, a, 'servicefees', '', client.name, `Service-charge agreement added: ${data.currency} ${data.amount} ${C.v8.serviceBasis[data.basis]}, ${data.enabled ? 'enabled' : 'not enabled'}`);
    return { ok: true } as Result;
  });
}

export async function saveServiceInvoice(a: Actor, input: Record<string, unknown>): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('serviceInvoices', input, false); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const t = await tx.serviceFeeTerm.findFirst({ where: { id: idOf(clean.term_id), workspace: a.workspace }, include: { client: true, invoices: true } }); if (!t) return fail({ term_id: 'Agreement not found.' });
    if (!t.enabled) return fail({ term_id: 'This client has no service charge enabled — nothing can be invoiced.' });
    const eligible = await eligibleWorkers(tx, a, t), already = t.invoices.reduce((s, i) => s + i.workers, 0);
    const allowed = V.serviceInvoiceable(t, eligible, already, t.invoices.length);
    const workers = t.basis === 'order' ? 1 : Number(clean.workers ?? 0);
    if (allowed <= 0) return fail({ term_id: `The agreed trigger (“${t.trigger}”) has not been reached by any un-invoiced worker yet.` });
    if (workers < 1) return fail({ workers: 'Enter the number of workers to invoice.' });
    if (workers > allowed) return fail({ workers: `Only ${allowed} worker(s) have reached “${t.trigger}” and are not yet invoiced.` });
    const amount = V.serviceInvoiceAmount({ basis: t.basis, amount: money(t.amount) }, workers);
    const code = await codeOf(tx, a, 'serviceinv', 1001, 'SI-');
    await tx.serviceFeeInvoice.create({ data: { workspace: a.workspace, code, termId: t.id, invoiceNo: clean.invoice_no, date: d(clean.date)!, workers, amount, note: clean.note } });
    await log(tx, a, 'servicefees', code, t.client.name, `Service-charge invoice ${code}: ${t.currency} ${amount} for ${t.basis === 'order' ? 'the order' : workers + ' worker(s)'}`);
    return { ok: true, code } as Result;
  });
}

export async function saveServicePayment(a: Actor, input: Record<string, unknown>): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('servicePayments', input, false); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const inv = await tx.serviceFeeInvoice.findFirst({ where: { id: idOf(clean.service_invoice_id), workspace: a.workspace }, include: { term: { include: { client: true } } } }); if (!inv) return fail({ service_invoice_id: 'Invoice not found.' });
    const outstanding = V.round2(money(inv.amount) - (await paid(tx, { serviceInvoiceId: inv.id })));
    if (money(clean.amount) > outstanding + 0.001) return fail({ amount: `Only ${inv.term.currency} ${outstanding} is outstanding on ${inv.code}.` });
    const receiptNo = await codeOf(tx, a, 'receipt', 1001, 'RC-');
    await tx.receivablePayment.create({ data: { workspace: a.workspace, direction: 'Incoming', date: d(clean.date)!, amount: money(clean.amount), currency: inv.term.currency, account: clean.account, category: 'Service charge', receiptNo, reference: clean.reference, note: clean.note, serviceInvoiceId: inv.id, createdById: a.userId } });
    await log(tx, a, 'servicefees', inv.code, inv.term.client.name, `Received ${inv.term.currency} ${clean.amount} against ${inv.code} — receipt ${receiptNo}`);
    return { ok: true, code: receiptNo } as Result;
  });
}

// ───────────── agency deposits: explicit allocation approved by the MD ─────────────

export async function saveFundAllocation(a: Actor, input: Record<string, unknown>): Promise<Result> {
  const no = needFinance(a); if (no) return no;
  const { errors, clean } = bad('fundAllocations', input, false); if (Object.keys(errors).length) return fail(errors);
  if (!clean.order_id && !clean.candidate_id) return fail({ order_id: 'Choose the order (or candidate) this money is for.' });
  return prisma.$transaction(async tx => {
    const e = await tx.financeEntry.findFirst({ where: { id: idOf(clean.finance_entry_id), workspace: a.workspace } });
    if (!e || e.category !== C.v8.allocationCategory || e.direction !== 'Incoming') return fail({ finance_entry_id: 'Choose an incoming “Agency advance” deposit.' });
    const prior = await tx.financeAllocation.findMany({ where: { financeEntryId: e.id, status: { in: ['Proposed', 'Approved'] } } });
    const u = V.unallocated(money(e.amount), prior.map(p => ({ status: 'Approved', amount: money(p.amount) }))); // proposals also reserve their amount
    if (money(clean.amount) > u.unallocated + 0.001) return fail({ amount: `Only QAR ${u.unallocated} of this deposit is still free to allocate.` });
    const order = clean.order_id ? await tx.order.findFirst({ where: { id: idOf(clean.order_id), workspace: a.workspace } }) : null;
    if (clean.order_id && !order) return fail({ order_id: 'Order not found.' });
    const cand = clean.candidate_id ? await tx.candidate.findFirst({ where: { id: idOf(clean.candidate_id), workspace: a.workspace } }) : null;
    if (clean.candidate_id && !cand) return fail({ candidate_id: 'Candidate not found.' });
    await tx.financeAllocation.create({ data: { workspace: a.workspace, financeEntryId: e.id, orderId: order?.id ?? null, candidateId: cand?.id ?? null, amount: money(clean.amount), note: clean.note, proposedById: a.userId } });
    await log(tx, a, 'finance', order?.code ?? '', e.client, `Allocation of QAR ${clean.amount} from deposit ${e.party} proposed — awaiting Managing Director approval`);
    return { ok: true } as Result;
  });
}

export async function decideAllocation(a: Actor, id: number, decision: 'Approved' | 'Rejected'): Promise<Result> {
  if (!can(a.role, 'allocation.approve')) return fail({ _: 'Only the Managing Director can approve deposit allocations.' });
  return prisma.$transaction(async tx => {
    const x = await tx.financeAllocation.findFirst({ where: { id, workspace: a.workspace }, include: { entry: true, order: true } }); if (!x) return fail({ _: 'Allocation not found.' });
    if (x.status !== 'Proposed') return fail({ _: `Already ${x.status.toLowerCase()}.` });
    await tx.financeAllocation.update({ where: { id }, data: { status: decision, decidedById: a.userId, decidedAt: new Date() } });
    await log(tx, a, 'finance', x.order?.code ?? '', x.entry.client, `Allocation of QAR ${x.amount} (${x.entry.party}) ${decision.toLowerCase()} by the Managing Director`);
    return { ok: true } as Result;
  });
}

// ───────────── contracts (metadata; files are handled by repo/contracts.ts) ─────────────

export async function saveContract(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  if (!can(a.role, 'contracts.manage')) return fail({ _: 'Contracts are managed by the Managing Director and Admin Manager.' });
  const { errors, clean } = bad('contracts', input, !!id); if (Object.keys(errors).length) return fail(errors);
  const dom = clean.division === 'domestic';
  if (dom && !clean.case_id) return fail({ case_id: 'Domestic contracts are filed under an individual sponsor.' });
  if (dom && clean.client) return fail({ client: 'Domestic contracts are never filed under a company — remove the company.' });
  if (!dom && !clean.client) return fail({ client: 'Choose the company this contract belongs to.' });
  if (!dom && clean.case_id) return fail({ case_id: 'Only Domestic contracts are filed under a sponsor.' });
  return prisma.$transaction(async tx => {
    const client = clean.client ? await findClient(tx, a.workspace, clean.client) : null; if (clean.client && !client) return fail({ client: 'Company not found.' });
    const sc = dom ? await sponsorCase(tx, a, clean.case_id) : null; if (dom && !sc) return fail({ case_id: 'Sponsor case not found.' });
    const order = clean.order_id ? await tx.order.findFirst({ where: { id: idOf(clean.order_id), workspace: a.workspace } }) : null; if (clean.order_id && !order) return fail({ order_id: 'Order not found.' });
    if (clean.signed_date && clean.expiry_date && clean.expiry_date < clean.signed_date) return fail({ expiry_date: 'Expiry cannot be before the signed date.' });
    const data = { division: clean.division, clientId: client?.id ?? null, domesticCaseId: sc?.id ?? null, title: clean.title, agreementType: clean.agreement_type, signedDate: d(clean.signed_date), effectiveDate: d(clean.effective_date), expiryDate: d(clean.expiry_date), orderId: order?.id ?? null, billingTerms: clean.billing_terms, warrantyTerms: clean.warranty_terms, notes: clean.notes };
    if (id) {
      const x = await tx.contract.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Contract not found.' });
      await tx.contract.update({ where: { id }, data }); await log(tx, a, 'contracts', x.code, client?.name ?? sc?.customer ?? '', `Contract ${x.code} details updated`); return { ok: true, code: x.code } as Result;
    }
    const code = await codeOf(tx, a, 'contract', 1001, 'CT-');
    await tx.contract.create({ data: { ...data, workspace: a.workspace, code } }); await log(tx, a, 'contracts', code, client?.name ?? sc?.customer ?? '', `Contract ${code} “${clean.title}” created`);
    return { ok: true, code } as Result;
  });
}

// ───────────── tasks ─────────────

export async function saveTask(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('tasks', input, !!id); if (Object.keys(errors).length) return fail(errors);
  const assignee = idOf(clean.assignee_id);
  if (assignee !== a.userId && !can(a.role, 'tasks.assign')) return fail({ assignee_id: 'Only the Managing Director or Admin Manager can assign tasks to other people.' });
  return prisma.$transaction(async tx => {
    const u = await tx.user.findFirst({ where: { id: assignee, active: true } }); if (!u) return fail({ assignee_id: 'Choose an active user.' });
    const data = { title: clean.title, detail: clean.detail, kind: clean.kind, assigneeId: u.id, dueDate: d(clean.due_date), priority: clean.priority, linkedCode: clean.linked_code };
    if (id) {
      const x = await tx.task.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Task not found.' });
      if (x.assigneeId !== a.userId && x.createdById !== a.userId && !can(a.role, 'tasks.assign')) return fail({ _: 'You can only edit your own tasks.' });
      await tx.task.update({ where: { id }, data }); await log(tx, a, 'tasks', x.code, '', `Task ${x.code} updated`); return { ok: true, code: x.code } as Result;
    }
    const code = await codeOf(tx, a, 'task', 1001, 'TK-');
    await tx.task.create({ data: { ...data, workspace: a.workspace, code, createdById: a.userId } }); await log(tx, a, 'tasks', code, '', `Task ${code} “${clean.title}” assigned to ${u.name}`);
    return { ok: true, code } as Result;
  });
}

export async function setTaskStatus(a: Actor, id: number, status: 'Open' | 'Done'): Promise<Result> {
  return prisma.$transaction(async tx => {
    const x = await tx.task.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Task not found.' });
    if (x.assigneeId !== a.userId && x.createdById !== a.userId && !can(a.role, 'tasks.assign')) return fail({ _: 'This task is assigned to someone else.' });
    await tx.task.update({ where: { id }, data: { status, doneAt: status === 'Done' ? new Date() : null } });
    await log(tx, a, 'tasks', x.code, '', `Task ${x.code} ${status === 'Done' ? 'completed' : 'reopened'}`);
    return { ok: true, code: x.code } as Result;
  });
}

// ───────────── interview attendance / client decision ─────────────

export async function saveInterviewEntry(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('interviewEntries', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const iv = await tx.interview.findFirst({ where: { id: idOf(clean.interview_id), workspace: a.workspace }, include: { client: true } }); if (!iv) return fail({ interview_id: 'Interview event not found.' });
    const cand = await tx.candidate.findFirst({ where: { id: idOf(clean.candidate_id), workspace: a.workspace } }); if (!cand) return fail({ candidate_id: 'Candidate not found.' });
    if (cand.clientId !== iv.clientId) return fail({ candidate_id: `${cand.code} belongs to a different client than this interview.` });
    if (clean.decision !== 'Pending' && clean.attended === 'No') return fail({ decision: 'A candidate who did not attend cannot be selected or rejected.' });
    const data = { interviewId: iv.id, candidateId: cand.id, attended: clean.attended, decision: clean.decision, note: clean.note };
    const dup = await tx.interviewEntry.findUnique({ where: { interviewId_candidateId: { interviewId: iv.id, candidateId: cand.id } } });
    if (dup && dup.id !== id) return fail({ candidate_id: 'This candidate already has a result for this interview — edit that row.' });
    if (id) { await tx.interviewEntry.update({ where: { id }, data }); } else { await tx.interviewEntry.create({ data: { ...data, workspace: a.workspace } }); }
    await log(tx, a, 'interviews', cand.code, iv.client.name, `Interview result for ${cand.code}: attended ${clean.attended || 'not recorded'}, decision ${clean.decision}`);
    return { ok: true, code: cand.code } as Result;
  });
}

// ───────────── deletes (all logged; money rows need finance) ─────────────
const DEL = {
  domPayments: { model: 'receivablePayment', finance: true }, placePayments: { model: 'receivablePayment', finance: true }, servicePayments: { model: 'receivablePayment', finance: true },
  refunds: { model: 'refundClaim', finance: true }, placementFees: { model: 'placementFee', finance: true }, serviceTerms: { model: 'serviceFeeTerm', finance: true },
  serviceInvoices: { model: 'serviceFeeInvoice', finance: true }, fundAllocations: { model: 'financeAllocation', finance: true }, domAccount: { model: 'domesticAccount', finance: true },
  vacancies: { model: 'corporateVacancy', finance: false }, placements: { model: 'corporatePlacement', finance: false }, interviewEntries: { model: 'interviewEntry', finance: false },
  tasks: { model: 'task', finance: false },
} as const;
export type V8Deletable = keyof typeof DEL;
export const isV8Deletable = (e: string): e is V8Deletable => e in DEL;

export async function deleteV8(a: Actor, entity: V8Deletable, id: number): Promise<Result> {
  const spec = DEL[entity];
  if (spec.finance && !can(a.role, 'finance.view')) return fail({ _: NO_FINANCE });
  if (entity === 'tasks' && !can(a.role, 'tasks.assign')) return fail({ _: 'Only the Managing Director or Admin Manager can delete tasks (others can mark them done).' });
  return prisma.$transaction(async tx => {
    const model = (tx as any)[spec.model]; const row = await model.findFirst({ where: { id, workspace: a.workspace } }); if (!row) return fail({ _: 'Record not found.' });
    if (entity === 'refunds' && row.status !== 'Pending review') return fail({ _: 'A decided refund claim is part of the audit trail and cannot be deleted.' });
    if (entity === 'fundAllocations' && row.status === 'Approved') return fail({ _: 'An approved allocation cannot be deleted.' });
    await model.delete({ where: { id } });
    await log(tx, a, entity, row.code ?? row.receiptNo ?? '', '', `${entity} record ${row.code ?? row.receiptNo ?? '#' + id} deleted${row.amount != null ? ' (amount ' + row.amount + ')' : ''}`);
    return { ok: true } as Result;
  });
}

/** Audit record for sensitive reads (downloads, exports, QID reveals). */
export async function audit(a: Actor, entity: string, recordCode: string, text: string) {
  await prisma.activityLog.create({ data: { workspace: a.workspace, userId: a.userId, role: a.role, entity, recordCode, client: '', text } });
}

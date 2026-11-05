import 'server-only';
import { prisma } from '@/lib/db';
import { can } from '@/lib/config';
import * as V from '@/lib/domain/v8';
import { mask } from '@/lib/crypto';
import { dateToISO, diffDays, todayISO } from '@/lib/util';
import type { Rec, ReportColumn } from '@/lib/domain/types';
import type { Actor } from './mutations';

/** V8 reports. Built from the database; money reports carry a permission that is checked again by the export route. */
const col = (...pairs: [string, string][]): ReportColumn[] => pairs.map(([key, label]) => ({ key, label }));
const n = (x: unknown) => Number(x ?? 0);
interface Def { permission?: string; build: (a: Actor) => Promise<{ columns: ReportColumn[]; rows: Rec[] }> }
const W = (a: Actor) => ({ workspace: a.workspace });

export const V8_REPORTS: Record<string, Def> = {
  'Contract Expiry': { permission: 'contracts.view', build: async a => {
    const t = todayISO(), cs = await prisma.contract.findMany({ where: W(a), include: { client: true, domesticCase: true, versions: true }, orderBy: [{ expiryDate: 'asc' }, { code: 'asc' }] });
    return { columns: col(['code', 'Contract'], ['division', 'Division'], ['owner', 'Company / Sponsor'], ['title', 'Title'], ['type', 'Agreement type'], ['signed', 'Signed'], ['expiry', 'Expiry'], ['alert', 'Alert'], ['days', 'Days left'], ['files', 'Files']),
      rows: cs.map(c => { const e = dateToISO(c.expiryDate); return { code: c.code, division: c.division, owner: c.client?.name ?? c.domesticCase?.customer ?? '', client: c.client?.name ?? '', title: c.title, type: c.agreementType, signed: dateToISO(c.signedDate), expiry: e, alert: V.expiryBand(e, t) || (e ? 'OK' : 'No expiry'), days: e ? diffDays(t, e) : '', files: c.versions.length }; }) };
  } },
  'Domestic Sponsor Cases': { build: async a => {
    const t = todayISO(), cs = await prisma.domesticCase.findMany({ where: W(a), orderBy: { code: 'asc' } });
    return { columns: col(['code', 'Case'], ['sponsor', 'Sponsor'], ['type', 'Sponsor type'], ['category', 'Worker category'], ['origin', 'Nationality'], ['mobile', 'Mobile'], ['qid', 'QID'], ['status', 'Status'], ['arrival', 'Arrival'], ['handover', 'Handover'], ['warranty_end', 'Guarantee ends'], ['warranty', 'Guarantee']),
      rows: cs.map(c => { const w = V.warrantyWindow(dateToISO(c.handoverDate), t); return { code: c.code, sponsor: c.customer, type: c.sponsorType, category: c.category, origin: c.origin, mobile: c.mobile, qid: mask(c.qidLast), status: c.status, arrival: dateToISO(c.arrivalDate), handover: dateToISO(c.handoverDate), warranty_end: w.end, warranty: w.state }; }) };
  } },
  'Domestic Warranty': { build: async a => {
    const t = todayISO(), cs = await prisma.domesticCase.findMany({ where: { ...W(a), handoverDate: { not: null } }, orderBy: { handoverDate: 'asc' } });
    return { columns: col(['code', 'Case'], ['sponsor', 'Sponsor'], ['handover', 'Handover'], ['end', 'Guarantee ends'], ['days', 'Days left'], ['state', 'State']),
      rows: cs.map(c => { const w = V.warrantyWindow(dateToISO(c.handoverDate), t); return { code: c.code, sponsor: c.customer, handover: w.start, end: w.end, days: w.daysLeft ?? '', state: w.state }; }) };
  } },
  'Domestic Balances': { permission: 'finance.export', build: async a => {
    const cs = await prisma.domesticCase.findMany({ where: W(a), include: { account: true, payments: true }, orderBy: { code: 'asc' } });
    return { columns: col(['code', 'Case'], ['sponsor', 'Sponsor'], ['fee', 'Agreed fee (QAR)'], ['received', 'Received (QAR)'], ['balance', 'Balance due (QAR)'], ['refunded', 'Refunds paid (QAR)'], ['last', 'Last receipt']),
      rows: cs.filter(c => c.account).map(c => { const b = V.domesticBalance(n(c.account!.agreedFee), c.payments.map(p => ({ direction: p.direction, category: p.category, amount: n(p.amount) }))); return { code: c.code, sponsor: c.customer, fee: n(c.account!.agreedFee), received: b.received, balance: b.balance, refunded: b.refunded, last: c.payments.map(p => dateToISO(p.date)).sort().pop() ?? '' }; }) };
  } },
  'Domestic Collections': { permission: 'finance.export', build: async a => {
    const ps = await prisma.receivablePayment.findMany({ where: { ...W(a), domesticCaseId: { not: null } }, include: { domesticCase: true }, orderBy: [{ date: 'desc' }, { id: 'desc' }] });
    return { columns: col(['date', 'Date'], ['case', 'Case'], ['sponsor', 'Sponsor'], ['direction', 'Direction'], ['category', 'Type'], ['amount', 'Amount (QAR)'], ['account', 'Account'], ['receipt', 'Receipt'], ['reference', 'Reference']),
      rows: ps.map(p => ({ date: dateToISO(p.date), case: p.domesticCase?.code, sponsor: p.domesticCase?.customer, direction: p.direction, category: p.category, amount: n(p.amount), account: p.account, receipt: p.receiptNo, reference: p.reference })) };
  } },
  'Refund Claims': { permission: 'finance.export', build: async a => {
    const rs = await prisma.refundClaim.findMany({ where: W(a), include: { domesticCase: true }, orderBy: { code: 'asc' } });
    return { columns: col(['code', 'Claim'], ['case', 'Case'], ['sponsor', 'Sponsor'], ['months', 'Months served'], ['reason', 'Reason'], ['fee', 'Fee paid (QAR)'], ['gov', 'Government fees (QAR)'], ['estimate', 'Estimate (QAR)'], ['rule', 'Rule version'], ['status', 'Status'], ['decision', 'Decision note']),
      rows: rs.map(r => ({ code: r.code, case: r.domesticCase.code, sponsor: r.domesticCase.customer, months: r.monthsServed, reason: r.reason, fee: n(r.feePaid), gov: n(r.govFees), estimate: r.estimate == null ? 'Review required' : n(r.estimate), rule: r.ruleVersion, status: r.status, decision: r.decisionNote })) };
  } },
  'Corporate Vacancies': { build: async a => {
    const vs = await prisma.corporateVacancy.findMany({ where: W(a), include: { client: true, placements: true }, orderBy: { code: 'asc' } });
    return { columns: col(['code', 'Vacancy'], ['client', 'Company'], ['title', 'Job title'], ['category', 'Category'], ['quantity', 'Positions'], ['source', 'Source'], ['status', 'Status'], ['candidates', 'Candidates'], ['joined', 'Joined']),
      rows: vs.map(v => ({ code: v.code, client: v.client.name, title: v.title, category: v.category, quantity: v.quantity, source: v.source, status: v.status, candidates: v.placements.length, joined: v.placements.filter(p => p.stage === 'Joined').length })) };
  } },
  'Corporate Placements': { build: async a => {
    const ps = await prisma.corporatePlacement.findMany({ where: W(a), include: { vacancy: { include: { client: true } } }, orderBy: { code: 'asc' } });
    return { columns: col(['code', 'Placement'], ['client', 'Company'], ['vacancy', 'Vacancy'], ['candidate', 'Candidate'], ['source', 'Source'], ['country', 'Country'], ['stage', 'Stage'], ['offer', 'Offer date'], ['joining', 'Confirmed joining']),
      rows: ps.map(p => ({ code: p.code, client: p.vacancy.client.name, vacancy: `${p.vacancy.code} ${p.vacancy.title}`, candidate: p.candidateName, source: p.source, country: p.country, stage: p.stage, offer: dateToISO(p.offerDate), joining: dateToISO(p.joiningDate) })) };
  } },
  'Placement Fees': { permission: 'finance.export', build: async a => {
    const t = todayISO(), fs = await prisma.placementFee.findMany({ where: W(a), include: { payments: true, placement: { include: { vacancy: { include: { client: true } } } } }, orderBy: { id: 'asc' } });
    return { columns: col(['code', 'Placement'], ['client', 'Company'], ['candidate', 'Candidate'], ['joining', 'Confirmed joining'], ['fee', 'Fee (QAR)'], ['credit', 'Credit note (QAR)'], ['accrued', 'Accrued (QAR)'], ['invoiced', 'Invoiced (QAR)'], ['invoice', 'Invoice'], ['collected', 'Collected (QAR)'], ['outstanding', 'Outstanding (QAR)'], ['due', 'Due date'], ['status', 'Status']),
      rows: fs.map(f => { const s = V.placementFeeSummary({ feeAmount: n(f.feeAmount), creditNote: n(f.creditNote), joining: dateToISO(f.placement.joiningDate), dueMonths: f.dueMonths, invoiceDate: dateToISO(f.invoiceDate), paid: f.payments.filter(p => p.direction === 'Incoming').reduce((x, p) => x + n(p.amount), 0), today: t });
        return { code: f.placement.code, client: f.placement.vacancy.client.name, candidate: f.placement.candidateName, joining: dateToISO(f.placement.joiningDate), fee: n(f.feeAmount), credit: n(f.creditNote), accrued: s.accrued, invoiced: s.invoiced, invoice: f.invoiceNo, collected: s.collected, outstanding: s.outstanding, due: s.due, status: s.status }; }) };
  } },
  'Service Charges': { permission: 'finance.export', build: async a => {
    const ts = await prisma.serviceFeeTerm.findMany({ where: W(a), include: { client: true, order: true, invoices: { include: { payments: true } } }, orderBy: { id: 'asc' } });
    return { columns: col(['client', 'Client'], ['order', 'Order'], ['enabled', 'Enabled'], ['basis', 'Basis'], ['currency', 'Currency'], ['rate', 'Negotiated charge'], ['trigger', 'Trigger'], ['taxable', 'Taxable'], ['invoiced', 'Invoiced'], ['collected', 'Collected'], ['outstanding', 'Outstanding']),
      rows: ts.map(x => { const inv = x.invoices.reduce((s, i) => s + n(i.amount), 0), col_ = x.invoices.reduce((s, i) => s + i.payments.reduce((q, p) => q + n(p.amount), 0), 0); return { client: x.client.name, order: x.order?.code ?? 'All orders', enabled: x.enabled ? 'Yes' : 'No', basis: x.basis === 'worker' ? 'Per worker' : 'Per order', currency: x.currency, rate: n(x.amount), trigger: x.trigger, taxable: x.taxable ? 'Yes' : 'No', invoiced: inv, collected: col_, outstanding: V.round2(inv - col_) }; }) };
  } },
  'Agency Deposits': { permission: 'finance.export', build: async a => {
    const es = await prisma.financeEntry.findMany({ where: { ...W(a), category: 'Agency advance', direction: 'Incoming' }, include: { allocations: true }, orderBy: { date: 'desc' } });
    return { columns: col(['date', 'Date'], ['party', 'Agency'], ['client', 'Client'], ['country', 'Country'], ['amount', 'Deposit (QAR)'], ['allocated', 'Allocated — approved (QAR)'], ['proposed', 'Proposed (QAR)'], ['unallocated', 'Unallocated (QAR)']),
      rows: es.map(e => { const u = V.unallocated(n(e.amount), e.allocations.map(x => ({ status: x.status, amount: n(x.amount) }))); return { date: dateToISO(e.date), party: e.party, client: e.client, country: e.country, amount: n(e.amount), allocated: u.allocated, proposed: u.proposed, unallocated: u.unallocated }; }) };
  } },
  'Interview Attendance': { build: async a => {
    const es = await prisma.interviewEntry.findMany({ where: W(a), include: { interview: { include: { client: true } }, candidate: true }, orderBy: [{ interviewId: 'asc' }, { id: 'asc' }] });
    return { columns: col(['date', 'Interview date'], ['client', 'Client'], ['method', 'Method'], ['country', 'Country'], ['cand_id', 'Candidate ID'], ['candidate', 'Candidate'], ['attended', 'Attended'], ['decision', 'Client decision'], ['note', 'Note']),
      rows: es.map(e => ({ date: dateToISO(e.interview.date), client: e.interview.client.name, method: e.interview.method, country: e.interview.country, cand_id: e.candidate.code, candidate: e.candidate.name, attended: e.attended || 'Not recorded', decision: e.decision, note: e.note })) };
  } },
  'Tasks': { build: async a => {
    const t = todayISO(), ts = await prisma.task.findMany({ where: { ...W(a), ...(can(a.role, 'tasks.assign') ? {} : { OR: [{ assigneeId: a.userId }, { createdById: a.userId }] }) }, include: { assignee: true }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }] });
    return { columns: col(['code', 'Task'], ['title', 'Title'], ['kind', 'Type'], ['assignee', 'Assigned to'], ['due', 'Due'], ['priority', 'Priority'], ['status', 'Status'], ['state', 'State'], ['linked', 'Related']),
      rows: ts.map(x => ({ code: x.code, title: x.title, kind: x.kind, assignee: x.assignee?.name ?? '', due: dateToISO(x.dueDate), priority: x.priority, status: x.status, state: V.taskState({ status: x.status, dueDate: dateToISO(x.dueDate) }, t), linked: x.linkedCode })) };
  } },
  'Receipts Ledger': { permission: 'finance.export', build: async a => {
    const ps = await prisma.receivablePayment.findMany({ where: W(a), orderBy: [{ date: 'desc' }, { id: 'desc' }] });
    return { columns: col(['date', 'Date'], ['receipt', 'Receipt'], ['kind', 'For'], ['direction', 'Direction'], ['category', 'Type'], ['amount', 'Amount'], ['currency', 'Currency'], ['account', 'Account'], ['reference', 'Reference']),
      rows: ps.map(p => ({ date: dateToISO(p.date), receipt: p.receiptNo, kind: p.domesticCaseId ? 'Domestic sponsor' : p.placementFeeId ? 'Corporate placement' : 'Blue-collar service charge', direction: p.direction, category: p.category, amount: n(p.amount), currency: p.currency, account: p.account, reference: p.reference })) };
  } },
};
export const v8ReportNames = Object.keys(V8_REPORTS);

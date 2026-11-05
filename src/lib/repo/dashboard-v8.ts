import 'server-only';
import { prisma } from '@/lib/db';
import { can, type RoleId, type Workspace } from '@/lib/config';
import * as V from '@/lib/domain/v8';
import { dateToISO, todayISO } from '@/lib/util';

const n = (x: unknown) => Number(x ?? 0);

/** Counts for the management overview. Money widgets are only computed (and returned) for users who may see finance. */
export async function overview(ws: Workspace, role: RoleId, userId: number) {
  const where = { workspace: ws }, today = todayISO(), month = today.slice(0, 7), fin = can(role, 'finance.view'), seeAll = can(role, 'tasks.assign');
  const [tasks, contracts, warranties, joinedMonth, domestic, vacancies, placements] = await Promise.all([
    prisma.task.findMany({ where: { ...where, status: 'Open', ...(seeAll ? {} : { assigneeId: userId }) } }),
    can(role, 'contracts.view') ? prisma.contract.findMany({ where: { ...where, expiryDate: { not: null } } }) : [],
    prisma.warrantyCase.count({ where: { ...where, status: { not: 'Closed' } } }),
    prisma.candidateStage.count({ where: { stage: 'Joined', candidate: where, at: { gte: new Date(month + '-01T00:00:00Z') } } }),
    prisma.domesticCase.findMany({ where, include: { account: fin, payments: fin } }),
    prisma.corporateVacancy.findMany({ where, include: { placements: true } }),
    prisma.corporatePlacement.count({ where }),
  ]);
  const overdue = tasks.filter(t => ['Overdue', 'Escalate'].includes(V.taskState({ status: 'Open', dueDate: dateToISO(t.dueDate) }, today))).length;
  const expiring = contracts.map(c => V.expiryBand(dateToISO(c.expiryDate), today)).filter(Boolean).length;
  const base = { openTasks: tasks.length, overdueTasks: overdue, expiringContracts: expiring, openWarranty: warranties, joinedThisMonth: joinedMonth, domesticCases: domestic.length, openVacancies: vacancies.filter(v => v.status === 'Open').length, corporateCandidates: placements, money: null as null | Money };
  if (!fin) return base;

  const [finance, fees, services, refunds, allocs, deposits] = await Promise.all([
    prisma.financeEntry.findMany({ where }),
    prisma.placementFee.findMany({ where, include: { payments: true, placement: true } }),
    prisma.serviceFeeInvoice.findMany({ where, include: { payments: true, term: true } }),
    prisma.refundClaim.count({ where: { ...where, status: 'Pending review' } }),
    prisma.financeAllocation.count({ where: { ...where, status: 'Proposed' } }),
    prisma.financeEntry.findMany({ where: { ...where, category: 'Agency advance', direction: 'Incoming' }, include: { allocations: true } }),
  ]);
  const net = (acct: string) => finance.filter(f => f.account === acct).reduce((s, f) => s + (f.direction === 'Incoming' ? n(f.amount) : -n(f.amount)), 0);
  const placementOut = fees.reduce((s, f) => s + V.placementFeeSummary({ feeAmount: n(f.feeAmount), creditNote: n(f.creditNote), joining: dateToISO(f.placement.joiningDate), dueMonths: f.dueMonths, invoiceDate: dateToISO(f.invoiceDate), paid: f.payments.reduce((a, p) => a + n(p.amount), 0), today }).outstanding, 0);
  const domesticDue = domestic.reduce((s, c) => s + (c.account ? V.domesticBalance(n(c.account.agreedFee), c.payments.map(p => ({ direction: p.direction, category: p.category, amount: n(p.amount) }))).balance : 0), 0);
  const serviceOut = (cur: string) => services.filter(i => i.term.currency === cur).reduce((s, i) => s + n(i.amount) - i.payments.reduce((a, p) => a + n(p.amount), 0), 0);
  const unalloc = deposits.reduce((s, e) => s + V.unallocated(n(e.amount), e.allocations.map(a => ({ status: a.status, amount: n(a.amount) }))).unallocated, 0);
  return { ...base, money: { cash: V.round2(net('Cash')), qiib: V.round2(net('QIIB')), domesticDue: V.round2(domesticDue), placementOut: V.round2(placementOut), serviceUsd: V.round2(serviceOut('USD')), serviceQar: V.round2(serviceOut('QAR')), unallocated: V.round2(unalloc), pendingRefunds: refunds, pendingAllocations: allocs } };
}
export interface Money { cash: number; qiib: number; domesticDue: number; placementOut: number; serviceUsd: number; serviceQar: number; unallocated: number; pendingRefunds: number; pendingAllocations: number }

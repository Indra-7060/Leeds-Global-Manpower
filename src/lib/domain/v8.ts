/**
 * V8 business rules — pure functions, no framework, no database (unit-tested in tests/v8.test.ts).
 * Every number/rule comes from src/lib/config.ts (C.v8) or from the record itself, never hard-coded here.
 */
import { C } from '../config';
import { addMonths, diffDays } from '../util';

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ───────────── domestic: sponsor balance, 9-month warranty, refund estimate ─────────────

/** Balance still due from the sponsor. Refunds paid OUT never reduce what the sponsor owes. */
export function domesticBalance(agreedFee: number, payments: { direction: string; category: string; amount: number }[]) {
  const received = round2(payments.filter(p => p.direction === 'Incoming').reduce((a, p) => a + p.amount, 0));
  const refunded = round2(payments.filter(p => p.direction === 'Outgoing').reduce((a, p) => a + p.amount, 0));
  return { received, refunded, balance: round2(Math.max(0, agreedFee - received)), overpaid: round2(Math.max(0, received - agreedFee)) };
}

/** Nine-month guarantee window, counted from the handover date (ASSUMPTION V8-Q3: handover, not arrival). */
export function warrantyWindow(handoverISO: string, today: string) {
  if (!handoverISO) return { start: '', end: '', daysLeft: null as number | null, state: 'No handover date' };
  const end = addMonths(handoverISO, C.v8.refundRule.totalMonths), daysLeft = diffDays(today, end);
  return { start: handoverISO, end, daysLeft, state: daysLeft < 0 ? 'Expired' : daysLeft <= C.warrantyAlertDays ? 'Expiring soon' : 'Active' };
}

export interface RefundEstimate { stage: string; estimate: number | null; note: string }
/**
 * Indicative estimate only. First `fullRefundMonths`: full fee less government fees. Months after that, up to `totalMonths`:
 * deduct `deductionPerMonth` of the fee for each month served beyond the full-refund period, plus government fees.
 * A reason that needs review returns estimate = null ("Review required"). Nothing here ever pays or approves a refund.
 */
export function refundEstimate(input: { fee: number; govFees: number; monthsServed: number; reason: string }, rule = C.v8.refundRule): RefundEstimate {
  const fee = Math.max(0, input.fee || 0), gov = Math.max(0, input.govFees || 0), m = Math.min(rule.totalMonths, Math.max(0, Math.floor(input.monthsServed || 0)));
  const stage = m < rule.fullRefundMonths ? `Initial guarantee (months 1–${rule.fullRefundMonths})` : m < rule.totalMonths ? `Extended guarantee (months ${rule.fullRefundMonths + 1}–${rule.totalMonths})` : 'Outside the guarantee period';
  const note = 'Indicative calculation only — legal eligibility, permitted deductions and exceptions need case review. A refund is never paid automatically.';
  if (C.v8.refundNeedsReview.includes(input.reason) || !input.reason) return { stage, estimate: null, note: 'Review required — reason is disputed or not selected. ' + note };
  const est = m < rule.fullRefundMonths ? fee - gov : m < rule.totalMonths ? fee * (1 - rule.deductionPerMonth * (m - rule.fullRefundMonths)) - gov : 0;
  return { stage, estimate: round2(Math.max(0, est)), note };
}

// ───────────── corporate: placement fee, due date, status ─────────────

export function placementFeeAmount(basis: string, basicSalary: number, custom?: number | null): number {
  const s = Math.max(0, basicSalary || 0);
  if (basis === 'half') return round2(s * 0.5);
  if (basis === 'one') return round2(s);
  return round2(Math.max(0, custom ?? 0));
}
/** Due date = confirmed joining date + N calendar months. No confirmed joining → no due date (the clock has not started). */
export const placementDueDate = (joiningISO: string, dueMonths: number): string => (joiningISO ? addMonths(joiningISO, dueMonths) : '');

export interface FeeSummary { net: number; accrued: number; invoiced: number; collected: number; outstanding: number; due: string; status: string }
/** Keeps four ideas apart: accrued revenue (joined), invoiced (invoice date set), due date, and cash actually collected. */
export function placementFeeSummary(f: { feeAmount: number; creditNote: number; joining: string; dueMonths: number; invoiceDate: string; paid: number; today: string }): FeeSummary {
  const net = round2(Math.max(0, f.feeAmount - f.creditNote)), due = placementDueDate(f.joining, f.dueMonths);
  const accrued = f.joining ? net : 0, invoiced = f.invoiceDate ? net : 0, collected = round2(f.paid), outstanding = f.joining ? round2(Math.max(0, net - collected)) : 0;
  let status: string;
  if (!f.joining) status = 'Awaiting joining';
  else if (net === 0) status = 'Credited in full';
  else if (outstanding === 0) status = 'Paid';
  else {
    const late = f.today > due;
    status = collected > 0 ? (late ? 'Partial — overdue' : 'Partial') : late ? 'Overdue' : f.today === due ? 'Due today' : 'Not yet due';
  }
  return { net, accrued, invoiced, collected, outstanding, due, status };
}

// ───────────── blue-collar optional service charge ─────────────

/** Workers (or 1 for a fixed-per-order charge) that can be invoiced right now. */
export function serviceInvoiceable(term: { enabled: boolean; basis: string; trigger: string }, eligibleWorkers: number, alreadyInvoicedWorkers: number, invoiceCount: number): number {
  if (!term.enabled) return 0;
  if (term.basis === 'order') return eligibleWorkers >= 1 && invoiceCount === 0 ? 1 : 0; // ASSUMPTION V8-Q5: a fixed per-order charge is due once any worker reaches the trigger
  return Math.max(0, eligibleWorkers - alreadyInvoicedWorkers);
}
export const serviceInvoiceAmount = (term: { basis: string; amount: number }, workers: number) => round2(term.amount * (term.basis === 'order' ? 1 : Math.max(0, workers)));
export const triggerStages = (trigger: string): string[] | null => C.v8.serviceTriggerStages[trigger] ?? null; // null → "Order confirmed": no candidate gate

// ───────────── contracts & tasks ─────────────

export function expiryBand(expiryISO: string, today: string): '' | 'Expired' | 'Within 7 days' | 'Within 30 days' | 'Within 90 days' {
  if (!expiryISO) return '';
  const d = diffDays(today, expiryISO), [a, b, c] = [...C.v8.contractAlertDays].sort((x, y) => x - y); // 7, 30, 90
  return d < 0 ? 'Expired' : d <= a ? 'Within 7 days' : d <= b ? 'Within 30 days' : d <= c ? 'Within 90 days' : '';
}
export function taskState(t: { status: string; dueDate: string }, today: string): 'Done' | 'No due date' | 'Upcoming' | 'Due today' | 'Overdue' | 'Escalate' {
  if (t.status === 'Done') return 'Done';
  if (!t.dueDate) return 'No due date';
  const daysLate = diffDays(t.dueDate, today); // > 0 once today is after the due date
  return daysLate < 0 ? 'Upcoming' : daysLate === 0 ? 'Due today' : daysLate >= C.v8.taskEscalateAfterDays ? 'Escalate' : 'Overdue';
}

// ───────────── agency deposits: allocation ─────────────

/** Unallocated = deposit − APPROVED allocations. Proposed/rejected allocations never reduce it. */
export function unallocated(deposit: number, allocations: { status: string; amount: number }[]) {
  const allocated = round2(allocations.filter(a => a.status === 'Approved').reduce((s, a) => s + a.amount, 0));
  const proposed = round2(allocations.filter(a => a.status === 'Proposed').reduce((s, a) => s + a.amount, 0));
  return { allocated, proposed, unallocated: round2(deposit - allocated) };
}

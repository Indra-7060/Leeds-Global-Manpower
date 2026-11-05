import { describe, expect, it } from 'vitest';
import * as V from '@/lib/domain/v8';

describe('V8 domestic: balance and 9-month guarantee', () => {
  it('balance = agreed fee − incoming receipts; refunds paid out do not change what the sponsor owes', () => {
    const r = V.domesticBalance(12000, [
      { direction: 'Incoming', category: 'Advance', amount: 5000 }, { direction: 'Incoming', category: 'Additional payment', amount: 0 },
      { direction: 'Outgoing', category: 'Refund paid', amount: 1000 },
    ]);
    expect(r).toMatchObject({ received: 5000, refunded: 1000, balance: 7000, overpaid: 0 }); // V7 example: 12,000 − 5,000 = 7,000
  });
  it('shows over-payment instead of a negative balance', () => {
    expect(V.domesticBalance(1000, [{ direction: 'Incoming', category: 'Advance', amount: 1500 }])).toMatchObject({ balance: 0, overpaid: 500 });
  });
  it('guarantee window runs 9 calendar months from handover', () => {
    const w = V.warrantyWindow('2026-01-31', '2026-10-01');
    expect(w.end).toBe('2026-10-31'); expect(w.state).toBe('Expiring soon'); expect(w.daysLeft).toBe(30);
    expect(V.warrantyWindow('2026-01-31', '2026-11-05').state).toBe('Expired');
    expect(V.warrantyWindow('', '2026-11-05').state).toBe('No handover date');
  });
});

describe('V8 domestic: refund estimate (indicative, never automatic)', () => {
  const base = { fee: 12000, govFees: 500, reason: 'Worker absconds' };
  it('months 0–2: full fee less government fees', () => {
    expect(V.refundEstimate({ ...base, monthsServed: 2 }).estimate).toBe(11500);
    expect(V.refundEstimate({ ...base, monthsServed: 0 }).stage).toMatch(/Initial/);
  });
  it('months 3–8: 15% of the fee deducted for each month beyond the first 3, plus government fees', () => {
    expect(V.refundEstimate({ ...base, monthsServed: 3 }).estimate).toBe(11500);   // 0 extra months
    expect(V.refundEstimate({ ...base, monthsServed: 4 }).estimate).toBe(9700);    // 12000×0.85 − 500
    expect(V.refundEstimate({ ...base, monthsServed: 8 }).estimate).toBe(2500);    // 12000×(1−0.15×5) − 500
  });
  it('month 9 and over is outside the guarantee: 0', () => {
    expect(V.refundEstimate({ ...base, monthsServed: 9 }).estimate).toBe(0);
    expect(V.refundEstimate({ ...base, monthsServed: 14 }).estimate).toBe(0); // capped at 9
  });
  it('never goes negative', () => expect(V.refundEstimate({ fee: 100, govFees: 500, reason: 'Chronic illness', monthsServed: 1 }).estimate).toBe(0));
  it('disputed / unselected reasons need manual review (no number)', () => {
    expect(V.refundEstimate({ ...base, reason: 'Other / disputed', monthsServed: 1 }).estimate).toBeNull();
    expect(V.refundEstimate({ ...base, reason: '', monthsServed: 1 }).estimate).toBeNull();
  });
});

describe('V8 corporate: placement fee, due date, status', () => {
  it('fee basis: half, one month, custom', () => {
    expect(V.placementFeeAmount('half', 6000)).toBe(3000);
    expect(V.placementFeeAmount('one', 6000)).toBe(6000); // V7 example
    expect(V.placementFeeAmount('custom', 6000, 4500)).toBe(4500);
    expect(V.placementFeeAmount('custom', 6000, null)).toBe(0);
  });
  it('due date = confirmed joining + 1 or 3 calendar months; none before joining', () => {
    expect(V.placementDueDate('2026-11-15', 1)).toBe('2026-12-15');
    expect(V.placementDueDate('2026-11-30', 3)).toBe('2027-02-28');
    expect(V.placementDueDate('', 1)).toBe('');
  });
  const f = { feeAmount: 6000, creditNote: 0, joining: '2026-09-01', dueMonths: 1, invoiceDate: '', paid: 0, today: '2026-10-01' };
  it('status: awaiting joining → not yet due → due today → overdue', () => {
    expect(V.placementFeeSummary({ ...f, joining: '' }).status).toBe('Awaiting joining');
    expect(V.placementFeeSummary({ ...f, today: '2026-09-20' }).status).toBe('Not yet due');
    expect(V.placementFeeSummary({ ...f, today: '2026-10-01' }).status).toBe('Due today');
    expect(V.placementFeeSummary({ ...f, today: '2026-10-02' }).status).toBe('Overdue');
  });
  it('partial and paid; due is never counted as cash received', () => {
    const part = V.placementFeeSummary({ ...f, paid: 2000, today: '2026-10-02' });
    expect(part).toMatchObject({ status: 'Partial — overdue', collected: 2000, outstanding: 4000, accrued: 6000, invoiced: 0 });
    expect(V.placementFeeSummary({ ...f, paid: 6000 })).toMatchObject({ status: 'Paid', outstanding: 0 });
    expect(V.placementFeeSummary({ ...f, joining: '' })).toMatchObject({ accrued: 0, collected: 0, outstanding: 0 });
  });
  it('credit notes reduce the fee; invoice date drives "invoiced" separately from accrual', () => {
    expect(V.placementFeeSummary({ ...f, creditNote: 1000, invoiceDate: '2026-09-02', paid: 5000 })).toMatchObject({ net: 5000, invoiced: 5000, status: 'Paid' });
    expect(V.placementFeeSummary({ ...f, creditNote: 6000 }).status).toBe('Credited in full');
  });
});

describe('V8 blue-collar service charge', () => {
  const term = { enabled: true, basis: 'worker', trigger: 'Verified arrival' };
  it('off by default: nothing can be invoiced', () => expect(V.serviceInvoiceable({ ...term, enabled: false }, 50, 0, 0)).toBe(0));
  it('per worker: only workers who reached the trigger and were not yet invoiced', () => {
    expect(V.serviceInvoiceable(term, 100, 0, 0)).toBe(100);
    expect(V.serviceInvoiceable(term, 100, 60, 1)).toBe(40);
    expect(V.serviceInvoiceAmount({ basis: 'worker', amount: 200 }, 100)).toBe(20000); // V8 example: USD 200 × 100 workers
  });
  it('fixed per order: once, after the trigger is reached by anyone', () => {
    const o = { ...term, basis: 'order' };
    expect(V.serviceInvoiceable(o, 0, 0, 0)).toBe(0);
    expect(V.serviceInvoiceable(o, 3, 0, 0)).toBe(1);
    expect(V.serviceInvoiceable(o, 30, 0, 1)).toBe(0);
    expect(V.serviceInvoiceAmount({ basis: 'order', amount: 5000 }, 1)).toBe(5000);
  });
});

describe('V8 contract expiry and task state', () => {
  it('90 / 30 / 7 day bands and expired', () => {
    const t = '2026-11-05';
    expect(V.expiryBand('', t)).toBe('');
    expect(V.expiryBand('2026-11-04', t)).toBe('Expired');
    expect(V.expiryBand('2026-11-12', t)).toBe('Within 7 days');
    expect(V.expiryBand('2026-12-05', t)).toBe('Within 30 days');
    expect(V.expiryBand('2027-02-03', t)).toBe('Within 90 days');
    expect(V.expiryBand('2027-02-04', t)).toBe('');
  });
  it('tasks: upcoming → due today → overdue → escalate; done and undated', () => {
    const t = '2026-11-05';
    expect(V.taskState({ status: 'Done', dueDate: '2020-01-01' }, t)).toBe('Done');
    expect(V.taskState({ status: 'Open', dueDate: '' }, t)).toBe('No due date');
    expect(V.taskState({ status: 'Open', dueDate: '2026-11-06' }, t)).toBe('Upcoming');
    expect(V.taskState({ status: 'Open', dueDate: '2026-11-05' }, t)).toBe('Due today');
    expect(V.taskState({ status: 'Open', dueDate: '2026-11-04' }, t)).toBe('Overdue');
    expect(V.taskState({ status: 'Open', dueDate: '2026-11-02' }, t)).toBe('Escalate');
  });
});

describe('V8 agency deposit allocation', () => {
  it('stays unallocated until approved; proposed and rejected allocations do not reduce it', () => {
    const r = V.unallocated(10000, [{ status: 'Proposed', amount: 4000 }, { status: 'Rejected', amount: 3000 }, { status: 'Approved', amount: 2500 }]);
    expect(r).toEqual({ allocated: 2500, proposed: 4000, unallocated: 7500 });
  });
});

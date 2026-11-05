import { describe, expect, it } from 'vitest';
import { C } from '@/lib/config';
import { addMonths, diffDays, parseDate, serialToISO } from '@/lib/util';
import { parseCsv, stringifyCsv, toCsv } from '@/lib/io/csv';
import * as L from '@/lib/domain/lifecycle';
import * as M from '@/lib/domain/metrics';
import { candidateKey, warrantyExpiry, looksLikeSecret } from '@/lib/domain/rules';
import { computeAlerts } from '@/lib/domain/alerts';
import { keywordReport, quickReports, runReport, defs } from '@/lib/domain/reports';
import { buildDemoState } from '@/lib/seed-data';

const seed = () => buildDemoState();

describe('utilities & CSV', () => {
  it('parses dates (ISO, day-first, 2-digit year, month names, Excel serial) and rejects impossible ones', () => {
    expect(parseDate('2026-11-05')).toBe('2026-11-05'); expect(parseDate('05/11/2026')).toBe('2026-11-05'); expect(parseDate('5-11-26')).toBe('2026-11-05');
    expect(parseDate('05 Nov 2026')).toBe('2026-11-05'); expect(parseDate('45292')).toBe('2024-01-01'); expect(serialToISO(25569)).toBe('1970-01-01');
    for (const bad of ['31/02/2026', '99/99/2026', '2026', 'abc', '', null, '2026-13-01']) expect(parseDate(bad)).toBeNull();
  });
  it('addMonths clamps month-end; diffDays', () => {
    expect(addMonths('2026-09-20', 3)).toBe('2026-12-20'); expect(addMonths('2026-11-30', 3)).toBe('2027-02-28'); expect(diffDays('2026-11-05', '2026-12-20')).toBe(45);
  });
  it('CSV parse handles quotes, commas, newlines, BOM and other delimiters', () => {
    expect(parseCsv('﻿a,b,c\r\n"x, y","line1\nline2","he said ""hi"""\r\n')).toEqual([['a', 'b', 'c'], ['x, y', 'line1\nline2', 'he said "hi"']]);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('CSV output quotes everything and neutralises formula injection', () => {
    expect(stringifyCsv([['Smith, Jones & Co', 'say "x"']])).toBe('"Smith, Jones & Co","say ""x"""');
    expect(stringifyCsv([['=1+1', '+SUM(A1)', '@cmd', '-abc', '-5', 12]])).toBe(`"'=1+1","'+SUM(A1)","'@cmd","'-abc","-5","12"`);
    expect(toCsv([{ key: 'a', label: 'Name' }], [{ a: '=HYPERLINK("x")' }])).toBe('"Name"\r\n"\'=HYPERLINK(""x"")"');
  });
});

describe('candidate lifecycle (V6)', () => {
  it('has the 14 V6 stages in order', () => expect(C.stages).toEqual(['CV Submitted', 'Client Review', 'Interview', 'Selected', 'Offer Accepted', 'Pre-Medical', 'Visa Applied', 'QVC', 'RTP', 'Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty']));
  it('allows next, skipping Pre-Medical/QVC, and reject only during screening', () => {
    expect(L.moves('Client Review')[0].to).toBe('Interview');
    expect(L.moves('Offer Accepted').map(m => m.to)).toEqual(['Pre-Medical', 'Visa Applied']);
    expect(L.moves('Visa Applied').map(m => m.to)).toEqual(['QVC', 'RTP']);
    expect(L.canMove('CV Submitted', 'Interview')).toBe(false); expect(L.canMove('RTP', 'Arrived')).toBe(false);
    expect(L.canMove('Interview', 'Rejected')).toBe(true); expect(L.canMove('Selected', 'Rejected')).toBe(false);
    expect(L.moves('Warranty')).toEqual([]); expect(L.moves('Rejected')).toEqual([]);
  });
  it('undo uses history', () => { expect(L.previousStage(['CV Submitted', 'Client Review'])).toBe('CV Submitted'); expect(L.previousStage(['CV Submitted'])).toBeNull(); });
});

describe('rules', () => {
  it('duplicate key: passport (normalised) else name + client', () => {
    expect(candidateKey({ passport: 'demo p0001', name: 'x', client: 'y' })).toBe(candidateKey({ passport: 'DEMO-P0001', name: 'z', client: 'q' }));
    expect(candidateKey({ name: 'No  Passport', client: 'Co A' })).toBe(candidateKey({ name: 'no passport', client: 'CO a' }));
    expect(candidateKey({ name: 'No Passport', client: 'Other Co' })).not.toBe(candidateKey({ name: 'No Passport', client: 'Co A' }));
  });
  it('labour warranty = start + 3 months; domestic has no default; explicit value wins', () => {
    expect(warrantyExpiry('Labour', '2026-09-20', '')).toBe('2026-12-20'); expect(warrantyExpiry('Domestic', '2026-09-20', '')).toBe(''); expect(warrantyExpiry('Labour', '2026-09-20', '2027-01-01')).toBe('2027-01-01');
  });
  it('secret guard', () => { expect(looksLikeSecret('password: abc')).toBe(true); expect(looksLikeSecret('Credentials on file')).toBe(false); });
});

describe('dashboard & report calculations on the demo data (same numbers as the original build)', () => {
  it('labour dashboard: groups 14/8/8/5, 5 open orders, 40 CVs', () => {
    const m = M.labour(seed()); expect(m.groups.map(g => g.count)).toEqual([14, 8, 8, 5]); expect([m.openOrders, m.cvsReceived, m.visaPipeline, m.readyToFly]).toEqual([5, 40, 8, 5]);
  });
  it('closed orders are not open', () => { const s = seed(); s.orders[0].status = 'Closed'; expect(M.labour(s).openOrders).toBe(4); });
  it('master report: Remaining = Demand − (Applied+QVC+RTP+Printed+Deployed)', () => {
    const m = M.masterReport(seed()); const r = (n: string) => m.rows.find(x => x.company === n)!;
    const c = r('Demo Contracting WLL'); expect([c.demand, c.applied, c.qvc, c.rtp, c.printed, c.deployed, c.remaining]).toEqual([100, 3, 2, 2, 2, 0, 91]);
    const l = r('Demo Logistics Co.'); expect([l.demand, l.printed, l.deployed, l.remaining]).toEqual([30, 1, 4, 25]);
    expect(m.total.demand).toBe(740); expect(M.masterReport(seed(), { query: 'logist' }).rows.map(x => x.company)).toEqual(['Demo Logistics Co.']);
  });
  it('visa / deployment / domestic / finance / costing', () => {
    const s = seed();
    expect(M.visaCards(s)).toEqual({ applied: 3, qvc: 2, rtp: 2, printed: 3 }); expect(M.deployCards(s)).toMatchObject({ readyToFly: 5, arrivalsVerified: 4 });
    expect(M.domestic(s)).toEqual({ enquiries: 3, profilesShared: 3, visaCases: 1, handovers: 1 });
    expect(M.financeTotals(s, 'labour')).toEqual({ count: 4, incoming: 8600, outgoing: 20300, net: -11700 });
    expect(M.costing({ qty: 100, revenue: 1500, client: 860, investment: 0, investmentTreatment: 'extra' })).toEqual({ revenue: 150000, cost: 86000, profit: 64000 });
    expect(M.costing({ qty: 10, revenue: 4000, client: 2500, investment: 300, investmentTreatment: 'included' }).profit).toBe(15000);
    expect(M.costing({ qty: -5, revenue: 100 }).revenue).toBe(0);
  });
  it('deployment checklist is derived from stage + travel record', () => {
    const s = seed(); const w = s.candidates.find(c => c.status === 'Warranty')!;
    expect(M.deploymentChecklist(s, w).every(x => x.done)).toBe(true); expect(M.deploymentChecklist(s, s.candidates.find(c => c.status === 'Offer Accepted')!).every(x => !x.done)).toBe(true);
  });
  it('alerts are rule-driven; warranty alert depends on date', () => {
    const s = seed(); const a = computeAlerts(s, '2026-11-05'); const by = (id: string) => a.find(x => x.id === id);
    expect(by('qvc')?.count).toBe(2); expect(by('followup')?.count).toBe(1); expect(by('warranty-expiry')).toBeUndefined();
    expect(computeAlerts(s, '2026-12-01').find(x => x.id === 'warranty-expiry')?.count).toBe(1);
    expect(by('ticket-responsibility')!.count).toBeGreaterThanOrEqual(1);
  });
});

describe('reports', () => {
  it('every report runs; every quick-report chip resolves', () => {
    const s = seed(); for (const n of Object.keys(defs)) { const r = runReport(n, s, {}, 'md'); expect(r.error, n).toBeUndefined(); expect(r.columns.length).toBeGreaterThan(0); }
    for (const p of ['interviews', 'visas', 'deployment', 'tickets', 'orders', 'candidates', 'agencies', 'warranty', 'domestic', 'demands', 'clients', 'visits', 'visa-master', 'dashboard']) for (const q of quickReports(p)) expect(defs[q], `${p} → ${q}`).toBeTruthy();
  });
  it('stage reports equal dashboard numbers; interview/order reports read the right entity', () => {
    const s = seed();
    expect(runReport('QVC Pending', s).rows.length).toBe(M.visaCards(s).applied + M.visaCards(s).qvc); expect(runReport('Flight Pending', s).rows.length).toBe(M.labour(s).readyToFly);
    expect(runReport('Rejected Candidates', s).rows.length).toBe(1); expect(runReport('Open Orders', s).rows.length).toBe(5); expect(runReport('Interview Schedule', s).rows.length).toBe(3); expect(runReport('Order Progress', s).rows.length).toBe(5);
  });
  it('toolbar filters, planned reports, keyword router, finance restriction', () => {
    const s = seed();
    const a = runReport('Candidate List', s, { client: 'Demo Contracting WLL', country: 'Nepal' }); expect(a.rows.length).toBeGreaterThan(0); expect(a.rows.every(c => c.client === 'Demo Contracting WLL')).toBe(true);
    expect(runReport('Candidate List', s, { stage: 'QVC Pending' }).rows.length).toBe(5);
    expect(runReport('Warranty Expiry', s, { today: '2026-11-05' }).rows.find(r => r.case === 'WR-101')!.days_left).toBe(45);
    const k = keywordReport('Show QVC pending for Demo Contracting WLL Nepal', s, 'staff'); expect(k.name).toBe('QVC Pending'); expect(k.rows.length).toBe(5); expect(k.interpretation).toContain('Country: Nepal');
    expect(keywordReport('orders for Nepal', s, 'md').rows.length).toBe(3); expect(keywordReport('all payments', s, 'staff').error).toMatch(/restricted/); expect(keywordReport('all payments', s, 'md').name).toBe('Private Finance');
  });
});

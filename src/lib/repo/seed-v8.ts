/**
 * Fictional V8 sample data for the DEMO workspace (sponsors, payments, a refund claim, vacancies/placements, service terms,
 * contract records, tasks, interview results). No real people, no real companies. No contract FILES are seeded.
 * No 'server-only' import on purpose: shared with the seed script that runs outside Next.js.
 */
import type { PrismaClient } from '@/generated/prisma/client';
import { addMonths, isoToDate } from '@/lib/util';

const d = (s?: string | null) => isoToDate(s || null);

export async function clearV8Data(tx: Pick<PrismaClient, 'agency' | 'listItem' | 'interviewEntry' | 'financeAllocation' | 'receivablePayment' | 'serviceFeeInvoice' | 'serviceFeeTerm' | 'contractVersion' | 'contract' | 'refundClaim' | 'domesticAccount' | 'placementFee' | 'corporatePlacement' | 'corporateVacancy' | 'task'>, where: { workspace: string }) {
  await tx.interviewEntry.deleteMany({ where }); await tx.financeAllocation.deleteMany({ where }); await tx.receivablePayment.deleteMany({ where });
  await tx.serviceFeeInvoice.deleteMany({ where }); await tx.serviceFeeTerm.deleteMany({ where });
  await tx.contractVersion.deleteMany({ where }); await tx.contract.deleteMany({ where });
  await tx.refundClaim.deleteMany({ where }); await tx.domesticAccount.deleteMany({ where });
  await tx.placementFee.deleteMany({ where }); await tx.corporatePlacement.deleteMany({ where }); await tx.corporateVacancy.deleteMany({ where });
  await tx.task.deleteMany({ where }); await tx.agency.deleteMany({ where }); await tx.listItem.deleteMany({ where });
}

export async function seedV8Demo(prisma: PrismaClient, ids: { client: Map<string, number>; order: Map<string, number>; cand: Map<string, number> }) {
  const ws = 'demo';
  const cl = (n: string) => ids.client.get(n)!;
  for (const n of ['Demo Construction Ltd', 'Demo Hospitality Group']) await prisma.client.update({ where: { id: cl(n) }, data: { segment: 'Both' } });
  await prisma.client.create({ data: { workspace: ws, name: 'Demo Finance Advisors', nameKey: 'demo finance advisors', sector: 'Financial services', stage: 'Prospect', segment: 'Corporate', nextAction: 'Send placement proposal' } });
  for (const [name, country, contact] of [['Demo Dhaka Agency', 'Bangladesh', 'Demo Contact A'], ['Demo Chattogram Agency', 'Bangladesh', 'Demo Contact B'], ['Demo Kathmandu Agency', 'Nepal', 'Demo Contact C']] as const)
    await prisma.agency.create({ data: { workspace: ws, name, nameKey: name.toLowerCase(), country, contact, phone: '+000 000 0000' } });
  // ── domestic sponsors (individuals) ──
  const dom = new Map((await prisma.domesticCase.findMany({ where: { workspace: ws } })).map(x => [x.code, x]));
  const profile: [string, string, string, string, string | null, string | null][] = [
    ['DW-001', 'Qatari Citizen', 'Housemaid', '+974 0000 0001', null, null], ['DW-002', 'Eligible Qatar Resident', 'Cook', '+974 0000 0002', '2026-10-20', null],
    ['DW-003', 'Qatari Citizen', 'Nanny', '+974 0000 0003', '2026-08-10', '2026-08-15'],
  ];
  for (const [code, type, cat, mobile, arrive, handover] of profile)
    await prisma.domesticCase.update({ where: { id: dom.get(code)!.id }, data: { sponsorType: type, category: cat, mobile, arrivalDate: d(arrive), handoverDate: d(handover), handoverNote: handover ? 'Signed handover form on file (demo)' : '' } });
  const acct: [string, number, number][] = [['DW-001', 12000, 500], ['DW-002', 11000, 500], ['DW-003', 12000, 500]];
  for (const [code, fee, gov] of acct) await prisma.domesticAccount.create({ data: { workspace: ws, caseId: dom.get(code)!.id, agreedFee: fee, govFees: gov } });
  const pay: [string, string, string, number, string, string][] = [
    ['DW-003', '2026-07-01', 'Advance', 5000, 'RC-1001', 'QIIB-DEMO-001'], ['DW-003', '2026-08-14', 'Deployment balance', 7000, 'RC-1002', 'QIIB-DEMO-002'], ['DW-001', '2026-10-28', 'Advance', 3000, 'RC-1003', 'QIIB-DEMO-003'],
  ];
  for (const [code, date, cat, amt, rc, ref] of pay)
    await prisma.receivablePayment.create({ data: { workspace: ws, direction: 'Incoming', date: d(date)!, amount: amt, category: cat, account: 'QIIB', receiptNo: rc, reference: ref, domesticCaseId: dom.get(code)!.id } });
  await prisma.refundClaim.create({ data: { workspace: ws, code: 'RF-001', caseId: dom.get('DW-003')!.id, monthsServed: 2, reason: 'Worker refuses work', evidence: 'Sponsor complaint letter dated 2026-10-30 (demo)', feePaid: 12000, govFees: 500, estimate: 11500, ruleVersion: 'MD-21-2021 draft-1' } });

  // ── corporate ──
  const v1 = await prisma.corporateVacancy.create({ data: { workspace: ws, code: 'VC-1001', clientId: cl('Demo Construction Ltd'), title: 'Site Accountant', category: 'Accountant', quantity: 2, source: 'Local Qatar' } });
  const v2 = await prisma.corporateVacancy.create({ data: { workspace: ws, code: 'VC-1002', clientId: cl('Demo Hospitality Group'), title: 'HR Coordinator', category: 'HR / Admin', quantity: 1, source: 'Both' } });
  const p1 = await prisma.corporatePlacement.create({ data: { workspace: ws, code: 'PL-1001', vacancyId: v1.id, candidateName: 'Demo Candidate Accountant A', source: 'Local Qatar', stage: 'Joined', offerDate: d('2026-08-20'), joiningDate: d('2026-09-01') } });
  await prisma.corporatePlacement.create({ data: { workspace: ws, code: 'PL-1002', vacancyId: v1.id, candidateName: 'Demo Candidate Accountant B', source: 'Local Qatar', stage: 'Offer', offerDate: d('2026-11-01') } });
  const p3 = await prisma.corporatePlacement.create({ data: { workspace: ws, code: 'PL-1003', vacancyId: v2.id, candidateName: 'Demo Candidate HR C', source: 'Overseas', country: 'India', stage: 'Joined', offerDate: d('2026-10-05'), joiningDate: d('2026-10-20') } });
  const f1 = await prisma.placementFee.create({ data: { workspace: ws, placementId: p1.id, basicSalary: 6000, basis: 'one', feeAmount: 6000, dueMonths: 1, invoiceNo: 'INV-DEMO-01', invoiceDate: d('2026-09-02') } });
  await prisma.placementFee.create({ data: { workspace: ws, placementId: p3.id, basicSalary: 3500, basis: 'half', feeAmount: 1750, dueMonths: 3, note: 'Due 3 months after joining per demo agreement' } });
  await prisma.receivablePayment.create({ data: { workspace: ws, direction: 'Incoming', date: d('2026-10-10')!, amount: 2000, category: 'Placement fee', account: 'Other bank', receiptNo: 'RC-1004', reference: 'BANK-DEMO-010', placementFeeId: f1.id } });

  // ── an agency deposit with one allocation proposal (waiting for MD approval) ──
  const dep = await prisma.financeEntry.create({ data: { workspace: ws, date: d('2026-11-02')!, division: 'labour', direction: 'Incoming', account: 'Cash', party: 'Demo Kathmandu Agency', client: 'Demo Contracting WLL', country: 'Nepal', orderRef: 'ORD-1003', category: 'Agency advance', amount: 15000, ref: 'DEMO-DEP-1' } });
  await prisma.financeAllocation.create({ data: { workspace: ws, financeEntryId: dep.id, orderId: ids.order.get('ORD-1003') ?? null, amount: 5000, note: 'Demo proposal — awaiting Managing Director approval' } });

  // ── blue-collar optional service charge ──
  await prisma.serviceFeeTerm.create({ data: { workspace: ws, clientId: cl('Demo Contracting WLL'), orderId: ids.order.get('ORD-1003') ?? null, enabled: true, currency: 'USD', basis: 'worker', amount: 200, trigger: 'Verified arrival', notes: 'Demo agreement — fictional amount' } });
  await prisma.serviceFeeTerm.create({ data: { workspace: ws, clientId: cl('Demo Logistics Co.'), enabled: false, currency: 'USD', basis: 'order', amount: 5000, trigger: 'Confirmed joining', notes: 'Not enabled — no charge by default' } });

  // ── contracts (records only) ──
  const soon = addMonths('2026-11-05', 0).slice(0, 8) + '25';
  await prisma.contract.create({ data: { workspace: ws, code: 'CT-1001', division: 'labour', clientId: cl('Demo Facilities Co.'), title: 'Manpower supply agreement 2026', agreementType: 'Manpower supply agreement', signedDate: d('2026-01-10'), effectiveDate: d('2026-01-15'), expiryDate: d(soon), orderId: ids.order.get('ORD-1001') ?? null, warrantyTerms: '3-month replacement warranty (demo)' } });
  await prisma.contract.create({ data: { workspace: ws, code: 'CT-1002', division: 'corporate', clientId: cl('Demo Construction Ltd'), title: 'Placement agreement', agreementType: 'Placement agreement', signedDate: d('2026-06-01'), expiryDate: d('2027-06-01'), billingTerms: 'Fee due 1 month after confirmed joining (demo)' } });
  await prisma.contract.create({ data: { workspace: ws, code: 'CT-1003', division: 'domestic', domesticCaseId: dom.get('DW-003')!.id, title: 'Sponsor recruitment agreement', agreementType: 'Sponsor agreement', signedDate: d('2026-06-20'), effectiveDate: d('2026-06-20'), expiryDate: d('2027-05-15') } });

  // ── tasks ──
  const staff = await prisma.user.findUnique({ where: { email: 'staff@lgm.local' } }), md = await prisma.user.findUnique({ where: { email: 'md@lgm.local' } });
  const tasks: [string, string, string, string | null, string][] = [
    ['TK-1001', 'Follow up QVC appointment results', 'QVC', '2026-11-02', 'High'], ['TK-1002', 'Collect arrival driver number for ORD-1004', 'Ticket / arrival', '2026-11-04', 'Normal'], ['TK-1003', 'Chase placement fee PL-1001', 'Receivable follow-up', '2026-11-12', 'High'],
  ];
  for (const [code, title, kind, due, pr] of tasks) await prisma.task.create({ data: { workspace: ws, code, title, kind, dueDate: d(due), priority: pr, assigneeId: (code === 'TK-1003' ? md : staff)?.id ?? null, createdById: md?.id ?? null } });

  // ── interview attendance (candidates of the same client as the event) ──
  const ivs = await prisma.interview.findMany({ where: { workspace: ws }, orderBy: { id: 'asc' } });
  const cands = await prisma.candidate.findMany({ where: { workspace: ws }, orderBy: { id: 'asc' } });
  let n = 0;
  for (const iv of ivs.slice(0, 2)) for (const c of cands.filter(x => x.clientId === iv.clientId).slice(0, 3)) {
    await prisma.interviewEntry.create({ data: { workspace: ws, interviewId: iv.id, candidateId: c.id, attended: n % 3 === 2 ? 'No' : 'Yes', decision: n % 3 === 2 ? 'Pending' : n % 3 === 0 ? 'Selected' : 'Rejected' } }); n++;
  }
  for (const [kind, next] of Object.entries({ receipt: 1005, refund: 2, vacancy: 1003, placement: 1004, serviceinv: 1001, contract: 1004, task: 1004 })) await prisma.counter.upsert({ where: { workspace_kind: { workspace: ws, kind } }, create: { workspace: ws, kind, next }, update: { next } });
}

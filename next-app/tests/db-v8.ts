/**
 * V8 database integration test — REAL database in .env, DEMO workspace, fictional data, resets the demo workspace at the end.
 * Run:  npm run test:v8      (uses tsx --conditions=react-server)
 * Proves the V8 rules hold in the server functions themselves (not just in the screens).
 */
import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import JSZip from 'jszip';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  :: ' + detail}`); if (!cond) failed++; };
const J = (x: unknown) => JSON.stringify(x);

async function main() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lgm-v8-')); process.env.STORAGE_DIR = dir;
  const { prisma } = await import('../src/lib/db');
  const R = await import('../src/lib/repo/mutations-v8'), K = await import('../src/lib/repo/contracts'), R2 = await import('../src/lib/repo/mutations-more'), R3 = await import('../src/lib/repo/mutations-3');
  const { sha256, decryptText } = await import('../src/lib/crypto');
  const ws = 'demo' as const;
  const u = async (email: string) => (await prisma.user.findUnique({ where: { email } }))!;
  const [mdU, niU, stU] = await Promise.all([u('md@lgm.local'), u('nitija@lgm.local'), u('staff@lgm.local')]);
  const md = { workspace: ws, role: 'md' as const, userId: mdU.id }, ni = { workspace: ws, role: 'nitija' as const, userId: niU.id }, staff = { workspace: ws, role: 'staff' as const, userId: stU.id };
  const no = (r: { ok: boolean }) => !r.ok;
  const clientA = (await prisma.client.findFirst({ where: { workspace: ws, name: 'Demo Contracting WLL' } }))!, clientB = (await prisma.client.findFirst({ where: { workspace: ws, name: 'Demo Construction Ltd' } }))!;

  // ───────── 1. Finance wall: staff blocked on every money function ─────────
  console.log('\n— finance wall —');
  const dw = (await prisma.domesticCase.findFirst({ where: { workspace: ws, code: 'DW-003' } }))!;
  const s = String(dw.id);
  check('STAFF cannot write fee agreement', no(await R.saveDomAccount(staff, { case_id: s, agreed_fee: '1000' })));
  check('STAFF cannot record a sponsor payment', no(await R.saveDomPayment(staff, { case_id: s, direction: 'Incoming', category: 'Advance', date: '2026-11-05', amount: '10', account: 'QIIB' })));
  check('STAFF cannot open a refund claim', no(await R.saveRefund(staff, { case_id: s, months_served: '1', reason: 'Worker absconds', evidence: 'x' })));
  check('STAFF cannot set placement fees / service terms / allocations', no(await R.savePlacementFee(staff, { placement_id: '1', basic_salary: '1', basis: 'one', due_months: '1' })) && no(await R.saveServiceTerm(staff, { client: clientA.name, enabled: 'Yes', currency: 'USD', basis: 'worker', amount: '1', trigger: 'Verified arrival', taxable: 'No' })) && no(await R.saveFundAllocation(staff, { finance_entry_id: '1', amount: '1' })));
  check('STAFF cannot delete a payment row', no(await R.deleteV8(staff, 'domPayments', 1)));

  // ───────── 2. Domestic: individual sponsor, advance + deployment balance, receipt, refund ─────────
  console.log('\n— domestic —');
  const mk = await R2.saveDomestic(staff, { sponsor_type: 'Qatari Citizen', customer: 'TEST Sponsor Person', qid: '29012345678', mobile: '+974 5000 0000', category: 'Cook', origin: 'Philippines', status: 'Customer Enquiry', handover_date: '2026-09-01' });
  check('staff can open a sponsor case (case tracking is not finance)', mk.ok, J(mk));
  const sp = (await prisma.domesticCase.findFirst({ where: { workspace: ws, customer: 'TEST Sponsor Person' } }))!;
  check('QID stored ENCRYPTED (no plaintext in the database), last 4 kept for masking', !!sp.qidCipher && !sp.qidCipher.includes('29012345678') && sp.qidLast === '5678' && decryptText(sp.qidCipher) === '29012345678', sp.qidCipher ?? '');
  const sid = String(sp.id);
  const edit = await R2.saveDomestic(staff, { sponsor_type: 'Qatari Citizen', customer: 'TEST Sponsor Person', qid: '', mobile: '+974 5000 0001', category: 'Cook', origin: 'Philippines', status: 'Worker Profiles', handover_date: '2026-09-01' }, sp.id);
  check('editing with a blank QID keeps the encrypted QID', edit.ok && (await prisma.domesticCase.findUnique({ where: { id: sp.id } }))!.qidLast === '5678');
  check('no corporate fields exist on the sponsor form', !Object.keys((await import('../src/lib/forms')).specs.domestic.fields.reduce((a, f) => ({ ...a, [f.key]: 1 }), {})).some(k => /company|cr_|purchase/i.test(k)));
  check('payment refused until a fee agreement exists', no(await R.saveDomPayment(md, { case_id: sid, direction: 'Incoming', category: 'Advance', date: '2026-09-02', amount: '5000', account: 'QIIB' })));
  check('MD records the fee agreement (QAR 12,000, gov. fees 500)', (await R.saveDomAccount(md, { case_id: sid, agreed_fee: '12000', gov_fees: '500' })).ok);
  const adv = await R.saveDomPayment(ni, { case_id: sid, direction: 'Incoming', category: 'Advance', date: '2026-09-02', amount: '5000', account: 'QIIB', reference: 'QIIB-T1' });
  check('Nitija records an advance; a receipt number RC-… is issued', adv.ok && /^RC-\d+$/.test(adv.ok ? adv.code ?? '' : ''), J(adv));
  const { domesticBalance } = await import('../src/lib/domain/v8');
  const pays = async () => (await prisma.receivablePayment.findMany({ where: { domesticCaseId: sp.id } })).map(p => ({ direction: p.direction, category: p.category, amount: Number(p.amount) }));
  check('balance due at deployment = 7,000', domesticBalance(12000, await pays()).balance === 7000);
  check('an Outgoing payment must be a refund, an Incoming one cannot be', no(await R.saveDomPayment(md, { case_id: sid, direction: 'Outgoing', category: 'Advance', date: '2026-09-02', amount: '1', account: 'QIIB' })) && no(await R.saveDomPayment(md, { case_id: sid, direction: 'Incoming', category: 'Refund paid', date: '2026-09-02', amount: '1', account: 'QIIB' })));
  await R.saveDomPayment(md, { case_id: sid, direction: 'Incoming', category: 'Deployment balance', date: '2026-09-05', amount: '7000', account: 'QIIB' });
  check('after the deployment payment the balance is 0', domesticBalance(12000, await pays()).balance === 0);

  const claim = await R.saveRefund(ni, { case_id: sid, months_served: '4', reason: 'Worker absconds', evidence: 'Police report no. T-1 (test)' });
  const rc = (await prisma.refundClaim.findFirst({ where: { workspace: ws, caseId: sp.id } }))!;
  check('refund claim computes the estimate (4 months: 12000×0.85 − 500 = 9,700) and starts Pending', claim.ok && Number(rc.estimate) === 9700 && rc.status === 'Pending review', J(rc));
  check('refund claim needs evidence', no(await R.saveRefund(md, { case_id: sid, months_served: '1', reason: 'Worker absconds', evidence: '' })));
  check('disputed reason → no number (manual review)', (await R.saveRefund(md, { case_id: sid, months_served: '1', reason: 'Other / disputed', evidence: 'dispute' })).ok && (await prisma.refundClaim.findFirst({ where: { workspace: ws, caseId: sp.id, reason: 'Other / disputed' } }))!.estimate === null);
  check('STAFF and Nitija cannot approve a refund (MD only)', no(await R.decideRefund(staff, rc.id, 'Approved', 'ok')) && no(await R.decideRefund(ni, rc.id, 'Approved', 'ok')));
  check('MD must give a decision note', no(await R.decideRefund(md, rc.id, 'Approved', '  ')));
  const before = await prisma.receivablePayment.count({ where: { workspace: ws } });
  check('MD approves — but NO payment row is created (no automatic payout)', (await R.decideRefund(md, rc.id, 'Approved', 'Approved after review (test)')).ok && (await prisma.receivablePayment.count({ where: { workspace: ws } })) === before);
  check('a decided claim cannot be re-decided, edited or deleted', no(await R.decideRefund(md, rc.id, 'Rejected', 'x')) && no(await R.saveRefund(md, { case_id: sid, months_served: '1', reason: 'Worker absconds', evidence: 'x' }, rc.id)) && no(await R.deleteV8(md, 'refunds', rc.id)));
  check('a sponsor case with money/contracts cannot be deleted through the case delete', no(await R2.deleteSimple(staff, 'domestic', sp.id)));

  // ───────── 3. Corporate placement fees ─────────
  console.log('\n— corporate —');
  const vac = await R.saveVacancy(staff, { client: clientB.name, title: 'TEST Accountant', category: 'Accountant', quantity: '1', source: 'Local Qatar', status: 'Open' });
  check('staff can open a vacancy for a company', vac.ok, J(vac));
  const v = (await prisma.corporateVacancy.findFirst({ where: { workspace: ws, title: 'TEST Accountant' } }))!;
  check('placement stage Joined needs a confirmed joining date, and vice versa', no(await R.savePlacement(staff, { vacancy_id: String(v.id), candidate_name: 'TEST Cand', source: 'Local Qatar', stage: 'Joined' })) && no(await R.savePlacement(staff, { vacancy_id: String(v.id), candidate_name: 'TEST Cand', source: 'Local Qatar', stage: 'Offer', joining_date: '2026-10-01' })));
  await R.savePlacement(staff, { vacancy_id: String(v.id), candidate_name: 'TEST Cand', source: 'Local Qatar', stage: 'Offer', offer_date: '2026-09-20' });
  const pl = (await prisma.corporatePlacement.findFirst({ where: { workspace: ws, candidateName: 'TEST Cand' } }))!;
  check('fee: 1 month of QAR 6,000 basic, due 1 month after joining', (await R.savePlacementFee(ni, { placement_id: String(pl.id), basic_salary: '6000', basis: 'one', due_months: '1' })).ok && Number((await prisma.placementFee.findUnique({ where: { placementId: pl.id } }))!.feeAmount) === 6000);
  const fee = (await prisma.placementFee.findUnique({ where: { placementId: pl.id } }))!;
  check('no fee can be received before joining is confirmed', no(await R.savePlacementPayment(md, { placement_fee_id: String(fee.id), date: '2026-10-05', amount: '1000', account: 'Other bank' })));
  await R.savePlacement(staff, { vacancy_id: String(v.id), candidate_name: 'TEST Cand', source: 'Local Qatar', stage: 'Joined', offer_date: '2026-09-20', joining_date: '2026-10-01' }, pl.id);
  check('half-month and custom fee bases', (await R.savePlacementFee(md, { placement_id: String(pl.id), basic_salary: '6000', basis: 'half', due_months: '3' })).ok && Number((await prisma.placementFee.findUnique({ where: { placementId: pl.id } }))!.feeAmount) === 3000 && no(await R.savePlacementFee(md, { placement_id: String(pl.id), basic_salary: '6000', basis: 'custom', due_months: '1' })) && (await R.savePlacementFee(md, { placement_id: String(pl.id), basic_salary: '6000', basis: 'one', due_months: '1' })).ok);
  check('receipt of 2,000 is accepted (partial) and a receipt number issued', (await R.savePlacementPayment(md, { placement_fee_id: String(fee.id), date: '2026-10-05', amount: '2000', account: 'Other bank' })).ok);
  check('cannot collect more than is outstanding (4,000 left)', no(await R.savePlacementPayment(md, { placement_fee_id: String(fee.id), date: '2026-10-06', amount: '4500', account: 'Other bank' })));
  check('credit note cannot exceed the fee', no(await R.savePlacementFee(md, { placement_id: String(pl.id), basic_salary: '6000', basis: 'one', due_months: '1', credit_note: '7000' })));

  // ───────── 4. Optional blue-collar service charge ─────────
  console.log('\n— service charge —');
  const arrCand = (await prisma.candidate.findFirst({ where: { workspace: ws, status: { in: ['Arrived', 'Joined', 'Warranty'] } }, include: { client: true } }))!;
  const clientS = arrCand.client;
  const cands = await prisma.candidate.findMany({ where: { workspace: ws, clientId: clientS.id } });
  const arrived = cands.filter(c => ['Arrived', 'Joined', 'Warranty'].includes(c.status)).length;
  const t = await R.saveServiceTerm(md, { client: clientS.name, enabled: 'No', currency: 'USD', basis: 'worker', amount: '200', trigger: 'Verified arrival', taxable: 'No', notes: 'TEST term' });
  const term = (await prisma.serviceFeeTerm.findFirst({ where: { workspace: ws, notes: 'TEST term' } }))!;
  check('a term is created DISABLED by choice (no charge by default)', t.ok && !term.enabled);
  check('nothing can be invoiced while disabled', no(await R.saveServiceInvoice(md, { term_id: String(term.id), workers: '1', date: '2026-11-05' })));
  await R.saveServiceTerm(md, { client: clientS.name, enabled: 'Yes', currency: 'USD', basis: 'worker', amount: '200', trigger: 'Verified arrival', taxable: 'No', notes: 'TEST term' }, term.id);
  console.log(`   (${arrived} worker(s) of ${clientS.name} have already reached “Verified arrival”)`);
  check('cannot invoice more workers than have arrived', no(await R.saveServiceInvoice(md, { term_id: String(term.id), workers: String(arrived + 1), date: '2026-11-05' })));
  if (arrived >= 1) {
    const ok = await R.saveServiceInvoice(md, { term_id: String(term.id), workers: '1', date: '2026-11-05', invoice_no: 'SI-T' });
    const inv = await prisma.serviceFeeInvoice.findFirst({ where: { termId: term.id } });
    check('invoice for 1 arrived worker = USD 200', ok.ok && Number(inv!.amount) === 200, J(ok));
    check('receipt larger than the invoice is refused; exact is accepted', no(await R.saveServicePayment(md, { service_invoice_id: String(inv!.id), date: '2026-11-06', amount: '250', account: 'Other bank' })) && (await R.saveServicePayment(md, { service_invoice_id: String(inv!.id), date: '2026-11-06', amount: '200', account: 'Other bank' })).ok);
  } else check('(no arrived workers in demo data for this client — invoice path skipped)', true);

  // ───────── 5. Agency deposit allocation ─────────
  console.log('\n— deposit allocation —');
  await R3.saveFinance(md, { date: '2026-11-05', division: 'labour', direction: 'Incoming', account: 'Cash', party: 'TEST Agency Deposit', client: clientA.name, country: 'Nepal', category: 'Agency advance', amount: '10000' });
  const dep = (await prisma.financeEntry.findFirst({ where: { workspace: ws, party: 'TEST Agency Deposit' } }))!;
  const ord = (await prisma.order.findFirst({ where: { workspace: ws, code: 'ORD-1003' } }))!;
  const prop = { finance_entry_id: String(dep.id), order_id: String(ord.id), amount: '4000' };
  check('MD/Nitija can PROPOSE an allocation', (await R.saveFundAllocation(ni, prop)).ok);
  check('cannot allocate more than the free part of the deposit', no(await R.saveFundAllocation(ni, { ...prop, amount: '7000' })));
  check('a non-deposit entry cannot be allocated', no(await R.saveFundAllocation(ni, { ...prop, finance_entry_id: String((await prisma.financeEntry.findFirst({ where: { workspace: ws, category: 'Office expense' } }))!.id) })));
  const al = (await prisma.financeAllocation.findFirst({ where: { financeEntryId: dep.id } }))!;
  check('Nitija and staff cannot approve; allocation stays Proposed', no(await R.decideAllocation(ni, al.id, 'Approved')) && no(await R.decideAllocation(staff, al.id, 'Approved')) && (await prisma.financeAllocation.findUnique({ where: { id: al.id } }))!.status === 'Proposed');
  check('MD approves (and it cannot be deleted afterwards)', (await R.decideAllocation(md, al.id, 'Approved')).ok && no(await R.deleteV8(md, 'fundAllocations', al.id)));

  // ───────── 6. Contract library ─────────
  console.log('\n— contracts —');
  check('a Domestic contract cannot be filed under a company', no(await R.saveContract(md, { division: 'domestic', client: clientA.name, case_id: sid, title: 'x', agreement_type: 'Sponsor agreement' })));
  check('a Blue-Collar contract needs a company', no(await R.saveContract(md, { division: 'labour', title: 'x', agreement_type: 'Other' })));
  check('STAFF cannot create contracts', no(await R.saveContract(staff, { division: 'labour', client: clientA.name, title: 'x', agreement_type: 'Other' })));
  const c1 = await R.saveContract(ni, { division: 'domestic', case_id: sid, title: 'TEST Sponsor agreement', agreement_type: 'Sponsor agreement', signed_date: '2026-06-01', expiry_date: '2026-12-01' });
  check('Nitija files a Domestic contract under the individual sponsor', c1.ok, J(c1));
  const ct = (await prisma.contract.findFirst({ where: { workspace: ws, title: 'TEST Sponsor agreement' } }))!;
  const pdf1 = Buffer.from('%PDF-1.4\n% original version one\n%%EOF'), pdf2 = Buffer.from('%PDF-1.4\n% second version, different content\n%%EOF');
  check('upload v1', (await K.addContractVersion(ni, ct.id, { name: 'agreement.pdf', buf: pdf1 }, 'first signed copy')).ok);
  check('upload again → v2 (v1 is kept, not overwritten)', (await K.addContractVersion(ni, ct.id, { name: 'agreement.pdf', buf: pdf2 }, 'amended')).ok);
  const vs = await prisma.contractVersion.findMany({ where: { contractId: ct.id }, orderBy: { version: 'asc' } });
  check('two versions, different storage keys, checksums recorded', vs.length === 2 && vs[0].storageKey !== vs[1].storageKey && vs[0].sha256 === sha256(pdf1) && vs[1].sha256 === sha256(pdf2));
  const dl1 = await K.readContractVersion(md, vs[0].id);
  check('download returns the EXACT original bytes of v1', dl1.ok && Buffer.compare(dl1.buf, pdf1) === 0);
  const fs = await import('node:fs/promises'); const raw = await fs.readFile(path.join(dir, vs[0].storageKey));
  check('the file on disk is encrypted (does not contain the PDF text)', !raw.includes('original version one') && raw.length > pdf1.length);
  check('STAFF cannot download or zip contracts', !(await K.readContractVersion(staff, vs[0].id)).ok && !(await K.zipContracts(staff, { caseId: sp.id })).ok);
  check('disallowed type, fake content, empty and oversize files are refused', no(await K.addContractVersion(ni, ct.id, { name: 'run.exe', buf: pdf1 }, '')) && no(await K.addContractVersion(ni, ct.id, { name: 'fake.pdf', buf: Buffer.from('not a pdf at all') }, '')) && no(await K.addContractVersion(ni, ct.id, { name: 'e.pdf', buf: Buffer.alloc(0) }, '')) && no(await K.addContractVersion(ni, ct.id, { name: 'big.pdf', buf: Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(16 * 1024 * 1024)]) }, '')));
  check('STAFF cannot upload', no(await K.addContractVersion(staff, ct.id, { name: 'a.pdf', buf: pdf1 }, '')));
  const z = await K.zipContracts(md, { caseId: sp.id });
  const zf = z.ok ? Object.keys((await JSZip.loadAsync(z.buf)).files).filter(n => !n.endsWith('/')) : [];
  check('sponsor ZIP holds both versions', z.ok && zf.length === 2 && zf.some(n => n.includes('v1_')) && zf.some(n => n.includes('v2_')), J(zf));
  check('downloads and ZIPs are in the audit log', (await prisma.activityLog.count({ where: { workspace: ws, entity: 'contracts', text: { contains: 'Downloaded' } } })) >= 1 && (await prisma.activityLog.count({ where: { workspace: ws, entity: 'contracts', text: { contains: 'Bulk ZIP' } } })) >= 1);
  await fs.writeFile(path.join(dir, vs[0].storageKey), Buffer.concat([raw.subarray(0, raw.length - 1), Buffer.from([raw[raw.length - 1] ^ 1])]));
  check('a tampered stored file is detected and refused', !(await K.readContractVersion(md, vs[0].id)).ok);

  // ───────── 7. Tasks ─────────
  console.log('\n— tasks —');
  check('staff cannot assign a task to someone else', no(await R.saveTask(staff, { title: 'x', kind: 'Manual', assignee_id: String(mdU.id), priority: 'Normal' })));
  check('staff can create a task for themselves and finish it', (await R.saveTask(staff, { title: 'TEST own task', kind: 'QVC', assignee_id: String(stU.id), priority: 'Normal', due_date: '2026-11-01' })).ok);
  const own = (await prisma.task.findFirst({ where: { workspace: ws, title: 'TEST own task' } }))!;
  check('MD can assign to staff', (await R.saveTask(md, { title: 'TEST assigned', kind: 'Manual', assignee_id: String(stU.id), priority: 'High' })).ok);
  check('staff can complete theirs; cannot complete a task of the MD', (await R.setTaskStatus(staff, own.id, 'Done')).ok && no(await R.setTaskStatus(staff, (await prisma.task.findFirst({ where: { workspace: ws, code: 'TK-1003' } }))!.id, 'Done')));
  check('only MD/Nitija may delete a task', no(await R.deleteV8(staff, 'tasks', own.id)) && (await R.deleteV8(md, 'tasks', own.id)).ok);

  // ───────── 8. Interview attendance ─────────
  console.log('\n— interview attendance —');
  const iv = (await prisma.interview.findFirst({ where: { workspace: ws, clientId: clientA.id } }))!;
  const own1 = (await prisma.candidate.findFirst({ where: { workspace: ws, clientId: clientA.id, interviewEntries: { none: {} } } }))!, other = (await prisma.candidate.findFirst({ where: { workspace: ws, clientId: { not: clientA.id } } }))!;
  check('a candidate of another client cannot be added to this interview', no(await R.saveInterviewEntry(staff, { interview_id: String(iv.id), candidate_id: String(other.id), attended: 'Yes', decision: 'Pending' })));
  check('absent candidates cannot be selected/rejected', no(await R.saveInterviewEntry(staff, { interview_id: String(iv.id), candidate_id: String(own1.id), attended: 'No', decision: 'Selected' })));
  const ie = await R.saveInterviewEntry(staff, { interview_id: String(iv.id), candidate_id: String(own1.id), attended: 'Yes', decision: 'Selected' });
  check('attendance + decision recorded; duplicates refused', ie.ok && no(await R.saveInterviewEntry(staff, { interview_id: String(iv.id), candidate_id: String(own1.id), attended: 'Yes', decision: 'Rejected' })), J(ie));

  // every V8 report listed in the UI exists and runs
  const { V8_REPORTS } = await import('../src/lib/repo/reports-v8'); const { V8_REPORT_NAMES } = await import('../src/lib/quick');
  let reportsOk = true; const bad: string[] = [];
  for (const name of V8_REPORT_NAMES) { try { const r = await V8_REPORTS[name].build(md); if (!r.columns.length) throw new Error('no columns'); } catch (e) { reportsOk = false; bad.push(name + ': ' + (e as Error).message); } }
  check('all ' + V8_REPORT_NAMES.length + ' V8 reports build for the MD (and match the registry names)', reportsOk && Object.keys(V8_REPORTS).length === V8_REPORT_NAMES.length, bad.join('; '));

  // cleanup: reseed the demo workspace (removes every TEST row) and the temp storage folder
  check('reset demo restores the V8 sample data', (await R3.resetDemo(md)).ok && (await prisma.corporateVacancy.count({ where: { workspace: ws } })) === 2 && (await prisma.domesticAccount.count({ where: { workspace: ws } })) === 3 && (await prisma.contract.count({ where: { workspace: ws } })) === 3);
  await prisma.$disconnect(); await rm(dir, { recursive: true, force: true });
  console.log(failed ? `\n${failed} FAILED` : '\nAll V8 database checks passed.');
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

/**
 * Database integration test — runs against the REAL database in .env, DEMO workspace only, and cleans up after itself.
 * Run:  npm run test:db
 * Calls the server-side write functions directly (bypassing the UI) to prove the rules hold even if someone ignores the screen.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  :: ' + detail}`); if (!cond) failed++; };

async function main() {
  // The repo uses src/lib/db.ts (server-only); this script supplies the same environment and imports it dynamically.
  const R = await import('../src/lib/repo/mutations');
  const { prisma } = await import('../src/lib/db');
  void PrismaMariaDb; void PrismaClient;
  const ws = 'demo' as const;
  const mdUser = (await prisma.user.findUnique({ where: { email: 'md@lgm.local' } }))!, staffUser = (await prisma.user.findUnique({ where: { email: 'staff@lgm.local' } }))!;
  const md = { workspace: ws, role: 'md' as const, userId: mdUser.id }, staff = { workspace: ws, role: 'staff' as const, userId: staffUser.id };
  const client = (await prisma.client.findFirst({ where: { workspace: ws, name: 'Demo Construction Ltd' } }))!;
  const tag = 'DBTEST-' + Date.now();
  const mk = (extra: Record<string, string> = {}) => ({ name: 'DB Test Person', passport: tag, client: client.name, country: 'Nepal', trade: 'Tester', ...extra });

  // create as staff is allowed (V6: staff operate the pipeline)
  const created = await R.saveCandidate(staff, mk());
  check('staff can add a candidate', created.ok, JSON.stringify(created));
  const row = await prisma.candidate.findFirst({ where: { workspace: ws, passport: tag } });
  check('candidate stored with NP- code, CV Submitted, 1 history row', !!row && /^NP-\d+$/.test(row.code) && row.status === 'CV Submitted' && (await prisma.candidateStage.count({ where: { candidateId: row!.id } })) === 1, row?.code);
  const id = row!.id;

  // duplicate rule (passport, normalised) — also enforced by a database unique index
  const dup = await R.saveCandidate(staff, mk({ name: 'Other Name', passport: tag.toLowerCase().replace('-', ' ') }));
  check('duplicate passport refused', !dup.ok && /Duplicate of/.test(JSON.stringify(dup)), JSON.stringify(dup));

  // lifecycle rules
  check('illegal jump refused (CV Submitted → Interview)', !(await R.moveCandidate(staff, id, 'Interview')).ok);
  check('legal step allowed', (await R.moveCandidate(staff, id, 'Client Review')).ok);
  check('Reject allowed during screening', (await R.moveCandidate(staff, id, 'Rejected')).ok);
  check('no moves out of Rejected', !(await R.moveCandidate(staff, id, 'Interview')).ok);

  // permission: undo is MD/Nitija only — enforced in the server function itself
  const undoStaff = await R.undoCandidate(staff, id);
  check('STAFF cannot undo a stage (server-side)', !undoStaff.ok && /Only the Managing Director/.test(JSON.stringify(undoStaff)), JSON.stringify(undoStaff));
  check('stage unchanged after refused undo', (await prisma.candidate.findUnique({ where: { id } }))!.status === 'Rejected');
  check('MD can undo', (await R.undoCandidate(md, id)).ok && (await prisma.candidate.findUnique({ where: { id } }))!.status === 'Client Review');

  // workspace isolation: a LIVE actor cannot see or touch DEMO records
  const live = { workspace: 'live' as const, role: 'md' as const, userId: mdUser.id };
  check('LIVE workspace cannot move a DEMO candidate', !(await R.moveCandidate(live, id, 'Interview')).ok);
  check('LIVE workspace cannot delete a DEMO candidate', !(await R.deleteCandidate(live, id)).ok);
  check('LIVE workspace cannot find DEMO clients', !(await R.saveOrder(live, { client: client.name, country: 'Nepal', trade: 'T', qty: '1' })).ok);

  // integrity
  const usedClient = await R.deleteClient(md, client.id);
  check('client in use cannot be deleted', !usedClient.ok && /used by/.test(JSON.stringify(usedClient)), JSON.stringify(usedClient));

  // cleanup
  check('cleanup: candidate deleted (history cascades)', (await R.deleteCandidate(md, id)).ok && (await prisma.candidateStage.count({ where: { candidateId: id } })) === 0);
  // ───────────── Stage 2 ─────────────
  const R2 = await import('../src/lib/repo/mutations-more');
  const bad = (r: { ok: boolean }) => !r.ok;
  const json = (r: unknown) => JSON.stringify(r);

  // visits
  check('visit with an unknown client is refused', bad(await R2.saveVisit(staff, { client: 'No Such Client', date: '2026-11-05', outcome: 'Follow-up' })));
  check('visit with an invalid date is refused', bad(await R2.saveVisit(staff, { client: client.name, date: '31/02/2026', outcome: 'Follow-up' })));
  const v = await R2.saveVisit(staff, { client: client.name, date: '2026-11-05', outcome: 'Follow-up', contact: tag });
  check('valid visit saved', v.ok, json(v));
  const visitRow = (await prisma.visit.findFirst({ where: { workspace: ws, contact: tag } }))!;

  // demand letters: code sequence, optional order link
  const dl = await R2.saveDemand(staff, { client: client.name, order_id: 'ORD-1002', status: 'Received', countries: tag });
  check('demand letter gets a DL- code', dl.ok && /^DL-\d+$/.test((dl as { code?: string }).code ?? ''), json(dl));
  check('demand letter with unknown order refused', bad(await R2.saveDemand(staff, { client: client.name, order_id: 'ORD-9999', status: 'Received' })));
  const dlCode = (dl as { code: string }).code;

  // agency allocations: warning when over the ordered quantity
  const alloc = await R2.saveAllocation(staff, { agency: tag, country: 'Bangladesh', order_id: 'ORD-1002', allocated: '9999', status: 'Sourcing' });
  check('allocation above order quantity saves with a warning', alloc.ok && /exceeds order quantity/.test(json(alloc)), json(alloc));
  check('allocation for an unknown order refused', bad(await R2.saveAllocation(staff, { agency: tag, country: 'Nepal', order_id: 'ORD-9999', allocated: '1', status: 'Sourcing' })));

  // interviews
  check('interview saved', (await R2.saveInterview(staff, { client: client.name, method: 'Zoom', country: 'nepal', date: '2026-12-01', candidates: '12', status: 'Scheduled' })).ok);
  check('interview with a bad method refused', bad(await R2.saveInterview(staff, { client: client.name, method: 'Carrier pigeon', country: 'Nepal', status: 'Scheduled' })));
  const interviewRow = (await prisma.interview.findFirst({ where: { workspace: ws, clientId: client.id, date: new Date('2026-12-01T00:00:00Z') } }))!;
  check('interview country is canonicalised to "Nepal"', interviewRow.country === 'Nepal', interviewRow.country);

  // travel records: stage eligibility, one per candidate, flight date lands on the candidate
  const early = (await prisma.candidate.findFirst({ where: { workspace: ws, status: 'CV Submitted' } }))!;
  check('travel record refused for a candidate who is not at Visa Printed or later', bad(await R2.saveTicket(staff, { candidate_id: early.code, step: 'Pending' })));
  const withTravel = (await prisma.travelRecord.findMany({ where: { workspace: ws }, select: { candidateId: true } })).map(t => t.candidateId);
  const free = (await prisma.candidate.findFirst({ where: { workspace: ws, status: { in: R2.TRAVEL_STAGES }, id: { notIn: withTravel } } }))!;
  check('demo data has a flight-ready candidate without a travel record', !!free);
  const t1 = await R2.saveTicket(staff, { candidate_id: free.code, ticket_by: 'Client', flight: 'DBT-1', flight_date: '2026-12-24', driver_name: 'X', driver_phone: '1', step: 'Request Booking' });
  check('travel record saved for an eligible candidate', t1.ok, json(t1));
  check('flight date is stored on the candidate', (await prisma.candidate.findUnique({ where: { id: free.id } }))!.flightDate?.toISOString().slice(0, 10) === '2026-12-24');
  check('a second travel record for the same candidate is refused', bad(await R2.saveTicket(staff, { candidate_id: free.code, step: 'Pending' })));
  const tRow = (await prisma.travelRecord.findUnique({ where: { candidateId: free.id } }))!;
  check('travel status advances one step', (await R2.advanceStatus(staff, 'tickets', tRow.id)).ok && (await prisma.travelRecord.findUnique({ where: { id: tRow.id } }))!.step === 'Flight Details Shared');

  // warranty: labour expiry auto = start + 3 months; domestic none; expiry before start refused
  const wl = await R2.saveWarranty(staff, { division: 'Labour', client: client.name, issue: tag, status: 'Pending', warranty_start: '2026-09-20' });
  const wlRow = (await prisma.warrantyCase.findFirst({ where: { workspace: ws, issue: tag } }))!;
  check('labour warranty expiry filled = start + 3 months', wl.ok && wlRow.warrantyExpiry?.toISOString().slice(0, 10) === '2026-12-20', json(wl));
  check('labour warranty is linked to the registered client', wlRow.clientId === client.id && wlRow.clientLabel === '');
  const wd = await R2.saveWarranty(staff, { division: 'Domestic', client: 'Some Household ' + tag, issue: tag + 'D', status: 'Pending', warranty_start: '2026-09-20' });
  const wdRow = (await prisma.warrantyCase.findFirst({ where: { workspace: ws, issue: tag + 'D' } }))!;
  check('domestic warranty has NO assumed expiry; free-text household kept', wd.ok && wdRow.warrantyExpiry === null && wdRow.clientId === null && /Some Household/.test(wdRow.clientLabel), json(wd));
  check('warranty expiry before start refused', bad(await R2.saveWarranty(staff, { division: 'Labour', client: client.name, issue: 'x', status: 'Pending', warranty_start: '2026-09-20', warranty_expiry: '2026-09-01' })));
  check('warranty advances along its workflow', (await R2.advanceStatus(staff, 'warranties', wlRow.id)).ok && (await prisma.warrantyCase.findUnique({ where: { id: wlRow.id } }))!.status === 'Under Review');

  // domestic cases + workflow end
  const dc = await R2.saveDomestic(staff, { origin: 'Kenya', customer: tag, status: 'Guarantee / Complaints' });
  const dcRow = (await prisma.domesticCase.findFirst({ where: { workspace: ws, customer: tag } }))!;
  check('domestic case gets a DW-nnn code', dc.ok && /^DW-\d{3}$/.test(dcRow.code), dcRow.code);
  check('cannot advance past the last workflow step', bad(await R2.advanceStatus(staff, 'domestic', dcRow.id)));

  // workspace isolation for the new record types
  check('LIVE cannot delete a DEMO visit', bad(await R2.deleteSimple(live, 'visits', visitRow.id)));
  check('LIVE cannot advance a DEMO domestic case', bad(await R2.advanceStatus(live, 'domestic', dcRow.id)));

  // cleanup of everything Stage 2 created
  await R2.deleteSimple(md, 'visits', visitRow.id); await R2.deleteSimple(md, 'interviews', interviewRow.id);
  await R2.deleteSimple(md, 'demands', (await prisma.demandLetter.findFirst({ where: { workspace: ws, code: dlCode } }))!.id);
  await R2.deleteSimple(md, 'allocations', (await prisma.agencyAllocation.findFirst({ where: { workspace: ws, agency: tag } }))!.id);
  await R2.deleteSimple(md, 'tickets', tRow.id); await prisma.candidate.update({ where: { id: free.id }, data: { flightDate: free.flightDate } });
  await R2.deleteSimple(md, 'warranties', wlRow.id); await R2.deleteSimple(md, 'warranties', wdRow.id); await R2.deleteSimple(md, 'domestic', dcRow.id);
  check('cleanup: no Stage 2 test rows remain', (await prisma.visit.count({ where: { contact: tag } })) + (await prisma.agencyAllocation.count({ where: { agency: tag } })) + (await prisma.warrantyCase.count({ where: { issue: { startsWith: tag } } })) === 0);

  // ───────────── Stage 3 ─────────────
  const R3 = await import('../src/lib/repo/mutations-3');
  const IMP = await import('../src/lib/repo/import');
  const { readTable } = await import('../src/lib/io/readTable');
  const MUT = await import('../src/lib/repo/mutations');
  const nitijaUser = (await prisma.user.findUnique({ where: { email: 'nitija@lgm.local' } }))!;
  const nitija = { workspace: ws, role: 'nitija' as const, userId: nitijaUser.id };
  const live2 = { ...md, workspace: 'live' as const };
  const stamp = String(Date.now()).slice(-6);

  // import: candidates with an unregistered client -> client auto-created as Prospect, rows tagged with their source file
  const csv = Buffer.from(['Name,Passport,Client,Country,Trade,Status', `Imp One,IMP-${stamp}-1,DBTEST Client ${stamp},Nepal,Mason,QVC`, `Imp Two,IMP-${stamp}-2,DBTEST Client ${stamp},Nepal,Mason,Banana`, 'Imp Three,DEMO-P0003,Demo Construction Ltd,Nepal,Mason,'].join('\n'));
  const table = await readTable('dbtest.csv', csv);
  const map = { candidate_name: '0', passport: '1', client: '2', country: '3', trade: '4', status: '5', agency: '', visa_number: '', qvc_date: '', flight_date: '', order_id: '' };
  const an = await IMP.analyseUpload(staff, 'candidates', table.rows, map);
  check('import analysis: 1 valid, 1 duplicate (existing passport), 1 rejected (bad status)', an.valid.length === 1 && an.duplicates.length === 1 && an.invalid.length === 1, json([an.valid.length, an.duplicates.length, an.invalid.length]));
  check('analysis writes nothing', (await prisma.client.count({ where: { workspace: ws, name: { startsWith: 'DBTEST Client' } } })) === 0);
  const done = await IMP.commitImport(staff, an, 'dbtest.csv');
  const impCand = await prisma.candidate.findFirst({ where: { workspace: ws, passport: `IMP-${stamp}-1` }, include: { client: true } });
  check('import commit added the candidate at stage QVC, tagged with its source file', done.added === 1 && impCand?.status === 'QVC' && impCand.sourceFile === 'dbtest.csv' && impCand.sourceRow === 1, json(done));
  check('missing client was created as a Prospect', impCand?.client.stage === 'Prospect' && done.newClients === 1);
  check('an import history record exists', (await prisma.importRecord.count({ where: { workspace: ws, file: 'dbtest.csv', added: 1 } })) === 1);
  const again = await IMP.analyseUpload(staff, 'candidates', table.rows, map);
  check('re-importing the same file adds nothing (idempotent)', again.valid.length === 0 && again.duplicates.length === 2, json([again.valid.length, again.duplicates.length]));

  // import: orders keep a custom order id; staff may not import finance (analysis throws)
  const oTable = await readTable('o.csv', Buffer.from(`Client,Country,Trade,Quantity,Order ID\nDemo Construction Ltd,Nepal,DBTEST Fitter ${stamp},15,ORD-9${stamp}`));
  const oMap = { client: '0', country: '1', trade: '2', quantity: '3', order_id: '4', agency: '', status: '' };
  const oDone = await IMP.commitImport(staff, await IMP.analyseUpload(staff, 'orders', oTable.rows, oMap), 'o.csv');
  check('order import keeps the order id from the sheet', oDone.added === 1 && !!(await prisma.order.findFirst({ where: { workspace: ws, code: `ORD-9${stamp}` } })));
  const fTable = await readTable('f.csv', Buffer.from('Date,Direction,Party,Category,Amount\n2026-11-05,Incoming,DBTEST Party,Other,10'));
  const fMap = { date: '0', direction: '1', party: '2', category: '3', amount: '4', division: '', account: '', client: '', country: '', order: '', ref: '', note: '' };
  let threw = ''; try { await IMP.analyseUpload(staff, 'finance', fTable.rows, fMap); } catch (e) { threw = (e as Error).message; }
  check('STAFF cannot import finance (server-side)', /restricted/.test(threw), threw);
  const fDone = await IMP.commitImport(md, await IMP.analyseUpload(md, 'finance', fTable.rows, fMap), 'f.csv');
  const fRow = await prisma.financeEntry.findFirst({ where: { workspace: ws, party: 'DBTEST Party' } });
  check('MD finance import: division/account defaults applied, tagged with source', fDone.added === 1 && fRow?.division === 'labour' && fRow.account === 'Cash' && fRow.sourceFile === 'f.csv');

  // finance permissions live inside the functions
  const fin = { date: '2026-11-05', division: 'labour', direction: 'Incoming', account: 'Cash', party: 'DBTEST Direct', category: 'Other', amount: '1234.50' };
  check('STAFF cannot add a finance entry', bad(await R3.saveFinance(staff, fin)));
  check('STAFF cannot delete a finance entry', bad(await R3.deleteFinance(staff, fRow!.id)));
  check('STAFF cannot clear finance', bad(await R3.clearFinance(staff)));
  check('Admin Manager (nitija) can add a finance entry', (await R3.saveFinance(nitija, fin)).ok);
  const dFin = (await prisma.financeEntry.findFirst({ where: { workspace: ws, party: 'DBTEST Direct' } }))!;
  check('amount is stored exactly (decimal 1234.50)', Number(dFin.amount) === 1234.5, String(dFin.amount));
  check('finance amount 0 / invalid date refused', bad(await R3.saveFinance(md, { ...fin, amount: '0' })) && bad(await R3.saveFinance(md, { ...fin, date: '31/02/2026' })));
  check('MD can delete finance entries', (await R3.deleteFinance(md, dFin.id)).ok && (await R3.deleteFinance(md, fRow!.id)).ok);

  // credentials register
  check('credentials: password-like text refused', bad(await R3.saveCredential(staff, { client: client.name, portal: 'MOL', record: 'password: hunter2' })));
  check('credentials: description-only record saved', (await R3.saveCredential(staff, { client: client.name, portal: 'MOL', record: 'DBTEST on file ' + stamp })).ok);
  await R3.deleteCredential(md, (await prisma.credentialRecord.findFirst({ where: { workspace: ws, record: 'DBTEST on file ' + stamp } }))!.id);

  // CV intake: duplicate file (same name + size) skipped; status validated
  const cvItem = { filename: `dbtest_${stamp}.txt`, size: 99, type: 'txt', source: 'Email attachment', client: '', agency: '', country: '', note: 'x', extractedEmail: '', extractedPhone: '', preview: '' };
  const cv1 = await R3.addCvItems(staff, [cvItem]), cv2 = await R3.addCvItems(staff, [cvItem]);
  check('CV intake: second upload of the same file is skipped', cv1.added === 1 && cv2.added === 0 && cv2.skipped === 1);
  const cvRow = (await prisma.cvIntakeItem.findFirst({ where: { workspace: ws, filename: cvItem.filename } }))!;
  check('CV intake: invalid status refused, valid one accepted', bad(await R3.setCvStatus(staff, cvRow.id, 'Banana')) && (await R3.setCvStatus(staff, cvRow.id, 'Reviewed')).ok);
  await R3.deleteCvItem(staff, cvRow.id);

  // users
  const email = `dbtest.${stamp}@lgm.local`;
  check('STAFF cannot create users', bad(await R3.createUser(staff, { email, name: 'T', role: 'staff', password: 'LongEnough123' })));
  check('short password refused', bad(await R3.createUser(md, { email, name: 'T', role: 'staff', password: 'short' })));
  check('invalid role refused', bad(await R3.createUser(md, { email, name: 'T', role: 'emperor', password: 'LongEnough123' })));
  check('MD can create a user', (await R3.createUser(md, { email, name: 'DB Test User', role: 'staff', password: 'LongEnough123' })).ok);
  check('duplicate e-mail refused', bad(await R3.createUser(md, { email, name: 'T', role: 'staff', password: 'LongEnough123' })));
  const tu = (await prisma.user.findUnique({ where: { email } }))!;
  check('password is stored hashed, never in clear text', tu.passwordHash.startsWith('$2') && !tu.passwordHash.includes('LongEnough'));
  check('STAFF cannot disable or reset users', bad(await R3.setUserActive(staff, tu.id, false)) && bad(await R3.resetUserPassword(staff, tu.id, 'AnotherLong123')));
  check('MD cannot disable their own account', bad(await R3.setUserActive(md, mdUser.id, false)));
  check('MD can disable and re-enable a user', (await R3.setUserActive(md, tu.id, false)).ok && !(await prisma.user.findUnique({ where: { id: tu.id } }))!.active && (await R3.setUserActive(md, tu.id, true)).ok);
  const me = { workspace: ws, role: 'staff' as const, userId: tu.id };
  check('own password change needs the correct current password', bad(await R3.changeOwnPassword(me, 'wrong-current', 'NewLongEnough123')) && (await R3.changeOwnPassword(me, 'LongEnough123', 'NewLongEnough123')).ok);
  await prisma.user.delete({ where: { id: tu.id } });

  // workspace tools
  check('STAFF cannot reset demo or clear a workspace', bad(await R3.resetDemo(staff)) && bad(await R3.clearWorkspace(staff)));
  check('a LIVE record can be written', (await MUT.saveClient(live2, { name: 'DBTEST Live Client', stage: 'Prospect' })).ok);
  check('MD can clear the LIVE workspace; DEMO is untouched', (await R3.clearWorkspace(live2)).ok && (await prisma.client.count({ where: { workspace: 'live' } })) === 0 && (await prisma.candidate.count({ where: { workspace: ws } })) > 0);
  check('reset demo is refused outside the DEMO workspace', bad(await R3.resetDemo(live2)));
  check('MD can reset the DEMO workspace to the original sample (also removes all test rows)', (await R3.resetDemo(md)).ok && (await prisma.candidate.count({ where: { workspace: ws } })) === 40 && (await prisma.client.count({ where: { workspace: ws } })) === 5);
  await prisma.activityLog.deleteMany({ where: { workspace: 'live' } }); await prisma.counter.deleteMany({ where: { workspace: 'live' } });

  await prisma.activityLog.deleteMany({ where: { workspace: ws, text: { contains: 'DB Test Person' } } });
  await prisma.$disconnect();
  console.log(failed ? `\n${failed} FAILED` : '\nAll database integration checks passed.');
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

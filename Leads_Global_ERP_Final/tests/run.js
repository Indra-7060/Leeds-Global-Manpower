/* Leads Global ERP — automated tests (Node, no browser). Run:  node tests/run.js
   Loads the same scripts the browser loads, against an in-memory adapter. Only fictional data. Writes tests/results.json. */
const path = require('path'), fs = require('fs'), assert = require('assert');
const root = path.join(__dirname, '..');
['util', 'storage', 'store', 'importer'].forEach(f => require(path.join(root, 'core', 'js', f + '.js')));
['logic', 'config', 'seed'].forEach(f => require(path.join(root, 'project', f + '.js')));
const U = ERP.util, L = LGM, C = LGM.config;

const results = []; let group = '';
const T = (name, fn) => { try { fn(); results.push({ group, name, ok: true }); } catch (e) { results.push({ group, name, ok: false, error: e.message }); } };
const G = n => { group = n; };
const fresh = () => ERP.Store(C, ERP.storage.MemoryAdapter());
const ok = (r, what) => { if (!r.ok) throw new Error((what || 'operation') + ' failed: ' + JSON.stringify(r.errors)); return r.record; };
const mk = (s, e, scope, v) => ok(s.create(e, v, { scope }), e);
const today = U.todayISO(), ago = n => U.isoOf(new Date(U.parseISO(today).getTime() - n * 864e5));
const upd = (s, c, date, stage, extra) => s.create('updates', Object.assign({ client: c.client, candidate: c.id, date, stage, staff: 'Tester', action: 'test' }, extra || {}), { scope: c.division });

function bc(s) {
  const cl = mk(s, 'clients', 'Blue-Collar', { name: 'Test Client A' }), ag = mk(s, 'agencies', null, { name: 'Test Agency', country: 'Nepal' });
  const o = mk(s, 'orders', 'Blue-Collar', { client: cl.id, trade: 'Welder', quantity: 3 });
  const al = mk(s, 'allocations', 'Blue-Collar', { client: cl.id, order: o.id, agency: ag.id, quantity: 3, fee: 400 });
  const cand = n => mk(s, 'candidates', 'Blue-Collar', { name: 'Cand ' + n, client: cl.id, order: o.id, agency: ag.id, passport: 'T-' + n });
  return { cl, ag, o, al, cand };
}
function dm(s) {
  const cl = mk(s, 'clients', 'Domestic', { name: 'Test Sponsor' }), o = mk(s, 'orders', 'Domestic', { client: cl.id, trade: 'Housemaid', quantity: 2 });
  const cand = n => mk(s, 'candidates', 'Domestic', { name: 'Worker ' + n, client: cl.id, order: o.id, passport: 'D-' + n });
  return { cl, o, cand };
}

/* ============================================================ */
G('A. Core data rules');
T('IDs are sequential per table and prefixed', () => { const s = fresh(); const a = mk(s, 'clients', 'Blue-Collar', { name: 'X1' }), b = mk(s, 'clients', 'Domestic', { name: 'X2' }); assert.strictEqual(a.id, 'CL-0001'); assert.strictEqual(b.id, 'CL-0002'); });
T('required field is rejected with a clear message', () => { const s = fresh(); const r = s.create('clients', { name: '' }, { scope: 'Blue-Collar' }); assert(!r.ok); assert(/required/i.test(r.errors.name)); });
T('number, date and e-mail fields are validated', () => {
  const s = fresh(); const x = bc(s);
  assert(!s.create('orders', { client: x.cl.id, trade: 'W', quantity: 'abc' }, { scope: 'Blue-Collar' }).ok);
  assert(!s.create('orders', { client: x.cl.id, trade: 'W', quantity: 0 }, { scope: 'Blue-Collar' }).ok);
  assert(!s.create('orders', { client: x.cl.id, trade: 'W', quantity: 1.5 }, { scope: 'Blue-Collar' }).ok);
  assert(!s.create('orders', { client: x.cl.id, trade: 'W', quantity: 1, orderDate: '2026-02-30' }, { scope: 'Blue-Collar' }).ok);
  assert(!s.create('clients', { name: 'Mail', email: 'not-an-email' }, { scope: 'Blue-Collar' }).ok);
});
T('select values outside the allowed list are rejected', () => { const s = fresh(); const x = bc(s); assert(!s.create('orders', { client: x.cl.id, trade: 'W', quantity: 1, status: 'Banana' }, { scope: 'Blue-Collar' }).ok); });
T('duplicate client name is blocked inside a division, allowed in another', () => { const s = fresh(); mk(s, 'clients', 'Blue-Collar', { name: 'Same Name' }); const r = s.create('clients', { name: ' same  NAME ' }, { scope: 'Blue-Collar' }); assert(!r.ok && /Duplicate/.test(r.errors.name)); assert(s.create('clients', { name: 'Same Name' }, { scope: 'Domestic' }).ok); });
T('duplicate passport is blocked; blank passport is not a duplicate', () => { const s = fresh(); const x = bc(s); x.cand('1'); const r = s.create('candidates', { name: 'Other', client: x.cl.id, passport: 'T-1' }, { scope: 'Blue-Collar' }); assert(!r.ok && /Duplicate/.test(r.errors.passport)); assert(s.create('candidates', { name: 'No pass 1', client: x.cl.id }, { scope: 'Blue-Collar' }).ok); assert(s.create('candidates', { name: 'No pass 2', client: x.cl.id }, { scope: 'Blue-Collar' }).ok); });
T('references must point to existing records', () => { const s = fresh(); const r = s.create('orders', { client: 'CL-9999', trade: 'W', quantity: 1 }, { scope: 'Blue-Collar' }); assert(!r.ok && /does not exist/.test(r.errors.client)); });
T('a record cannot reference a record of another division', () => { const s = fresh(); const d = dm(s); const r = s.create('orders', { client: d.cl.id, trade: 'W', quantity: 1 }, { scope: 'Blue-Collar' }); assert(!r.ok && /different division/i.test(r.errors.client)); });
T('division can never be changed after creation', () => { const s = fresh(); const x = bc(s); const r = s.update('clients', x.cl.id, { division: 'Domestic' }); assert(!r.ok); assert.strictEqual(s.get('clients', x.cl.id).division, 'Blue-Collar'); });
T('delete is blocked while other records depend on the record', () => { const s = fresh(); const x = bc(s); const r = s.remove('clients', x.cl.id); assert(!r.ok && /used by/.test(r.errors._)); assert(s.get('clients', x.cl.id)); });
T('unused record can be deleted and the audit log records it', () => { const s = fresh(); const c = mk(s, 'clients', 'Blue-Collar', { name: 'Temp' }); assert(s.remove('clients', c.id).ok); assert(!s.get('clients', c.id)); assert(s.audit.some(a => a.action === 'delete' && a.recordId === c.id)); });
T('every create / update writes an audit entry', () => { const s = fresh(); const c = mk(s, 'clients', 'Blue-Collar', { name: 'Aud' }); s.update('clients', c.id, { phone: '1' }); assert.deepStrictEqual(s.audit.filter(a => a.recordId === c.id).map(a => a.action), ['create', 'update']); });
T('tracked fields keep a history (from → to)', () => { const s = fresh(); const x = bc(s); const c = x.cand('h'); s.update('candidates', c.id, { stage: 'Selected' }); const h = s.historyOf('candidates', c.id, 'stage'); assert.deepStrictEqual(h.map(e => e.from + '>' + e.to), ['>CV Received', 'CV Received>Selected']); });
T('failed batch leaves no half-written data', () => { const s = fresh(); const before = JSON.stringify(s.raw.data); try { s.batch(() => { mk(s, 'clients', 'Blue-Collar', { name: 'In batch' }); throw new Error('boom'); }); } catch (e) { /* expected */ } assert.strictEqual(JSON.stringify(s.raw.data), before); assert.strictEqual(s.count('clients'), 0); });
T('simulate() rolls everything back (import preview safety)', () => { const s = fresh(); s.simulate(() => { mk(s, 'clients', 'Blue-Collar', { name: 'Ghost' }); }); assert.strictEqual(s.count('clients'), 0); assert.strictEqual(s.counters.clients || 0, 0); });
T('records survive reopening (storage adapter round trip)', () => { const ad = ERP.storage.MemoryAdapter(); const s1 = ERP.Store(C, ad); mk(s1, 'clients', 'Blue-Collar', { name: 'Persist' }); const s2 = ERP.Store(C, ad); assert.strictEqual(s2.list('clients')[0].name, 'Persist'); assert.strictEqual(mk(s2, 'clients', 'Blue-Collar', { name: 'Next' }).id, 'CL-0002'); });
T('when browser storage is full the save fails loudly, nothing is half-saved, and saving works again afterwards', () => {
  let full = false; const ad = ERP.storage.MemoryAdapter(); const real = ad.save; ad.save = o => { if (full) throw new Error('QuotaExceededError'); real(o); };
  const s = ERP.Store(C, ad); mk(s, 'clients', 'Blue-Collar', { name: 'Before' }); full = true; assert.throws(() => s.create('clients', { name: 'During' }, { scope: 'Blue-Collar' }), /Quota/);
  assert.strictEqual(s.count('clients'), 1); assert.strictEqual(s.counters.clients, 1); assert.strictEqual(s.audit.length, 1); full = false; assert.strictEqual(mk(s, 'clients', 'Blue-Collar', { name: 'After' }).id, 'CL-0002');
});
T('the "ever reached" cache is never stale after a restore', () => { const a = fresh(); L.seed(a); const want = L.reachedCount(a, 'Deployed', 'Blue-Collar'); const bk = JSON.parse(JSON.stringify(a.exportJSON())); const b = fresh(); L.seed(b); b.update('candidates', b.list('candidates', { division: 'Blue-Collar' })[0].id, { stage: 'Selected' }); L.reachedCount(b, 'Deployed', 'Blue-Collar'); b.restore(bk); assert.strictEqual(L.reachedCount(b, 'Deployed', 'Blue-Collar'), want); });
T('unreadable stored data is refused, never silently overwritten', () => { const ad = ERP.storage.MemoryAdapter({ format: 'erp-data', projectId: 'other-project', data: {} }); assert.throws(() => ERP.Store(C, ad), /not usable/); });

G('B. Blue-Collar workflow (daily update → stage → deployment → agency ledger)');
T('stage list for Blue-Collar contains no Corporate/Domestic-only stage', () => { assert(!L.stagesFor('Blue-Collar').includes('Joined')); assert(L.stagesFor('Blue-Collar').includes('Deployed')); });
T('a daily update changes the candidate stage and writes stage history', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); ok(upd(s, c, ago(5), 'Selected')); assert.strictEqual(s.get('candidates', c.id).stage, 'Selected'); const h = s.historyOf('candidates', c.id, 'stage').pop(); assert.strictEqual(h.to, 'Selected'); assert(h.updateId, 'history event links to the update'); });
T('milestone date is filled from the update date, and never overwritten', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); ok(upd(s, c, ago(10), 'Interviewed')); assert.strictEqual(s.get('candidates', c.id).interviewDate, ago(10)); ok(upd(s, c, ago(8), 'Selected')); ok(upd(s, c, ago(2), 'Interviewed')); assert.strictEqual(s.get('candidates', c.id).interviewDate, ago(10)); });
T('Deployed update records the verified deployment date', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); ok(upd(s, c, ago(3), 'Deployed')); assert.strictEqual(s.get('candidates', c.id).deploymentDate, ago(3)); });
T('a stage that does not belong to the division workflow is rejected', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); const r = upd(s, c, ago(1), 'Joined'); assert(!r.ok); assert(r.errors.stage || r.errors.stage === undefined && Object.values(r.errors).length); assert.strictEqual(s.get('candidates', c.id).stage, 'CV Received'); });
T('moving a candidate backwards, or out of Rejected, is allowed but warned; skipping stages is allowed silently', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); const r1 = upd(s, c, ago(9), 'RTP'); assert(r1.ok && !r1.warnings.some(w => /earlier/.test(w))); const r2 = upd(s, c, ago(8), 'Selected'); assert(r2.ok && r2.warnings.some(w => /earlier/.test(w))); ok(upd(s, c, ago(7), 'Rejected')); const r3 = upd(s, c, ago(6), 'Selected'); assert(r3.ok && r3.warnings.some(w => /re-opens/.test(w))); });
T('an update whose client does not match the candidate is rejected', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); const other = mk(s, 'clients', 'Blue-Collar', { name: 'Other client' }); const r = s.create('updates', { client: other.id, candidate: c.id, date: ago(1), stage: 'Selected', staff: 'T', action: 'a' }, { scope: 'Blue-Collar' }); assert(!r.ok && r.errors.candidate); });
T('follow-up due date before the update date is rejected; due date needs a follow-up text', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); assert(!upd(s, c, ago(1), 'Selected', { nextAction: 'Call', dueDate: ago(5) }).ok); assert(!upd(s, c, ago(1), 'Selected', { nextAction: 'Call' }).ok); });
T('a Domestic candidate cannot be updated from the Blue-Collar division', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); const r = s.create('updates', { client: d.cl.id, candidate: w.id, date: ago(1), stage: 'Selected', staff: 'T', action: 'a' }, { scope: 'Blue-Collar' }); assert(!r.ok); });
T('agency earned = verified-deployed workers × fee (and ONLY verified deployments)', () => {
  const s = fresh(); const x = bc(s); const a = x.cand('1'), b = x.cand('2'), c = x.cand('3');
  ok(upd(s, a, ago(5), 'Deployed')); ok(upd(s, b, ago(4), 'Arrived')); ok(upd(s, c, ago(3), 'Selected'));
  const l = L.agencyLedger(s); assert.strictEqual(l.rows[0].deployed, 1); assert.strictEqual(l.rows[0].earned, 400); assert.strictEqual(l.totals.earned, 400);
  ok(upd(s, b, ago(2), 'Deployed')); assert.strictEqual(L.agencyLedger(s).totals.earned, 800);
});
T('payments linked to the allocation reduce the outstanding amount; unlinked ones are listed apart', () => {
  const s = fresh(); const x = bc(s); const a = x.cand('1'); ok(upd(s, a, ago(5), 'Deployed'));
  mk(s, 'accounts', 'Blue-Collar', { client: x.cl.id, agency: x.ag.id, allocation: x.al.id, kind: 'Payment received', payer: 'Overseas Agent', amount: 150, date: ago(1) });
  mk(s, 'accounts', 'Blue-Collar', { client: x.cl.id, agency: x.ag.id, kind: 'Payment received', payer: 'Overseas Agent', amount: 70, date: ago(1) });
  const l = L.agencyLedger(s); assert.strictEqual(l.rows[0].paid, 150); assert.strictEqual(l.rows[0].outstanding, 250); assert.strictEqual(l.unlinkedTotal, 70);
});
T('deployments above the allocated quantity are flagged', () => { const s = fresh(); const x = bc(s); s.update('allocations', x.al.id, { quantity: 1 }); const a = x.cand('1'), b = x.cand('2'); ok(upd(s, a, ago(5), 'Deployed')); ok(upd(s, b, ago(4), 'Deployed')); assert(L.agencyLedger(s).rows[0].overDeployed); });
T('an allocation must belong to the same client/agency as the payment', () => { const s = fresh(); const x = bc(s); const cl2 = mk(s, 'clients', 'Blue-Collar', { name: 'Client B' }); const r = s.create('accounts', { client: cl2.id, agency: x.ag.id, allocation: x.al.id, kind: 'Payment received', amount: 1, date: ago(1) }, { scope: 'Blue-Collar' }); assert(!r.ok && r.errors.allocation); });
T('an agency can only be allocated once per order', () => { const s = fresh(); const x = bc(s); const r = s.create('allocations', { client: x.cl.id, order: x.o.id, agency: x.ag.id, quantity: 1, fee: 1 }, { scope: 'Blue-Collar' }); assert(!r.ok && /Duplicate/.test(Object.values(r.errors).join(' '))); });
T('"ever reached" keeps counting a candidate who has moved on; "current" does not', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); ok(upd(s, c, ago(9), 'Interviewed')); ok(upd(s, c, ago(8), 'Selected')); assert.strictEqual(L.stageCount(s, 'Interviewed', 'Blue-Collar'), 0); assert.strictEqual(L.reachedCount(s, 'Interviewed', 'Blue-Collar'), 1); assert.strictEqual(L.stageCount(s, 'Selected', 'Blue-Collar'), 1); });
T('the latest update defines the open follow-up; older ones are superseded', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); ok(upd(s, c, ago(6), 'Interviewed', { nextAction: 'Old task', dueDate: ago(5) })); assert.strictEqual(L.followUps(s, 'Blue-Collar').length, 1); assert(L.followUps(s, 'Blue-Collar')[0].overdue); ok(upd(s, c, ago(2), 'Selected', { nextAction: 'New task', dueDate: ago(-3) })); const f = L.followUps(s, 'Blue-Collar'); assert.strictEqual(f.length, 1); assert.strictEqual(f[0].update.nextAction, 'New task'); assert(!f[0].overdue); });
T('order fulfilment counts verified deployments', () => { const s = fresh(); const x = bc(s); const a = x.cand('1'); ok(upd(s, a, ago(2), 'Deployed')); assert.strictEqual(L.deliveredForOrder(s, s.get('orders', x.o.id)), 1); });

G('C. Domestic warranty (9 months)');
T('date arithmetic: calendar months with end-of-month clamp and leap years', () => { assert.strictEqual(U.addMonths('2026-01-15', 9), '2026-10-15'); assert.strictEqual(U.addMonths('2026-05-31', 9), '2027-02-28'); assert.strictEqual(U.addMonths('2027-05-31', 9), '2028-02-29'); assert.strictEqual(U.addMonths('2026-08-31', 6), '2027-02-28'); assert.strictEqual(U.addMonths('2026-03-05', 12), '2027-03-05'); assert.strictEqual(U.daysBetween('2026-03-01', '2026-03-31'), 30); });
T('sponsor handover update auto-creates a warranty: start = handover date, end = +9 months', () => {
  const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, '2026-01-15', 'Handed Over'));
  const wr = L.warrantyOf(s, w.id); assert(wr, 'warranty exists'); assert.strictEqual(wr.start, '2026-01-15'); assert.strictEqual(wr.months, 9); assert.strictEqual(wr.end, '2026-10-15'); assert.strictEqual(wr.status, 'Active'); assert.strictEqual(s.get('candidates', w.id).handoverDate, '2026-01-15');
});
T('the warranty runs from the verified sponsor handover date, not from any other date (arrival, ticket, today)', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, '2026-02-01', 'Arrived')); ok(upd(s, w, '2026-02-10', 'Handed Over')); assert.strictEqual(L.warrantyOf(s, w.id).start, '2026-02-10'); });
T('no warranty is created before the sponsor handover', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, ago(3), 'Arrived')); assert.strictEqual(L.warrantyOf(s, w.id), null); });
T('warranty state: active / last day / expired are exact', () => { const w = { end: '2026-06-30' }; assert(L.warrantyState(w, '2026-06-29').active); const last = L.warrantyState(w, '2026-06-30'); assert(last.active && last.text === 'Last day'); const ex = L.warrantyState(w, '2026-07-01'); assert(ex.expired && !ex.active); assert(L.warrantyState(w, '2026-06-10').expiringSoon); assert(!L.warrantyState(w, '2026-05-01').expiringSoon); });
T('editing start date or months recalculates the expiry automatically', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, '2026-01-15', 'Handed Over')); const wr = L.warrantyOf(s, w.id); const r = ok(s.update('warranties', wr.id, { start: '2026-03-31', months: 6 })); assert.strictEqual(r.end, '2026-09-30'); });
T('a manually typed expiry date is ignored — expiry is always calculated', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); const r = ok(s.create('warranties', { client: d.cl.id, candidate: w.id, start: '2026-01-01', months: 9, end: '2030-01-01' }, { scope: 'Domestic' })); assert.strictEqual(r.end, '2026-10-01'); });
T('start differing from the recorded handover date is flagged for the client to confirm (not silently changed)', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, '2026-01-15', 'Handed Over')); const wr = L.warrantyOf(s, w.id); assert(!L.startMismatch(s, wr)); ok(s.update('warranties', wr.id, { start: '2026-01-20' })); assert(L.startMismatch(s, s.get('warranties', wr.id))); assert.strictEqual(s.get('warranties', wr.id).start, '2026-01-20'); });
T('open complaint → resolved; counters follow', () => {
  const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, ago(60), 'Handed Over')); const wr = L.warrantyOf(s, w.id);
  ok(s.update('warranties', wr.id, { reason: 'Left the house', claimDate: ago(20), claimType: 'Replacement', status: 'Open' })); assert(L.warrantyState(s.get('warranties', wr.id)).open);
  ok(s.update('warranties', wr.id, { status: 'Resolved', resolutionDate: ago(10) })); assert(!L.warrantyState(s.get('warranties', wr.id)).open); assert.deepStrictEqual(s.historyOf('warranties', wr.id, 'status').map(h => h.to), ['Active', 'Open', 'Resolved']);
});
T('complaint date before the warranty start, or resolved before complaint, is rejected', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, '2026-03-01', 'Handed Over')); const wr = L.warrantyOf(s, w.id); assert(!s.update('warranties', wr.id, { claimDate: '2026-02-01', reason: 'x' }).ok); assert(!s.update('warranties', wr.id, { claimDate: '2026-04-01', resolutionDate: '2026-03-15', reason: 'x' }).ok); });
T('replacement worker must be a different worker of the same sponsor', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'), r2 = d.cand('2'); ok(upd(s, w, ago(40), 'Handed Over')); const wr = L.warrantyOf(s, w.id); assert(!s.update('warranties', wr.id, { replacementCandidate: w.id, claimType: 'Replacement' }).ok); assert(s.update('warranties', wr.id, { replacementCandidate: r2.id, claimType: 'Replacement', reason: 'r', claimDate: ago(5) }).ok); const other = mk(s, 'clients', 'Domestic', { name: 'Sponsor 2' }); const o3 = mk(s, 'candidates', 'Domestic', { name: 'Elsewhere', client: other.id }); assert(!s.update('warranties', wr.id, { replacementCandidate: o3.id }).ok); });
T('only one warranty per worker', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, ago(40), 'Handed Over')); const r = s.create('warranties', { client: d.cl.id, candidate: w.id, start: ago(40), months: 9 }, { scope: 'Domestic' }); assert(!r.ok && /Duplicate/.test(Object.values(r.errors).join(' '))); });
T('refund amount without a refund claim type produces a warning', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); ok(upd(s, w, ago(40), 'Handed Over')); const r = s.update('warranties', L.warrantyOf(s, w.id).id, { refundAmount: 500, claimType: 'Replacement', reason: 'x', claimDate: ago(3) }); assert(r.ok && r.warnings.some(x => /refund/i.test(x))); });
T('warranty belongs to Domestic workers only', () => { const s = fresh(); const x = bc(s); const c = x.cand('1'); const r = s.create('warranties', { client: x.cl.id, candidate: c.id, start: ago(5), end: ago(-100) }, { scope: 'Domestic' }); assert(!r.ok); });
T('Domestic workflow rejects Blue-Collar-only and Corporate-only stages', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); assert(!upd(s, w, ago(1), 'Deployed').ok); assert(!upd(s, w, ago(1), 'Joined').ok); assert(upd(s, w, ago(1), 'Handed Over').ok); });
T('worker without a Domestic order field set uses Domestic fields (category list, no agency)', () => { const s = fresh(); const f = s.fieldsFor('candidates', 'Domestic').map(x => x.key); assert(!f.includes('agency') && !f.includes('deploymentDate') && !f.includes('joiningDate') && f.includes('handoverDate')); });

G('D. Corporate workflow and placement fees');
let corpN = 0;
function corp(s, order) { const cl = mk(s, 'clients', 'Corporate', { name: 'Corp Co ' + (++corpN) }); const o = mk(s, 'orders', 'Corporate', Object.assign({ client: cl.id, trade: 'Accountant', quantity: 2, basicSalary: 8000 }, order || {})); const cand = (n, sal) => mk(s, 'candidates', 'Corporate', { name: 'P' + n, client: cl.id, order: o.id, passport: 'C-' + n, salary: sal }); return { cl, o, cand }; }
T('Corporate stage list is Candidate → Interview → Selection → Offer → Joining (no visa/ticket stages)', () => { const st = L.stagesFor('Corporate'); assert(st.includes('Offer Issued') && st.includes('Joined') && !st.includes('Visa Printed') && !st.includes('Deployed')); });
T('Joined update records the joining date', () => { const s = fresh(); const x = corp(s, { feeBasis: '1 month', paymentMilestone: 1 }); const c = x.cand('1', 8000); ok(upd(s, c, '2026-03-10', 'Joined')); assert.strictEqual(s.get('candidates', c.id).joiningDate, '2026-03-10'); });
T('fee basis: 1 month, 0.5 month and custom amount', () => {
  const s = fresh(); const a = corp(s, { feeBasis: '1 month' }), c1 = a.cand('1', 9000); assert.strictEqual(L.placementFee(a.o, c1).fee, 9000);
  const b = corp(s, { feeBasis: '0.5 month' }); const c2 = mk(s, 'candidates', 'Corporate', { name: 'Q', client: b.cl.id, order: b.o.id, passport: 'C-9', salary: 7000 }); assert.strictEqual(L.placementFee(b.o, c2).fee, 3500);
  assert.strictEqual(L.placementFee({ feeBasis: 'Custom', customFee: 1234.5 }, c1).fee, 1234.5);
});
T('custom fee amount is required when the basis is Custom', () => { const s = fresh(); const cl = mk(s, 'clients', 'Corporate', { name: 'Z' }); const r = s.create('orders', { client: cl.id, trade: 'T', quantity: 1, feeBasis: 'Custom' }, { scope: 'Corporate' }); assert(!r.ok && r.errors.customFee); });
T('fee falls back to the order salary when the candidate has none; missing basis is reported', () => { const s = fresh(); const x = corp(s, { feeBasis: '1 month' }); const c = x.cand('1', ''); assert.strictEqual(L.placementFee(x.o, c).fee, 8000); assert(!L.placementFee({}, c).ok); });
T('receivables: due = joining + invoice months; received reduces outstanding; overdue flagged', () => {
  const s = fresh(); const x = corp(s, { feeBasis: '1 month', paymentMilestone: 1 }); const c = x.cand('1', 8000); ok(upd(s, c, ago(60), 'Joined'));
  mk(s, 'accounts', 'Corporate', { client: x.cl.id, candidate: c.id, kind: 'Invoice', amount: 8000, date: ago(30) }); mk(s, 'accounts', 'Corporate', { client: x.cl.id, candidate: c.id, kind: 'Payment received', amount: 3000, date: ago(5) });
  const r = L.corporateReceivables(s)[0]; assert.strictEqual(r.fee, 8000); assert.strictEqual(r.due, U.addMonths(ago(60), 1)); assert.strictEqual(r.invoiced, 8000); assert.strictEqual(r.received, 3000); assert.strictEqual(r.outstanding, 5000); assert(r.overdue);
});
T('only Joined candidates appear in placement fees', () => { const s = fresh(); const x = corp(s, { feeBasis: '1 month' }); const c = x.cand('1', 8000); ok(upd(s, c, ago(5), 'Offer Issued')); assert.strictEqual(L.corporateReceivables(s).length, 0); });

G('E. Division isolation (no mixing)');
T('each division has its own stage vocabulary and only its own fields', () => { const s = fresh(); const keys = d => s.fieldsFor('candidates', d).map(f => f.key); assert(keys('Blue-Collar').includes('agency') && !keys('Corporate').includes('agency')); assert(keys('Corporate').includes('joiningDate') && !keys('Blue-Collar').includes('joiningDate')); assert(keys('Domestic').includes('handoverDate') && !keys('Corporate').includes('handoverDate')); });
T('seeded dashboards count each division separately and add up to the global total', () => {
  const s = fresh(); L.seed(s); const per = C.scope.values.map(d => s.count('candidates', { division: d })); assert(per.every(n => n > 0)); assert.strictEqual(per.reduce((a, b) => a + b, 0), s.count('candidates'));
  C.scope.values.forEach(d => { assert.strictEqual(s.count('orders', { division: d }), s.list('orders').filter(o => o.division === d).length); });
});
T('Blue-Collar agency ledger never includes Domestic or Corporate records', () => { const s = fresh(); L.seed(s); const rows = L.agencyLedger(s).rows; assert(rows.every(r => r.allocation.division === 'Blue-Collar')); const d = s.list('candidates', { division: 'Domestic' }); assert(d.every(c => !L.agencyLedger(s).rows.some(r => r.allocation.order === c.order))); });
T('a candidate of one division cannot appear in another division\'s documents / interviews', () => { const s = fresh(); const d = dm(s); const w = d.cand('1'); const x = bc(s); const r = s.create('interviews', { client: x.cl.id, candidate: w.id, date: ago(1) }, { scope: 'Blue-Collar' }); assert(!r.ok); });
T('Corporate has no ticket fields and Domestic warranty differs from the generic one', () => { const s = fresh(); assert.strictEqual(s.fieldsFor('tickets', 'Corporate').length, 0); assert(s.fieldsFor('warranties', 'Domestic').some(f => f.key === 'months') && !s.fieldsFor('warranties', 'Corporate').some(f => f.key === 'months')); });

G('F. CSV import / export');
const IMP = ERP.importer;
T('template contains the field keys of the chosen division only', () => { const s = fresh(); const t = IMP.template(s, 'candidates', 'Corporate'); assert(/joiningDate/.test(t) && !/agency/.test(t)); });
T('CSV parser handles quotes, commas, embedded newlines and BOM', () => { const r = U.csvParse('﻿a,b\r\n"x, y","he said ""hi"""\r\n"line1\nline2",z\r\n'); assert.deepStrictEqual(r, [['a', 'b'], ['x, y', 'he said "hi"'], ['line1\nline2', 'z']]); });
T('preview classifies rows as new / duplicate / invalid with reasons, and writes nothing', () => {
  const s = fresh(); mk(s, 'clients', 'Blue-Collar', { name: 'Existing Co' });
  const csv = 'name,phone,email\nNew Co,123,a@b.co\nExisting Co,1,\n,2,\nBad Mail,3,nope\nNew Co,9,\n';
  const res = IMP.analyse(s, 'clients', 'Blue-Collar', csv); assert(res.ok); assert.deepStrictEqual(res.items.map(i => i.status), ['new', 'duplicate', 'invalid', 'invalid', 'duplicate']); assert.strictEqual(s.count('clients'), 1);
  assert(/required/i.test(res.items[2].errors.join(' ')) && /e-mail/i.test(res.items[3].errors.join(' ')));
});
T('commit adds only valid rows, atomically, with audit entry', () => { const s = fresh(); const res = IMP.analyse(s, 'clients', 'Blue-Collar', 'name\nA Co\nB Co\nA Co\n'); const r = IMP.commit(s, 'clients', 'Blue-Collar', res.items, 'tester'); assert.strictEqual(r.added, 2); assert.strictEqual(s.count('clients'), 2); assert(s.audit.some(a => a.action === 'import')); });
T('linked columns accept the record name or id; unknown names are rejected', () => { const s = fresh(); const cl = mk(s, 'clients', 'Blue-Collar', { name: 'Link Co' }); const res = IMP.analyse(s, 'orders', 'Blue-Collar', 'client,trade,quantity\nLink Co,Welder,2\nCL-0001,Mason,3\nNo Such Co,Cook,1\n'); assert.deepStrictEqual(res.items.map(i => i.status), ['new', 'new', 'invalid']); IMP.commit(s, 'orders', 'Blue-Collar', res.items); assert.strictEqual(s.count('orders'), 2); assert.strictEqual(s.list('orders')[0].client, cl.id); });
T('imported rows go to the chosen division only and respect its field set', () => { const s = fresh(); const res = IMP.analyse(s, 'clients', 'Domestic', 'name,qid\nSponsor Z,Q123\n'); IMP.commit(s, 'clients', 'Domestic', res.items); const c = s.list('clients')[0]; assert.strictEqual(c.division, 'Domestic'); assert.strictEqual(c.qid, 'Q123'); });
T('day-first dates (DD/MM/YYYY) are converted; impossible dates rejected', () => { const s = fresh(); const cl = mk(s, 'clients', 'Blue-Collar', { name: 'D Co' }); const res = IMP.analyse(s, 'orders', 'Blue-Collar', 'client,trade,quantity,orderDate\nD Co,A,1,05/03/2026\nD Co,B,1,31/02/2026\n'); assert.strictEqual(res.items[0].values.orderDate, '2026-03-05'); assert.strictEqual(res.items[1].status, 'invalid'); });
T('file with no matching columns is refused; empty file is refused', () => { const s = fresh(); assert(!IMP.analyse(s, 'clients', 'Blue-Collar', 'foo,bar\n1,2\n').ok); assert(!IMP.analyse(s, 'clients', 'Blue-Collar', 'name\n').ok); });
T('export neutralises spreadsheet formula injection and round-trips through import', () => {
  const s = fresh(); mk(s, 'clients', 'Blue-Collar', { name: '=HYPERLINK("http://x")', phone: '+974 1' }); mk(s, 'clients', 'Blue-Collar', { name: 'Normal Co' });
  const csv = IMP.exportRows(s, 'clients', 'Blue-Collar', s.list('clients')); assert(/"'=HYPERLINK/.test(csv)); assert(!/"=HYPERLINK/.test(csv)); assert(/"\+974 1"|"'\+974 1"/.test(csv));
});
T('importing the app\'s own export gives duplicates, not double records', () => { const s = fresh(); L.seed(s); const csv = IMP.exportRows(s, 'clients', 'Domestic', s.list('clients', { division: 'Domestic' })); const res = IMP.analyse(s, 'clients', 'Domestic', csv); assert(res.items.every(i => i.status === 'duplicate')); });

G('G. Backup / restore');
T('backup → restore into an empty store reproduces every table, counters and history', () => { const a = fresh(); L.seed(a); const b = fresh(); const r = b.restore(JSON.parse(JSON.stringify(a.exportJSON()))); assert(r.ok); Object.keys(C.entities).forEach(k => assert.deepStrictEqual(b.list(k), a.list(k), k)); assert.deepStrictEqual(b.counters, a.counters); assert.strictEqual(b.history.length, a.history.length); assert.strictEqual(mk(b, 'clients', 'Blue-Collar', { name: 'After restore' }).id, 'CL-' + U.pad(a.counters.clients + 1, 4)); });
T('a backup of another project is rejected and changes nothing', () => { const s = fresh(); mk(s, 'clients', 'Blue-Collar', { name: 'Keep' }); const r = s.restore({ format: 'erp-backup', projectId: 'some-crm', data: { leads: [] } }); assert(!r.ok && /another project/.test(r.errors[0])); assert.strictEqual(s.count('clients'), 1); });
T('corrupt backups are rejected (not an object, missing data, duplicate ids, wrong list type)', () => { const s = fresh(); assert(!s.restore(null).ok); assert(!s.restore({ format: 'erp-backup', projectId: C.id }).ok); assert(!s.restore({ format: 'erp-backup', projectId: C.id, data: { clients: [{ id: 'CL-1' }, { id: 'CL-1' }] } }).ok); assert(!s.restore({ format: 'erp-backup', projectId: C.id, data: { clients: 'x' } }).ok); assert(!s.restore({ projectId: C.id, data: {} }).ok); });
T('dangling references in a backup are reported as warnings', () => { const s = fresh(); const r = s.restore({ format: 'erp-backup', projectId: C.id, data: { orders: [{ id: 'ORD-0001', client: 'CL-0042', division: 'Blue-Collar' }] } }); assert(r.ok && r.warnings.length === 1); });
T('restore replaces current data (does not merge) and is written to the audit log', () => { const a = fresh(); mk(a, 'clients', 'Blue-Collar', { name: 'In backup' }); const bk = a.exportJSON(); const b = fresh(); mk(b, 'clients', 'Domestic', { name: 'Will vanish' }); b.restore(bk); assert.deepStrictEqual(b.list('clients').map(c => c.name), ['In backup']); assert(b.audit.some(x => x.action === 'restore')); });

G('H. Dashboard traceability (no static numbers)');
T('every dashboard card value is a function of the data', () => { const cards = [].concat(C.overview.cards, ...Object.values(C.home).map(h => h.cards)); assert(cards.length > 30); cards.forEach(c => assert.strictEqual(typeof c.value, 'function', c.label)); });
T('every counter changes when the underlying data changes', () => {
  const s = fresh(); const before = {}; const cards = [].concat(...Object.entries(C.home).map(([d, h]) => h.cards.map(c => [d, c])));
  const snap = () => cards.map(([d, c]) => c.value(s, d)); const empty = snap(); L.seed(s); const full = snap(); const same = cards.map(([d, c], i) => [d + ' / ' + c.label, empty[i] === full[i]]).filter(x => x[1]).map(x => x[0]); const allowed = ['Blue-Collar / Documents', 'Domestic / Documents', 'Corporate / Documents', 'Domestic / Handed over, no warranty', 'Domestic / Overdue follow-ups', 'Corporate / Overdue invoices']; assert.deepStrictEqual(same.filter(x => !allowed.includes(x)), [], 'counters that did not react to seeded data');
});
T('overview totals equal independent counts of the raw tables', () => { const s = fresh(); L.seed(s); const g = {}; C.overview.cards.forEach(c => { g[c.label] = c.value(s); }); assert.strictEqual(g['Candidates'], s.raw.data.candidates.length); assert.strictEqual(g['Orders'], s.raw.data.orders.length); assert.strictEqual(g['Clients / Sponsors'], s.raw.data.clients.length); assert.strictEqual(g['Interview records'], s.raw.data.interviews.length); assert.strictEqual(g['Tickets'], s.raw.data.tickets.length); });
T('stage cards equal the number of candidates currently at that stage', () => { const s = fresh(); L.seed(s); Object.keys(C.stages).forEach(d => C.stages[d].forEach(st => assert.strictEqual(L.stageCount(s, st, d), s.raw.data.candidates.filter(c => c.division === d && c.stage === st).length))); });
T('agency totals equal an independent recomputation from candidates and accounts', () => { const s = fresh(); L.seed(s); let earned = 0, paid = 0; s.raw.data.allocations.forEach(a => { const n = s.raw.data.candidates.filter(c => c.order === a.order && c.agency === a.agency && c.deploymentDate).length; earned += n * a.fee; }); s.raw.data.accounts.filter(a => a.kind === 'Payment received' && a.allocation).forEach(a => { paid += a.amount; }); const t = L.agencyLedger(s).totals; assert.strictEqual(t.earned, earned); assert.strictEqual(t.paid, paid); assert.strictEqual(t.outstanding, earned - paid); });
T('seeded history proves the stage counters came from daily updates, not typed values', () => { const s = fresh(); L.seed(s); const moved = s.raw.data.candidates.filter(c => c.stage !== 'CV Received'); assert(moved.length > 0); moved.forEach(c => assert(s.history.some(h => h.recordId === c.id && h.field === 'stage' && h.to === c.stage && h.updateId), c.id + ' has an update-linked history event')); });
T('every alert is computed from data (none on an empty database)', () => { const s = fresh(); assert.strictEqual(C.alerts(s).length, 0); L.seed(s); assert(C.alerts(s).length > 0); });
T('every report returns rows consistent with its column keys', () => { const s = fresh(); L.seed(s); Object.keys(C.reports).forEach(id => { const r = C.reports[id]; (r.scoped ? C.scope.values : [r.scope]).forEach(sc => { const rows = r.rows(s, sc); rows.forEach(row => r.columns.forEach(c => assert(c.key in row, id + ' missing ' + c.key))); }); }); });

T('the counters left at 0 by the demo data react when their situation is created', () => {
  const s = fresh(); const card = (d, l) => C.home[d].cards.find(c => c.label === l).value(s, d);
  const x = bc(s); const c = x.cand('1'); mk(s, 'documents', 'Blue-Collar', { client: x.cl.id, type: 'CV' }); assert.strictEqual(card('Blue-Collar', 'Documents'), 1); assert.strictEqual(card('Blue-Collar', 'Agencies'), 1);
  const d = dm(s); const w = d.cand('1'); ok(upd(s, w, ago(5), 'Interviewed', { nextAction: 'Call sponsor', dueDate: ago(1) })); assert.strictEqual(card('Domestic', 'Overdue follow-ups'), 1);
  L.AUTO_WARRANTY = false; try { const w2 = d.cand('2'); ok(upd(s, w2, ago(5), 'Handed Over')); assert.strictEqual(card('Domestic', 'Handed over, no warranty'), 1); } finally { L.AUTO_WARRANTY = true; }
  const k = corp(s, { feeBasis: '1 month', paymentMilestone: 1 }); const p = k.cand('1', 8000); ok(upd(s, p, ago(90), 'Joined')); assert.strictEqual(card('Corporate', 'Overdue invoices'), 1);
});

G('I. Configuration sanity');
T('every field of every division is well-formed (key, label, known type, refs exist)', () => { const types = ['text', 'number', 'date', 'select', 'ref', 'email', 'textarea']; Object.keys(C.entities).forEach(k => { const e = C.entities[k]; const sets = Array.isArray(e.fields) ? [e.fields] : Object.values(e.fields); sets.forEach(fs => fs.forEach(f => { assert(f.key && f.label, k + ' field'); assert(types.includes(f.type), k + '.' + f.key + ' type ' + f.type); if (f.type === 'ref') assert(C.entities[f.ref], k + '.' + f.key + ' -> ' + f.ref); if (f.type === 'select') assert(f.options, k + '.' + f.key); })); }); });
T('no duplicate field keys inside one field set', () => { Object.keys(C.entities).forEach(k => { const e = C.entities[k]; const sets = Array.isArray(e.fields) ? [e.fields] : Object.values(e.fields); sets.forEach(fs => { const ks = fs.map(f => f.key); assert.strictEqual(new Set(ks).size, ks.length, k); }); }); });
T('every table column and filter points to a real field or computed column', () => { const s = fresh(); Object.keys(C.entities).forEach(k => { const e = C.entities[k]; C.scope.values.forEach(d => { const fk = s.fieldsFor(k, d).map(f => f.key); if (!fk.length) return; const cols = Array.isArray(e.columns) ? e.columns : (e.columns && e.columns[d]) || []; cols.forEach(c => assert(c === 'id' || c === 'createdAt' || (e.computed || {})[c] || fk.includes(c), k + '/' + d + ' column ' + c)); (e.filters || []).forEach(f => assert(C.scope.values.some(dd => s.fieldsFor(k, dd).some(x => x.key === f)), k + ' filter ' + f + ' exists in no division')); }); }); });
T('every navigation item resolves to a table or report that exists', () => { Object.values(C.nav.scope).forEach(items => items.forEach(i => { if (i.view === 'entity') assert(C.entities[i.entity], i.entity); if (i.view === 'report') assert(C.reports[i.id], i.id); })); });
T('the core scripts contain no Leads Global / recruitment wording', () => { const dir = path.join(root, 'core'); const bad = /(leads global|blue-collar|domestic|warranty|candidate|sponsor|qvc|manpower)/i; const walk = d => fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) return walk(p); const t = fs.readFileSync(p, 'utf8'); const m = t.match(bad); assert(!m, f + ' mentions "' + (m && m[0]) + '"'); }); walk(dir); });

/* ---------------- report ---------------- */
const failed = results.filter(r => !r.ok);
const groups = [...new Set(results.map(r => r.group))];
groups.forEach(g => { const rs = results.filter(r => r.group === g); console.log('\n' + g + '  (' + rs.filter(r => r.ok).length + '/' + rs.length + ')'); rs.forEach(r => console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.name + (r.ok ? '' : '\n        → ' + r.error))); });
console.log('\n' + (results.length - failed.length) + ' / ' + results.length + ' passed');
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ ranAt: new Date().toISOString(), total: results.length, passed: results.length - failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);

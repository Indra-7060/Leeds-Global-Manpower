/* Logic test-suite. Run:  node tests/run-tests.js      (no dependencies; uses fictional data only) */
'use strict';
const assert = require('assert/strict');
const { load } = require('./harness');
const { buildXlsx } = require('./xlsx-builder');

const results = []; let currentGroup = '';
// Objects built inside the vm sandbox have a different Array prototype; compare by value via JSON.
const deq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
const group = n => { currentGroup = n; console.log('\n# ' + n); };
async function test(name, fn) {
  try { await fn(); results.push({ group: currentGroup, name, ok: true }); console.log('  PASS  ' + name); }
  catch (e) { results.push({ group: currentGroup, name, ok: false, err: e.message }); console.log('  FAIL  ' + name + '\n        ' + e.message.split('\n').join('\n        ')); }
}
const fresh = (o) => { const a = load(o); a.LGM.Store.init('demo'); return a; };
const csvFile = (name, text) => ({ name, text: async () => text, arrayBuffer: async () => Buffer.from(text) });
const xlsxFile = (name, buf) => ({ name, text: async () => '', arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });

(async () => {
  // ------------------------------------------------------------------ utilities
  group('Utilities & CSV');
  const { LGM: L0 } = load();
  const U = L0.Util, Csv = L0.Csv;
  await test('parseDate: ISO, day-first, 2-digit year, month names', () => {
    assert.equal(U.parseDate('2026-11-05'), '2026-11-05'); assert.equal(U.parseDate('05/11/2026'), '2026-11-05');
    assert.equal(U.parseDate('5-11-26'), '2026-11-05'); assert.equal(U.parseDate('05 Nov 2026'), '2026-11-05'); assert.equal(U.parseDate('5.11.2026'), '2026-11-05');
  });
  await test('parseDate: rejects impossible/ambiguous values', () => {
    for (const bad of ['31/02/2026', '99/99/2026', '2026', 'abc', '', null, '2026-13-01']) assert.equal(U.parseDate(bad), null, String(bad));
  });
  await test('parseDate: Excel serial numbers (45292 = 2024-01-01)', () => { assert.equal(U.parseDate('45292'), '2024-01-01'); assert.equal(U.serialToISO(25569), '1970-01-01'); });
  await test('addMonths clamps month-end; diffDays', () => {
    assert.equal(U.addMonths('2026-09-20', 3), '2026-12-20'); assert.equal(U.addMonths('2026-11-30', 3), '2027-02-28'); assert.equal(U.addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(U.diffDays('2026-11-05', '2026-12-20'), 45);
  });
  await test('CSV parse: quotes, commas, embedded newline, BOM, escaped quotes', () => {
    const rows = Csv.parse('﻿a,b,c\r\n"x, y","line1\nline2","he said ""hi"""\r\n');
    deq(rows, [['a', 'b', 'c'], ['x, y', 'line1\nline2', 'he said "hi"']]);
  });
  await test('CSV parse: semicolon and tab delimiters auto-detected; quoted delimiter preserved', () => {
    deq(Csv.parse('a;b\n1;2'), [['a', 'b'], ['1', '2']]); deq(Csv.parse('a\tb\n"1,5"\t2'), [['a', 'b'], ['1,5', '2']]);
  });
  await test('CSV stringify: quotes everything, doubles quotes, keeps comma inside company name (V6 defect D-7)', () => {
    assert.equal(Csv.stringify([['Smith, Jones & Co', 'say "x"']]), '"Smith, Jones & Co","say ""x"""');
  });
  await test('CSV stringify: neutralises formula injection but leaves negative numbers alone', () => {
    assert.equal(Csv.stringify([['=1+1', '+SUM(A1)', '@cmd', '-abc', '-5', 12]]), `"'=1+1","'+SUM(A1)","'@cmd","'-abc","-5","12"`);
  });

  // ------------------------------------------------------------------ lifecycle
  group('Candidate lifecycle (V6 stage order, optional-stage skipping)');
  const Lc = L0.Lifecycle;
  await test('14 V6 stages in V6 order', () => deq(L0.Config.stages, ['CV Submitted', 'Client Review', 'Interview', 'Selected', 'Offer Accepted', 'Pre-Medical', 'Visa Applied', 'QVC', 'RTP', 'Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty']));
  await test('Next stage is the V6 +1 step', () => assert.equal(Lc.moves('Client Review')[0].to, 'Interview'));
  await test('Pre-Medical may be skipped (V6: "if required")', () => deq(Lc.moves('Offer Accepted').map(m => m.to), ['Pre-Medical', 'Visa Applied']));
  await test('QVC may be skipped (V6: "if applicable")', () => deq(Lc.moves('Visa Applied').map(m => m.to), ['QVC', 'RTP']));
  await test('Non-optional stages cannot be skipped', () => { assert.equal(Lc.canMove('CV Submitted', 'Interview'), false); assert.equal(Lc.canMove('RTP', 'Arrived'), false); });
  await test('Reject only from screening stages; terminal stages have no moves', () => {
    assert.ok(Lc.canMove('Interview', 'Rejected')); assert.equal(Lc.canMove('Selected', 'Rejected'), false);
    deq(Lc.moves('Warranty'), []); deq(Lc.moves('Rejected'), []);
  });

  // ------------------------------------------------------------------ store
  group('Data entry, editing, deletion, integrity');
  await test('Demo workspace seeds fictional data (40 candidates, 5 orders)', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(); assert.equal(s.candidates.length, 40); assert.equal(s.orders.length, 5);
    assert.ok(s.candidates.every(c => /^Demo Candidate/.test(c.name) && /^DEMO-P/.test(c.passport)), 'all seed candidates are visibly fictional');
  });
  await test('Order add: validated, id sequence continues from seed, never reused after delete (V6 defect fixed)', () => {
    const { LGM } = fresh(); const S = LGM.Store;
    const a = S.insert('orders', { client: 'Demo Facilities Co.', country: 'nepal', trade: 'Welder', qty: '25' }); assert.ok(a.ok); assert.equal(a.record.id, 'ORD-1006'); assert.equal(a.record.country, 'Nepal'); assert.equal(a.record.qty, 25); assert.equal(a.record.status, 'New Order');
    S.remove('orders', 'ORD-1006'); const b = S.insert('orders', { client: 'Demo Facilities Co.', country: 'Nepal', trade: 'Welder', qty: 25 }); assert.equal(b.record.id, 'ORD-1007');
  });
  await test('Order validation: qty must be whole number >= 1; trade/client required', () => {
    const S = fresh().LGM.Store;
    for (const qty of ['abc', '2.5', '0', '-3', '']) assert.equal(S.insert('orders', { client: 'X', country: 'Nepal', trade: 'T', qty }).ok, false, 'qty ' + qty);
    const r = S.insert('orders', { client: '', country: 'Nepal', trade: '', qty: 5 }); assert.ok(r.errors.client && r.errors.trade);
  });
  await test('Candidate id uses country prefix + running counter (BD-/NP-, as V6)', () => {
    const S = fresh().LGM.Store;
    const a = S.insert('candidates', { name: 'Test Bd', client: 'Demo Construction Ltd', country: 'Bangladesh', trade: 'Mason', passport: 'T-1' });
    const b = S.insert('candidates', { name: 'Test Np', client: 'Demo Construction Ltd', country: 'Nepal', trade: 'Mason', passport: 'T-2' });
    assert.equal(a.record.id, 'BD-1041'); assert.equal(b.record.id, 'NP-1042'); assert.equal(a.record.status, 'CV Submitted'); assert.equal(a.record.history.length, 1);
  });
  await test('Duplicate candidate blocked by passport (normalised) and by name+client when no passport (V6 keys)', () => {
    const S = fresh().LGM.Store;
    const d1 = S.insert('candidates', { name: 'Someone', client: 'C', country: 'Nepal', trade: 'T', passport: 'demo p0001' }); assert.equal(d1.ok, false); assert.match(d1.errors.passport, /Duplicate of BD-1001/);
    assert.ok(S.insert('candidates', { name: 'No Passport', client: 'Co A', country: 'Nepal', trade: 'T' }).ok);
    const d2 = S.insert('candidates', { name: 'no  passport', client: 'CO a', country: 'Nepal', trade: 'T' }); assert.equal(d2.ok, false);
    assert.ok(S.insert('candidates', { name: 'No Passport', client: 'Other Co', country: 'Nepal', trade: 'T' }).ok, 'same name, different client is allowed');
  });
  await test('Edit candidate keeps stage/history; duplicate check ignores itself', () => {
    const S = fresh().LGM.Store; const c = S.list('candidates')[5]; const before = c.status;
    const r = S.update('candidates', c.id, { trade: 'Plumber', passport: c.passport }); assert.ok(r.ok, JSON.stringify(r.errors)); assert.equal(S.get('candidates', c.id).trade, 'Plumber'); assert.equal(S.get('candidates', c.id).status, before);
  });
  await test('Stage changes: next/skip/reject go through the workflow and write history; illegal jump refused', () => {
    const S = fresh().LGM.Store; const c = S.insert('candidates', { name: 'Flow', client: 'A', country: 'Nepal', trade: 'T' }).record;
    assert.equal(S.moveCandidate(c.id, 'Interview').ok, false);
    assert.ok(S.moveCandidate(c.id, 'Client Review').ok); assert.ok(S.moveCandidate(c.id, 'Interview').ok); assert.ok(S.moveCandidate(c.id, 'Selected').ok);
    deq(S.get('candidates', c.id).history.map(h => h.stage), ['CV Submitted', 'Client Review', 'Interview', 'Selected']);
    assert.equal(S.moveCandidate(c.id, 'Rejected').ok, false, 'cannot reject after Selected');
    assert.ok(S.undoCandidate(c.id).ok); assert.equal(S.get('candidates', c.id).status, 'Interview');
  });
  await test('Skip optional stages end-to-end: Offer Accepted → Visa Applied → RTP', () => {
    const S = fresh().LGM.Store; const c = S.list('candidates').find(x => x.status === 'Offer Accepted');
    assert.ok(S.moveCandidate(c.id, 'Visa Applied').ok); assert.ok(S.moveCandidate(c.id, 'RTP').ok); assert.equal(S.get('candidates', c.id).status, 'RTP');
  });
  await test('Client rename rewrites linked orders/candidates; delete of used client/order is blocked', () => {
    const S = fresh().LGM.Store; const cl = S.list('clients').find(c => c.name === 'Demo Construction Ltd');
    assert.equal(S.remove('clients', cl.id).ok, false);
    assert.ok(S.update('clients', cl.id, { name: 'Demo Builders Ltd' }).ok);
    assert.ok(S.list('orders').some(o => o.client === 'Demo Builders Ltd') && !S.list('candidates').some(c => c.client === 'Demo Construction Ltd'));
    assert.equal(S.remove('orders', 'ORD-1001').ok, false);
  });
  await test('Client names are unique (case/space-insensitive)', () => assert.equal(fresh().LGM.Store.insert('clients', { name: ' demo   facilities co. ', stage: 'Active' }).ok, false));
  await test('Deleting a candidate removes its travel record and unlinks warranty cases', () => {
    const S = fresh().LGM.Store; const w = S.get('warranties', 'WR-101'); const cid = w.candidate_id; assert.ok(cid);
    assert.ok(S.list('tickets').some(t => t.candidate_id === cid)); assert.ok(S.remove('candidates', cid).ok);
    assert.ok(!S.list('tickets').some(t => t.candidate_id === cid)); assert.equal(S.get('warranties', 'WR-101').candidate_id, '');
  });
  await test('Travel record: one per candidate', () => {
    const S = fresh().LGM.Store; const t = S.list('tickets')[0]; const r = S.insert('tickets', { candidate_id: t.candidate_id, step: 'Pending' }); assert.equal(r.ok, false); assert.match(r.errors.candidate_id, /already has/);
  });
  await test('Warranty: labour expiry auto = start + 3 months; domestic is not auto-filled', () => {
    const S = fresh().LGM.Store;
    const a = S.insert('warranties', { division: 'Labour', client: 'X', issue: 'i', status: 'Pending', warranty_start: '2026-09-20' }); assert.equal(a.record.warranty_expiry, '2026-12-20');
    const b = S.insert('warranties', { division: 'Domestic', client: 'Y', issue: 'i', status: 'Pending', warranty_start: '2026-09-20' }); assert.equal(b.record.warranty_expiry, '');
    assert.equal(S.insert('warranties', { division: 'Labour', client: 'X', issue: 'i', status: 'Pending', warranty_start: '2026-09-20', warranty_expiry: '2026-09-01' }).ok, false);
  });
  await test('Credentials register refuses anything that looks like a password', () => {
    const S = fresh().LGM.Store; assert.equal(S.insert('credentials', { client: 'A', portal: 'MOL', record: 'password: abc123' }).ok, false); assert.ok(S.insert('credentials', { client: 'A', portal: 'MOL', record: 'Credentials on file' }).ok);
  });
  await test('Finance entry validation: positive amount, valid date, enums', () => {
    const S = fresh().LGM.Store; const base = { date: '2026-11-05', division: 'labour', direction: 'Incoming', account: 'Cash', party: 'P', category: 'Other', amount: 10 };
    assert.ok(S.insert('finance', base).ok);
    for (const bad of [{ amount: 0 }, { amount: -4 }, { amount: 'x' }, { date: '31/02/2026' }, { direction: 'Sideways' }, { party: '' }]) assert.equal(S.insert('finance', Object.assign({}, base, bad)).ok, false, JSON.stringify(bad));
  });
  await test('Activity log records changes (feeds Recent Activity)', () => {
    const S = fresh().LGM.Store; const n0 = S.state().activity.length; S.insert('orders', { client: 'Demo Facilities Co.', country: 'Nepal', trade: 'T', qty: 1 });
    assert.equal(S.state().activity.length, n0 + 1); assert.match(S.state().activity[0].text, /Order ORD-1006 added/);
  });

  // ------------------------------------------------------------------ workspaces / persistence
  group('Demo vs live separation, persistence, backup');
  await test('Changes persist across reloads (V6 lost them)', () => {
    const a = fresh(); a.LGM.Store.insert('orders', { client: 'Demo Facilities Co.', country: 'Nepal', trade: 'Persist', qty: 7 });
    const b = load({ storage: a.storage }); b.LGM.Store.init('demo'); assert.ok(b.LGM.Store.list('orders').some(o => o.trade === 'Persist'));
  });
  await test('Live workspace starts empty and is stored under a different key; demo untouched', () => {
    const a = fresh(); const S = a.LGM.Store; S.switchMode('live'); assert.equal(S.list('orders').length, 0);
    S.insert('orders', { client: 'Real Co', country: 'Nepal', trade: 'T', qty: 3 }); S.switchMode('demo'); assert.equal(S.list('orders').length, 5);
    assert.ok(a.storage['lgm_v6dev_data_live'] && a.storage['lgm_v6dev_data_demo']); S.switchMode('live'); assert.equal(S.list('orders').length, 1);
  });
  await test('Reset demo restores fictional sample only in demo mode', () => {
    const S = fresh().LGM.Store; S.insert('orders', { client: 'Demo Facilities Co.', country: 'Nepal', trade: 'T', qty: 1 }); assert.ok(S.resetDemo()); assert.equal(S.list('orders').length, 5);
    S.switchMode('live'); assert.equal(S.resetDemo(), false);
  });
  await test('Backup → clear → restore round-trip; foreign/corrupt files rejected', () => {
    const S = fresh().LGM.Store; const bk = JSON.parse(JSON.stringify(S.exportBackup())); S.clearWorkspace(); assert.equal(S.list('candidates').length, 0);
    assert.ok(S.importBackup(bk).ok); assert.equal(S.list('candidates').length, 40);
    assert.equal(S.importBackup({ app: 'other' }).ok, false); assert.equal(S.importBackup({ app: 'LGM-ERP-V6-Developed', data: { orders: 'x' } }).ok, false);
  });
  await test('Storage quota failure does not crash; app keeps working in memory and reports unsaved', () => {
    const a = load({ quotaFull: true }); a.LGM.Store.init('demo'); assert.equal(a.LGM.Store.list('candidates').length, 40); assert.equal(a.LGM.Store.isSaved(), false);
    assert.ok(a.LGM.Store.insert('orders', { client: 'Demo Facilities Co.', country: 'Nepal', trade: 'T', qty: 1 }).ok);
  });

  // ------------------------------------------------------------------ metrics
  group('Dashboard counters & reports are computed from records');
  await test('Labour dashboard on seed: pipeline groups are mutually exclusive and sum to all non-rejected candidates', () => {
    const { LGM } = fresh(); const m = LGM.Metrics.labour(LGM.Store.state());
    deq(m.groups.map(g => g.count), [14, 8, 8, 5]); assert.equal(m.openOrders, 5); assert.equal(m.cvsReceived, 40); assert.equal(m.visaPipeline, 8); assert.equal(m.readyToFly, 5);
    assert.equal(m.groups.reduce((a, g) => a + g.count, 0) + 4 /*deployed*/ + 1 /*rejected*/, 40);
  });
  await test('Counters update immediately when a record changes', () => {
    const { LGM } = fresh(); const S = LGM.Store, M = LGM.Metrics; const c = S.list('candidates').find(x => x.status === 'Client Review');
    S.moveCandidate(c.id, 'Interview'); const m = M.labour(S.state()); deq(m.groups.map(g => g.count), [13, 9, 8, 5]);
    S.insert('orders', { client: 'Demo Facilities Co.', country: 'Nepal', trade: 'T', qty: 1, status: 'Closed' }); assert.equal(M.labour(S.state()).openOrders, 5, 'closed order is not open');
  });
  await test('Master report: V6 formula Remaining = Demand − (Applied+QVC+RTP+Printed+Deployed)', () => {
    const { LGM } = fresh(); const m = LGM.Metrics.masterReport(LGM.Store.state());
    const r = n => m.rows.find(x => x.company === n);
    const c = r('Demo Contracting WLL'); deq([c.demand, c.applied, c.qvc, c.rtp, c.printed, c.deployed, c.remaining], [100, 3, 2, 2, 2, 0, 91]);
    const l = r('Demo Logistics Co.'); deq([l.demand, l.printed, l.deployed, l.remaining], [30, 1, 4, 25]);
    assert.equal(r('Demo Facilities Co.').remaining, 400);
    assert.equal(m.total.demand, 740); assert.equal(m.total.remaining, m.total.demand - (m.total.applied + m.total.qvc + m.total.rtp + m.total.printed + m.total.deployed));
  });
  await test('Master report filters: country and client search', () => {
    const { LGM } = fresh(); const M = LGM.Metrics, s = LGM.Store.state();
    assert.ok(M.masterReport(s, { country: 'Nepal' }).rows.every(r => r.country === 'Nepal'));
    const q = M.masterReport(s, { query: 'logist' }); assert.equal(q.rows.length, 1); assert.equal(q.rows[0].company, 'Demo Logistics Co.');
  });
  await test('Each candidate counted in one master-report stage only', () => {
    const { LGM } = fresh(); const m = LGM.Metrics.masterReport(LGM.Store.state()); const cols = LGM.Config.masterColumns;
    const inCols = LGM.Store.list('candidates').filter(c => cols.some(k => k.stages.includes(c.status))).length;
    assert.equal(cols.reduce((a, k) => a + m.total[k.key], 0), inCols);
  });
  await test('Visa and deployment cards', () => {
    const { LGM } = fresh(); const M = LGM.Metrics, s = LGM.Store.state();
    deq(M.visaCards(s), { applied: 3, qvc: 2, rtp: 2, printed: 3 }); const d = M.deployCards(s); assert.equal(d.readyToFly, 5); assert.equal(d.arrivalsVerified, 4);
    const pending = s.candidates.filter(c => ['Visa Printed', 'Deployment Ready'].includes(c.status)).filter(c => { const t = s.tickets.find(x => x.candidate_id === c.id); return !t || ['Pending', 'Request Booking'].includes(t.step); }).length;
    assert.equal(d.ticketsPending, pending);
  });
  await test('Deployment checklist derives from stage + travel record (no duplicated state)', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(); const w = s.candidates.find(c => c.status === 'Warranty'); const cl = LGM.Metrics.deploymentChecklist(s, w);
    deq(cl.map(x => x.done), [true, true, true, true, true, true]);
    const early = s.candidates.find(c => c.status === 'Offer Accepted'); assert.ok(LGM.Metrics.deploymentChecklist(s, early).every(x => !x.done));
  });
  await test('Domestic dashboard counters from cases', () => {
    const { LGM } = fresh(); deq(LGM.Metrics.domestic(LGM.Store.state()), { enquiries: 3, profilesShared: 3, visaCases: 1, handovers: 1 });
  });
  await test('Finance totals per division: net = incoming − outgoing (V6)', () => {
    const { LGM } = fresh(); const M = LGM.Metrics, s = LGM.Store.state();
    deq(M.financeTotals(s, 'labour'), { count: 4, incoming: 8600, outgoing: 20300, net: -11700 }); deq(M.financeTotals(s, 'domestic'), { count: 2, incoming: 12000, outgoing: 3000, net: 9000 });
    const all = M.financeTotals(s, 'all'); assert.equal(all.count, 6); assert.equal(all.net, 8600 + 12000 - 20300 - 3000);
  });
  await test('Costing (V6 formula): Nepal defaults 100 × (1500 − 860) = 64,000; Bangladesh with/without investment; negatives treated as 0', () => {
    const M = fresh().LGM.Metrics; const nep = M.costingDefaults('Nepal'), bd = M.costingDefaults('Bangladesh');
    deq(nep, { client: 860, revenue: 1500, investment: 0 }); deq(bd, { client: 2500, revenue: 4000, investment: 300 });
    deq(M.costing({ qty: 100, revenue: 1500, client: 860, investment: 0, investmentTreatment: 'extra' }), { revenue: 150000, cost: 86000, profit: 64000 });
    assert.equal(M.costing({ qty: 10, revenue: 4000, client: 2500, investment: 300, investmentTreatment: 'extra' }).profit, 12000);
    assert.equal(M.costing({ qty: 10, revenue: 4000, client: 2500, investment: 300, investmentTreatment: 'included' }).profit, 15000);
    assert.equal(M.costing({ qty: 10, revenue: 100, client: -50, partner: 20, other: 5, investmentTreatment: 'extra' }).cost, 250); assert.equal(M.costing({ qty: -5, revenue: 100 }).revenue, 0);
  });
  await test('Seed leaves one flight-ready candidate without a travel record → reminders fire', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(); const ready = s.candidates.filter(c => ['Visa Printed', 'Deployment Ready'].includes(c.status));
    assert.equal(ready.filter(c => !s.tickets.some(t => t.candidate_id === c.id)).length, 1);
    const a = LGM.Alerts.compute(s, '2026-11-05'); assert.ok(a.find(x => x.id === 'ticket-responsibility').count >= 1); assert.ok(a.find(x => x.id === 'driver').count >= 1);
  });
  await test('Alerts are rule-driven; warranty alert depends on date window', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(); const a = LGM.Alerts.compute(s, '2026-11-05'); const by = id => a.find(x => x.id === id);
    assert.equal(by('qvc').count, 2); assert.equal(by('followup').count, 1); assert.equal(by('warranty-expiry'), undefined);
    assert.equal(LGM.Alerts.compute(s, '2026-12-01').find(x => x.id === 'warranty-expiry').count, 1);
  });

  // ------------------------------------------------------------------ import
  group('Excel / CSV import — validation, duplicates, relationships');
  const CSV = [
    'Name,Passport,Client,Country,Trade,Status,QVC Date,Order ID',
    'Test Alpha,TST-001,Demo Construction Ltd,Bangladesh,Steel Fixer,QVC,15/10/2026,ORD-1002',
    'Test Beta,TST-002,Demo Construction Ltd,Bangladesh,Mason,Visa Applied,,',
    'Test Gamma,DEMO-P0001,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,,',
    'Test Delta,TST-001,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,,',
    'Test Epsilon,TST-005,Demo Construction Ltd,Bangladesh,Mason,Banana,,',
    ',TST-006,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,,',
    'Test Zeta,TST-007,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,99/99/2026,',
    'Test Eta,TST-008,Demo Unlisted Co,Sri Lanka,Welder,,,',
  ].join('\n');
  async function analyseCsv(a, text, role = 'md', target = 'candidates') {
    const f = await a.LGM.Importer.readFile(csvFile('test.csv', text)); const map = a.LGM.Importer.guessMapping(target, f.columns);
    return { f, map, mapped: a.LGM.Importer.mapRows(target, f.rows, map), an: a.LGM.Importer.analyse(target, a.LGM.Importer.mapRows(target, f.rows, map), a.LGM.Store.state(), role, a.LGM.Store) };
  }
  await test('Column mapping guessed from V6 aliases', async () => {
    const a = fresh(); const { map } = await analyseCsv(a, CSV); deq([map.candidate_name, map.passport, map.client, map.status, map.qvc_date, map.order_id], ['0', '1', '2', '5', '6', '7']);
  });
  await test('Candidate import analysis: 3 valid, 2 duplicates (existing passport + same-file), 3 rejected with reasons', async () => {
    const a = fresh(); const { an } = await analyseCsv(a, CSV);
    assert.equal(an.valid.length, 3); assert.equal(an.duplicates.length, 2); assert.equal(an.invalid.length, 3);
    const why = r => an.invalid.find(x => x.row === r).errors.join(' ');
    assert.match(why(5), /Unknown status "Banana"/); assert.match(why(6), /Missing required: candidate name/); assert.match(why(7), /QVC date is not a valid date/);
    deq(an.duplicates.map(d => d.row), [3, 4]);
  });
  await test('Nothing is written during analysis (dry run)', async () => { const a = fresh(); await analyseCsv(a, CSV); assert.equal(a.LGM.Store.list('candidates').length, 40); });
  await test('Commit: imported rows land in the SAME list the Candidates page reads and move dashboard counters (V6 defect D-1)', async () => {
    const a = fresh(); const { an, f } = await analyseCsv(a, CSV); const before = a.LGM.Metrics.labour(a.LGM.Store.state());
    const res = a.LGM.Importer.commit(an, { fileName: f.fileName }, a.LGM.Store, 'md'); assert.equal(res.added, 3); assert.equal(a.LGM.Store.list('candidates').length, 43);
    const alpha = a.LGM.Store.list('candidates').find(c => c.name === 'Test Alpha'); assert.equal(alpha.status, 'QVC'); assert.equal(alpha.qvc_date, '2026-10-15'); assert.equal(alpha._src.file, 'test.csv');
    const eta = a.LGM.Store.list('candidates').find(c => c.name === 'Test Eta'); assert.equal(eta.status, 'CV Submitted'); assert.equal(eta.country, 'Sri Lanka'); assert.match(eta.id, /^XX-/);
    const after = a.LGM.Metrics.labour(a.LGM.Store.state()); assert.equal(after.cvsReceived, before.cvsReceived + 3); assert.equal(after.visaPipeline, before.visaPipeline + 2);
    assert.equal(a.LGM.Store.state().imports.length, 1); deq([a.LGM.Store.state().imports[0].added, a.LGM.Store.state().imports[0].duplicates, a.LGM.Store.state().imports[0].invalid], [3, 2, 3]);
  });
  await test('Re-importing the same file adds nothing (idempotent)', async () => {
    const a = fresh(); let r = await analyseCsv(a, CSV); a.LGM.Importer.commit(r.an, { fileName: 't.csv' }, a.LGM.Store, 'md');
    r = await analyseCsv(a, CSV); assert.equal(r.an.valid.length, 0); assert.equal(r.an.duplicates.length, 5);
  });
  await test('Rejected/duplicate rows can be downloaded as a fix-and-retry sheet', async () => {
    const a = fresh(); const { an } = await analyseCsv(a, CSV); const rows = a.LGM.Importer.problemRows(an); assert.equal(rows.length, 1 + 5); assert.match(rows[1][1], /REJECTED|DUPLICATE/);
  });
  await test('Order import: bad quantity, id clash, missing required rejected; true duplicate skipped; good row added with its id', async () => {
    const a = fresh(); const t = 'Client,Country,Trade,Quantity,Order ID,Status\nDemo Facilities Co.,Nepal,Welder,40,ORD-2001,Interview\nDemo Facilities Co.,Nepal,Welder,abc,,\nDemo Facilities Co.,Nepal,Fitter,10,ORD-1001,\nDemo Facilities Co.,Bangladesh,Cleaners / Helpers,400,ORD-1001,\n,Nepal,Welder,5,,';
    const { an } = await analyseCsv(a, t, 'md', 'orders'); assert.equal(an.valid.length, 1); assert.equal(an.duplicates.length, 1); assert.equal(an.invalid.length, 3);
    a.LGM.Importer.commit(an, { fileName: 'o.csv' }, a.LGM.Store, 'md'); const o = a.LGM.Store.get('orders', 'ORD-2001'); assert.ok(o); assert.equal(o.qty, 40); assert.equal(o.status, 'Interview');
    assert.equal(a.LGM.Store.insert('orders', { client: 'Demo Facilities Co.', country: 'Nepal', trade: 'T', qty: 1 }).ok, true, 'manual adds still work after custom-id import');
  });
  await test('Finance import: role gate, direction/category/date/amount validation, duplicate vs existing entries, defaults', async () => {
    const a = fresh(); const t = 'Date,Division,Direction,Account,Party,Client,Country,Category,Amount,Reference\n' +
      '2026-11-05,Domestic,Payment,,Demo Agency X,,Philippines,Agency expense,"1,200.50",R-1\n' +
      '2026-11-05,Blue,Receipt,Cash,Demo Agency Y,,Nepal,Mystery,300,R-2\n' +
      '2026-11-05,Blue,Sideways,Cash,Demo Agency Z,,Nepal,Other,300,R-3\n' +
      '2026-11-05,Blue,Receipt,Cash,Demo Agency Z,,Nepal,Other,-5,R-4\n' +
      '2026-11-01,labour,Outgoing,Cash,Demo Dhaka Agency,Demo Facilities Co.,Bangladesh,Agency advance,15000,DEMO-001';
    await assert.rejects(analyseCsv(a, t, 'staff', 'finance'), /restricted/);
    const { an } = await analyseCsv(a, t, 'md', 'finance'); assert.equal(an.valid.length, 2); assert.equal(an.duplicates.length, 1); assert.equal(an.invalid.length, 2);
    a.LGM.Importer.commit(an, { fileName: 'f.csv' }, a.LGM.Store, 'md'); const f1 = a.LGM.Store.list('finance').find(x => x.ref === 'R-1'), f2 = a.LGM.Store.list('finance').find(x => x.ref === 'R-2');
    deq([f1.division, f1.direction, f1.account, f1.amount], ['domestic', 'Outgoing', 'QIIB', 1200.5]); assert.equal(f2.category, 'Other'); assert.match(f2.note, /Original category: Mystery/);
  });
  await test('XLSX: real file structure read correctly — shared + inline strings, Excel date serial → ISO date (V6 defect D-8), sheet picker', async () => {
    const a = fresh(); const buf = buildXlsx([
      { name: 'Candidates', rows: [['Name', 'Passport', 'Client', 'Country', 'Trade', 'Status', 'QVC Date'], ['Xl One', 'XL-001', 'Demo Construction Ltd', 'Nepal', 'Mason', 'QVC', { date: 46310 }], [{ inline: 'Xl Two & Co' }, 'XL-002', 'Demo Construction Ltd', 'Nepal', 'Mason', 'RTP', null]] },
      { name: 'Second', rows: [['Name'], ['Other sheet']] }]);
    const f = await a.LGM.Importer.readFile(xlsxFile('c.xlsx', buf)); deq(f.sheetNames, ['Candidates', 'Second']); assert.equal(f.rows[0][6], U.serialToISO(46310)); assert.equal(f.rows[0][6], '2026-10-15');
    const f2 = await a.LGM.Importer.readFile(xlsxFile('c.xlsx', buf), 1); assert.equal(f2.rows[0][0], 'Other sheet');
    const map = a.LGM.Importer.guessMapping('candidates', f.columns); const an = a.LGM.Importer.analyse('candidates', a.LGM.Importer.mapRows('candidates', f.rows, map), a.LGM.Store.state(), 'md', a.LGM.Store); assert.equal(an.valid.length, 2);
    a.LGM.Importer.commit(an, { fileName: 'c.xlsx' }, a.LGM.Store, 'md'); const one = a.LGM.Store.list('candidates').find(c => c.name === 'Xl One'); assert.equal(one.qvc_date, '2026-10-15'); assert.ok(a.LGM.Store.list('candidates').some(c => c.name === 'Xl Two & Co'));
  });
  await test('Unsupported/corrupt files give a clear error', async () => {
    const a = fresh(); await assert.rejects(a.LGM.Importer.readFile(csvFile('x.xls', 'a')), /Upload \.xlsx/); await assert.rejects(a.LGM.Importer.readFile(csvFile('x.csv', 'only header')), /No data rows/);
    await assert.rejects(a.LGM.Importer.readFile(xlsxFile('bad.xlsx', Buffer.from('not a zip at all'))), /Not a valid XLSX/);
  });

  // ------------------------------------------------------------------ reports
  group('Reports & exports');
  await test('Every report in the registry runs and every quick-report chip resolves (V6 defect D-9)', () => {
    const { LGM } = fresh(); const s = LGM.Store.state();
    for (const name of Object.keys(LGM.Reports.defs)) { const r = LGM.Reports.run(name, s, {}, 'md'); assert.ok(!r.error && Array.isArray(r.rows) && r.columns.length, name); }
    for (const p of ['interviews', 'visas', 'deployment', 'tickets', 'orders', 'candidates', 'agencies', 'warranty', 'domestic', 'demands', 'clients', 'visits', 'visa-master', 'dashboard']) for (const q of LGM.Reports.quick(p)) assert.ok(LGM.Reports.defs[q], p + ' → ' + q);
  });
  await test('Stage reports match the dashboard/cards (one definition of each stage set)', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(), R = LGM.Reports, M = LGM.Metrics;
    assert.equal(R.run('QVC Pending', s).rows.length, M.visaCards(s).applied + M.visaCards(s).qvc); assert.equal(R.run('Flight Pending', s).rows.length, M.labour(s).readyToFly);
    assert.equal(R.run('Rejected Candidates', s).rows.length, 1); assert.equal(R.run('Open Orders', s).rows.length, 5); assert.equal(R.run('Candidate List', s).rows.length, 40);
    assert.equal(R.run('Interview Schedule', s).rows.length, 3, 'reads interview events, not candidate status');
    assert.equal(R.run('Order Progress', s).rows.length, 5, 'reads orders, not candidates');
  });
  await test('Toolbar filters (client/country/stage) narrow candidate reports', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(), R = LGM.Reports;
    const a = R.run('Candidate List', s, { client: 'Demo Contracting WLL', country: 'Nepal' }); assert.ok(a.rows.length > 0 && a.rows.every(c => c.client === 'Demo Contracting WLL' && c.country === 'Nepal'));
    const b = R.run('Candidate List', s, { stage: 'QVC Pending' }); assert.equal(b.rows.length, 5);
    assert.equal(R.run('Candidate List', s, { country: 'Bangladesh', stage: 'Arrived' }).rows.length, 0);
  });
  await test('Planned V6 reports return calculated rows (country-wise, agent, warranty expiry, demand & sales)', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(), R = LGM.Reports;
    const cw = R.run('Country-wise Recruitment', s).rows; assert.equal(cw.find(x => x.country === 'Nepal').orders, 3); assert.equal(cw.reduce((a, x) => a + x.cvs, 0), 40);
    assert.ok(R.run('Agent Performance', s).rows.some(r => r.agency === 'Demo Kathmandu Agency'));
    assert.equal(R.run('Warranty Expiry', s, { today: '2026-11-05' }).rows.find(r => r.case === 'WR-101').days_left, 45);
    assert.equal(R.run('Demand & Sales Visits', s).rows.find(r => r.client === 'Demo Hospitality Group').follow_ups, 1);
  });
  await test('Keyword report: routes, finds client + country, explains interpretation, enforces finance restriction', () => {
    const { LGM } = fresh(); const s = LGM.Store.state(), R = LGM.Reports;
    const r = R.keyword('Show QVC pending for Demo Contracting WLL Nepal', s, 'staff'); assert.equal(r.name, 'QVC Pending'); assert.equal(r.rows.length, 5); assert.ok(r.interpretation.includes('Client: Demo Contracting WLL') && r.interpretation.includes('Country: Nepal'));
    assert.equal(R.keyword('orders for Nepal', s, 'md').rows.length, 3); assert.match(R.keyword('all payments', s, 'staff').error, /restricted/); assert.equal(R.keyword('all payments', s, 'md').name, 'Private Finance'); assert.ok(R.keyword('', s, 'md').error);
  });
  await test('CSV export: BOM-ready text, headers are labels, injection neutralised, every value quoted', () => {
    const { LGM } = fresh(); const csv = LGM.Exporter.toCsv([{ key: 'a', label: 'Name' }, { key: 'b', label: 'Qty' }], [{ a: '=HYPERLINK("x")', b: 5 }, { a: 'Smith, J', b: 2 }]);
    assert.equal(csv, '"Name","Qty"\r\n"\'=HYPERLINK(""x"")","5"\r\n"Smith, J","2"');
    assert.match(LGM.Exporter.fileName('QVC Pending'), /^LGM_DEMO_QVC_Pending_\d{4}-\d{2}-\d{2}\.csv$/);
  });
  await test('Exported file name carries the workspace (DEMO/LIVE)', () => { const { LGM } = fresh(); LGM.Store.switchMode('live'); assert.match(LGM.Exporter.fileName('Orders'), /^LGM_LIVE_/); });

  // ------------------------------------------------------------------ permissions
  group('Role permissions (demonstration only — not security)');
  await test('Finance is restricted for Operations Staff exactly as V6; MD/Nitija allowed', () => {
    const P = L0.Permissions; for (const p of ['finance.view', 'finance.import', 'finance.export']) { assert.equal(P.can('staff', p), false); assert.ok(P.can('md', p) && P.can('nitija', p)); }
    assert.equal(P.can('staff', 'unknown.perm'), false);
  });

  // ------------------------------------------------------------------ summary
  const failed = results.filter(r => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
  require('fs').writeFileSync(require('path').join(__dirname, 'results.json'), JSON.stringify({ ranAt: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})();

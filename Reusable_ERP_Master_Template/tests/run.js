/* Reusable ERP Master Template — automated tests (Node). Run:  node tests/run.js
   Loads the shared core once and BOTH example projects in the same process, then proves they are independent. Fictional data only. */
const path = require('path'), fs = require('fs'), assert = require('assert'), crypto = require('crypto');
const root = path.join(__dirname, '..');
['util', 'storage', 'store', 'importer'].forEach(f => require(path.join(root, 'core', 'js', f + '.js')));
['logic', 'config', 'seed'].forEach(f => require(path.join(root, 'projects', 'manpower', f + '.js')));
['logic', 'config', 'seed'].forEach(f => require(path.join(root, 'projects', 'crm', f + '.js')));
require(path.join(root, 'projects', '_blank', 'config.js'));
const U = ERP.util, MPc = MP.config, CRMc = CRM.config, BL = PROJECT.config;

const results = []; let group = '';
const T = (name, fn) => { try { fn(); results.push({ group, name, ok: true }); } catch (e) { results.push({ group, name, ok: false, error: e.message }); } };
const G = n => { group = n; };
const mem = () => ERP.storage.MemoryAdapter();
const mpS = () => ERP.Store(MPc, mem()), crmS = () => ERP.Store(CRMc, mem());
const ok = (r, w) => { if (!r.ok) throw new Error((w || 'op') + ' failed: ' + JSON.stringify(r.errors)); return r.record; };
const today = U.todayISO(), ago = n => U.isoOf(new Date(U.parseISO(today).getTime() - n * 864e5));
const keysOf = e => Array.isArray(e.fields) ? e.fields.map(f => f.key) : [].concat(...Object.values(e.fields).map(fs => fs.map(f => f.key)));

G('A. Core is generic');
T('core files contain no Leads Global or recruitment-division wording', () => { const bad = /(leads global|blue-collar|domestic|warranty|sponsor|qvc|manpower|candidate)/i; (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) return walk(p); const m = fs.readFileSync(p, 'utf8').match(bad); assert(!m, f + ' mentions "' + (m && m[0]) + '"'); }); })(path.join(root, 'core')); });
T('the Leads Global project\'s core copy is byte-identical to this template\'s core', () => {
  const lg = path.join(root, '..', 'Leads_Global_ERP_Final', 'core'); if (!fs.existsSync(lg)) return;
  const h = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const list = d => fs.readdirSync(d, { recursive: true }).filter(x => fs.statSync(path.join(d, x)).isFile()).sort();
  const a = list(path.join(root, 'core')), b = list(lg); assert.deepStrictEqual(a, b); a.forEach(x => assert.strictEqual(h(path.join(root, 'core', x)), h(path.join(lg, x)), x + ' differs'));
});
T('no project-specific file is needed by the core (core loads with no project present)', () => { assert.strictEqual(typeof ERP.Store, 'function'); assert.strictEqual(typeof ERP.importer.analyse, 'function'); });

G('B. Two example configurations are independent');
T('different project ids, names, storage keys and currencies', () => { assert.notStrictEqual(MPc.id, CRMc.id); assert.notStrictEqual(MPc.storageKey, CRMc.storageKey); assert.notStrictEqual(MPc.filesKey, CRMc.filesKey); assert.notStrictEqual(MPc.name, CRMc.name); assert.notStrictEqual(BL.id, MPc.id); assert.notStrictEqual(BL.storageKey, CRMc.storageKey); });
T('different tables', () => { assert.deepStrictEqual(Object.keys(MPc.entities), ['employers', 'vacancies', 'candidates', 'interviews', 'placements']); assert.deepStrictEqual(Object.keys(CRMc.entities), ['accounts', 'contacts', 'leads', 'activities']); });
T('different menus, dashboards and reports', () => { const labels = c => JSON.stringify((c.nav.global || []).map(i => i.label || i.entity || i.id)); assert.notStrictEqual(labels(MPc), labels(CRMc)); assert.notDeepStrictEqual(Object.keys(MPc.reports), Object.keys(CRMc.reports)); assert.notDeepStrictEqual(MPc.overview.cards.map(c => c.label), CRMc.overview.cards.map(c => c.label)); });
T('different statuses / stages', () => { assert.notDeepStrictEqual(MP.STAGES, CRM.STAGES.B2B); assert(!MP.STAGES.includes('Negotiation')); assert(!CRM.STAGES.B2B.includes('Placed')); });
T('one example has divisions (two pipelines), the other has none — same core handles both', () => { assert.strictEqual(MPc.scope, null); assert.deepStrictEqual(CRMc.scope.values, ['B2B', 'B2C']); const a = mpS(), b = crmS(); assert(!a.isScoped('candidates')); assert(b.isScoped('leads')); });
T('field sets are different for the same scope concept (B2B vs B2C)', () => { const s = crmS(); const b2b = s.fieldsFor('leads', 'B2B').map(f => f.key), b2c = s.fieldsFor('leads', 'B2C').map(f => f.key); assert(b2b.includes('dealValue') && !b2c.includes('dealValue')); assert(b2c.includes('interest') && !b2b.includes('interest')); assert.strictEqual(s.fieldsFor('contacts', 'B2C').length, 0); });
T('no table name or field of one example leaks into the other', () => { const a = new Set([].concat(...Object.values(MPc.entities).map(keysOf))), b = new Set([].concat(...Object.values(CRMc.entities).map(keysOf))); ['vacancy', 'stage', 'placements', 'monthlySalary', 'feePercent'].forEach(k => assert(!b.has(k) || k === 'stage', 'CRM has ' + k)); assert(!a.has('dealValue') && !a.has('lostReason') && !a.has('moveTo')); });

G('C. Independent data');
T('writing to one project never changes the other (separate stores, same process)', () => { const m = mpS(), c = crmS(); MP.seed(m); CRM.seed(c); const mBefore = JSON.stringify(m.raw.data), cBefore = JSON.stringify(c.raw.data); ok(m.create('employers', { name: 'Only In Manpower' })); ok(c.create('accounts', { name: 'Only In CRM' }, { scope: 'B2B' })); assert.strictEqual(m.count('accounts' in m.config.entities ? 'accounts' : 'employers') >= 1, true); assert.notStrictEqual(JSON.stringify(m.raw.data), mBefore); assert.strictEqual(JSON.stringify(c.raw.data).includes('Only In Manpower'), false); assert.strictEqual(JSON.stringify(m.raw.data).includes('Only In CRM'), false); assert(c.raw.data.accounts.some(x => x.name === 'Only In CRM')); assert.notStrictEqual(JSON.stringify(c.raw.data), cBefore); });
T('browser storage keys keep data apart (localStorage shim)', () => {
  const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const m = ERP.Store(MPc, ERP.storage.LocalAdapter(MPc.storageKey)), c = ERP.Store(CRMc, ERP.storage.LocalAdapter(CRMc.storageKey)); MP.seed(m); CRM.seed(c);
  assert(MPc.storageKey in store && CRMc.storageKey in store); const m2 = ERP.Store(MPc, ERP.storage.LocalAdapter(MPc.storageKey)); assert.strictEqual(m2.count('employers'), m.count('employers')); assert.strictEqual(JSON.parse(store[MPc.storageKey]).projectId, MPc.id); assert.strictEqual(JSON.parse(store[CRMc.storageKey]).projectId, CRMc.id);
  delete global.localStorage;
});
T('a backup of one project cannot be restored into the other, in either direction', () => { const m = mpS(), c = crmS(); MP.seed(m); CRM.seed(c); const r1 = c.restore(JSON.parse(JSON.stringify(m.exportJSON()))), r2 = m.restore(JSON.parse(JSON.stringify(c.exportJSON()))); assert(!r1.ok && /another project/.test(r1.errors[0])); assert(!r2.ok && /another project/.test(r2.errors[0])); assert(c.count('leads') > 0 && m.count('candidates') > 0); });
T('each project\'s own backup round-trips', () => { [[mpS, MP, MPc], [crmS, CRM, CRMc]].forEach(([mk, P, cfg]) => { const a = mk(); P.seed(a); const b = mk(); assert(b.restore(JSON.parse(JSON.stringify(a.exportJSON()))).ok); Object.keys(cfg.entities).forEach(k => assert.deepStrictEqual(b.list(k), a.list(k), k)); }); });
T('record ids are per project and per table (both start at 1)', () => { const m = mpS(), c = crmS(); assert.strictEqual(ok(m.create('employers', { name: 'A' })).id, 'EMP-0001'); assert.strictEqual(ok(c.create('accounts', { name: 'A' }, { scope: 'B2B' })).id, 'ACC-0001'); });

G('D. Manpower Recruitment example — its own workflow');
T('demo data loads through validation', () => { const s = mpS(); const r = MP.seed(s); assert(r.candidates === 4 && r.placements === 1); });
T('interview Passed moves the candidate to Interviewed; Failed rejects; stages never move backwards', () => {
  const s = mpS(); const e = ok(s.create('employers', { name: 'E' })), v = ok(s.create('vacancies', { employer: e.id, title: 'T', positions: 1 })); const c = ok(s.create('candidates', { name: 'C', vacancy: v.id }));
  ok(s.create('interviews', { candidate: c.id, date: ago(3), round: 'Phone', result: 'Passed' })); assert.strictEqual(s.get('candidates', c.id).stage, 'Interviewed');
  ok(s.update('candidates', c.id, { stage: 'Offered' })); ok(s.create('interviews', { candidate: c.id, date: ago(2), round: 'HR', result: 'Passed' })); assert.strictEqual(s.get('candidates', c.id).stage, 'Offered');
  ok(s.create('interviews', { candidate: c.id, date: ago(1), round: 'Final', result: 'Failed' })); assert.strictEqual(s.get('candidates', c.id).stage, 'Rejected');
});
T('a future interview cannot already be Passed', () => { const s = mpS(); const c = ok(s.create('candidates', { name: 'C' })); assert(!s.create('interviews', { candidate: c.id, date: ago(-5), round: 'Phone', result: 'Passed' }).ok); });
T('placement marks the candidate Placed, fills the vacancy, and the fee = salary × 12 × %', () => {
  const s = mpS(); const e = ok(s.create('employers', { name: 'E' })), v = ok(s.create('vacancies', { employer: e.id, title: 'T', positions: 1 })); const c = ok(s.create('candidates', { name: 'C' }));
  const r = s.create('placements', { candidate: c.id, vacancy: v.id, startDate: ago(1), monthlySalary: 2000, feePercent: 10 }); ok(r); assert.strictEqual(s.get('candidates', c.id).stage, 'Placed'); assert.strictEqual(s.get('vacancies', v.id).status, 'Filled'); assert.strictEqual(MP.fee(r.record), 2400); assert.strictEqual(MP.feesEarned(s), 2400); assert.strictEqual(MP.fillRate(s), 100);
});
T('a closed vacancy cannot receive a placement; a candidate can only be placed once', () => { const s = mpS(); const e = ok(s.create('employers', { name: 'E' })), v = ok(s.create('vacancies', { employer: e.id, title: 'T', positions: 2, status: 'Closed' })), v2 = ok(s.create('vacancies', { employer: e.id, title: 'T2', positions: 2 })); const c = ok(s.create('candidates', { name: 'C' })); assert(!s.create('placements', { candidate: c.id, vacancy: v.id, startDate: ago(1), monthlySalary: 1, feePercent: 1 }).ok); ok(s.create('placements', { candidate: c.id, vacancy: v2.id, startDate: ago(1), monthlySalary: 1, feePercent: 1 })); assert(!s.create('placements', { candidate: c.id, vacancy: v2.id, startDate: ago(1), monthlySalary: 1, feePercent: 1 }).ok); });
T('dashboard counters follow the data', () => { const s = mpS(); const card = l => MPc.overview.cards.find(c => c.label === l).value(s); assert.strictEqual(card('Candidates'), 0); MP.seed(s); assert.strictEqual(card('Candidates'), s.count('candidates')); assert.strictEqual(card('Placements'), 1); assert.strictEqual(card('Open vacancies'), s.count('vacancies', { status: 'Open' })); assert.strictEqual(card('Fees earned'), MP.feesEarned(s)); });
T('delete protection: an employer with vacancies cannot be deleted', () => { const s = mpS(); MP.seed(s); assert(!s.remove('employers', s.list('employers')[0].id).ok); });

G('E. CRM / Lead Management example — its own workflow');
T('demo data loads through validation and activities move the leads', () => { const s = crmS(); CRM.seed(s); const l = s.list('leads').find(x => x.title === 'Plant software licence'); assert.strictEqual(l.stage, 'Proposal'); assert(s.historyOf('leads', l.id, 'stage').length >= 4); });
T('pipelines are separate: a B2C lead cannot be moved to a B2B-only stage', () => { const s = crmS(); const a = ok(s.create('accounts', { name: 'C1' }, { scope: 'B2C' })); const l = ok(s.create('leads', { title: 'L', account: a.id, owner: 'o', stage: 'New' }, { scope: 'B2C' })); const r = s.create('activities', { lead: l.id, date: ago(1), type: 'Call', summary: 's', moveTo: 'Negotiation' }, { scope: 'B2C' }); assert(!r.ok && r.errors.moveTo); assert.strictEqual(s.get('leads', l.id).stage, 'New'); assert(!s.create('leads', { title: 'bad', account: a.id, owner: 'o', stage: 'Proposal' }, { scope: 'B2C' }).ok); });
T('Lost needs a reason; Won stamps the close date; reopening clears it', () => {
  const s = crmS(); const a = ok(s.create('accounts', { name: 'A' }, { scope: 'B2B' })); const l = ok(s.create('leads', { title: 'L', account: a.id, owner: 'o', dealValue: 1000, stage: 'New' }, { scope: 'B2B' }));
  assert(!s.create('activities', { lead: l.id, date: ago(2), type: 'Call', summary: 'x', moveTo: 'Lost' }, { scope: 'B2B' }).ok);
  ok(s.create('activities', { lead: l.id, date: ago(2), type: 'Call', summary: 'x', moveTo: 'Won' }, { scope: 'B2B' })); assert.strictEqual(s.get('leads', l.id).stage, 'Won'); assert.strictEqual(s.get('leads', l.id).closedDate, ago(2));
  ok(s.update('leads', l.id, { stage: 'Negotiation' })); assert.strictEqual(s.get('leads', l.id).closedDate, '');
});
T('a won B2B deal needs a deal value', () => { const s = crmS(); const a = ok(s.create('accounts', { name: 'A' }, { scope: 'B2B' })); assert(!s.create('leads', { title: 'L', account: a.id, owner: 'o', stage: 'Won' }, { scope: 'B2B' }).ok); });
T('contact must work for the lead\'s company', () => { const s = crmS(); const a = ok(s.create('accounts', { name: 'A' }, { scope: 'B2B' })), b = ok(s.create('accounts', { name: 'B' }, { scope: 'B2B' })); const c = ok(s.create('contacts', { account: b.id, name: 'X' }, { scope: 'B2B' })); const r = s.create('leads', { title: 'L', account: a.id, contact: c.id, owner: 'o', dealValue: 5 }, { scope: 'B2B' }); assert(!r.ok && r.errors.contact); });
T('pipeline value, weighted forecast, won value and win rate are exact', () => {
  const s = crmS(); const a = ok(s.create('accounts', { name: 'A' }, { scope: 'B2B' })); const mk = (v, st, extra) => ok(s.create('leads', Object.assign({ title: 'L' + v, account: a.id, owner: 'o', dealValue: v, stage: st }, extra || {}), { scope: 'B2B' }));
  mk(1000, 'Qualified'); mk(2000, 'Proposal'); mk(5000, 'Won'); mk(300, 'Lost', { lostReason: 'Price' });
  assert.strictEqual(CRM.openValue(s, 'B2B'), 3000); assert.strictEqual(CRM.forecast(s, 'B2B'), 1000 * 0.4 + 2000 * 0.6); assert.strictEqual(CRM.wonValue(s, 'B2B'), 5000); assert.strictEqual(CRM.winRate(s, 'B2B'), 50);
});
T('B2B and B2C counters never mix', () => { const s = crmS(); CRM.seed(s); const sum = ['B2B', 'B2C'].reduce((n, p) => n + s.count('leads', { pipeline: p }), 0); assert.strictEqual(sum, s.count('leads')); assert(CRM.leads(s, 'B2C').every(l => l.pipeline === 'B2C')); assert.strictEqual(CRMc.home.B2B.cards.find(c => c.label === 'Companies').value(s, 'B2B'), s.count('accounts', { pipeline: 'B2B' })); });
T('next steps: only the latest activity of an open lead counts; overdue is flagged', () => { const s = crmS(); CRM.seed(s); const n = CRM.nextSteps(s, 'B2B'); assert(n.length >= 1 && n.some(x => x.overdue)); assert(n.every(x => CRM.isOpen(x.lead))); });
T('CSV import works in a scoped example (rows go to the chosen pipeline)', () => { const s = crmS(); const res = ERP.importer.analyse(s, 'accounts', 'B2C', 'name,city\nImported One,Doha\nImported Two,Lusail\nImported One,Doha\n'); assert.deepStrictEqual(res.items.map(i => i.status), ['new', 'new', 'duplicate']); ERP.importer.commit(s, 'accounts', 'B2C', res.items); assert(s.list('accounts').every(a => a.pipeline === 'B2C')); });
T('CSV import works in the scope-less example', () => { const s = mpS(); const res = ERP.importer.analyse(s, 'employers', null, 'name,industry\nImp Co,Retail\n'); assert.strictEqual(res.items[0].status, 'new'); ERP.importer.commit(s, 'employers', null, res.items); assert.strictEqual(s.count('employers'), 1); });

G('F. Blank starter + configuration sanity');
T('the blank project boots, validates and round-trips', () => { const s = ERP.Store(BL, mem()); const r = ok(s.create('items', { name: 'First' })); assert.strictEqual(r.id, 'IT-0001'); assert(!s.create('items', { name: 'First' }).ok); assert(!s.create('items', { name: '' }).ok); const b = ERP.Store(BL, mem()); assert(b.restore(JSON.parse(JSON.stringify(s.exportJSON()))).ok); assert.strictEqual(b.count('items'), 1); });
[[MPc, 'manpower'], [CRMc, 'crm'], [BL, 'blank']].forEach(([cfg, nm]) => {
  T(nm + ': every field is well-formed and every ref / column / filter / nav target exists', () => {
    const types = ['text', 'number', 'date', 'select', 'ref', 'email', 'textarea'], scopes = cfg.scope ? cfg.scope.values : [null], s = ERP.Store(cfg, mem());
    Object.keys(cfg.entities).forEach(k => { const e = cfg.entities[k]; const sets = Array.isArray(e.fields) ? [e.fields] : Object.values(e.fields); sets.forEach(fs => { const ks = fs.map(f => f.key); assert.strictEqual(new Set(ks).size, ks.length, k + ' duplicate key'); fs.forEach(f => { assert(f.key && f.label && types.includes(f.type), k + '.' + f.key); if (f.type === 'ref') assert(cfg.entities[f.ref], k + '.' + f.key + ' -> ' + f.ref); if (f.type === 'select') assert(f.options, k + '.' + f.key + ' options'); }); });
      scopes.forEach(sc => { const fk = s.fieldsFor(k, sc).map(f => f.key); if (!fk.length) return; const cols = Array.isArray(e.columns) ? e.columns : (e.columns && (e.columns[sc] || e.columns.default)) || []; cols.forEach(c => assert(c === 'id' || c === 'createdAt' || (e.computed || {})[c] || fk.includes(c), k + ' column ' + c)); (e.filters || []).forEach(f => assert(fk.includes(f), k + ' filter ' + f)); }); });
    const items = (cfg.nav.global || []).concat(...Object.values(cfg.nav.scope || {})); items.forEach(i => { if (i.view === 'entity') assert(cfg.entities[i.entity], i.entity); if (i.view === 'report') assert(cfg.reports[i.id], i.id); });
  });
  T(nm + ': every dashboard card is a function of the data', () => { const cards = [].concat(cfg.overview && cfg.overview.cards || [], ...Object.values(cfg.home || {}).map(h => h.cards || [])); assert(cards.length > 0); cards.forEach(c => assert.strictEqual(typeof c.value, 'function', c.label)); });
});
T('every report of both examples runs on seeded data and on empty data without error', () => { [[MPc, mpS, MP], [CRMc, crmS, CRM]].forEach(([cfg, mk, P]) => { const empty = mk(), full = mk(); P.seed(full); Object.keys(cfg.reports).forEach(id => { const r = cfg.reports[id]; (cfg.scope ? cfg.scope.values : [null]).forEach(sc => { [empty, full].forEach(st => { const rows = r.rows(st, sc); rows.forEach(row => r.columns.forEach(c => assert(c.key in row, id + ' missing ' + c.key))); }); }); }); }); });

const failed = results.filter(r => !r.ok), groups = [...new Set(results.map(r => r.group))];
groups.forEach(g => { const rs = results.filter(r => r.group === g); console.log('\n' + g + '  (' + rs.filter(r => r.ok).length + '/' + rs.length + ')'); rs.forEach(r => console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.name + (r.ok ? '' : '\n        → ' + r.error))); });
console.log('\n' + (results.length - failed.length) + ' / ' + results.length + ' passed');
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ ranAt: new Date().toISOString(), total: results.length, passed: results.length - failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);

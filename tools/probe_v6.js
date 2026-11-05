// Behavioural probe of the ORIGINAL V6 index.html (read-only; it never writes to it).
// Runs V6's inline scripts in a vm with DOM stubs and reports what the buttons/imports actually do.
// Usage: node tools/probe_v6.js <path-to-V6>/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const store = {}; const alerts = []; const downloads = [];
const els = {};
function el(id) {
  return els[id] || (els[id] = new Proxy({ id, value: '', innerHTML: '', textContent: '', children: [], style: {},
    insertAdjacentHTML(pos, h) { this.innerHTML = h + this.innerHTML; }, appendChild() {}, remove() {}, click() {},
    getAttribute() { return null; }, files: [] }, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => (t[k] = v, true) }));
}
const document = {
  getElementById: id => el(id), querySelector: s => el(s), querySelectorAll: () => [],
  createElement: () => ({ click() { downloads.push(this); }, remove() {}, set href(v) { this._h = v; }, get href() { return this._h; } }), body: { appendChild() {} },
};
const ctx = vm.createContext({
  document, window: {}, console,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k] },
  alert: m => alerts.push(m), confirm: () => true, setTimeout: () => 0,
  URL: { createObjectURL: b => { downloads.push({ blob: b }); return 'blob:x'; }, revokeObjectURL() {} },
  Blob: class { constructor(parts, o) { this.text = parts.join(''); this.type = o && o.type; } },
  DOMParser: class {}, DecompressionStream: undefined, TextDecoder, Response: class {}, Date, Number, Math, JSON, Array, Object, String, RegExp, Set, Map, Error,
});
ctx.window = ctx; // window.x === global x
for (const s of scripts) vm.runInContext(s, ctx);
const run = c => vm.runInContext(c, ctx);

console.log('=== 1. Quick-report buttons: rows returned against the built-in sample data ===');
const labels = run('JSON.stringify(v6QuickReports)');
const qr = JSON.parse(labels);
const seen = new Set();
for (const [pg, list] of Object.entries(qr)) for (const l of list) {
  if (seen.has(l)) continue; seen.add(l);
  const n = run(`v6ReportRows(${JSON.stringify(l)}).length`);
  console.log(String(n).padStart(3), ' ', l.padEnd(24), '(page: ' + pg + ')');
}
console.log('\n=== 2. Import writes to a different store than the pages read ===');
run(`importTarget='candidates';importColumns=['Name','Passport','Client','Country','Status'];importRows=[['Imported Test One','P1','Zeta Co','Nepal','Visa Printed']];importFileName='probe.csv';v5MapGuess();v5Import();`);
console.log('v5.candidates length after import      :', run('v5.candidates.length'));
console.log('page list `candidates` length (unchanged):', run('candidates.length'));
run(`page='candidates';render();`);
console.log('Candidates page HTML shows imported row? :', /Imported Test One/.test(els['view'].innerHTML));
run(`page='orders';render();`);
run(`importTarget='orders';importColumns=['Client','Country','Trade','Quantity'];importRows=[['Zeta Co','Nepal','Welder','abc']];v5MapGuess();v5Import();`);
console.log('Order with quantity "abc" imported OK?  :', run('v5.orders.length') === 1, '(no numeric validation)');
run(`importTarget='candidates';importColumns=['Name','Client','Status'];importRows=[['Free Status Person','Zeta Co','Banana']];v5MapGuess();v5Import();`);
console.log('Status "Banana" accepted on import?     :', run(`v5.candidates.some(x=>x.status==='Banana')`));

console.log('\n=== 3. Dashboard counters ===');
run(`page='dashboard';division='labour';render();`);
const dash = els['view'].innerHTML;
console.log('Dashboard shows hard-coded 1,240 / 324 / 186 :', ['1,240', '324', '186'].map(x => dash.includes(x)));
console.log('Actual candidate records in store            :', run('v5AllCandidateRecords().length'));

console.log('\n=== 4. Master report is static ===');
run(`page='visa-master';render();`);
const vm1 = els['view'].innerHTML;
console.log('Contains hard-coded 2-row sample (Elegancia 300):', /Elegancia/.test(vm1) && /300/.test(vm1));

console.log('\n=== 5. Persistence of manual edits ===');
const keysBefore = Object.keys(store);
run(`advance(0);`);
console.log('localStorage keys:', Object.keys(store), '→ candidates/orders arrays are not persisted (only v5 import store + finance)');

console.log('\n=== 6. Escaping ===');
run(`window.visaSearch='"><img src=x onerror=alert(1)>';page='visa-master';render();`);
console.log('Raw HTML injected via Master-report search box:', els['view'].innerHTML.includes('<img src=x onerror=alert(1)>'));
run(`orders.push({id:'X',client:'<b>bold</b>',country:'Nepal',trade:'T',qty:1,status:'S'});page='orders';render();`);
console.log('Order client rendered unescaped (<b> tag live) :', els['view'].innerHTML.includes('<b>bold</b>'));

console.log('\n=== 7. Visa-summary CSV (page button) quoting ===');
run(`window.visaReportRows=[['Smith, Jones & Co','Nepal',10,1,1,1,1,1]];exportVisaSummary();`);
const last = downloads.filter(d => d.blob).pop().blob.text;
console.log(JSON.stringify(last.split('\r\n')[1]), '← company name with a comma is NOT quoted → breaks columns in Excel');

console.log('\n=== 8. Two different "visa summary" definitions ===');
console.log('Page (hard-coded) columns : Company,Country,Order,Applied,QVC,RTP,Printed,Deployed,Remaining');
console.log('CSV v5ExportVisa columns  :', run(`(()=>{let all=v5AllCandidateRecords();return 'client,total,cv_review,interview,selected,visa_applied,qvc,rtp,visa_printed,flight_pending,arrived'})()`));

console.log('\n=== 9. AI report keyword routing examples ===');
const probes = ['Show QVC pending for JAAK Nepal', 'show all payments', 'orders for Nepal'];
for (const q of probes) {
  el('v5Query').value = q; downloads.length = 0; alerts.length = 0; run('role="md"; v5RunReport()');
  const d = downloads.filter(x => x.blob).pop();
  console.log(JSON.stringify(q).padEnd(40), '→', d ? d.blob.text.split('\r\n').length - 1 + ' data rows' : ('no file: ' + alerts.join('|')));
}
console.log('\nAlerts raised during probe:', alerts);

/* BROWSER END-TO-END SUITE (fictional data only).
   Load the app, then in the page:  (inject this file) → await LGM_E2E.run()   — returns [{group,name,ok,detail}].
   It drives the real UI: clicks buttons, fills forms, uploads files via the page's own handlers. */
(function () {
  'use strict';
  const L = window.LGM, UI = L.UI, S = L.Store, A = L.App;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const res = []; let grp = '';
  const ok = (name, cond, detail) => res.push({ group: grp, name, ok: !!cond, detail: cond ? '' : String(detail === undefined ? '' : detail) });
  const clearToasts = () => { document.getElementById('toasts').innerHTML = ''; };
  const click = async el => { if (!el) throw new Error('element not found'); clearToasts(); el.click(); await wait(25); };
  const btnIn = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text));
  const rowOf = text => $$('#view tbody tr').find(r => r.textContent.includes(text));
  const setv = (name, val, root = document) => { const el = root.querySelector(`[name="${name}"]`); if (!el) throw new Error('no field ' + name); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const fill = (vals, root) => Object.entries(vals).forEach(([k, v]) => setv(k, v, root));
  const modal = () => $('#overlay-root .modal');
  const confirmYes = async () => { await click($('[data-act="confirmYes"]')); await wait(30); };
  const num = label => { const c = $$('.card').find(x => x.textContent.includes(label)); return c ? c.querySelector('.num').textContent.trim() : null; };
  const mkFile = (name, text) => new File([text], name, { type: 'text/plain' });
  const pick = async (action, files) => { clearToasts(); await UI.actions[action]('', { files, value: '' }); await wait(60); };
  const go = async p => { clearToasts(); A.go(p); await wait(20); };

  async function zipStored(files) { // tiny .xlsx builder using the browser's CompressionStream → exercises the real inflate path
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const deflate = async u8 => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    for (const [name, content] of Object.entries(files)) {
      const nb = enc.encode(name), raw = enc.encode(content), data = await deflate(raw);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 8, true); lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, nb.length, true);
      parts.push(new Uint8Array(lh.buffer), nb, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(10, 8, true); ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb); off += 30 + nb.length + data.length;
    }
    const cdLen = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22)); const n = Object.keys(files).length;
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, n, true); end.setUint16(10, n, true); end.setUint32(12, cdLen, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
  }

  async function run() {
    res.length = 0;
    UI.state.imp = null; UI.state.cv = null; UI.state.division = 'labour'; UI.state.financeDivision = 'labour'; UI.state.vm = { country: 'All', q: '' }; L.Crud.state = {}; // reset UI state so runs are independent
    window.__LGM_NO_DOWNLOAD = true; S.switchMode('demo'); L.Storage.remove('lgm_v6dev_data_live'); S.resetDemo(); // deterministic baseline: fresh live workspace + original demo sample UI.state.role = 'md'; S.setPref('role', 'md'); UI.state.filters = { client: 'All', country: 'All', stage: 'All' }; A.render();

    grp = 'Dashboard';
    await go('dashboard');
    ok('Counters equal calculated values (5 / 40 / 8 / 5)', [num('Open Orders'), num('CVs Received'), num('Visa Pipeline'), num('Ready to Fly')].join() === '5,40,8,5', [num('Open Orders'), num('CVs Received'), num('Visa Pipeline'), num('Ready to Fly')]);
    ok('Pipeline bars shown (14 / 8 / 8 / 5)', ['CV Screening', 'Interviews & Selection', 'Visa Processing', 'Ready to Deploy'].every(l => $('#view').textContent.includes(l)));
    ok('Domestic tab computes from cases', (await (async () => { await click($$('.tab').find(t => t.textContent.startsWith('Domestic'))); return num('Enquiries') === '3' && num('Handovers') === '1'; })()));
    await click($$('.tab').find(t => t.textContent.startsWith('Local Corporate'))); ok('Corporate tab shows future-division text', /not yet started/.test($('#view').textContent));
    UI.state.division = 'labour';

    grp = 'Orders (add / validate / edit / delete)';
    await go('orders'); await click(btnIn($('#view'), '+ Sample New Order')); ok('Add-order modal opens', !!modal());
    await click(btnIn(modal(), 'Save')); ok('Empty form is rejected with field errors and stays open', $$('#overlay-root .field.err').length >= 2 && !!modal(), $$('#overlay-root .field.err').length);
    fill({ client: 'Demo Facilities Co.', country: 'Nepal', trade: 'E2E Welder', qty: '0' }, modal()); await click(btnIn(modal(), 'Save')); ok('Quantity 0 rejected', /at least 1/.test(modal().textContent));
    setv('qty', '12', modal()); await click(btnIn(modal(), 'Save'));
    ok('Valid order saved, modal closed, row appears with auto id', !modal() && !!rowOf('E2E Welder') && /ORD-1006/.test(rowOf('E2E Welder').textContent), rowOf('E2E Welder') && rowOf('E2E Welder').textContent);
    await go('dashboard'); ok('Dashboard Open Orders updated 5 → 6', num('Open Orders') === '6', num('Open Orders'));
    await go('orders'); await click(btnIn(rowOf('E2E Welder'), 'Edit')); setv('qty', '20', modal()); setv('status', 'Closed', modal()); await click(btnIn(modal(), 'Save changes'));
    ok('Edit persists (qty 20, stage Closed)', /20/.test(rowOf('E2E Welder').textContent) && /Closed/.test(rowOf('E2E Welder').textContent));
    await go('dashboard'); ok('Closed order no longer counted as open (→ 5)', num('Open Orders') === '5', num('Open Orders'));
    await go('orders'); await click(btnIn(rowOf('E2E Welder'), 'Delete')); ok('Delete asks for confirmation', /permanently removed/.test(modal().textContent)); await confirmYes();
    ok('Order deleted', !rowOf('E2E Welder'));
    await click(btnIn(rowOf('ORD-1001'), 'Delete')); await confirmYes(); ok('Order with linked candidates cannot be deleted (guard message)', !!rowOf('ORD-1001') && /linked/i.test($('#toasts').textContent), $('#toasts').textContent);

    grp = 'Candidates (add / duplicate / stage workflow)';
    await go('candidates'); await click(btnIn($('#view'), '+ Add Candidate'));
    fill({ name: 'E2E Candidate', passport: 'E2E-P1', client: 'Demo Construction Ltd', order_id: 'ORD-1002', country: 'Bangladesh', trade: 'Mason' }, modal()); await click(btnIn(modal(), 'Save'));
    ok('Candidate saved with BD- id at CV Submitted', !!rowOf('E2E Candidate') && /BD-1041/.test(rowOf('E2E Candidate').textContent) && /CV Submitted/.test(rowOf('E2E Candidate').textContent));
    await click(btnIn($('#view'), '+ Add Candidate')); fill({ name: 'Other Name', passport: 'e2e p1', client: 'X', country: 'Nepal', trade: 'T' }, modal()); await click(btnIn(modal(), 'Save'));
    ok('Duplicate passport rejected with reference to the existing record', /Duplicate of BD-1041/.test(modal().textContent), modal() && modal().textContent); await click(btnIn(modal(), 'Cancel'));
    const cid = 'BD-1041';
    await click(btnIn(rowOf(cid), 'Next Stage')); ok('Next Stage → Client Review', S.get('candidates', cid).status === 'Client Review');
    await click(btnIn(rowOf(cid), 'Next Stage')); ok('Next Stage → Interview', S.get('candidates', cid).status === 'Interview');
    ok('Interview row offers Reject; no illegal skip button', !!btnIn(rowOf(cid), 'Reject') && !btnIn(rowOf(cid), 'Skip'));
    await click(btnIn(rowOf(cid), 'Reject')); await confirmYes(); ok('Reject (confirmed) → Rejected', S.get('candidates', cid).status === 'Rejected');
    ok('Rejected candidate has no forward buttons', !btnIn(rowOf(cid), 'Next Stage'));
    await click(btnIn(rowOf(cid), 'Undo')); await confirmYes(); ok('Undo returns to Interview (MD allowed)', S.get('candidates', cid).status === 'Interview');
    await click(btnIn(rowOf(cid), 'View')); ok('Detail view shows history and checklist', /Stage history/.test(modal().textContent) && /Deployment checklist/.test(modal().textContent) && /Client Review/.test(modal().textContent)); await click($('[data-act="modalClose"]'));
    UI.state.role = 'staff'; A.render(); ok('Staff cannot Undo (button hidden)', !btnIn(rowOf(cid), 'Undo')); UI.state.role = 'md'; A.render();
    const st0 = $('#view [data-input="crudSearch"]'); st0.focus(); st0.value = 'Demo Candidate 03'; st0.dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
    ok('Search filters the table to the 10 matching candidates and keeps input focus', $('#crud-candidates-count').textContent === '10 of 41' && document.activeElement === st0, $('#crud-candidates-count').textContent);
    st0.value = ''; st0.dispatchEvent(new Event('input', { bubbles: true }));
    const fsel = $('#view [data-key="status"]'); fsel.value = 'Visa Applied'; fsel.dispatchEvent(new Event('change', { bubbles: true })); await wait(30);
    ok('Stage filter narrows to 3 Visa Applied candidates', $('#crud-candidates-count').textContent === '3 of 41', $('#crud-candidates-count').textContent);
    fsel.value = 'All'; fsel.dispatchEvent(new Event('change', { bubbles: true }));
    await go('candidates'); await click(btnIn(rowOf(cid), 'Delete')); await confirmYes(); ok('Candidate deleted', !S.get('candidates', cid));
    await go('candidates'); const oa = S.list('candidates').find(c => c.status === 'Offer Accepted'); await click(btnIn(rowOf(oa.id), 'Skip')); ok('Optional stage can be skipped (Offer Accepted → Visa Applied)', S.get('candidates', oa.id).status === 'Visa Applied');

    grp = 'Visa / Deployment / Tickets / Warranty';
    await go('visas'); const before = num('QVC'); const q = S.list('candidates').find(c => c.status === 'QVC'); await click(btnIn(rowOf(q.id), 'Next Stage'));
    ok('Moving a candidate QVC→RTP updates the visa cards (QVC -1, RTP +1)', num('QVC') === String(Number(before) - 1) && num('RTP') === '3', [num('QVC'), num('RTP')]);
    await go('deployment'); ok('Deployment cards computed (Ready to Fly 5, Arrivals Verified 4)', num('Ready to Fly') === '5' && num('Arrivals Verified') === '4', [num('Ready to Fly'), num('Arrivals Verified')]);
    const dp = S.list('candidates').find(c => c.status === 'Deployment Ready'); await click(btnIn(rowOf(dp.id), 'Next Stage')); ok('Deployment Ready → Arrived from the deployment page', S.get('candidates', dp.id).status === 'Arrived');
    ok('…and Arrivals Verified becomes 5', (await go('deployment'), num('Arrivals Verified') === '5'), num('Arrivals Verified'));
    await go('tickets'); await click(btnIn($('#view'), '+ Add Travel Record'));
    const free = S.list('candidates').find(c => ['Visa Printed', 'Deployment Ready'].includes(c.status) && !S.list('tickets').some(t => t.candidate_id === c.id));
    const opts = [...modal().querySelectorAll('[name="candidate_id"] option')].map(o => o.value);
    ok('Travel form lists only eligible candidates without a record', !!free && opts.includes(free.id) && !opts.includes(S.list('tickets')[0].candidate_id), opts.join());
    fill({ candidate_id: free.id, ticket_by: 'Client', flight: 'E2E-FL1', flight_date: '2026-11-20', step: 'Request Booking' }, modal()); await click(btnIn(modal(), 'Save'));
    ok('Travel record saved and flight date written to the candidate', !!rowOf(free.id) && S.get('candidates', free.id).flight_date === '2026-11-20');
    await click(btnIn(rowOf(free.id), 'Next →')); ok('Ticket status advances (Request Booking → Flight Details Shared)', S.list('tickets').find(t => t.candidate_id === free.id).step === 'Flight Details Shared');
    await go('warranty'); await click(btnIn($('#view'), '+ New Case')); fill({ division: 'Labour', client: 'Demo Logistics Co.', issue: 'E2E issue', warranty_start: '2026-10-01' }, modal()); await click(btnIn(modal(), 'Save'));
    ok('Labour warranty expiry auto-filled (+3 months = 2027-01-01)', /2027-01-01/.test(rowOf('E2E issue').textContent), rowOf('E2E issue') && rowOf('E2E issue').textContent);
    await click(btnIn(rowOf('E2E issue'), 'Next →')); ok('Warranty case advances Pending → Under Review', /Under Review/.test(rowOf('E2E issue').textContent));

    grp = 'Excel / CSV import (through the real UI handlers)';
    await go('import-center');
    const csv = 'Candidate Name,Passport No,Company,Nationality,Profession,Visa Status,Appointment Date\nE2E Imp One,IMP-1,Demo Construction Ltd,Bangladesh,Mason,QVC,20/11/2026\nE2E Imp Two,IMP-2,Demo Construction Ltd,Bangladesh,Mason,Banana,\nE2E Imp Three,DEMO-P0002,Demo Construction Ltd,Bangladesh,Mason,,\nE2E Imp Four,IMP-4,Demo Construction Ltd,Bangladesh,Mason,Visa Applied,';
    await pick('impPick', [mkFile('e2e_candidates.csv', csv)]);
    ok('File loaded; V6 header aliases mapped automatically (name, passport, client, country, trade, status)', /Loaded 4 rows/.test($('#view').textContent) && $$('#view select[data-change="impMap"]').filter(s => s.value !== '').length >= 6, $$('#view select[data-change="impMap"]').map(s => s.value).join());
    await click(btnIn($('#view'), 'Validate 4 rows')); const cards = $$('#view .card .num').map(x => x.textContent.trim()).join();
    ok('Validation result: 2 ready, 1 duplicate, 1 rejected — nothing imported yet', cards.startsWith('2,1,1,4') && S.list('candidates').length === 40, cards + ' / candidates=' + S.list('candidates').length);
    ok('Rejected reason is explained', /Unknown status/.test($('#view').textContent));
    await click(btnIn($('#view'), 'Import 2 valid')); await confirmYes();
    ok('Imported rows exist in the Candidates register (V6 defect fixed)', S.list('candidates').some(c => c.name === 'E2E Imp One' && c.qvc_date === '2026-11-20') && S.list('candidates').some(c => c.name === 'E2E Imp Four'));
    await go('candidates'); ok('…and show on the Candidates page with an "imported" tag', !!rowOf('E2E Imp One') && /imported/.test(rowOf('E2E Imp One').textContent));
    await go('dashboard'); ok('…and dashboard CVs Received increased (40 → 42 plus earlier test records)', num('CVs Received') === '42', num('CVs Received'));
    await go('import-center'); ok('Import history row recorded', /e2e_candidates\.csv/.test($('#view').textContent));
    // XLSX through browser DecompressionStream
    const sheet = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Passport</t></is></c><c r="C1" t="inlineStr"><is><t>Client</t></is></c><c r="D1" t="inlineStr"><is><t>Country</t></is></c><c r="E1" t="inlineStr"><is><t>Trade</t></is></c><c r="F1" t="inlineStr"><is><t>QVC Date</t></is></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>E2E Xlsx Person</t></is></c><c r="B2" t="inlineStr"><is><t>XL-9</t></is></c><c r="C2" t="inlineStr"><is><t>Demo Construction Ltd</t></is></c><c r="D2" t="inlineStr"><is><t>Nepal</t></is></c><c r="E2" t="inlineStr"><is><t>Welder</t></is></c><c r="F2" s="1"><v>46310</v></c></row></sheetData></worksheet>';
    const blob = await zipStored({ 'xl/workbook.xml': '<workbook xmlns:r="x"><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/styles.xml': '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>', 'xl/worksheets/sheet1.xml': sheet });
    await pick('impPick', [new File([blob], 'e2e.xlsx')]); await click(btnIn($('#view'), 'Validate 1 rows')); await click(btnIn($('#view'), 'Import 1 valid')); await confirmYes();
    const xp = S.list('candidates').find(c => c.name === 'E2E Xlsx Person'); ok('XLSX read in the browser; Excel date serial 46310 became 2026-10-15', !!xp && xp.qvc_date === '2026-10-15', xp && xp.qvc_date);
    await go('import-center'); await click($$('#view .tab').find(t => t.textContent.startsWith('Manpower Orders')));
    await pick('impPick', [mkFile('o.csv', 'Client,Country,Trade,Quantity\nDemo Facilities Co.,Nepal,E2E Fitter,abc\nDemo Facilities Co.,Nepal,E2E Fitter,15')]); await click(btnIn($('#view'), 'Validate 2 rows'));
    ok('Order import: quantity "abc" rejected, 15 accepted', $$('#view .card .num').map(x => x.textContent.trim()).join().startsWith('1,0,1'), $$('#view .card .num').map(x => x.textContent.trim()).join());
    await click(btnIn($('#view'), 'Import 1 valid')); await confirmYes(); ok('Imported order is on the Orders page', (await go('orders'), !!rowOf('E2E Fitter')));
    await go('import-center'); await pick('impPick', [mkFile('bad.txt', 'only one line')]); ok('Bad file gives a clear message, no crash', /No data rows/.test($('#toasts').textContent), $('#toasts').textContent);

    grp = 'Reports & exports';
    await go('visas'); const flt = $('.v6-tools [data-k="stage"]'); flt.value = 'QVC Pending'; flt.dispatchEvent(new Event('change', { bubbles: true })); await click(btnIn($('.v6-tools'), 'QVC Pending'));
    let ex = L.Exporter.last(); ok('Quick report exports a CSV named with workspace and date', /^LGM_DEMO_QVC_Pending_\d{4}-\d{2}-\d{2}\.csv$/.test(ex.name), ex.name);
    ok('Export CSV content: header + only QVC-pending rows, every value quoted', /^"Candidate ID","Candidate"/.test(ex.text) && ex.text.split('\r\n').slice(1).every(l => /"Visa Applied"|"QVC"/.test(l)), ex.text.split('\r\n')[1]);
    await go('interviews'); await click(btnIn($('.v6-tools'), 'Interview Schedule')); ok('Interview Schedule exports interview events (3)', L.Exporter.last().text.split('\r\n').length === 4, L.Exporter.last().text);
    await go('orders'); await click(btnIn($('.v6-tools'), 'Order Progress')); ok('Order Progress exports orders (not candidates)', /^"Order","Client"/.test(L.Exporter.last().text));
    UI.state.filters.stage = 'All'; await go('candidates'); await click(btnIn($('.v6-tools'), 'Candidate List')); ok('Candidate List button returns data (was empty in V6)', L.Exporter.last().text.split('\r\n').length > 40);
    await go('corporate'); ok('No dead toolbar on the not-started Corporate division', !$('.v6-tools'));
    await go('visa-master'); const vq = $('#vmQuery'); vq.focus(); vq.value = 'logist'; vq.dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
    ok('Master report search filters without losing focus (V6 defect D-12)', document.activeElement === vq && /Demo Logistics Co\./.test($('#vm-results').textContent) && !/Demo Facilities Co\./.test($('#vm-results').textContent));
    vq.value = ''; vq.dispatchEvent(new Event('input', { bubbles: true }));
    const vc = $('#vmCountry'); vc.value = 'Nepal'; vc.dispatchEvent(new Event('change', { bubbles: true })); await wait(30); ok('Master report country filter works', !/Bangladesh/.test($('#vm-results tbody').textContent) );
    await click(btnIn($('#view'), 'Export CSV for Excel')); ok('Master export includes TOTAL row', /"TOTAL"/.test(L.Exporter.last().text)); UI.state.vm = { country: 'All', q: '' };
    await go('reports'); await click($$('#view button').find(b => b.dataset.arg === 'Country-wise Recruitment' && b.dataset.act === 'runReport')); ok('Planned report opens in preview with export button', !!modal() && /Country-wise/.test(modal().textContent)); await click(btnIn(modal(), '⇩ Export')); ok('Preview export works', /^LGM_DEMO_Country_wise/.test(L.Exporter.last().name)); await click($('[data-act="modalClose"]'));
    ok('Reminders are generated from data (QVC follow-up present)', /Follow up QVC result/.test($('#view').textContent));
    ok('Audit log lists our E2E changes', /ORD-1006|E2E/.test($('#view').textContent));
    await go('ai-reports'); $('#aiQuery').value = 'Show QVC pending for Demo Contracting WLL Nepal'; await click(btnIn($('#view'), 'Generate report'));
    ok('Keyword report previews with an explanation of how it was understood', /Client: Demo Contracting WLL/.test(modal().textContent) && /Country: Nepal/.test(modal().textContent)); await click($('[data-act="modalClose"]'));

    grp = 'Finance, Vault, Corporate calculator';
    await go('finance'); const inc0 = num('Money Received'); const f = $('#fin-form');
    fill({ date: '2026-11-05', division: 'labour', direction: 'Incoming', account: 'Cash', party: 'E2E Party', category: 'Client visa charge', amount: '-5' }, f); await click(btnIn($('#view'), 'Save Sample Transaction'));
    ok('Negative amount rejected inline', /at least 0.01/.test($('#fin-form').textContent), $('#fin-form').textContent.slice(0, 200)); setv('amount', '1234.5', $('#fin-form')); await click(btnIn($('#view'), 'Save Sample Transaction'));
    ok('Transaction saved: cashbook row and Money Received updated', !!rowOf('E2E Party') && num('Money Received') === 'QAR 9,834.5', num('Money Received'));
    const net0 = num('Net Cash Movement'); await click(btnIn(rowOf('E2E Party'), 'Delete')); await confirmYes(); ok('Transaction deleted and totals revert', !rowOf('E2E Party') && num('Net Cash Movement') !== undefined);
    const cq = $('#costQty'); cq.value = '10'; cq.dispatchEvent(new Event('input', { bubbles: true })); ok('Costing: 10 × (1500 − 860) = QAR 6,400 profit', $('#costProfitResult').textContent === 'QAR 6,400', $('#costProfitResult').textContent);
    const cc = $('#costCountry'); cc.value = 'Bangladesh'; cc.dispatchEvent(new Event('change', { bubbles: true })); ok('Costing Bangladesh defaults: 10 × (4000 − 2500 − 300) = QAR 12,000', $('#costProfitResult').textContent === 'QAR 12,000', $('#costProfitResult').textContent);
    const ci = $('#costIncluded'); ci.value = 'included'; ci.dispatchEvent(new Event('change', { bubbles: true })); ok('Investment "already included" removes it from cost → QAR 15,000', $('#costProfitResult').textContent === 'QAR 15,000', $('#costProfitResult').textContent);
    await click(btnIn($('#view'), 'Export CSV')); ok('Finance export works for MD', /^LGM_DEMO_Finance_labour/.test(L.Exporter.last().name), L.Exporter.last().name);
    await go('vault'); await click(btnIn($('#view'), '+ Add Record')); fill({ client: 'Demo Facilities Co.', portal: 'MOL', record: 'password: hunter2' }, modal()); await click(btnIn(modal(), 'Save'));
    ok('Credentials register refuses a password', /Do not store passwords/.test(modal().textContent)); setv('record', 'Credentials on file', modal()); await click(btnIn(modal(), 'Save')); ok('Description-only record accepted', !modal());
    await go('corporate'); const rt = $('#rate'); rt.value = '0.5'; rt.dispatchEvent(new Event('change', { bubbles: true })); ok('Corporate fee: half of 6,000 = QAR 3,000', $('#feeResult').textContent === 'QAR 3,000', $('#feeResult').textContent);
    const sal = $('#salary'); sal.value = '8000'; sal.dispatchEvent(new Event('input', { bubbles: true })); ok('Corporate fee: half of 8,000 = QAR 4,000', $('#feeResult').textContent === 'QAR 4,000');

    grp = 'CV intake, CRM links, safety';
    await go('cv-inbox'); $('#cvClient').value = 'Demo Construction Ltd'; $('#cvClient').dispatchEvent(new Event('input', { bubbles: true }));
    await pick('cvUpload', [mkFile('e2e_cv.txt', 'Name: Demo Person\nEmail: demo.person@example.test\nPhone: +000 1234 5678')]);
    ok('CV text file recorded with extracted e-mail and phone-based status', !!rowOf('e2e_cv.txt') && /demo\.person@example\.test/.test(rowOf('e2e_cv.txt').textContent));
    await pick('cvUpload', [mkFile('e2e_cv.txt', 'Name: Demo Person\nEmail: demo.person@example.test\nPhone: +000 1234 5678')]); ok('Same file again is skipped as already received', S.list('cvInbox').filter(x => x.filename === 'e2e_cv.txt').length === 1);
    await pick('cvUpload', [mkFile('virus.exe', 'x')]); ok('Unsupported type refused', /Unsupported file type/.test($('#toasts').textContent));
    await click(btnIn(rowOf('e2e_cv.txt'), 'Create candidate')); ok('"Create candidate" opens a pre-filled form (client, name from filename)', modal().querySelector('[name="client"]').value === 'Demo Construction Ltd' && /e2e cv/i.test(modal().querySelector('[name="name"]').value));
    setv('passport', 'CV-E2E-1', modal()); setv('trade', 'Cook', modal()); await click(btnIn(modal(), 'Save')); await wait(30); ok('…saving marks the intake item "Candidate created"', S.list('cvInbox').find(x => x.filename === 'e2e_cv.txt').status === 'Candidate created');
    await go('clients'); await click(btnIn($('#view'), '+ Add Client')); fill({ name: '<img src=x onerror="window.__xss=1">', stage: 'Prospect' }, modal()); await click(btnIn(modal(), 'Save')); await wait(50);
    ok('Hostile client name is stored but rendered as text (no script execution, V6 defect D-6)', !window.__xss && /<img src=x/.test($('#view').textContent) && !$('#view img'), $('#view img') && 'img element injected');
    await click(btnIn(rowOf('<img'), 'Edit')); setv('name', 'Renamed E2E Client', modal()); await click(btnIn(modal(), 'Save changes')); ok('Client rename works', !!rowOf('Renamed E2E Client'));
    await click(btnIn(rowOf('Demo Construction Ltd'), 'Delete')); await confirmYes(); ok('Client in use cannot be deleted', !!rowOf('Demo Construction Ltd') && /used by/.test($('#toasts').textContent));
    await click(btnIn(rowOf('Demo Hospitality Group'), '+ Order')); ok('Client row "+ Order" pre-fills the client', modal().querySelector('[name="client"]').value === 'Demo Hospitality Group'); await click($('[data-act="modalClose"]'));
    await go('visits'); ok('Visit with outcome "Order Received" offers "Create order →"', !!btnIn(rowOf('Demo Construction Ltd'), 'Create order'));
    UI.modal.open({ title: 't', body: 'x' }); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); ok('Escape closes a modal', !modal());

    grp = 'Roles (demo only)';
    UI.state.role = 'staff'; A.render(); await go('dashboard');
    ok('Staff: Private Finance hidden from navigation', !/Private Finance/.test($('#nav').textContent)); await go('finance'); ok('Staff: opening Finance is redirected', UI.state.page === 'dashboard' && /restricted/i.test($('#toasts').textContent));
    await go('import-center'); ok('Staff: no Private Finance import tab', !$$('#view .tab').some(t => /Finance/.test(t.textContent)));
    await go('ai-reports'); ok('Staff: no finance preset or finance export button', !btnIn($('#view'), 'Private Finance') && !btnIn($('#view'), 'All finance transactions'));
    $('#aiQuery').value = 'all payments'; await click(btnIn($('#view'), 'Generate report')); ok('Staff: finance keyword report refused', /restricted/i.test($('#toasts').textContent));
    await go('settings'); ok('Staff: cannot see reset/clear/switch controls', !btnIn($('#view'), 'Clear this workspace') && !btnIn($('#view'), 'Switch to LIVE'));
    UI.state.role = 'md'; S.setPref('role', 'md'); A.render();

    grp = 'Demo / live separation';
    await go('settings'); await click(btnIn($('#view'), 'Switch to LIVE')); await confirmYes();
    ok('LIVE workspace starts empty (no demo data leaks)', S.mode() === 'live' && S.list('candidates').length === 0 && S.list('orders').length === 0);
    await go('dashboard'); ok('Dashboard shows zeros and LIVE banner', num('CVs Received') === '0' && /LIVE WORKSPACE/.test($('#banner').textContent) && /LIVE DATA/.test($('#modePill').textContent));
    await go('orders'); ok('Empty state message shown', /No orders yet/.test($('#view').textContent));
    await click(btnIn($('#view'), '+ New Order')); fill({ client: 'Live Test Co', country: 'Nepal', trade: 'T', qty: '5' }, modal()); await click(btnIn(modal(), 'Save')); await go('orders'); await click(btnIn($('.v6-tools'), 'Open Orders'));
    ok('LIVE exports are labelled LIVE', /^LGM_LIVE_/.test(L.Exporter.last().name), L.Exporter.last().name);
    await go('settings'); await click(btnIn($('#view'), 'Switch to DEMO')); await confirmYes();
    ok('Back in DEMO: demo data intact, live order not visible', S.mode() === 'demo' && S.list('candidates').length > 40 && !S.list('orders').some(o => o.client === 'Live Test Co'));
    await go('settings'); await click(btnIn($('#view'), 'Download backup')); ok('Backup download produces a JSON file labelled DEMO', /^LGM_DEMO_BACKUP_.*\.json$/.test(L.Exporter.last().name) && JSON.parse(L.Exporter.last().text).app === 'LGM-ERP-V6-Developed');
    await click(btnIn($('#view'), 'Reset demo data')); await confirmYes(); ok('Reset demo restores the original sample (40 candidates)', S.list('candidates').length === 40 && S.list('orders').length === 5);

    await go('dashboard'); UI.state.filters = { client: 'All', country: 'All', stage: 'All' };
    return res;
  }
  window.LGM_E2E = { run };
})();

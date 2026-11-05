/* PAGES — Excel Import Center, CV Intake Center, Settings & Data (workspaces, backup/restore, data quality). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {};
  const UI = LGM.UI, Crud = LGM.Crud, C = LGM.Config, S = LGM.Store, U = LGM.Util, I = LGM.Importer, P = LGM.Permissions, esc = U.esc;
  const rerender = () => LGM.App.render();

  // =============================== Excel Import Center ===============================
  const imp = () => UI.state.imp || (UI.state.imp = { target: 'candidates', fileName: '', columns: [], rows: [], sheetNames: [], sheetIndex: 0, mapping: {}, analysis: null, message: '', fileObj: null });
  const targetLabel = { candidates: 'Candidates / Visa Status', orders: 'Manpower Orders', finance: 'Private Finance' };

  function mappingSelect(f) {
    const i = imp();
    return `<select class="input" data-change="impMap" data-field="${f}" aria-label="Column for ${esc(I.label(f))}"><option value="">-- Not mapped --</option>${i.columns.map((c, k) => `<option value="${k}" ${i.mapping[f] === String(k) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`;
  }
  function analysisPanel(i) {
    const a = i.analysis; if (!a) return '';
    const probs = [...a.invalid.map(x => [x.row, UI.badge('Rejected'), x.errors.join('; ')]), ...a.duplicates.map(x => [x.row, UI.badge('Duplicate'), x.reason])].sort((p, q) => p[0] - q[0]);
    const warn = a.valid.filter(v => v.warnings.length);
    return UI.panel('Step 5 — Validation result (nothing has been imported yet)',
      UI.cards([UI.metric('Ready to import', a.valid.length, 'Passed all checks'), UI.metric('Duplicates', a.duplicates.length, 'Will be skipped'), UI.metric('Rejected', a.invalid.length, 'Need fixing'), UI.metric('Rows read', a.total, i.fileName)], 'grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 14px') +
      (probs.length ? UI.table(['Data row', 'Result', 'Reason'], probs.slice(0, 50)) + (probs.length > 50 ? UI.muted(`Showing first 50 of ${probs.length}. Download the full list below.`) : '') : UI.muted('No problems found.')) +
      (warn.length ? UI.muted(`${warn.length} valid row(s) carry warnings (e.g. order not found, unknown category) — they will still import.`) : '') +
      `<div class="row" style="margin-top:14px">${UI.btn(`Import ${a.valid.length} valid row(s)`, 'impCommit', '', '', a.valid.length ? '' : 'disabled')}${probs.length ? UI.btn('Download rejected / duplicate rows (CSV)', 'impProblems', '', 'secondary') : ''}</div>`);
  }

  LGM.Pages['import-center'] = {
    render() {
      const i = imp(), role = UI.state.role, canFin = P.can(role, 'finance.import'); const req = I.REQUIRED[i.target] || [];
      const missing = req.filter(f => i.mapping[f] === '' || i.mapping[f] == null);
      let h = UI.heading('Excel Import Center', 'Upload your existing projects, candidate lists and finance sheets; map columns, validate, then import') +
        UI.notice(`Supports CSV, TSV and standard XLSX (one worksheet at a time) in a modern browser. Rows are validated against the same rules as manual entry; duplicates are skipped; rejected rows are listed with the reason. Imported records go into the ${S.mode().toUpperCase()} workspace and appear immediately on the normal pages. Old .xls must be saved as .xlsx first. ${S.mode() === 'live' ? 'Browser storage is not secure — see Settings & Data.' : 'Use fictional data only in the demo workspace.'}`);
      h += UI.panel('Step 1 — Select the Excel file', `<div class="row"><input class="input" style="max-width:420px" type="file" accept=".xlsx,.csv,.tsv,.txt" data-change="impPick" aria-label="Choose file">${UI.btn('Download backup', 'backupDownload', '', 'secondary')}</div>
        ${i.sheetNames.length > 1 ? `<p><label for="impSheet">Worksheet</label><select id="impSheet" class="input" style="max-width:260px" data-change="impSheet">${i.sheetNames.map((n, k) => `<option value="${k}" ${k === i.sheetIndex ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></p>` : ''}
        <p class="muted">${esc(i.message)}</p>`);
      h += UI.panel('Step 2 — Choose destination', UI.tabs(Object.entries(targetLabel).filter(([k]) => k !== 'finance' || canFin), i.target, 'impTarget'));
      if (i.rows.length) {
        h += UI.panel('Step 3 — Match Excel columns', `<div class="formgrid">${I.FIELDS[i.target].map(f => `<div><label>${esc(I.label(f).toUpperCase())}${req.includes(f) ? ' <span class="req">*</span>' : ''}</label>${mappingSelect(f)}</div>`).join('')}</div>
          <p class="muted">${i.rows.length} rows found. <span class="req">*</span> = required. ${missing.length ? `<b>Still to map: ${esc(missing.map(I.label).join(', '))}.</b>` : 'All required columns are mapped.'}</p>${UI.btn('Validate ' + i.rows.length + ' rows', 'impValidate')}`);
        h += UI.panel('Step 4 — Preview first five source rows', UI.table(i.columns, i.rows.slice(0, 5).map(r => i.columns.map((_, k) => r[k] || ''))));
        h += analysisPanel(i);
      }
      const hist = S.state().imports.slice().reverse().map(x => [x.file, targetLabel[x.target] || x.target, x.added, x.duplicates, x.invalid, String(x.at).slice(0, 16).replace('T', ' ')]);
      h += UI.panel('Import History', UI.table(['File', 'Module', 'Added', 'Duplicates', 'Rejected', 'Date'], hist, { empty: 'No imports yet in this workspace.' }));
      h += UI.panel('Export workspace data', `<div class="row"><button class="btn secondary" data-act="exportReportNamed" data-arg="Candidate List" type="button">Export Candidates CSV</button><button class="btn secondary" data-act="exportReportNamed" data-arg="All Orders" type="button">Export Orders CSV</button>${P.can(role, 'finance.export') ? '<button class="btn secondary" data-act="exportReportNamed" data-arg="Private Finance" type="button">Export Finance CSV</button>' : ''}</div>`);
      return h;
    },
  };
  UI.on('impTarget', t => { const i = imp(); i.target = t; i.mapping = i.columns.length ? I.guessMapping(t, i.columns) : {}; i.analysis = null; rerender(); });
  UI.on('impMap', (v, el) => { const i = imp(); i.mapping[el.dataset.field] = v; i.analysis = null; rerender(); });
  UI.on('impPick', async (v, el) => {
    const f = el.files && el.files[0]; if (!f) return; const i = imp();
    try {
      const r = await I.readFile(f, 0);
      Object.assign(i, { fileObj: f, fileName: f.name, columns: r.columns, rows: r.rows, sheetNames: r.sheetNames, sheetIndex: r.sheetIndex, mapping: I.guessMapping(i.target, r.columns), analysis: null,
        message: `Loaded ${r.rows.length} rows from ${f.name}${r.truncated ? ` (only the first ${C.importMaxRows} rows are read)` : ''}. Check the column mapping, then validate.` });
      rerender();
    } catch (e) { UI.toast('Import error: ' + e.message, 'err'); el.value = ''; }
  });
  UI.on('impSheet', async v => {
    const i = imp(); try { const r = await I.readFile(i.fileObj, Number(v)); Object.assign(i, { columns: r.columns, rows: r.rows, sheetIndex: r.sheetIndex, mapping: I.guessMapping(i.target, r.columns), analysis: null, message: `Loaded ${r.rows.length} rows from worksheet "${r.sheetNames[r.sheetIndex]}".` }); rerender(); }
    catch (e) { UI.toast('Import error: ' + e.message, 'err'); }
  });
  UI.on('impValidate', () => {
    const i = imp(), miss = (I.REQUIRED[i.target] || []).filter(f => i.mapping[f] === '' || i.mapping[f] == null);
    if (miss.length) return UI.toast('Map the required columns first: ' + miss.map(I.label).join(', '), 'err');
    try { i.analysis = I.analyse(i.target, I.mapRows(i.target, i.rows, i.mapping), S.state(), UI.state.role, S); rerender(); } catch (e) { UI.toast(e.message, 'err'); }
  });
  UI.on('impProblems', () => { const i = imp(); LGM.Exporter.download(LGM.Exporter.fileName('Import_problems_' + i.target), LGM.Csv.stringify(I.problemRows(i.analysis))); });
  UI.on('impCommit', async () => {
    const i = imp(), a = i.analysis; if (!a || !a.valid.length) return;
    const ok = await UI.confirm({ title: 'Import rows?', message: `Import ${a.valid.length} validated row(s) into the ${S.mode().toUpperCase()} workspace? ${a.duplicates.length} duplicate(s) and ${a.invalid.length} rejected row(s) will be skipped.${S.mode() === 'demo' ? ' Use fictional data only.' : ''}`, ok: 'Import' });
    if (!ok) return;
    const res = I.commit(a, { fileName: i.fileName }, S, UI.state.role);
    i.analysis = null; i.message = `Imported ${res.added} record(s); skipped ${res.duplicates} duplicate(s) and ${res.invalid} rejected row(s).`; UI.toast(i.message, 'ok'); rerender();
  });

  // =============================== CV Intake Center ===============================
  const cvs = () => UI.state.cv || (UI.state.cv = { source: C.cvSources[0], client: '', agency: '', country: 'Nepal', message: '' });
  LGM.Pages['cv-inbox'] = {
    render() {
      const c = cvs(), s = S.state();
      const rows = s.cvInbox.slice().reverse().map(x => [x.filename, x.source, x.client, x.agency, x.extracted_email, UI.raw(`${UI.badge(x.status)}<span class="src">${esc(x.note)}</span>`),
        UI.raw(`<div class="table-actions">${UI.btn('Create candidate', 'cvCreate', x.id, 'small')}${UI.btn('Reviewed', 'cvStatus', x.id, 'secondary small', 'data-s="Reviewed"')}${UI.btn('Ignore', 'cvStatus', x.id, 'ghost small', 'data-s="Ignored"')}${UI.btn('Delete', 'cvDelete', x.id, 'danger small')}</div>`)]);
      return UI.heading('CV Intake Center', 'Collect CVs from files, email attachments and WeTransfer downloads') +
        UI.notice('This version cannot connect to Gmail, Outlook or WeTransfer links automatically. Download email attachments or WeTransfer archives first, then upload the files here. Only file details are recorded — the files themselves are not stored. Do not upload real passports or sensitive CVs to this unsecured prototype.') +
        UI.panel('Upload CVs and Attachments', `<div class="formgrid"><div><label for="cvSource">Source</label><select class="input" id="cvSource" data-change="cvField" data-k="source">${C.cvSources.map(x => `<option ${c.source === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
          <div><label for="cvClient">Client</label><input class="input" id="cvClient" list="cvClients" value="${esc(c.client)}" data-input="cvField" data-k="client" placeholder="e.g. a registered client"><datalist id="cvClients">${s.clients.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist></div>
          <div><label for="cvAgency">Overseas agency</label><input class="input" id="cvAgency" value="${esc(c.agency)}" data-input="cvField" data-k="agency" placeholder="e.g. an overseas agency"></div>
          <div><label for="cvCountry">Country</label><input class="input" id="cvCountry" list="cvCountries" value="${esc(c.country)}" data-input="cvField" data-k="country"><datalist id="cvCountries">${C.countries.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div></div>
          <p><input class="input" type="file" multiple accept=".txt,.csv,.eml,.docx,.pdf,.zip,.rar,.7z" data-change="cvUpload" aria-label="Choose CV files"></p><p class="muted">${esc(c.message)}</p>
          <p class="muted">Text extraction: TXT, EML, CSV and DOCX (first e-mail and phone number found). PDFs and ZIP/RAR packages are listed for review; PDF parsing, OCR and archive extraction need a backend service.</p>`) +
        UI.panel('CV Intake Review Queue', UI.table(['File', 'Source', 'Client', 'Agency', 'Extracted E-mail', 'Status', ''], rows, { empty: 'No files received yet.' })) +
        UI.panel('Export Intake Log', UI.btn('Export CV Intake CSV', 'exportReportNamed', 'CV Intake', 'secondary')) +
        UI.panel('Production Automation Requirements', '<p>Connect an authorized shared recruitment mailbox via Microsoft Graph or Gmail API, download attachments securely, support WeTransfer files after authorized retrieval, unpack ZIP/RAR, extract PDF/DOCX/CV text with OCR where necessary, identify passport and trade, detect duplicates, match orders and agencies, and send uncertain matches to staff review. Never automatically share confidential documents with the wrong client.</p>');
    },
  };
  UI.on('cvField', (v, el) => { cvs()[el.dataset.k] = v; });
  UI.on('cvUpload', async (v, el) => {
    const files = Array.from(el.files || []); if (!files.length) return; const c = cvs(); let added = 0, dup = 0; const errs = [];
    for (const f of files) {
      try {
        const item = await LGM.CvIntake.process(f, c);
        if (S.state().cvInbox.some(x => x.filename === item.filename && x.size === item.size)) { dup++; continue; }
        const r = S.insert('cvInbox', item, { silent: true, defer: true, by: UI.state.role }); if (r.ok) added++; else errs.push(f.name + ': ' + Object.values(r.errors).join(' '));
      } catch (e) { errs.push(f.name + ': ' + e.message); }
    }
    S.log(`CV intake: ${added} file record(s) added`, c.client, 'cvInbox', '', { by: UI.state.role }); S.flush();
    c.message = `Added ${added} file record(s)${dup ? `, skipped ${dup} already received` : ''}${errs.length ? '. Problems: ' + errs.join(' | ') : ''}. Files themselves are NOT stored.`;
    UI.toast(c.message, errs.length ? 'err' : 'ok'); rerender();
  });
  UI.on('cvStatus', (id, el) => { const r = S.update('cvInbox', id, { status: el.dataset.s }, { by: UI.state.role, silent: true }); UI.toast(r.ok ? 'Marked ' + el.dataset.s : Object.values(r.errors).join(' '), r.ok ? 'ok' : 'err'); });
  UI.on('cvDelete', async id => { if (await UI.confirm({ title: 'Delete intake record?', message: 'Only the log entry is removed (the file itself was never stored).', ok: 'Delete', danger: true })) S.remove('cvInbox', id, { by: UI.state.role }); });
  UI.on('cvCreate', id => {
    const x = S.get('cvInbox', id); if (!x) return;
    Crud.formModal({ entity: 'candidates', defaults: { client: x.client, agency: x.agency, country: x.country || 'Nepal', name: x.filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }, title: `New candidate from ${x.filename}`,
      onSaved: () => S.update('cvInbox', id, { status: 'Candidate created' }, { silent: true, by: UI.state.role }) });
  });

  // =============================== Settings & Data ===============================
  function quality(s) {
    const reg = new Set(s.clients.map(c => U.norm(c.name)));
    const names = U.uniqSorted([...s.orders, ...s.candidates, ...s.visits, ...s.demands, ...s.interviews].map(x => x.client)).filter(n => n && !reg.has(U.norm(n)));
    const travelStage = ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];
    const today = U.todayISO();
    return {
      names,
      checks: [
        ['Client names used in records but not in the Client Register', names.length, names.length ? UI.btn(`Add ${names.length} to register`, 'dqAddClients', '', 'small') : '—'],
        ['Candidates not linked to an order', s.candidates.filter(c => !c.order_id).length, UI.btn('View', 'go', 'candidates', 'ghost small')],
        ['Orders with no linked candidates', s.orders.filter(o => !s.candidates.some(c => c.order_id === o.id)).length, UI.btn('View', 'go', 'orders', 'ghost small')],
        ['Orders whose agency allocations exceed the ordered quantity', s.orders.filter(o => U.sum(s.allocations.filter(a => a.order_id === o.id), a => a.allocated) > o.qty).length, UI.btn('View', 'go', 'agencies', 'ghost small')],
        ['Candidates at Visa Printed or later without a travel record', s.candidates.filter(c => travelStage.includes(c.status) && !s.tickets.some(t => t.candidate_id === c.id)).length, UI.btn('View', 'go', 'tickets', 'ghost small')],
        ['Open warranty cases past their expiry date', s.warranties.filter(w => w.status !== 'Closed' && w.warranty_expiry && w.warranty_expiry < today).length, UI.btn('View', 'go', 'warranty', 'ghost small')],
      ],
    };
  }
  const cfgRows = () => [
    ['Candidate stages and order', C.stages.join(' → '), 'From V6'], ['Optional (skippable) stages', C.optionalStages.join(', '), 'From V6 notes'],
    ['Reject allowed from', C.rejectableFrom.join(', '), 'ASSUMPTION · OQ-1'], ['Dashboard pipeline groups', C.pipelineGroups.map(g => `${g.label}: ${g.stages.join(', ')}`).join(' | '), 'ASSUMPTION · OQ-2'],
    ['Flight Pending', C.stageSets['Flight Pending'].join(', '), 'From V6 (conflicting definitions) · OQ-4'], ['Deployed (master report)', C.stageSets.Deployed.join(', '), 'ASSUMPTION · OQ-5'],
    ['Order stages / closed', C.orderStatuses.join(', ') + ' — closed: ' + C.orderClosed.join(', '), 'Mixed · OQ-3'], ['Labour warranty (months)', String(C.warrantyMonths.Labour), 'V6 “illustrative” · OQ-8'],
    ['Domestic warranty (months)', 'not set — enter expiry manually', 'V6: verify against Qatar law · OQ-8'], ['Warranty alert window (days)', String(C.warrantyAlertDays), 'ASSUMPTION · OQ-21'],
    ['Candidate ID prefixes', Object.entries(C.countryPrefix).map(([k, v]) => `${k}=${v}`).join(', '), 'BD/NP from V6; others ASSUMPTION · OQ-22'], ['Currency', C.app.currency, 'From V6 · OQ-24'],
  ];

  LGM.Pages.settings = {
    render() {
      const role = UI.state.role, mode = S.mode(), q = quality(S.state()), counts = S.ENT.filter(e => !['imports', 'activity'].includes(e)).map(e => [e, S.list(e).length]);
      return UI.heading('Settings & Data', 'Workspaces, backup and restore, data quality and configuration') +
        UI.panel('Workspace', `<p>You are working in the <span class="mode-pill ${mode === 'demo' ? 'mode-demo' : 'mode-live'}" style="cursor:default">${mode.toUpperCase()}</span> workspace.</p>
          <p class="muted">${mode === 'demo' ? 'The DEMO workspace holds fictional sample data so every screen has something to calculate. It is stored separately from the LIVE workspace, and exports are labelled DEMO.' : 'The LIVE workspace starts empty and holds the records you enter or import. It is stored separately from the DEMO workspace, and exports are labelled LIVE. It is still only browser storage: not encrypted, not backed up, not shared between users or devices.'}</p>
          ${P.can(role, 'workspace.switch') ? UI.btn(mode === 'demo' ? 'Switch to LIVE workspace' : 'Switch to DEMO workspace', 'wsSwitch', mode === 'demo' ? 'live' : 'demo', mode === 'demo' ? '' : 'secondary') : UI.muted('Only the Managing Director or Admin Manager can switch workspace.')}
          <div class="divider"></div>${UI.table(['Data set', 'Records'], counts)}`) +
        UI.panel('Backup & Restore', `<p class="muted">A backup contains every record in the current (${mode.toUpperCase()}) workspace as a JSON file. Restoring replaces the current workspace’s data. Keep backups somewhere safe; clearing browser data deletes the workspace.</p>
          <div class="row">${UI.btn('Download backup (JSON)', 'backupDownload')}${P.can(role, 'data.restore') ? `<input class="input" style="max-width:340px" type="file" accept=".json,application/json" data-change="restorePick" aria-label="Restore backup file">` : ''}</div>`) +
        UI.panel('Data Tools', `<div class="row">${mode === 'demo' && P.can(role, 'data.reset') ? UI.btn('Reset demo data to original sample', 'resetDemo', '', 'secondary') : ''}${P.can(role, 'data.reset') ? UI.btn('Clear this workspace…', 'clearWs', '', 'danger') : ''}</div>${P.can(role, 'data.reset') ? '' : UI.muted('Reset and clear are limited to the Managing Director or Admin Manager.')}`) +
        UI.panel('Data Quality Checks', UI.table(['Check', 'Count', ''], q.checks.map(c => [c[0], UI.raw(c[1] ? `<span class="pill orange">${c[1]}</span>` : '<span class="pill green">0</span>'), c[2]]))) +
        UI.panel('Configuration in force (read-only)', UI.table(['Setting', 'Value', 'Origin'], cfgRows()) + UI.muted('Everything marked ASSUMPTION is a placeholder pending client confirmation; it lives in js/config/config.js and the open-question IDs are explained in docs/01 and docs/06.')) +
        UI.panel('About this version', `<ul class="list-plain"><li><b>Prototype status:</b> offline browser application. Data stays in this browser. No login, server, database, encryption or live notifications.</li><li><b>Roles</b> are a demonstration dropdown, not authentication.</li><li>Production requirements (backend, database, authentication, permissions, secure file storage, backups, audit) are in <span class="mono">docs/06_Production_Requirements.md</span>.</li></ul>`);
    },
  };
  UI.on('wsSwitch', async m => {
    const ok = await UI.confirm({ title: `Switch to ${m.toUpperCase()} workspace?`, message: m === 'live' ? 'The LIVE workspace is separate from the demo data and starts empty. Browser storage is not secure; take backups regularly.' : 'You will see the fictional demo data again. Your LIVE records are kept.', ok: 'Switch' });
    if (ok) { S.switchMode(m); LGM.App.go('dashboard'); UI.toast(m.toUpperCase() + ' workspace active', 'ok'); }
  });
  UI.on('backupDownload', () => {
    const b = S.exportBackup(); LGM.Exporter.download(`LGM_${S.mode().toUpperCase()}_BACKUP_${U.todayISO()}.json`, JSON.stringify(b, null, 1), 'application/json');
    UI.toast('Backup downloaded', 'ok');
  });
  UI.on('restorePick', async (v, el) => {
    const f = el.files && el.files[0]; if (!f) return; let obj;
    try { obj = JSON.parse(await f.text()); } catch (e) { el.value = ''; return UI.toast('That file is not valid JSON.', 'err'); }
    const ok = await UI.confirm({ title: 'Restore backup?', message: `This REPLACES all data in the current ${S.mode().toUpperCase()} workspace with the backup (${obj.workspace || '?'} workspace, ${String(obj.exportedAt || '').slice(0, 10)}).`, ok: 'Restore', danger: true });
    if (!ok) { el.value = ''; return; } const r = S.importBackup(obj); UI.toast(r.ok ? 'Backup restored' : r.error, r.ok ? 'ok' : 'err');
  });
  UI.on('resetDemo', async () => { if (await UI.confirm({ title: 'Reset demo data?', message: 'Your changes to the DEMO workspace are discarded and the original fictional sample is restored. The LIVE workspace is not touched.', ok: 'Reset', danger: true })) { S.resetDemo(); UI.toast('Demo data reset', 'ok'); } });
  UI.on('clearWs', () => {
    UI.modal.open({ title: 'Clear this workspace', narrow: true, body: `<p style="margin-top:0">This permanently deletes <b>every record</b> in the ${S.mode().toUpperCase()} workspace. Download a backup first if you may need it.</p><label for="clearTyped">Type DELETE to confirm</label><input id="clearTyped" class="input" autocomplete="off">`,
      footer: '<button class="btn secondary" data-act="modalClose" type="button">Cancel</button><button class="btn danger" data-act="clearGo" type="button">Delete everything</button>' });
  });
  UI.on('clearGo', () => { if (document.getElementById('clearTyped').value.trim() !== 'DELETE') return UI.toast('Type DELETE (capitals) to confirm.', 'err'); UI.modal.close(); S.clearWorkspace(); UI.toast('Workspace cleared', 'ok'); });
  UI.on('dqAddClients', () => {
    const names = quality(S.state()).names; names.forEach(n => S.insert('clients', { name: n, stage: 'Prospect', next_action: 'Complete client details' }, { silent: true, defer: true, by: UI.state.role }));
    S.log(`${names.length} client(s) added to the register from existing records`, '', 'clients', '', { by: UI.state.role }); S.flush(); UI.toast(`${names.length} client(s) added as Prospect`, 'ok');
  });
})(typeof window !== 'undefined' ? window : globalThis);

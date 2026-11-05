/* IMPORT PIPELINE — read file → map columns → validate every row → plan (valid / duplicate / invalid) → commit.
   Same targets, field lists and aliases as V6. Differences (all fixes for defects D-1, D-2, D-8):
   • imported rows are written to the SAME stores the pages read (not a hidden side store)
   • each row is validated with the same schema/rules as manual entry; rejected rows are reported with reasons
   • duplicates are checked against ALL existing records, not just earlier imports
   • Excel dates become ISO dates; day-first d/m/y text dates are accepted (ASSUMPTION, OQ-19) */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util, R = LGM.Rules, Lc = LGM.Lifecycle;
  const n = U.norm;

  const FIELDS = {
    candidates: ['candidate_name', 'passport', 'client', 'country', 'agency', 'trade', 'status', 'visa_number', 'qvc_date', 'flight_date', 'order_id'],
    orders: ['client', 'country', 'agency', 'trade', 'quantity', 'status', 'order_id'],
    finance: ['date', 'division', 'direction', 'account', 'party', 'client', 'country', 'order', 'category', 'amount', 'ref', 'note'],
  };
  const REQUIRED = {
    candidates: ['candidate_name', 'client', 'country', 'trade'],
    orders: ['client', 'country', 'trade', 'quantity'],
    finance: ['date', 'direction', 'party', 'category', 'amount'],
  };
  // V6 v5Aliases (unchanged) + a few obvious header spellings.
  const ALIASES = {
    candidate_name: ['name', 'candidate', 'candidate name', 'full name', 'worker name'],
    passport: ['passport', 'passport number', 'passport no', 'pp no'],
    client: ['client', 'company', 'company name', 'employer', 'qatar company'],
    country: ['country', 'nationality', 'source country'],
    agency: ['agency', 'agent', 'recruitment agency', 'overseas agency'],
    trade: ['trade', 'profession', 'category', 'job title', 'position'],
    status: ['status', 'visa status', 'stage', 'current status'],
    visa_number: ['visa number', 'visa no', 'vp number'],
    qvc_date: ['qvc date', 'appointment date'],
    flight_date: ['flight date', 'travel date', 'ticket date'],
    order_id: ['order id', 'order no', 'demand number'],
    quantity: ['quantity', 'qty', 'required', 'total'],
    date: ['date', 'transaction date', 'payment date'],
    division: ['division', 'business', 'business division'],
    direction: ['direction', 'type', 'incoming outgoing', 'receipt payment'],
    account: ['account', 'payment method', 'bank cash'],
    party: ['party', 'agency name', 'paid to', 'received from', 'customer'],
    order: ['order', 'order ref'],
    amount: ['amount', 'qar', 'total amount'],
    ref: ['reference', 'receipt no', 'transaction id'],
    note: ['remarks', 'notes', 'description'],
    category: ['expense type', 'category', 'purpose'],
  };
  const label = f => f.replace(/_/g, ' ');

  /** Read a File-like ({name, text(), arrayBuffer()}) → {columns, rows, sheetNames, sheetIndex, truncated}. */
  async function readFile(file, sheetIndex = 0) {
    const name = (file.name || '').toLowerCase();
    let table, sheetNames = [], idx = 0;
    if (/\.(csv|tsv|txt)$/.test(name)) table = LGM.Csv.parse(await file.text());
    else if (name.endsWith('.xlsx')) { const r = await LGM.Xlsx.read(await file.arrayBuffer(), sheetIndex); table = r.rows; sheetNames = r.sheetNames; idx = r.sheetIndex; }
    else throw new Error('Upload .xlsx, .csv or .tsv. Old .xls files must be saved as .xlsx first.');
    if (table.length < 2) throw new Error('No data rows found (a header row and at least one data row are required).');
    const columns = table[0].map((x, i) => String(x).trim() || 'Column ' + (i + 1));
    let rows = table.slice(1).filter(r => r.some(x => String(x).trim()));
    const truncated = rows.length > C.importMaxRows; if (truncated) rows = rows.slice(0, C.importMaxRows);
    return { columns, rows, sheetNames, sheetIndex: idx, truncated, fileName: file.name };
  }

  function guessMapping(target, columns) {
    const used = new Set(), map = {};
    for (const f of FIELDS[target]) {
      const opts = [label(f), ...(ALIASES[f] || [])].map(n);
      const i = columns.findIndex((c, ci) => !used.has(ci) && opts.includes(n(c)));
      map[f] = i < 0 ? '' : String(i); if (i >= 0) used.add(i);
    }
    return map;
  }
  const mapRows = (target, rows, mapping) => rows.map(row => Object.fromEntries(FIELDS[target].map(f => [f, mapping[f] === '' || mapping[f] == null ? '' : String(row[Number(mapping[f])] == null ? '' : row[Number(mapping[f])]).trim()])));

  const OUT = /(^|\b)(out|outgoing|expense|payment|paid|debit|dr)\b/i, INN = /^(in|incoming|receipt|received|credit|cr)\b/i;

  /** Convert one mapped row to {input, ctx, key, errors[], warnings[]} for the target. */
  function normaliseRow(target, r, state, role) {
    const errors = [], warnings = [], input = {}, ctx = {};
    const need = REQUIRED[target].filter(f => !r[f]);
    if (need.length) errors.push('Missing required: ' + need.map(label).join(', '));
    if (target === 'candidates') {
      Object.assign(input, { name: r.candidate_name, passport: r.passport, client: r.client, order_id: r.order_id, country: r.country, agency: r.agency, trade: r.trade, visa_number: r.visa_number, qvc_date: r.qvc_date, flight_date: r.flight_date });
      if (r.status) { const st = Lc.canonical(r.status); if (st) input.status = st; else errors.push(`Unknown status "${r.status}"`); }
      return { input, ctx, errors, warnings, entity: 'candidates', key: R.candidateKey({ passport: r.passport, name: r.candidate_name, client: r.client }) };
    }
    if (target === 'orders') {
      Object.assign(input, { client: r.client, country: r.country, agency: r.agency, trade: r.trade, qty: r.quantity });
      if (r.status) { const st = C.orderStatuses.find(x => n(x) === n(r.status)); if (st) input.status = st; else errors.push(`Unknown order stage "${r.status}"`); }
      if (r.order_id) {
        if (state.orders.some(o => n(o.id) === n(r.order_id) && R.orderKey(o) !== R.orderKey({ id: r.order_id, client: r.client, country: r.country, trade: r.trade }))) errors.push(`Order id ${r.order_id} is already used by a different order`);
        else ctx.id = r.order_id.trim();
      }
      return { input, ctx, errors, warnings, entity: 'orders', key: R.orderKey({ id: r.order_id, client: r.client, country: r.country, trade: r.trade }) };
    }
    // finance
    const division = /domestic/i.test(r.division) ? 'domestic' : 'labour';
    let direction = '';
    if (r.direction) { if (OUT.test(r.direction)) direction = 'Outgoing'; else if (INN.test(r.direction)) direction = 'Incoming'; else errors.push(`Direction "${r.direction}" is not Incoming/Outgoing`); }
    const account = r.account ? C.financeAccounts.find(a => n(a) === n(r.account)) || null : C.financeDefaultAccount[division];
    if (r.account && !account) errors.push(`Account "${r.account}" is not one of ${C.financeAccounts.join(', ')}`);
    let category = C.financeCategories.find(c => n(c) === n(r.category)) || '', note = r.note;
    if (r.category && !category) { category = 'Other'; note = (note ? note + ' | ' : '') + 'Original category: ' + r.category; warnings.push(`Category "${r.category}" mapped to Other`); }
    const amount = U.num(r.amount);
    Object.assign(input, { date: r.date, division, direction, account: account || '', party: r.party, client: r.client, country: r.country, order: r.order, category, amount: Number.isFinite(amount) ? amount : r.amount, ref: r.ref, note });
    return { input, ctx, errors, warnings, entity: 'finance', key: R.financeKey({ date: U.parseDate(r.date) || r.date, ref: r.ref, party: r.party, amount: Number.isFinite(amount) ? amount : r.amount, direction }) };
  }

  /** Dry run. Returns { target, total, valid[], duplicates[], invalid[] } — nothing is written. */
  function analyse(target, mapped, state, role, store) {
    if (target === 'finance' && !LGM.Permissions.can(role, 'finance.import')) throw new Error('Finance import is restricted to Managing Director and Admin Manager.');
    const out = { target, total: mapped.length, valid: [], duplicates: [], invalid: [] };
    const batch = new Set();
    const existing = target === 'orders' ? new Set([...state.orders.map(o => R.orderKey(o)), ...state.orders.map(o => o._key).filter(Boolean)])
      : target === 'finance' ? new Set(state.finance.map(f => R.financeKey(f))) : null;
    mapped.forEach((r, i) => {
      const row = i + 1; const x = normaliseRow(target, r, state, role);
      if (x.errors.length) return out.invalid.push({ row, errors: x.errors, raw: r });
      if (batch.has(x.key) || (existing && existing.has(x.key))) return out.duplicates.push({ row, reason: batch.has(x.key) ? 'Duplicate of an earlier row in this file' : 'Already exists', raw: r });
      const p = store.preview(x.entity, x.input);
      if (!p.ok) {
        const msgs = Object.values(p.errors);
        if (target === 'candidates' && Object.values(p.errors).some(m => /^Duplicate of/.test(m))) return out.duplicates.push({ row, reason: msgs.join('; '), raw: r });
        return out.invalid.push({ row, errors: msgs, raw: r });
      }
      batch.add(x.key);
      out.valid.push({ row, entity: x.entity, input: x.input, ctx: x.ctx, key: x.key, warnings: x.warnings.concat(p.warnings), raw: r });
    });
    return out;
  }

  /** Write the valid rows. Returns { added, duplicates, invalid, errors[] }. */
  function commit(analysis, meta, store, role) {
    let added = 0; const late = [];
    analysis.valid.forEach(v => {
      const res = store.insert(v.entity, v.input, { silent: true, defer: true, by: role, id: v.ctx.id, extra: { _src: { file: meta.fileName, row: v.row, at: new Date().toISOString() }, _key: v.key } });
      if (res.ok) added++; else late.push({ row: v.row, errors: Object.values(res.errors), raw: v.raw });
    });
    const invalid = analysis.invalid.length + late.length;
    store.state().imports.push({ id: U.uid('imp'), file: meta.fileName, target: analysis.target, added, duplicates: analysis.duplicates.length, invalid, at: new Date().toISOString(), by: role });
    store.log(`Import ${meta.fileName}: ${added} added, ${analysis.duplicates.length} duplicate(s) skipped, ${invalid} rejected (${analysis.target})`, '', 'import', '', { by: role });
    store.flush();
    return { added, duplicates: analysis.duplicates.length, invalid, late };
  }

  /** Rejected/duplicate rows as a CSV-able table so staff can fix and re-import. */
  function problemRows(analysis, columns, mapped) {
    const head = ['data_row', 'problem', ...FIELDS[analysis.target].map(label)];
    const lines = [...analysis.invalid.map(x => [x.row, 'REJECTED: ' + x.errors.join('; '), x.raw]), ...analysis.duplicates.map(x => [x.row, 'DUPLICATE: ' + x.reason, x.raw])]
      .sort((a, b) => a[0] - b[0]).map(([row, why, raw]) => [row, why, ...FIELDS[analysis.target].map(f => raw[f])]);
    return [head, ...lines];
  }

  LGM.Importer = { FIELDS, REQUIRED, ALIASES, readFile, guessMapping, mapRows, analyse, commit, problemRows, label };
})(typeof window !== 'undefined' ? window : globalThis);

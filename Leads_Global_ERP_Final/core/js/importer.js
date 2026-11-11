/* ERP core · importer.js — CSV import with a real preview.
   1. headers are matched to fields (by key, label or field.aliases);
   2. every row is run through the SAME validation and hooks as a form (store.create inside store.simulate, then rolled back),
      so the preview shows exactly what would happen: new / duplicate / invalid with the reason;
   3. nothing is written until commit(); commit is one atomic batch.
   Linked fields accept the other record's id or its name (resolved inside the same scope). */
(function (g) {
  'use strict';
  const ERP = g.ERP = g.ERP || {};
  const U = ERP.util;

  const csvFields = (store, entity, scope) => store.fieldsFor(entity, scope).filter(f => f.type !== 'file' && !f.computed);

  function template(store, entity, scope) {
    const fs = csvFields(store, entity, scope);
    return U.csvStringify([fs.map(f => f.key)]) + '\r\n';
  }
  function mapHeaders(store, entity, scope, headers) {
    const fs = csvFields(store, entity, scope), map = {};
    headers.forEach(h => {
      const n = U.norm(h);
      const f = fs.find(x => U.norm(x.key) === n || U.norm(x.label) === n || (x.aliases || []).some(a => U.norm(a) === n));
      map[h] = f ? f.key : null;
    });
    return map;
  }
  function convert(store, f, raw, scope) {
    let v = String(raw == null ? '' : raw).trim();
    if (v === '') return { value: '' };
    if (f.type === 'number') { const n = Number(v.replace(/,/g, '')); return Number.isFinite(n) ? { value: n } : { value: v }; }
    if (f.type === 'date') {
      if (U.isValidISO(v)) return { value: v };
      const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);   // day-first, as used in Qatar / South Asia
      if (m) { const iso = m[3] + '-' + U.pad(m[2], 2) + '-' + U.pad(m[1], 2); return { value: U.isValidISO(iso) ? iso : v }; }
      return { value: v };
    }
    if (f.type === 'ref') {
      if (store.get(f.ref, v)) return { value: v };
      const rec = store.byName(f.ref, v, store.isScoped(f.ref) ? scope : null);
      return rec ? { value: rec.id } : { value: v, error: f.label + ': "' + v + '" was not found.' };
    }
    if (f.type === 'select') { const o = store.optionsFor(f, scope, {}).find(x => U.norm(x) === U.norm(v)); return { value: o || v }; }
    return { value: v };
  }
  function analyse(store, entity, scope, text, by) {
    const rows = U.csvParse(text);
    if (rows.length < 2) return { ok: false, error: 'The file has no data rows.' };
    const headers = rows[0].map(h => String(h).trim()), map = mapHeaders(store, entity, scope, headers);
    if (!headers.some(h => map[h])) return { ok: false, error: 'None of the column headings match this table. Download the template and use its headings.' };
    const fs = csvFields(store, entity, scope), items = [];
    store.simulate(() => {
      rows.slice(1).forEach((cells, i) => {
        const values = {}, pre = [];
        headers.forEach((h, c) => { const key = map[h]; if (!key) return; const f = fs.find(x => x.key === key), r = convert(store, f, cells[c], scope); values[key] = r.value; if (r.error) pre.push(r.error); });
        if (store.isScoped(entity)) values[store.scopeField] = scope;
        if (pre.length) { items.push({ line: i + 2, status: 'invalid', errors: pre, values }); return; }
        const res = store.create(entity, values, { scope, by: by || 'CSV import', note: 'imported' });
        if (res.ok) items.push({ line: i + 2, status: 'new', errors: [], values, warnings: res.warnings || [] });
        else { const msgs = Object.values(res.errors); items.push({ line: i + 2, status: msgs.some(m => /^Duplicate/.test(m)) ? 'duplicate' : 'invalid', errors: msgs, values }); }
      });
    });
    const sum = { total: items.length, valid: items.filter(x => x.status === 'new').length, duplicate: items.filter(x => x.status === 'duplicate').length, invalid: items.filter(x => x.status === 'invalid').length };
    return { ok: true, headers, map, unknown: headers.filter(h => !map[h]), items, summary: sum };
  }
  /** Writes the rows that were previewed as "new". One atomic batch: all or nothing. */
  function commit(store, entity, scope, items, by) {
    const good = items.filter(x => x.status === 'new'); let added = 0; const failed = [];
    store.batch(() => {
      good.forEach(x => { const r = store.create(entity, x.values, { scope, by: by || 'CSV import', note: 'imported' }); if (r.ok) added++; else failed.push({ line: x.line, errors: Object.values(r.errors) }); });
      store.logAudit('import', entity, '', 'CSV import: ' + added + ' added, ' + failed.length + ' failed', by || 'CSV import'); store.touch();
    });
    return { added, failed };
  }
  function exportRows(store, entity, scope, rows) {
    const fs = csvFields(store, entity, scope), head = ['id'].concat(fs.map(f => f.key));
    const body = rows.map(r => [r.id].concat(fs.map(f => (f.type === 'ref' ? store.display(f.ref, store.get(f.ref, r[f.key])) : r[f.key]))));
    return U.csvStringify([head].concat(body));
  }

  ERP.importer = { template, mapHeaders, analyse, commit, exportRows };
})(typeof window !== 'undefined' ? window : globalThis);

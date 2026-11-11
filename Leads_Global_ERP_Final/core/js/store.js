/* ERP core · store.js — data layer: records, IDs, validation, references, history, audit, backup.
   Knows NOTHING about recruitment, CRM or any other business. Everything it needs comes from the config object:
     config.id, config.scope {field,values,default}, config.entities{...}, config.hooks{beforeSave,afterSave,beforeDelete}

   Record rules
   • every record has a stable id  (<prefix>-0001, per entity)  — records reference each other by id, never by name
   • scoped entities carry the scope field (e.g. division) and can never move to another scope
   • tracked fields (entity.track) write a history event on every change (from → to, when, by, why)
   • every create / update / delete / import / restore writes an audit entry
   • a multi-record operation (batch) is atomic: if anything throws, nothing is saved. */
(function (g) {
  'use strict';
  const ERP = g.ERP = g.ERP || {};
  const U = ERP.util;
  const SCHEMA = 1;

  function Store(config, adapter) {
    const listeners = [];
    let depth = 0, dirty = false, state = blank();

    function blank() {
      const data = {}; Object.keys(config.entities).forEach(k => { data[k] = []; });
      return { format: 'erp-data', schema: SCHEMA, projectId: config.id, counters: {}, data, history: [], audit: [] };
    }
    function load() {
      const saved = adapter.load();
      if (!saved) { state = blank(); return; }
      const check = validateBackup(saved, true);
      if (check.errors.length) throw new Error('Stored data is not usable: ' + check.errors[0]);
      state = adopt(saved);
    }
    function adopt(o) {   // fill any entity added to the config since the data was saved
      const s = Object.assign(blank(), U.clone(o)); Object.keys(config.entities).forEach(k => { if (!Array.isArray(s.data[k])) s.data[k] = []; });
      s.counters = s.counters || {}; s.history = s.history || []; s.audit = s.audit || []; s.projectId = config.id; return s;
    }

    /* ---------- schema helpers ---------- */
    const scopeCfg = config.scope || null, scopeField = scopeCfg ? scopeCfg.field : null;
    const ent = k => { const e = config.entities[k]; if (!e) throw new Error('Unknown entity: ' + k); return e; };
    const isScoped = k => !!(scopeCfg && ent(k).scoped);
    function fieldsFor(k, scope) {
      const e = ent(k), f = e.fields;
      const list = Array.isArray(f) ? f : (f[scope] || f.default || []);
      return list.filter(x => !x.scopes || !scope || x.scopes.includes(scope));
    }
    const label = (k, scope) => { const e = ent(k), o = scope && e.labels && e.labels.byScope && e.labels.byScope[scope]; return Object.assign({ label: e.label, plural: e.plural }, o || {}); };
    function display(k, r) { if (!r) return ''; const e = ent(k); if (e.display) return e.display(r, api); return r.name || r.title || r.id; }

    /* ---------- reads ---------- */
    const all = k => { ent(k); return state.data[k]; };
    const get = (k, id) => all(k).find(r => r.id === id) || null;
    function list(k, filter) {
      const rows = all(k);
      if (!filter) return rows.slice();
      if (typeof filter === 'function') return rows.filter(filter);
      return rows.filter(r => Object.keys(filter).every(f => matches(r[f], filter[f])));
    }
    function matches(v, spec) {
      if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
        if ('nonEmpty' in spec) return spec.nonEmpty ? (v !== undefined && v !== null && String(v) !== '') : (v === undefined || v === null || String(v) === '');
        if ('in' in spec) return spec.in.includes(v);
        if ('not' in spec) return v !== spec.not;
      }
      return v === spec;
    }
    const count = (k, filter) => list(k, filter).length;
    const byName = (k, name, scope) => { const n = U.norm(name); return all(k).find(r => U.norm(display(k, r)) === n && (!scope || !isScoped(k) || r[scopeField] === scope)) || null; };

    /* ---------- history / audit ---------- */
    function logAudit(action, entity, recordId, summary, by) { state.audit.push({ at: new Date().toISOString(), action, entity, recordId, summary, by: by || 'local user' }); if (state.audit.length > 5000) state.audit.splice(0, state.audit.length - 5000); }
    function logHistory(entity, recordId, field, from, to, by, note, extra) { state.history.push(Object.assign({ id: 'H' + U.uid(), at: new Date().toISOString(), entity, recordId, field, from: from == null ? '' : from, to: to == null ? '' : to, by: by || 'local user', note: note || '' }, extra || {})); }
    const historyOf = (entity, id, field) => state.history.filter(h => h.entity === entity && h.recordId === id && (!field || h.field === field));

    /* ---------- persistence + atomic batches ---------- */
    function persist() { adapter.save(state); listeners.slice().forEach(fn => { try { fn(); } catch (e) { /* a broken listener must never block saving */ } }); }
    function batch(fn) {
      if (depth > 0) return fn();                         // nested: join the outer batch
      const snapshot = JSON.stringify(state); depth++; dirty = false; let r;
      try { r = fn(); } catch (e) { depth--; state = JSON.parse(snapshot); throw e; }
      depth--;
      if (dirty) { try { persist(); } catch (e) { state = JSON.parse(snapshot); throw e; } }   // e.g. browser storage full: nothing is half-saved
      return r;
    }
    /** Run fn against a throw-away copy: every write is rolled back afterwards (used by the CSV import preview). */
    function simulate(fn) {
      const snapshot = JSON.stringify(state); depth++;
      try { return fn(); } finally { depth--; state = JSON.parse(snapshot); dirty = false; }
    }
    const touch = () => { dirty = true; };

    /* ---------- validation ---------- */
    function normalise(f, v) {
      if (v === undefined || v === null) return '';
      if (typeof v === 'string') v = v.trim();
      if (f.type === 'number' && v !== '' && !Number.isNaN(Number(v))) return Number(v);
      return v;
    }
    function validate(k, rec, scope, opts) {
      const e = ent(k), errors = {}, fields = fieldsFor(k, scope);
      for (const f of fields) {
        const v = rec[f.key], empty = v === '' || v === undefined || v === null;
        const req = typeof f.required === 'function' ? f.required(rec, api) : f.required;
        if (empty) { if (req) errors[f.key] = f.label + ' is required.'; continue; }
        switch (f.type) {
          case 'number': if (typeof v !== 'number' || !Number.isFinite(v)) errors[f.key] = f.label + ' must be a number.'; else if (f.min != null && v < f.min) errors[f.key] = f.label + ' must be at least ' + f.min + '.'; else if (f.max != null && v > f.max) errors[f.key] = f.label + ' must be at most ' + f.max + '.'; else if (f.integer && !Number.isInteger(v)) errors[f.key] = f.label + ' must be a whole number.'; break;
          case 'date': if (!U.isValidISO(v)) errors[f.key] = f.label + ' is not a valid date (use YYYY-MM-DD).'; break;
          case 'email': if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errors[f.key] = f.label + ' is not a valid e-mail address.'; break;
          case 'select': { const opts2 = optionsFor(f, scope, rec); if (!opts2.includes(v)) errors[f.key] = f.label + ': "' + v + '" is not an allowed value.'; break; }
          case 'ref': { const target = get(f.ref, v); if (!target) errors[f.key] = f.label + ' refers to a record that does not exist.'; else if (f.sameScope !== false && isScoped(f.ref) && isScoped(k) && target[scopeField] !== scope) errors[f.key] = f.label + ' belongs to a different ' + scopeCfg.label.toLowerCase() + '.'; break; }
          default: if (f.max != null && String(v).length > f.max) errors[f.key] = f.label + ' is too long.';
        }
      }
      if (e.unique && !Object.keys(errors).length) {
        for (const combo of e.unique) {
          const key = combo.map(c => U.norm(rec[c])).join('|'); if (!combo.some(c => rec[c] !== '' && rec[c] != null)) continue;
          if (combo.some(c => rec[c] === '' || rec[c] == null)) continue;
          const dup = all(k).find(r => r.id !== rec.id && combo.map(c => U.norm(r[c])).join('|') === key && (e.uniqueScope === 'global' || !isScoped(k) || r[scopeField] === scope));
          if (dup) { errors[combo[0]] = 'Duplicate: ' + combo.map(c => fieldLabel(fields, c)).join(' + ') + ' already exists (' + dup.id + ').'; break; }
        }
      }
      return errors;
    }
    const fieldLabel = (fields, key) => (fields.find(f => f.key === key) || { label: key }).label;
    function optionsFor(f, scope, rec) { const o = typeof f.options === 'function' ? f.options({ scope, rec, store: api }) : (typeof f.options === 'string' ? (config.lists && config.lists[f.options]) : f.options); return Array.isArray(o) ? o : (o && o[scope]) || []; }

    /* ---------- write operations ---------- */
    function buildRecord(k, values, scope, old) {
      const rec = Object.assign({}, old || {}); const fields = fieldsFor(k, scope);
      for (const f of fields) { if (f.readonly && old) continue; if (f.key in values) rec[f.key] = normalise(f, values[f.key]); else if (!old && f.default !== undefined && !(f.key in rec)) rec[f.key] = typeof f.default === 'function' ? f.default({ scope, store: api }) : f.default; if (!(f.key in rec)) rec[f.key] = ''; }
      if (isScoped(k)) rec[scopeField] = scope;
      return rec;
    }
    function runBefore(k, mode, rec, old, scope) {
      const h = config.hooks && config.hooks.beforeSave; if (!h) return { errors: {}, warnings: [] };
      const r = h({ store: api, entity: k, mode, values: rec, old, scope }) || {};
      return { errors: r.errors || {}, warnings: r.warnings || [] };
    }
    function create(k, values, opts) {
      opts = opts || {}; const e = ent(k);
      return batch(() => {
        const scope = isScoped(k) ? (values[scopeField] || opts.scope || scopeCfg.default) : null;
        if (isScoped(k) && !scopeCfg.values.includes(scope)) return { ok: false, errors: { _: 'Unknown ' + scopeCfg.label.toLowerCase() + ': ' + scope } };
        const rec = buildRecord(k, values, scope, null);
        let errors = validate(k, rec, scope);
        const pre = runBefore(k, 'create', rec, null, scope); errors = Object.assign(errors, pre.errors);
        if (Object.keys(errors).length) return { ok: false, errors, warnings: pre.warnings };
        const n = (state.counters[k] || 0) + 1; state.counters[k] = n;
        rec.id = (e.idPrefix || k.slice(0, 3).toUpperCase()) + '-' + U.pad(n, 4);
        rec.createdAt = new Date().toISOString(); rec.updatedAt = rec.createdAt;
        state.data[k].push(rec);
        (e.track || []).forEach(f => { if (rec[f] !== '' && rec[f] != null) logHistory(k, rec.id, f, '', rec[f], opts.by, opts.note || 'created', opts.historyExtra); });
        logAudit('create', k, rec.id, 'Created ' + display(k, rec), opts.by); touch();
        const post = config.hooks && config.hooks.afterSave && config.hooks.afterSave({ store: api, entity: k, mode: 'create', record: rec, old: null, scope, opts });
        return { ok: true, record: get(k, rec.id), warnings: pre.warnings.concat((post && post.warnings) || []), notes: (post && post.notes) || [] };
      });
    }
    function update(k, id, values, opts) {
      opts = opts || {}; const e = ent(k);
      return batch(() => {
        const old = get(k, id); if (!old) return { ok: false, errors: { _: 'Record not found: ' + id } };
        const scope = isScoped(k) ? old[scopeField] : null;
        if (isScoped(k) && values[scopeField] && values[scopeField] !== scope) return { ok: false, errors: { [scopeField]: scopeCfg.label + ' cannot be changed after the record is created.' } };
        const rec = buildRecord(k, values, scope, old); const before = U.clone(old);
        let errors = validate(k, rec, scope);
        const pre = runBefore(k, 'update', rec, before, scope); errors = Object.assign(errors, pre.errors);
        if (Object.keys(errors).length) return { ok: false, errors, warnings: pre.warnings };
        rec.updatedAt = new Date().toISOString();
        Object.assign(old, rec);
        (e.track || []).forEach(f => { if (String(before[f] == null ? '' : before[f]) !== String(old[f] == null ? '' : old[f])) logHistory(k, id, f, before[f], old[f], opts.by, opts.note || 'edited', opts.historyExtra); });
        logAudit('update', k, id, 'Updated ' + display(k, old), opts.by); touch();
        const post = config.hooks && config.hooks.afterSave && config.hooks.afterSave({ store: api, entity: k, mode: 'update', record: old, old: before, scope, opts });
        return { ok: true, record: old, warnings: pre.warnings.concat((post && post.warnings) || []), notes: (post && post.notes) || [] };
      });
    }
    function usages(k, id) {   // who still points at this record?
      const out = [];
      Object.keys(config.entities).forEach(ek => {
        const sets = Array.isArray(config.entities[ek].fields) ? [config.entities[ek].fields] : Object.values(config.entities[ek].fields);
        const keys = new Set(); sets.forEach(fs => fs.forEach(f => { if (f.type === 'ref' && f.ref === k) keys.add(f.key); }));
        keys.forEach(fk => { const n = all(ek).filter(r => r[fk] === id).length; if (n) out.push({ entity: ek, field: fk, count: n }); });
      });
      return out;
    }
    function remove(k, id, opts) {
      opts = opts || {}; const e = ent(k);
      return batch(() => {
        const rec = get(k, id); if (!rec) return { ok: false, errors: { _: 'Record not found: ' + id } };
        const used = usages(k, id);
        if (used.length && e.deletePolicy !== 'detach') return { ok: false, errors: { _: 'Cannot delete ' + display(k, rec) + ': it is used by ' + used.map(u => u.count + ' ' + (config.entities[u.entity].plural || u.entity).toLowerCase()).join(', ') + '. Remove or reassign those first.' }, used };
        const pre = config.hooks && config.hooks.beforeDelete && config.hooks.beforeDelete({ store: api, entity: k, record: rec });
        if (pre && pre.errors && Object.keys(pre.errors).length) return { ok: false, errors: pre.errors };
        if (used.length) used.forEach(u => all(u.entity).forEach(r => { if (r[u.field] === id) r[u.field] = ''; }));
        state.data[k] = state.data[k].filter(r => r.id !== id);
        logAudit('delete', k, id, 'Deleted ' + display(k, rec), opts.by); touch();
        return { ok: true, record: rec };
      });
    }

    /* ---------- backup / restore ---------- */
    const exportJSON = () => ({ format: 'erp-backup', schema: SCHEMA, projectId: config.id, projectName: config.name, exportedAt: new Date().toISOString(), counters: U.clone(state.counters), data: U.clone(state.data), history: U.clone(state.history), audit: U.clone(state.audit) });
    function validateBackup(o, loose) {
      const errors = [], warnings = [];
      if (!o || typeof o !== 'object') return { errors: ['The file is not a JSON object.'], warnings };
      if (!loose && o.format !== 'erp-backup') errors.push('This is not an ERP backup file.');
      if (o.projectId !== config.id) errors.push('This backup belongs to another project ("' + (o.projectId || 'unknown') + '"), not "' + config.id + '". It was not loaded.');
      if (!o.data || typeof o.data !== 'object') errors.push('The backup has no data section.');
      if (!errors.length) {
        const ids = new Set();
        for (const k of Object.keys(config.entities)) {
          const rows = o.data[k]; if (rows === undefined) continue;
          if (!Array.isArray(rows)) { errors.push('Table "' + k + '" is not a list.'); continue; }
          rows.forEach(r => { if (!r || typeof r.id !== 'string') errors.push('A record in "' + k + '" has no id.'); else if (ids.has(k + r.id)) errors.push('Duplicate id ' + r.id + ' in "' + k + '".'); else ids.add(k + r.id); });
        }
        // dangling references are reported as warnings (the data is still usable)
        if (!errors.length) for (const k of Object.keys(config.entities)) {
          const sets = Array.isArray(config.entities[k].fields) ? [config.entities[k].fields] : Object.values(config.entities[k].fields);
          const refs = [], seen = new Set(); sets.forEach(fs => fs.forEach(f => { if (f.type === 'ref' && !seen.has(f.key + '|' + f.ref)) { seen.add(f.key + '|' + f.ref); refs.push(f); } }));
          (Array.isArray(o.data[k]) ? o.data[k] : []).forEach(r => refs.forEach(f => { if (r[f.key] && !(Array.isArray(o.data[f.ref]) ? o.data[f.ref] : []).some(x => x.id === r[f.key])) warnings.push(r.id + '.' + f.key + ' points to missing ' + r[f.key]); }));
        }
      }
      return { errors, warnings };
    }
    function restore(o) {
      const v = validateBackup(o); if (v.errors.length) return { ok: false, errors: v.errors };
      return batch(() => { state = adopt(Object.assign({}, o, { format: 'erp-data' })); logAudit('restore', '', '', 'Restored backup exported ' + (o.exportedAt || ''), ''); touch(); return { ok: true, warnings: v.warnings }; });
    }
    function reset() { state = blank(); adapter.clear(); persist(); }

    const subscribe = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };
    const api = { config, adapter, ent, isScoped, scopeField, fieldsFor, label, display, optionsFor, get, list, count, byName, create, update, remove, usages, batch, simulate, historyOf, exportJSON, validateBackup, restore, reset, subscribe, logAudit, logHistory, touch,
      get history() { return state.history; }, get audit() { return state.audit; }, get counters() { return state.counters; }, get raw() { return state; }, load, validate, normalise };
    load();
    return api;
  }

  ERP.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);

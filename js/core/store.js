/* STORE — single source of truth. All writes go through here so validation, rules, audit log, persistence and
   change notification always happen. Two workspaces (demo / live) are kept in separate storage keys so fictional
   sample data can never mix with working records. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util, S = LGM.Schema, R = LGM.Rules, L = LGM.Lifecycle, ST = LGM.Storage;

  const ENT = ['clients', 'visits', 'demands', 'orders', 'allocations', 'candidates', 'interviews', 'tickets', 'warranties', 'domestic', 'credentials', 'finance', 'cvInbox', 'imports', 'activity'];
  const dataKey = m => C.storageKeyPrefix + 'data_' + m;
  const PREFS_KEY = C.storageKeyPrefix + 'prefs';

  let state = null, mode = 'demo', saved = true; const listeners = [];

  function blank(workspace) {
    const s = { meta: { version: 1, workspace, counters: { order: 1001, candidate: 1001, demand: 1001, warranty: 101, domestic: 1 } } };
    ENT.forEach(e => (s[e] = []));
    return s;
  }
  function normalise(s, workspace) {
    const b = blank(workspace);
    if (!s || typeof s !== 'object') return b;
    ENT.forEach(e => { if (Array.isArray(s[e])) b[e] = s[e]; });
    if (s.meta && s.meta.counters) Object.assign(b.meta.counters, s.meta.counters);
    syncCounters(b); return b;
  }
  function syncCounters(s) {
    const maxNum = (arr, re) => arr.reduce((m, r) => { const x = re.exec(r.id || ''); return x ? Math.max(m, +x[1]) : m; }, 0);
    const c = s.meta.counters;
    c.order = Math.max(c.order, maxNum(s.orders, /(\d+)$/) + 1);
    c.candidate = Math.max(c.candidate, maxNum(s.candidates, /(\d+)$/) + 1);
    c.demand = Math.max(c.demand, maxNum(s.demands, /(\d+)$/) + 1);
    c.warranty = Math.max(c.warranty, maxNum(s.warranties, /(\d+)$/) + 1);
    c.domestic = Math.max(c.domestic, maxNum(s.domestic, /(\d+)$/) + 1);
  }

  function loadMode(m) {
    mode = m;
    const raw = ST.get(dataKey(m));
    if (raw) state = normalise(raw, m);
    else if (m === 'demo' && LGM.Seed) { state = normalise(LGM.Seed.build(), 'demo'); persist(); }
    else state = blank(m);
  }
  function persist() { saved = ST.set(dataKey(mode), state); return saved; }
  function notify() { listeners.slice().forEach(fn => { try { fn(); } catch (e) { if (g.console) console.error(e); } }); }
  function commit(ctx) { if (ctx && ctx.defer) return; persist(); notify(); }

  function nextId(kind, rec) {
    const c = state.meta.counters;
    const mk = {
      order: () => 'ORD-' + c.order++, demand: () => 'DL-' + c.demand++, warranty: () => 'WR-' + c.warranty++,
      domestic: () => 'DW-' + String(c.domestic++).padStart(3, '0'),
      candidate: () => (C.countryPrefix[rec.country] || 'XX') + '-' + c.candidate++,
    }[kind];
    if (!mk) return U.uid(kind || 'id');
    const pool = { order: 'orders', demand: 'demands', warranty: 'warranties', domestic: 'domestic', candidate: 'candidates' }[kind];
    for (;;) { const id = mk(); if (!state[pool].some(x => x.id === id)) return id; }
  }

  function log(text, client, entity, id, ctx) {
    state.activity.unshift({ at: new Date().toISOString(), by: (ctx && ctx.by) || '', entity: entity || '', id: id || '', client: client || '', text });
    if (state.activity.length > C.activityCap) state.activity.length = C.activityCap;
  }

  const fieldKeys = e => S.entities[e].fields.map(f => f.key);
  const pick = (rec, e) => Object.fromEntries(fieldKeys(e).map(k => [k, rec[k]]));

  /** Validate + rule-check without saving. */
  function preview(entity, input, opts = {}) {
    const v = S.validate(entity, input, { useDefaults: !opts.ignoreId, skipCreateOnly: !!opts.ignoreId });
    if (Object.keys(v.errors).length) return { ok: false, errors: v.errors, warnings: [] };
    const clean = R.derive(entity, v.clean);
    const chk = R.check(state, entity, clean, { ignoreId: opts.ignoreId });
    if (Object.keys(chk.errors).length) return { ok: false, errors: chk.errors, warnings: chk.warnings };
    return { ok: true, clean, warnings: chk.warnings, errors: {} };
  }

  function insert(entity, input, ctx = {}) {
    const p = preview(entity, input);
    if (!p.ok) return p;
    const def = S.entities[entity];
    const rec = Object.assign({}, p.clean, ctx.extra || {});
    rec.id = ctx.id || nextId(def.idKind, rec);
    rec.createdAt = new Date().toISOString();
    if (entity === 'candidates') rec.history = [{ stage: rec.status, at: rec.createdAt, by: ctx.by || '' }];
    state[entity].push(rec);
    if (!ctx.silent) log(`${def.label} ${def.title(rec)} added`, rec.client || '', entity, rec.id, ctx);
    commit(ctx);
    return { ok: true, record: rec, warnings: p.warnings, errors: {} };
  }

  function update(entity, id, patch, ctx = {}) {
    const rec = state[entity].find(x => x.id === id);
    if (!rec) return { ok: false, errors: { _: 'Record not found.' } };
    const p = preview(entity, Object.assign(pick(rec, entity), patch), { ignoreId: id });
    if (!p.ok) return p;
    const oldName = entity === 'clients' ? rec.name : null;
    Object.assign(rec, p.clean, { updatedAt: new Date().toISOString() });
    if (oldName && oldName !== rec.name) {
      const n = R.renameClient(state, oldName, rec.name);
      if (n) log(`Client renamed ${oldName} → ${rec.name} (${n} linked record(s) updated)`, rec.name, entity, id, ctx);
    }
    if (!ctx.silent) log(`${S.entities[entity].label} ${S.entities[entity].title(rec)} updated`, rec.client || (entity === 'clients' ? rec.name : ''), entity, id, ctx);
    commit(ctx);
    return { ok: true, record: rec, warnings: p.warnings, errors: {} };
  }

  function remove(entity, id, ctx = {}) {
    const rec = state[entity].find(x => x.id === id);
    if (!rec) return { ok: false, error: 'Record not found.' };
    const why = R.canDelete(state, entity, rec);
    if (why) return { ok: false, error: why };
    R.cascadeDelete(state, entity, rec);
    state[entity] = state[entity].filter(x => x.id !== id);
    if (!ctx.silent) log(`${S.entities[entity] ? S.entities[entity].label : entity} ${S.entities[entity] ? S.entities[entity].title(rec) : id} deleted`, rec.client || (entity === 'clients' ? rec.name : ''), entity, id, ctx);
    commit(ctx);
    return { ok: true };
  }

  function moveCandidate(id, to, ctx = {}) {
    const c = state.candidates.find(x => x.id === id);
    if (!c) return { ok: false, error: 'Candidate not found.' };
    const r = L.moveTo(c, to, ctx.by);
    if (r.error) return { ok: false, error: r.error };
    const from = c.status; Object.assign(c, r.patch, { updatedAt: new Date().toISOString() });
    log(`${c.id} ${c.name}: ${from} → ${to}`, c.client, 'candidates', id, ctx);
    commit(ctx); return { ok: true, record: c };
  }
  function undoCandidate(id, ctx = {}) {
    const c = state.candidates.find(x => x.id === id);
    if (!c) return { ok: false, error: 'Candidate not found.' };
    const r = L.undo(c, ctx.by);
    if (r.error) return { ok: false, error: r.error };
    const from = c.status; Object.assign(c, r.patch, { updatedAt: new Date().toISOString() });
    log(`${c.id} ${c.name}: stage corrected ${from} → ${c.status}`, c.client, 'candidates', id, ctx);
    commit(ctx); return { ok: true, record: c };
  }

  // ---- backup / restore / workspaces ----
  function exportBackup() {
    return { app: 'LGM-ERP-V6-Developed', schema: 1, workspace: mode, exportedAt: new Date().toISOString(), data: U.clone(state) };
  }
  function importBackup(obj) {
    if (!obj || obj.app !== 'LGM-ERP-V6-Developed' || !obj.data || typeof obj.data !== 'object') return { ok: false, error: 'This is not a backup file created by this application.' };
    const bad = ENT.filter(e => obj.data[e] != null && !Array.isArray(obj.data[e]));
    if (bad.length) return { ok: false, error: 'Backup is corrupt (invalid sections: ' + bad.join(', ') + ').' };
    state = normalise(obj.data, mode);
    log('Backup restored (' + (obj.workspace || '?') + ' workspace backup of ' + String(obj.exportedAt || '').slice(0, 10) + ')', '', 'system', '', {});
    commit({}); return { ok: true };
  }
  function switchMode(m) { if (m !== 'demo' && m !== 'live') return; persist(); loadMode(m); setPref('mode', m); notify(); }
  function resetDemo() {
    if (mode !== 'demo') return false;
    state = normalise(LGM.Seed.build(), 'demo'); log('Demo data reset to the original fictional sample', '', 'system', '', {}); commit({}); return true;
  }
  function clearWorkspace() { state = blank(mode); log('Workspace cleared', '', 'system', '', {}); commit({}); }

  function getPref(k, d) { const p = ST.get(PREFS_KEY) || {}; return k in p ? p[k] : d; }
  function setPref(k, v) { const p = ST.get(PREFS_KEY) || {}; p[k] = v; ST.set(PREFS_KEY, p); }

  function init(forceMode) { loadMode(forceMode || getPref('mode', 'demo')); }

  LGM.Store = {
    init, blank, ENT, preview, insert, update, remove, moveCandidate, undoCandidate, log,
    flush() { persist(); notify(); },
    onChange(fn) { listeners.push(fn); },
    state: () => state, mode: () => mode, isSaved: () => saved,
    list: e => state[e], get: (e, id) => state[e].find(x => x.id === id) || null,
    exportBackup, importBackup, switchMode, resetDemo, clearWorkspace, getPref, setPref, syncCounters: () => syncCounters(state),
  };
})(typeof window !== 'undefined' ? window : globalThis);

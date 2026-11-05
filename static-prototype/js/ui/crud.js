/* GENERIC CRUD — schema-driven register tables (search, filters, add/edit/delete) and form builder.
   Pages declare columns; validation, rules, audit log and persistence come from Store/Schema/Rules. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const UI = LGM.UI, U = LGM.Util, esc = U.esc, S = LGM.Store, Sc = LGM.Schema;

  const Crud = { cfgs: {}, state: {} };
  const st = id => (Crud.state[id] = Crud.state[id] || { q: '', f: {} });
  const by = () => UI.state.role;

  // ---------------- form fields ----------------
  function suggestValues(f) {
    const s = S.state();
    if (f.suggestList) return f.suggestList.concat(U.uniqSorted([...s.candidates.map(c => c.country), ...s.orders.map(o => o.country)])).filter((v, i, a) => a.indexOf(v) === i);
    const { entity, key } = f.suggest; let vals = s[entity].map(r => r[key]);
    if (entity === 'allocations' && key === 'agency') vals = vals.concat(s.candidates.map(c => c.agency));
    return U.uniqSorted(vals);
  }
  function fieldHtml(entity, f, value, o = {}) {
    const name = esc(f.key), v = value == null ? '' : value, id = `f_${o.scope || 'm'}_${entity}_${f.key}`;
    const dis = f.readonly || (o.lockKeys && o.lockKeys.includes(f.key)) ? 'disabled' : '';
    let input;
    if (f.type === 'select') {
      const opts = (f.options || []).map(x => `<option value="${esc(x)}" ${String(v) === String(x) ? 'selected' : ''}>${esc(f.labels ? f.labels[x] : x)}</option>`).join('');
      input = `<select class="input" id="${id}" name="${name}" ${dis}>${f.required ? '' : '<option value="">—</option>'}${opts}</select>`;
    } else if (f.type === 'refselect') {
      const st0 = S.state(); const src = f.source;
      let items = st0[src.entity].filter(r => (!src.filter || src.filter(r)) && (!src.taken || String(r[src.value]) === String(v) || !st0[src.taken[0]].some(x => x[src.taken[1]] === r[src.value])));
      input = `<select class="input" id="${id}" name="${name}" ${dis}><option value="">${f.required ? '— select —' : '— none —'}</option>${items.map(r => `<option value="${esc(r[src.value])}" ${String(v) === String(r[src.value]) ? 'selected' : ''}>${esc(src.label(r))}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea class="input" id="${id}" name="${name}" rows="3" ${dis}>${esc(v)}</textarea>`;
    } else {
      const type = f.type === 'int' || f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
      const extra = f.type === 'int' ? `step="1" min="${f.min ?? ''}"` : f.type === 'number' ? `step="0.01" min="${f.min ?? ''}"` : '';
      const list = f.suggest || f.suggestList ? `list="dl_${id}"` : '';
      input = `<input class="input" id="${id}" name="${name}" type="${type}" value="${esc(v)}" ${extra} ${list} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${dis} autocomplete="off">`;
      if (list) input += `<datalist id="dl_${id}">${suggestValues(f).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
    }
    return `<div class="field ${f.full ? 'full' : ''}" data-field="${name}"><label for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>${input}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}<div class="errmsg"></div></div>`;
  }
  /** Fields grid for an entity. `values` pre-fills; `hide` omits keys; `virtual` adds non-schema fields. */
  function fieldsGrid(entity, values = {}, o = {}) {
    const defs = Sc.entities[entity].fields.filter(f => !(o.hide || []).includes(f.key) && !(o.editing && f.createOnly));
    return `<div class="formgrid">${defs.map(f => fieldHtml(entity, f, values[f.key], o)).join('')}${(o.virtual || []).map(vf => fieldHtml(entity, vf, values[vf.key], o)).join('')}</div>`;
  }
  function readForm(root, entity, o = {}) {
    const out = {};
    root.querySelectorAll('[name]').forEach(el => { out[el.name] = el.value; });
    return out;
  }
  function showErrors(root, errors) {
    root.querySelectorAll('.field').forEach(f => { f.classList.remove('err'); f.querySelector('.errmsg').textContent = ''; });
    let general = [];
    Object.entries(errors || {}).forEach(([k, m]) => { const f = root.querySelector(`.field[data-field="${k}"]`); if (f) { f.classList.add('err'); f.querySelector('.errmsg').textContent = m; } else general.push(m); });
    const box = root.querySelector('.formerr'); if (box) { box.textContent = general.join(' '); box.style.display = general.length ? 'block' : 'none'; }
    const firstErr = root.querySelector('.field.err .input'); if (firstErr) firstErr.focus();
  }

  /** Open add/edit modal. opts: {entity, id, defaults, hide, lockKeys, virtual:[{key,label,type,get(rec),after(values,rec)}], title, onSaved} */
  function formModal(opts) {
    const entity = opts.entity, def = Sc.entities[entity]; const rec = opts.id ? S.get(entity, opts.id) : null;
    const values = Object.assign({}, rec ? rec : Object.assign(Sc.defaults(entity), opts.defaults || {}));
    (opts.virtual || []).forEach(vf => { if (rec && vf.get) values[vf.key] = vf.get(rec); });
    UI.modal.open({
      title: opts.title || (rec ? `Edit ${def.label.toLowerCase()} — ${def.title(rec)}` : `Add ${def.label.toLowerCase()}`),
      body: `<form id="crud-form" novalidate><div class="formerr notice" style="display:none;background:#feeaea;color:#8f2a2a;border-color:#f0c4c4;margin:0 0 14px"></div>${fieldsGrid(entity, values, { hide: opts.hide, editing: !!rec, lockKeys: opts.lockKeys, virtual: opts.virtual, scope: 'm' })}</form>`,
      footer: `<button class="btn secondary" data-act="modalClose" type="button">Cancel</button><button class="btn" data-act="crudSubmit" type="button">${rec ? 'Save changes' : 'Save'}</button>`,
    });
    UI.actions.crudSubmit = () => {
      const root = document.getElementById('crud-form'); const vals = readForm(root, entity); const ctx = { by: by() };
      const own = Object.fromEntries(Object.entries(vals).filter(([k]) => !(opts.virtual || []).some(v => v.key === k)));
      // `fixed` = values for fields that are hidden from the form but must still be saved (e.g. a pre-selected client).
      const res = rec ? S.update(entity, rec.id, own, ctx) : S.insert(entity, Object.assign({}, opts.fixed || {}, own), ctx);
      if (!res.ok) return showErrors(root, res.errors);
      (opts.virtual || []).forEach(vf => vf.after && vf.after(vals, res.record));
      UI.modal.close();
      UI.toast(`${def.label} ${rec ? 'updated' : 'saved'}` + (res.warnings && res.warnings.length ? ' — note: ' + res.warnings.join(' ') : ''), res.warnings && res.warnings.length ? '' : 'ok');
      if (opts.onSaved) opts.onSaved(res.record);
    };
  }
  /** Inline form (used by Finance, as in V6). Returns {html, submit(rootEl)} */
  function inlineSubmit(entity, rootEl, ctxExtra = {}) {
    const vals = readForm(rootEl, entity); const res = S.insert(entity, vals, { by: by() });
    showErrors(rootEl, res.errors); return res;
  }

  // ---------------- register table ----------------
  function rowsFor(cfg) {
    const q = U.norm(st(cfg.id).q), f = st(cfg.id).f;
    let rows = (cfg.rows ? cfg.rows() : S.list(cfg.entity)).slice();
    (cfg.filters || []).forEach(fl => { const v = f[fl.key]; if (v && v !== 'All') rows = rows.filter(r => String(fl.get ? fl.get(r) : r[fl.key]) === v); });
    if (q) rows = rows.filter(r => U.norm((cfg.search || Object.keys(r).filter(k => typeof r[k] === 'string' || typeof r[k] === 'number')).map(k => (typeof k === 'function' ? k(r) : r[k])).join(' ')).includes(q));
    if (cfg.sort) rows.sort(cfg.sort);
    return rows;
  }
  function bodyHtml(cfg) {
    const rows = rowsFor(cfg), total = (cfg.rows ? cfg.rows() : S.list(cfg.entity)).length;
    const canEdit = cfg.canEdit !== false, canDel = cfg.canDelete !== false;
    const table = UI.table([...cfg.columns.map(c => c.label), ''], rows.map(r => [...cfg.columns.map(c => c.get(r)),
      UI.raw(`<div class="table-actions">${cfg.rowActions ? cfg.rowActions(r) : ''}${canEdit ? UI.btn('Edit', 'crudEdit', cfg.id, 'secondary small', `data-rec="${esc(r.id)}"`) : ''}${canDel ? UI.btn('Delete', 'crudDelete', cfg.id, 'danger small', `data-rec="${esc(r.id)}"`) : ''}</div>`)]),
      { empty: total ? 'No records match the search/filters.' : (cfg.emptyText || 'No records yet.') });
    return { html: table, count: `${rows.length} of ${total}` };
  }
  function toolbar(cfg, count) {
    const s = st(cfg.id), rows = cfg.rows ? cfg.rows() : S.list(cfg.entity);
    const filters = (cfg.filters || []).map(fl => {
      const vals = fl.values ? fl.values() : U.uniqSorted(rows.map(r => (fl.get ? fl.get(r) : r[fl.key])));
      return `<select class="input" data-change="crudFilter" data-crud="${cfg.id}" data-key="${fl.key}" aria-label="Filter by ${esc(fl.label)}"><option value="All">All ${esc(fl.label)}</option>${vals.map(v => `<option ${s.f[fl.key] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    }).join('');
    return `<div class="toolbar"><input class="input grow" type="search" placeholder="Search…" value="${esc(s.q)}" data-input="crudSearch" data-crud="${cfg.id}" aria-label="Search ${esc(cfg.title || cfg.entity)}">${filters}<span class="count" id="crud-${cfg.id}-count">${esc(count)}</span></div>`;
  }
  /** Returns HTML for a full register panel. */
  function table(cfg) {
    Crud.cfgs[cfg.id] = cfg; const b = bodyHtml(cfg);
    const add = cfg.canAdd === false ? '' : UI.btn(cfg.addLabel || '+ Add', 'crudAdd', cfg.id);
    return UI.panel(cfg.title, `${toolbar(cfg, b.count)}<div id="crud-${cfg.id}-body">${b.html}</div>`, add);
  }
  function refresh(id) {
    const cfg = Crud.cfgs[id]; if (!cfg) return; const b = bodyHtml(cfg);
    const body = document.getElementById(`crud-${id}-body`), cnt = document.getElementById(`crud-${id}-count`);
    if (body) body.innerHTML = b.html; if (cnt) cnt.textContent = b.count;
  }

  UI.on('crudSearch', (v, el) => { st(el.dataset.crud).q = v; refresh(el.dataset.crud); });
  UI.on('crudFilter', (v, el) => { st(el.dataset.crud).f[el.dataset.key] = v; refresh(el.dataset.crud); });
  UI.on('crudAdd', id => { const cfg = Crud.cfgs[id]; (cfg.onAdd || (() => formModal(Object.assign({ entity: cfg.entity }, cfg.form || {}))))(); });
  UI.on('crudEdit', (id, el) => { const cfg = Crud.cfgs[id]; formModal(Object.assign({ entity: cfg.entity, id: el.dataset.rec }, cfg.form || {})); });
  UI.on('crudDelete', async (id, el) => {
    const cfg = Crud.cfgs[id], def = Sc.entities[cfg.entity], rec = S.get(cfg.entity, el.dataset.rec); if (!rec) return;
    const ok = await UI.confirm({ title: `Delete ${def.label.toLowerCase()}?`, message: `${def.title(rec)} will be permanently removed from this ${S.mode()} workspace.`, ok: 'Delete', danger: true });
    if (!ok) return; const res = S.remove(cfg.entity, rec.id, { by: by() });
    UI.toast(res.ok ? `${def.label} deleted` : res.error, res.ok ? 'ok' : 'err');
  });

  Crud.table = table; Crud.formModal = formModal; Crud.refresh = refresh;
  Crud.fieldsGrid = fieldsGrid; Crud.inlineSubmit = inlineSubmit; Crud.showErrors = showErrors; Crud.readForm = readForm;
  LGM.Crud = Crud;
})(typeof window !== 'undefined' ? window : globalThis);

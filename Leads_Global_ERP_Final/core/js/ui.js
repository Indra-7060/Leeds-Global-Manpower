/* ERP core · ui.js — reusable UI components (no business knowledge).
   icons · toast · modal · confirm · badge · formatting · form engine (built from the entity field config).
   Everything user-supplied is escaped; there is no inline JavaScript — behaviour is attached with data-* attributes and delegation. */
(function (g) {
  'use strict';
  const ERP = g.ERP = g.ERP || {};
  const U = ERP.util, esc = U.esc;

  /* ---------------- icons (24px stroke icons) ---------------- */
  const P = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14.5c2.4 0 4 1.6 4 4"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    plane: '<path d="M21 4 3 11l6 2.5L11.5 20 14 14l7-10z"/>',
    file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
    coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    shield: '<path d="M12 3 5 6v6c0 4.4 3 7.5 7 9 4-1.5 7-4.6 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v5h16v-5"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 20h16"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  const icon = (n, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.list) + '</svg>';

  /* ---------------- formatting ---------------- */
  const fmtNum = n => (n === '' || n == null || Number.isNaN(Number(n))) ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fmtMoney = (n, cur) => (cur ? cur + ' ' : '') + fmtNum(n || 0);
  const fmtBytes = b => (b = Number(b) || 0) < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const badge = (text, tone) => '<span class="badge ' + (tone ? 'b-' + tone : '') + '">' + esc(text) + '</span>';

  /* ---------------- toast ---------------- */
  function toast(msg, type, ms) {
    let box = document.getElementById('erp-toasts'); if (!box) { box = document.createElement('div'); box.id = 'erp-toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast t-' + (type || 'info'); t.innerHTML = '<div>' + (Array.isArray(msg) ? msg.map(m => '<div>' + esc(m) + '</div>').join('') : esc(msg)) + '</div><button class="x" aria-label="Dismiss">' + icon('x') + '</button>';
    t.querySelector('.x').onclick = () => t.remove(); box.appendChild(t);
    setTimeout(() => t.remove(), ms || (type === 'error' ? 9000 : Array.isArray(msg) ? 8000 : 4500));
  }

  /* ---------------- modal ---------------- */
  function modal(opts) {
    const d = document.createElement('dialog'); d.className = 'modal' + (opts.wide ? ' wide' : '');
    d.innerHTML = '<div class="m-head"><h2>' + esc(opts.title || '') + '</h2><button class="icon-btn m-x" aria-label="Close">' + icon('x') + '</button></div><div class="m-body"></div>' + (opts.actions ? '<div class="m-foot"></div>' : '');
    const body = d.querySelector('.m-body'); if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    const api = { el: d, body, close(v) { try { d.close(); } catch (e) { /* already closed */ } d.remove(); if (opts.onClose) opts.onClose(v); } };
    if (opts.actions) { const foot = d.querySelector('.m-foot'); opts.actions.forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.cls || ''); b.textContent = a.label; if (a.id) b.dataset.id = a.id; b.onclick = () => a.run ? a.run(api, b) : api.close(); foot.appendChild(b); }); api.foot = foot; }
    d.querySelector('.m-x').onclick = () => api.close();
    d.addEventListener('cancel', e => { e.preventDefault(); api.close(); });
    document.body.appendChild(d); d.showModal(); return api;
  }
  function confirm(o) {
    return new Promise(res => {
      const m = modal({ title: o.title || 'Please confirm', body: '<p>' + esc(o.message || '') + '</p>' + (o.typeToConfirm ? '<label class="lbl">Type <b>' + esc(o.typeToConfirm) + '</b> to continue</label><input class="inp" data-confirm-input autocomplete="off">' : ''),
        onClose: v => res(v === true), actions: [{ label: 'Cancel', run: x => x.close(false) }, { label: o.okLabel || 'Confirm', cls: o.danger ? 'danger' : 'primary', id: 'ok', run: x => { if (o.typeToConfirm) { const i = x.el.querySelector('[data-confirm-input]'); if (i.value.trim() !== o.typeToConfirm) { i.classList.add('bad'); return; } } x.close(true); } }] });
    });
  }

  /* ---------------- form engine ----------------
     Form(store, entityKey, scope, record, {prefill, onChange}) → {el, read(), setErrors(), rec}
     Dynamic behaviour is driven by field config: options (function), ref + filter(target, rec, store), fills {recKey: targetKey}, compute(rec), required(rec). */
  function Form(store, entityKey, scope, record, opts) {
    opts = opts || {};
    const fields = store.fieldsFor(entityKey, scope).filter(f => !f.hidden);
    const rec = Object.assign({}, record || {}, opts.prefill || {});
    fields.forEach(f => { if (!(f.key in rec)) { const d = f.default; rec[f.key] = d === undefined ? '' : typeof d === 'function' ? d({ scope, store }) : d; } });
    const root = document.createElement('form'); root.className = 'frm'; root.noValidate = true; root.autocomplete = 'off';
    const isReq = f => (typeof f.required === 'function' ? f.required(rec, store) : f.required);

    function refRows(f) {
      const scoped = store.isScoped(f.ref), rows = store.list(f.ref, scoped && f.sameScope !== false && scope ? { [store.scopeField]: scope } : null);
      return rows.filter(t => !f.filter || f.filter(t, rec, store)).sort((a, b) => store.display(f.ref, a).localeCompare(store.display(f.ref, b)));
    }
    function optionList(f) {
      if (f.type === 'ref') return refRows(f).map(t => ({ v: t.id, t: store.display(f.ref, t) + (store.display(f.ref, t) === t.id ? '' : ' (' + t.id + ')') }));
      return store.optionsFor(f, scope, rec).map(o => ({ v: o, t: o }));
    }
    function control(f) {
      const id = 'f_' + entityKey + '_' + f.key, v = rec[f.key] == null ? '' : rec[f.key], ro = f.readonly && !f.compute ? ' disabled' : (f.compute ? ' disabled' : '');
      if (f.type === 'select' || f.type === 'ref') {
        let o = optionList(f); if (v !== '' && !o.some(x => x.v === v)) o = o.concat([{ v, t: (f.type === 'ref' ? store.display(f.ref, store.get(f.ref, v)) || v : v) + ' (not in list)' }]);
        return '<select class="inp" id="' + id + '" name="' + f.key + '"' + ro + '><option value="">Select…</option>' + o.map(x => '<option value="' + esc(x.v) + '"' + (x.v === v ? ' selected' : '') + '>' + esc(x.t) + '</option>').join('') + '</select>';
      }
      if (f.type === 'textarea') return '<textarea class="inp" id="' + id + '" name="' + f.key + '" rows="3"' + ro + '>' + esc(v) + '</textarea>';
      const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text';
      return '<input class="inp" id="' + id + '" name="' + f.key + '" type="' + type + '"' + (type === 'number' ? ' step="any"' + (f.min != null ? ' min="' + f.min + '"' : '') : '') + ' value="' + esc(v) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ro + '>';
    }
    function draw() {
      root.innerHTML = '<div class="frm-banner" hidden></div><div class="fields">' + fields.map(f => '<div class="fld' + (f.wide ? ' wide' : '') + '" data-key="' + f.key + '"><label class="lbl" for="f_' + entityKey + '_' + f.key + '">' + esc(f.label) + (isReq(f) ? ' <span class="req" title="Required">*</span>' : '') + '</label>' + control(f) + (f.help || f.computedHint ? '<div class="hint">' + esc(f.help || f.computedHint) + '</div>' : '') + '<div class="err" hidden></div></div>').join('') + '</div>' + (opts.extra ? '<div class="frm-extra"></div>' : '');
      if (opts.extra) root.querySelector('.frm-extra').appendChild(opts.extra);
    }
    function pull() {   // DOM → rec
      fields.forEach(f => { const el = root.elements[f.key]; if (el && !el.disabled) rec[f.key] = el.value; });
    }
    function recompute() {
      fields.forEach(f => { if (f.compute) { const el = root.elements[f.key]; const val = f.compute(rec, store); rec[f.key] = val || ''; if (el) el.value = val || ''; } });
    }
    function refreshDynamic(changedKey) {
      fields.forEach(f => {
        if (!(f.type === 'ref' || (f.type === 'select' && typeof f.options === 'function'))) return;
        const el = root.elements[f.key]; if (!el) return;
        const o = optionList(f), cur = rec[f.key];
        const keep = cur === '' || o.some(x => x.v === cur);
        if (!keep && f.key !== changedKey) rec[f.key] = '';
        el.innerHTML = '<option value="">Select…</option>' + o.map(x => '<option value="' + esc(x.v) + '"' + (x.v === rec[f.key] ? ' selected' : '') + '>' + esc(x.t) + '</option>').join('');
      });
      fields.forEach(f => { const w = root.querySelector('[data-key="' + f.key + '"] .lbl'); if (w) w.innerHTML = esc(f.label) + (isReq(f) ? ' <span class="req" title="Required">*</span>' : ''); });
    }
    root.addEventListener('change', e => {
      const name = e.target && e.target.name; if (!name) return; pull();
      const f = fields.find(x => x.key === name);
      if (f && f.type === 'ref' && f.fills && rec[name]) { const t = store.get(f.ref, rec[name]); if (t) Object.keys(f.fills).forEach(k => { if (fields.some(x => x.key === k) && t[f.fills[k]]) { rec[k] = t[f.fills[k]]; } }); }
      recompute(); refreshDynamic(name);
      fields.forEach(x => { const el = root.elements[x.key]; if (el && !el.disabled && x.key in rec && el.value !== String(rec[x.key] == null ? '' : rec[x.key]) && el.tagName !== 'SELECT') el.value = rec[x.key]; });
      fields.forEach(x => { const el = root.elements[x.key]; if (el && el.tagName === 'SELECT') el.value = rec[x.key]; });
      if (opts.onChange) opts.onChange(rec, name);
    });
    root.addEventListener('input', e => { const w = e.target.closest && e.target.closest('.fld'); if (w) { w.classList.remove('has-err'); const er = w.querySelector('.err'); if (er) er.hidden = true; } });
    draw(); recompute();
    return {
      el: root, rec,
      read() { pull(); recompute(); return Object.assign({}, rec); },
      setErrors(errors, warnings) {
        root.querySelectorAll('.fld').forEach(w => { w.classList.remove('has-err'); w.querySelector('.err').hidden = true; });
        const banner = root.querySelector('.frm-banner'); const general = [];
        Object.keys(errors || {}).forEach(k => { const w = root.querySelector('[data-key="' + k + '"]'); if (w) { w.classList.add('has-err'); const er = w.querySelector('.err'); er.textContent = errors[k]; er.hidden = false; } else general.push(errors[k]); });
        const first = root.querySelector('.has-err'); if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = first.querySelector('.inp'); if (i) i.focus({ preventScroll: true }); }
        banner.hidden = !general.length; banner.textContent = general.join(' ');
      },
    };
  }

  ERP.ui = { icon, icons: Object.keys(P), badge, fmtNum, fmtMoney, fmtBytes, toast, modal, confirm, Form };
})(typeof window !== 'undefined' ? window : globalThis);

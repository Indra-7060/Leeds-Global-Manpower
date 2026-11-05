/* UI COMPONENTS — presentation only. Same visual vocabulary as V6 (headings, KPI cards, panels, badges, flows, notices, tabs).
   Safety rule: plain strings are ALWAYS escaped; only `UI.raw(...)` / component return values (Raw) are inserted as HTML. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const U = LGM.Util, esc = U.esc;

  class Raw { constructor(h) { this.h = h; } toString() { return this.h; } }
  const raw = h => new Raw(h);
  const cell = c => (c instanceof Raw ? c.h : esc(c));

  const UI = {
    esc, raw, Raw, actions: {},
    state: { page: 'dashboard', division: 'labour', role: 'md', financeDivision: 'labour', recruitOpen: true, filters: { client: 'All', country: 'All', stage: 'All' }, vm: { country: 'All', q: '' } },
  };

  // ---------- V6 components ----------
  UI.badge = s => {
    const t = String(s == null ? '' : s);
    const c = /rejected|expired/i.test(t) ? 'red' : /active|arrived|joined|printed|selected|accepted|approved|reviewed|created|issued|^yes$|^done$/i.test(t) ? 'green'
      : /pending|review|interview|processing|qvc|rtp|scheduled|follow|booking|sourcing|received|needs/i.test(t) ? 'orange' : 'grey';
    return raw(`<span class="pill ${c}">${esc(t)}</span>`);
  };
  UI.heading = (t, d, action = '') => `<div class="row between"><div><div class="eyebrow">LGM / ${esc(t)}</div><h1 class="title">${esc(t)}</h1><div class="muted">${esc(d)}</div></div><div class="row">${action}</div></div>`;
  UI.metric = (label, n, sub) => `<div class="card"><div class="muted">${esc(label)}</div><div class="num">${cell(n)}</div><div class="muted">${esc(sub)}</div></div>`;
  UI.cards = (arr, style = '') => `<div class="cards" ${style ? `style="${style}"` : ''}>${arr.join('')}</div>`;
  UI.panel = (title, body, actions = '') => `<section class="panel"><div class="row between"><h3>${esc(title)}</h3><div class="row">${actions}</div></div>${body}</section>`;
  UI.flow = arr => `<div class="flow">${arr.map((s, i) => `<span>${esc(s)}</span>${i < arr.length - 1 ? '<i>→</i>' : ''}`).join('')}</div>`;
  UI.notice = (text, cls = '') => `<div class="notice ${cls}">${esc(text)}</div>`;
  UI.muted = t => `<p class="muted">${esc(t)}</p>`;
  UI.table = (head, rows, opts = {}) => {
    if (!rows.length) return `<div class="empty">${esc(opts.empty || 'No records yet.')}</div>`;
    const th = h => (typeof h === 'object' ? `<th title="${esc(h.title)}">${esc(h.label)}</th>` : `<th>${esc(h)}</th>`);
    return `<div class="scroll-x"><table><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  UI.tabs = (items, active, act) => `<div class="tabs">${items.map(([id, label]) => `<button class="tab ${active === id ? 'selected' : ''}" data-act="${act}" data-arg="${esc(id)}" type="button">${esc(label)}</button>`).join('')}</div>`;
  UI.btn = (label, act, arg = '', cls = '', attrs = '') => raw(`<button class="btn ${cls}" data-act="${act}" data-arg="${esc(arg)}" ${attrs} type="button">${esc(label)}</button>`);
  UI.kv = obj => `<div class="kv">${Object.entries(obj).map(([k, v]) => `<b>${esc(k)}</b><span>${cell(v === '' || v == null ? '—' : v)}</span>`).join('')}</div>`;
  UI.bar = (label, count, pct) => `<div class="row between"><span>${esc(label)}</span><strong>${esc(count)}</strong></div><div class="bar"><div style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
  UI.stagebar = (stage) => { const S = LGM.Config.stages, i = S.indexOf(stage); return `<div class="stagebar" title="${esc(stage)}">${S.map((s, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>`; };

  // ---------- events ----------
  UI.on = (name, fn) => { UI.actions[name] = fn; };
  function wire() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
      const fn = UI.actions[el.dataset.act]; if (fn) fn(el.dataset.arg, el, e);
    });
    document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && UI.actions[el.dataset.change]) UI.actions[el.dataset.change](el.value, el, e); });
    document.addEventListener('input', e => { const el = e.target.closest('[data-input]'); if (el && UI.actions[el.dataset.input]) UI.actions[el.dataset.input](el.value, el, e); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('#overlay-root .overlay')) UI.modal.close(); });
  }

  // ---------- modal / confirm / toast ----------
  let onClose = null;
  UI.modal = {
    open({ title, body, footer = '', narrow = false, onOpen, closed }) {
      onClose = closed || null;
      document.getElementById('overlay-root').innerHTML = `<div class="overlay" data-act="modalBackdrop"><div class="modal ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h3>${esc(title)}</h3><button class="modal-x" data-act="modalClose" aria-label="Close" type="button">×</button></div><div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div></div>`;
      const first = document.querySelector('#overlay-root input:not([type=hidden]):not([disabled]),#overlay-root select,#overlay-root textarea'); if (first) first.focus();
      if (onOpen) onOpen();
    },
    close() { document.getElementById('overlay-root').innerHTML = ''; const f = onClose; onClose = null; if (f) f(); },
    isOpen: () => !!document.querySelector('#overlay-root .overlay'),
  };
  UI.on('modalClose', () => UI.modal.close());
  UI.on('modalBackdrop', (a, el, e) => { if (e.target === el) UI.modal.close(); });

  /** Promise-based confirm (replaces window.confirm so it is styled, testable and never blocks). */
  UI.confirm = ({ title = 'Please confirm', message, ok = 'Confirm', danger = false, html = '' }) => new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; resolve(v); };
    UI.modal.open({ title, narrow: true, body: `<p style="margin:0;font-size:14px;line-height:1.5">${esc(message)}</p>${html}`,
      footer: `<button class="btn secondary" data-act="confirmNo" type="button">Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-act="confirmYes" type="button">${esc(ok)}</button>`, closed: () => finish(false) });
    UI.actions.confirmYes = () => { finish(true); UI.modal.close(); };
    UI.actions.confirmNo = () => { UI.modal.close(); };
  });
  UI.toast = (msg, kind = '') => {
    const root = document.getElementById('toasts'); const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; root.appendChild(t);
    setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3800);
  };

  // ---------- report preview (used by Reports, AI Reports, toolbar) ----------
  UI.previewReport = res => {
    UI.state.preview = res;
    const rows = res.rows.slice(0, 100);
    UI.modal.open({
      title: res.name, body: (res.interpretation ? `<p class="muted">${res.interpretation.map(esc).join(' · ')}</p>` : '') +
        `<p class="muted">${res.rows.length} record(s)${res.rows.length > 100 ? ' — showing first 100; export for all' : ''}</p>` +
        UI.table(res.columns.map(c => c.label), rows.map(r => res.columns.map(c => r[c.key] == null ? '' : r[c.key])), { empty: 'No matching records for these filters.' }),
      footer: `<button class="btn secondary" data-act="modalClose" type="button">Close</button><button class="btn" data-act="exportPreview" type="button" ${res.rows.length ? '' : 'disabled'}>⇩ Export CSV</button>`,
    });
  };
  UI.on('exportPreview', () => { const r = UI.state.preview; if (r && LGM.Exporter.exportRows(r.name, r.columns, r.rows)) UI.toast('Exported ' + r.rows.length + ' row(s) — ' + LGM.Exporter.last().name, 'ok'); });

  UI.wire = wire;
  LGM.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);

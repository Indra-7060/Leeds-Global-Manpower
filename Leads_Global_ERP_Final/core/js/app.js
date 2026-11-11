/* ERP core · app.js — application shell, hash router and generic views.
   Everything shown comes from the config object (menus, cards, tables, reports, labels) and from the Store (data).
   The core never mentions recruitment, CRM or any other business. */
(function (g) {
  'use strict';
  const ERP = g.ERP = g.ERP || {};
  const U = ERP.util, ui = ERP.ui, esc = U.esc;
  const RESERVED = ['q', 'fn', 'sort', 'dir', 'page'];
  const PAGE = 50;

  function App(config, opts) {
    const store = opts.store, files = opts.files, mount = opts.mount, cur = config.currency || '';
    const scopes = config.scope ? config.scope.values : [], scopeField = config.scope ? config.scope.field : null;
    const state = { sort: {}, page: {}, q: {}, drills: [], fnRegistry: {} };
    let userName = 'Local user';
    const UKEY = 'erp_user_' + config.id;
    try { userName = g.localStorage.getItem(UKEY) || userName; } catch (e) { /* storage blocked: keep default */ }
    const setUser = n => { userName = (n || '').trim() || 'Local user'; try { g.localStorage.setItem(UKEY, userName); } catch (e) { /* ignore */ } };
    const T = config.text || {};
    const colorOf = sc => (config.scope && config.scope.colors && config.scope.colors[sc]) || '#1766ac', scopeLabel = config.scope ? config.scope.label : '', defScope = scopes[0] || undefined;

    /* ======================= helpers ======================= */
    const isScope = s => scopes.includes(s);
    const hrefOf = (scope, kind, id, query) => '#/s/' + encodeURIComponent(scope) + '/' + kind + (id ? '/' + encodeURIComponent(id) : '') + (query ? '?' + query : '');
    const qs = o => Object.keys(o || {}).filter(k => o[k] !== '' && o[k] != null).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
    function parseHash() {
      const raw = (g.location.hash || '').replace(/^#\/?/, ''), [path, query] = raw.split('?'), parts = path.split('/').filter(Boolean).map(decodeURIComponent), q = {};
      (query || '').split('&').filter(Boolean).forEach(p => { const [k, v] = p.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
      if (!parts.length || parts[0] === 'overview') return { view: 'overview', q };
      if (parts[0] === 'settings') return { view: 'settings', q };
      if (parts[0] === 'audit') return { view: 'audit', q };
      if (parts[0] === 's' && parts[1]) { const scope = parts[1]; const v = parts[2] || 'home'; return { view: v === 'e' ? 'entity' : v === 'r' ? 'report' : v, scope, id: parts[3], q }; }
      return { view: 'overview', q };
    }
    const go = h => { if (g.location.hash === h) render(); else g.location.hash = h; };
    function drillHref(d, scope) {
      if (!d) return '';
      const sc = d.scope || (d.all ? 'all' : scope || (scopes[0] || 'all'));
      if (d.report) return hrefOf(sc, 'r', d.report);
      if (d.view) return hrefOf(sc, d.view);
      const f = {}; Object.keys(d.filter || {}).forEach(k => { const v = d.filter[k]; f[k] = v && typeof v === 'object' ? (v.nonEmpty ? '*' : '') : v; });
      if (d.id) f.q = d.id;
      if (d.filterFn) f.fn = d.fnKey || d.label || '';
      return hrefOf(sc, 'e', d.entity, qs(f));
    }
    function registerDrills() {   // filter functions cannot live in a URL: register them by key so links survive a reload
      const add = (c, scope) => { if (c.drill && c.drill.filterFn) { c.drill.fnKey = c.label; state.fnRegistry[c.label] = c.drill.filterFn; } };
      (config.overview && config.overview.cards || []).forEach(add);
      Object.values(config.home || {}).forEach(h => (h.cards || []).forEach(add));
    }
    const entityLabel = (k, scope) => store.label(k, isScope(scope) ? scope : null);
    const recScope = r => (scopeField && r ? r[scopeField] : null);

    /* ======================= value rendering ======================= */
    function fieldOf(entity, key, scope) {
      const sc = isScope(scope) ? scope : null; let f = store.fieldsFor(entity, sc).find(x => x.key === key);
      if (!f && !sc) for (const s of scopes) { f = store.fieldsFor(entity, s).find(x => x.key === key); if (f) break; }
      return f;
    }
    function colLabel(entity, key, scope) {
      if (key === 'id') return 'ID'; if (key === 'createdAt') return 'Created'; if (key === scopeField) return scopeLabel;
      const c = (config.entities[entity].computed || {})[key]; if (c) return c.label;
      const f = fieldOf(entity, key, scope); return f ? f.label.replace(/\s*\(.*?\)\s*$/, '') : key;
    }
    function cell(entity, key, rec, scope) {
      const e = config.entities[entity];
      if (key === 'id') return '<span class="mono">' + esc(rec.id) + '</span>';
      if (key === 'createdAt') return esc((rec.createdAt || '').slice(0, 10));
      const comp = (e.computed || {})[key];
      if (comp) { const v = comp.value(rec, store), tone = comp.tone ? comp.tone(rec, store) : ''; const inner = tone ? ui.badge(v, tone) : esc(v); return comp.drill ? '<a href="' + esc(drillHref(comp.drill(rec), recScope(rec) || scope)) + '" class="lnk">' + inner + '</a>' : inner; }
      const f = fieldOf(entity, key, recScope(rec) || scope), v = rec[key];
      if (v === '' || v == null) return '<span class="muted">—</span>';
      if (!f) return esc(v);
      if (f.type === 'ref') { const t = store.get(f.ref, v); return t ? esc(store.display(f.ref, t)) : '<span class="muted" title="Missing record">' + esc(v) + ' (missing)</span>'; }
      if (f.type === 'number') return f.label.indexOf(cur) >= 0 && cur ? '<span class="num">' + ui.fmtNum(v) + '</span>' : '<span class="num">' + esc(v) + '</span>';
      if (key === 'fileSize') return ui.fmtBytes(v);
      if (f.type === 'select') { const tone = config.tone ? config.tone(v) : ''; return tone ? ui.badge(v, tone) : esc(v); }
      const s = String(v); return s.length > 70 ? '<span title="' + esc(s) + '">' + esc(s.slice(0, 68)) + '…</span>' : esc(s);
    }
    function plain(entity, key, rec, scope) {   // text version of a cell (sorting, search, CSV)
      const e = config.entities[entity], comp = (e.computed || {})[key]; if (comp) return String(comp.value(rec, store));
      const f = fieldOf(entity, key, recScope(rec) || scope), v = rec[key]; if (f && f.type === 'ref') return store.display(f.ref, store.get(f.ref, v)) || String(v || ''); return v == null ? '' : String(v);
    }

    /* ======================= generic UI pieces ======================= */
    const card = c => { const i = state.drills.push(c) - 1; return c; };
    function cardsHtml(cards, scope) {
      return '<div class="cards">' + cards.map(c => {
        let v; try { v = c.value(store, isScope(scope) ? scope : null); } catch (e) { v = '!'; }
        const shown = c.format === 'money' ? ui.fmtMoney(v, cur) : (typeof v === 'number' ? ui.fmtNum(v) : esc(v));
        const href = c.drill ? drillHref(c.drill, scope) : '';
        return (href ? '<a class="kpi ' + (c.tone ? 'k-' + c.tone : '') + '" href="' + esc(href) + '">' : '<div class="kpi ' + (c.tone ? 'k-' + c.tone : '') + '">') + '<b>' + shown + '</b><span>' + esc(c.label) + '</span>' + (href ? '</a>' : '</div>');
      }).join('') + '</div>';
    }
    function tableHtml(columns, rows, o) {   // columns [{key,label,type}], rows [{...,tone,drill}]
      o = o || {};
      if (!rows.length) return '<div class="empty">' + esc(o.empty || 'No records yet.') + '</div>';
      const body = rows.map(r => {
        const href = r.drill ? drillHref(r.drill, o.scope) : '';
        return '<tr' + (href ? ' class="clickable" data-href="' + esc(href) + '"' : '') + '>' + columns.map(c => {
          const v = r[c.key]; let h;
          if (v === '' || v == null) h = '<span class="muted">—</span>';
          else if (c.type === 'money') h = '<span class="num">' + ui.fmtMoney(v) + '</span>';
          else if (c.type === 'number') h = '<span class="num">' + ui.fmtNum(v) + '</span>';
          else if (c.type === 'badge') h = ui.badge(v, r.tone || (config.tone ? config.tone(v) : ''));
          else h = esc(v);
          return '<td' + (c.type === 'money' || c.type === 'number' ? ' class="r"' : '') + '>' + h + '</td>';
        }).join('') + '</tr>';
      }).join('');
      let foot = ''; if (o.totals) foot = '<tfoot><tr>' + columns.map((c, i) => { const v = o.totals[c.key]; return '<td class="r"><b>' + (i === 0 ? 'Total' : v == null ? '' : (c.type === 'money' ? ui.fmtMoney(v) : ui.fmtNum(v))) + '</b></td>'; }).join('') + '</tr></tfoot>';
      return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + columns.map(c => '<th' + (c.type === 'money' || c.type === 'number' ? ' class="r"' : '') + '>' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody>' + foot + '</table></div>';
    }
    const scopeChip = s => isScope(s) ? '<span class="chip" style="--c:' + esc(colorOf(s)) + '">' + esc(s) + '</span>' : (scopes.length ? '<span class="chip">All ' + esc(scopeLabel.toLowerCase()) + 's</span>' : '');
    const head = (title, sub, right) => '<div class="pg-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="pg-actions">' + (right || '') + '</div></div>';

    /* ======================= views ======================= */
    function overviewView() {
      const o = config.overview || {}, empty = !Object.keys(config.entities).some(k => store.count(k));
      let h = head(T.overviewTitle || 'Main Dashboard', 'Live totals from the records saved in this ' + (store.adapter.key ? 'browser' : 'session') + '.');
      if (o.notice) h += '<div class="notice">' + esc(o.notice) + '</div>';
      if (empty) h += emptyStart();
      h += cardsHtml(o.cards || [], null);
      h += pipelineHtml(o.stageCards, null);
      h += panelsHtml(o.panels, null);
      if (o.divisionTable && scopes.length) {
        const dt = o.divisionTable, cols = [{ key: '_s', label: config.scope.label }].concat(dt.columns.map(c => ({ key: c, label: c, type: 'number' })));
        const rows = scopes.map(s => Object.assign({ _s: s, drill: { view: 'home', scope: s } }, dt.row(store, s)));
        h += '<section class="panel"><div class="panel-h"><h2>' + esc(dt.title) + '</h2></div>' + (dt.note ? '<p class="note">' + esc(dt.note) + '</p>' : '') + tableHtml(cols, rows, {}) + '</section>';
      }
      h += '<div class="tiles">' + scopes.map(s => '<a class="tile" style="--c:' + esc(colorOf(s)) + '" href="' + esc(hrefOf(s, 'home')) + '"><b>' + esc(s) + '</b><span>' + esc(((config.home || {})[s] || {}).intro || '') + '</span><em>Open ' + esc(s) + ' dashboard →</em></a>').join('') + '</div>';
      return { title: T.overviewTitle || 'Main Dashboard', html: h };
    }
    function emptyStart() {
      return '<section class="panel start"><h2>Get started</h2><p>There is no data yet. ' + esc(config.text && config.text.emptyHint || 'Add the first record from the menu, or load the fictional demo data to explore.') + '</p>' + (config.demo && config.demo.seed ? '<button class="btn primary" data-act="load-demo">Load fictional demo data</button>' : '') + '</section>';
    }
    function homeView(scope) {
      const hc = (config.home || {})[scope]; if (!hc) return { title: scope, html: '<div class="empty">No dashboard configured for ' + esc(scope) + '.</div>' };
      let h = head(scope + ' — dashboard', null, quickButtons(scope, hc));
      if (hc.intro) h += '<div class="flow">' + hc.intro.split('→').map((t, i, a) => '<span class="step">' + esc(t.trim()) + '</span>' + (i < a.length - 1 ? '<i>→</i>' : '')).join('') + '</div>';
      if (!Object.keys(config.entities).some(k => store.isScoped(k) && store.count(k, r => r[scopeField] === scope))) h += emptyStart();
      h += cardsHtml(hc.cards || [], scope);
      h += pipelineHtml(hc.stageCards, scope);
      h += panelsHtml(hc.panels, scope);
      return { title: scope + ' dashboard', html: h };
    }
    function pipelineHtml(stages, scope) {
      if (!(stages && stages.length && config.pipeline)) return '';
      const pe = config.pipeline, sc = isScope(scope) ? scope : null;
      return '<section class="panel"><div class="panel-h"><h2>' + esc(pe.title || 'Pipeline') + '</h2><span class="note">Current stage' + (config.pipelineReached ? ' · (ever reached)' : '') + '</span></div><div class="pipe">' + stages.map(st => {
        const n = store.count(pe.entity, r => (!sc || r[scopeField] === sc) && r[pe.field] === st), reached = config.pipelineReached ? config.pipelineReached(store, st, sc) : null;
        return '<a class="pstage ' + (n ? 'has' : '') + ((pe.negative || []).indexOf(st) >= 0 ? ' rej' : '') + '" href="' + esc(hrefOf(sc || 'all', 'e', pe.entity, qs({ [pe.field]: st }))) + '"><b>' + n + '</b><span>' + esc(st) + '</span>' + (reached != null ? '<small>(' + reached + ')</small>' : '') + '</a>';
      }).join('') + '</div></section>';
    }
    function panelsHtml(ids, scope) {
      const sc = isScope(scope) ? scope : null; let h = '';
      (ids || []).forEach(id => { const r = config.reports[id]; if (!r) return; const rows = r.rows(store, sc), shown = rows.slice(0, 8);
        h += '<section class="panel"><div class="panel-h"><h2>' + esc(r.title) + '</h2><a class="lnk" href="' + esc(hrefOf(sc || 'all', 'r', id)) + '">Open full report →</a></div>' + tableHtml(r.columns, shown, { scope: sc, empty: 'Nothing to show yet.', totals: r.totals && shown.length === rows.length ? r.totals(store, sc) : null }) + (rows.length > shown.length ? '<div class="more">' + (rows.length - shown.length) + ' more rows in the full report</div>' : '') + '</section>'; });
      return h;
    }
    function quickButtons(scope, hc) {
      const list = hc.quick || []; return list.map(k => store.fieldsFor(k, scope).length ? '<button class="btn" data-act="add" data-entity="' + k + '" data-scope="' + esc(scope || '') + '">' + ui.icon('plus') + ' ' + esc(entityLabel(k, scope).label) + '</button>' : '').join('');
    }

    /* ---------- entity list ---------- */
    function colsFor(entity, scope) { const c = config.entities[entity].columns; const arr = Array.isArray(c) ? c : (c && (c[scope] || c.default)) || ['id']; return arr.filter(k => k === 'id' || k === 'createdAt' || (config.entities[entity].computed || {})[k] || fieldOf(entity, k, scope)); }
    function listRows(entity, scope, q) {
      const e = config.entities[entity], scoped = store.isScoped(entity) && isScope(scope);
      let rows = store.list(entity, scoped ? { [scopeField]: scope } : null);
      Object.keys(q).filter(k => RESERVED.indexOf(k) < 0).forEach(k => { const v = q[k]; rows = rows.filter(r => v === '*' ? (r[k] !== '' && r[k] != null) : r[k] === v); });
      if (q.fn && state.fnRegistry[q.fn]) rows = rows.filter(r => state.fnRegistry[q.fn](r, store));
      if (q.q) { const n = U.norm(q.q); rows = rows.filter(r => U.norm(r.id + ' ' + Object.keys(r).map(k => { const f = fieldOf(entity, k, recScope(r) || scope); return f && f.type === 'ref' ? store.display(f.ref, store.get(f.ref, r[k])) : r[k]; }).join(' ')).indexOf(n) >= 0); }
      const sk = state.sort[entity] || { key: 'createdAt', dir: -1 }, cols = colsFor(entity, scope);
      rows = rows.slice().sort((a, b) => { const x = sk.key === 'createdAt' ? (a.createdAt || '') + a.id : plain(entity, sk.key, a, scope), y = sk.key === 'createdAt' ? (b.createdAt || '') + b.id : plain(entity, sk.key, b, scope); const fx = Number(x), fy = Number(y); const c = (x !== '' && y !== '' && !isNaN(fx) && !isNaN(fy)) ? fx - fy : String(x).localeCompare(String(y)); return c * sk.dir || a.id.localeCompare(b.id); });
      return rows;
    }
    function entityView(scope, entity, q) {
      if (!config.entities[entity]) return { title: 'Not found', html: '<div class="empty">Unknown table "' + esc(entity) + '".</div>' };
      const e = config.entities[entity], lab = entityLabel(entity, scope), sc = isScope(scope) ? scope : null, scoped = store.isScoped(entity);
      const fields = sc || !scoped ? store.fieldsFor(entity, sc || (scopes[0] || null)) : store.fieldsFor(entity, scopes[0]);
      let cols = colsFor(entity, sc || scopes[0]); if (!sc && scoped && cols.indexOf(scopeField) < 0) cols = [cols[0], scopeField].concat(cols.slice(1));
      const rows = listRows(entity, scope, q), pg = Math.max(1, Math.min(Number(q.page || state.page[entity] || 1), Math.ceil(rows.length / PAGE) || 1));
      const sk = state.sort[entity] || { key: 'createdAt', dir: -1 };
      const canAdd = (!scoped || sc) && store.fieldsFor(entity, sc || null).length > 0;
      let h = head(lab.plural, scopeChip(sc || 'all') + ' · ' + rows.length + ' record' + (rows.length === 1 ? '' : 's') + (rows.length !== store.count(entity, scoped && sc ? { [scopeField]: sc } : null) ? ' (filtered)' : ''),
        (e.upload ? '' : '') + '<button class="btn" data-act="export" data-entity="' + entity + '"' + (!sc && scoped ? ' disabled title="Open a ' + esc(config.scope.label.toLowerCase()) + ' to export"' : '') + '>' + ui.icon('download') + ' Export CSV</button>' + '<button class="btn primary" data-act="add" data-entity="' + entity + '" data-scope="' + esc(sc || '') + '"' + (canAdd ? '' : ' disabled title="Open a ' + esc(config.scope ? config.scope.label.toLowerCase() : 'scope') + ' to add records"') + '>' + ui.icon('plus') + ' Add ' + esc(lab.label.toLowerCase()) + '</button>');
      // toolbar
      const fl = (e.filters || []).map(k => { const f = fields.find(x => x.key === k); if (!f) return '';
        let opts = f.type === 'ref' ? store.list(f.ref, store.isScoped(f.ref) && sc && f.sameScope !== false ? { [scopeField]: sc } : null).map(t => ({ v: t.id, t: store.display(f.ref, t) })) : f.type === 'select' ? store.optionsFor(f, sc || scopes[0], {}).map(o => ({ v: o, t: o })) : [...new Set(store.list(entity, scoped && sc ? { [scopeField]: sc } : null).map(r => r[k]).filter(Boolean))].sort().map(o => ({ v: o, t: o }));
        return '<select class="inp sm" data-filter="' + k + '" aria-label="' + esc(f.label) + '"><option value="">' + esc(f.label.replace(/\s*\(.*?\)\s*/, '')) + ': all</option>' + opts.map(o => '<option value="' + esc(o.v) + '"' + (q[k] === o.v ? ' selected' : '') + '>' + esc(o.t) + '</option>').join('') + '</select>'; }).join('');
      const active = Object.keys(q).filter(k => RESERVED.indexOf(k) < 0 && k !== 'q' || k === 'fn'), hasAny = active.length || q.q;
      h += '<div class="toolbar"><div class="search">' + ui.icon('search') + '<input class="inp sm" id="list-q" type="search" placeholder="Search ' + esc(lab.plural.toLowerCase()) + '…" value="' + esc(q.q || '') + '" aria-label="Search"></div>' + fl + (hasAny ? '<button class="btn sm" data-act="clear-filters">Clear filters</button>' : '') + '</div>';
      if (q.fn) h += '<div class="notice info">Showing: <b>' + esc(q.fn) + '</b>' + (state.fnRegistry[q.fn] ? '' : ' (this saved filter is no longer available — all records are shown)') + '</div>';
      h += '<div id="list-body">' + listBody(entity, sc || scope, rows, cols, pg, sk, q) + '</div>';
      return { title: lab.plural, html: h };
    }
    function listBody(entity, scope, rows, cols, pg, sk, q) {
      const e = config.entities[entity], sc = isScope(scope) ? scope : null;
      if (!rows.length) return '<div class="empty">' + (store.count(entity) ? 'No records match these filters.' : 'No records yet. Use the Add button to create the first one.') + '</div>';
      const slice = rows.slice((pg - 1) * PAGE, pg * PAGE), actions = e.actions || [];
      const th = cols.map(k => '<th class="sortable" data-act="sort" data-key="' + k + '" aria-sort="' + (sk.key === k ? (sk.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + esc(colLabel(entity, k, sc)) + (sk.key === k ? (sk.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>').join('') + '<th class="act-col">Actions</th>';
      const tr = slice.map(r => '<tr>' + cols.map(k => '<td>' + cell(entity, k, r, sc) + '</td>').join('') + '<td class="acts">' + [
        '<button class="icon-btn" title="View" aria-label="View" data-act="view" data-entity="' + entity + '" data-id="' + r.id + '">' + ui.icon('eye') + '</button>',
        e.upload && r.fileId ? '<button class="icon-btn" title="Download file" aria-label="Download file" data-act="download" data-id="' + r.id + '">' + ui.icon('download') + '</button>' : '',
        actions.map((a, i) => (!a.when || a.when(r, store)) ? '<button class="btn xs" data-act="rowaction" data-entity="' + entity + '" data-i="' + i + '" data-id="' + r.id + '">' + esc(a.label) + '</button>' : '').join(''),
        '<button class="icon-btn" title="Edit" aria-label="Edit" data-act="edit" data-entity="' + entity + '" data-id="' + r.id + '">' + ui.icon('edit') + '</button>',
        '<button class="icon-btn danger" title="Delete" aria-label="Delete" data-act="delete" data-entity="' + entity + '" data-id="' + r.id + '">' + ui.icon('trash') + '</button>'].join('') + '</td></tr>').join('');
      const pages = Math.ceil(rows.length / PAGE);
      return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>' + (pages > 1 ? '<div class="pager"><button class="btn sm" data-act="page" data-d="-1"' + (pg <= 1 ? ' disabled' : '') + '>‹ Previous</button><span>Page ' + pg + ' of ' + pages + '</span><button class="btn sm" data-act="page" data-d="1"' + (pg >= pages ? ' disabled' : '') + '>Next ›</button></div>' : '');
    }

    /* ---------- reports ---------- */
    function reportView(scope, id) {
      const r = config.reports[id]; if (!r) return { title: 'Report', html: '<div class="empty">Unknown report.</div>' };
      const sc = isScope(scope) ? scope : null, rows = r.rows(store, sc);
      let h = head(r.title, scopeChip(sc || 'all') + ' · ' + rows.length + ' row' + (rows.length === 1 ? '' : 's'), '<button class="btn" data-act="export-report" data-id="' + id + '">' + ui.icon('download') + ' Export CSV</button>');
      if (r.note) h += '<div class="notice info">' + esc(r.note) + '</div>';
      h += '<section class="panel">' + tableHtml(r.columns, rows, { scope: sc, empty: 'Nothing to show yet.', totals: r.totals ? r.totals(store, sc) : null }) + '</section>';
      return { title: r.title, html: h };
    }

    /* ---------- import / export ---------- */
    function importView(scope) {
      const sc = isScope(scope) ? scope : defScope, items = (scopes.length ? ((config.nav.scope || {})[sc] || []) : (config.nav.global || [])).filter(i => i.view === 'entity' && store.fieldsFor(i.entity, sc).some(f => f.type !== 'file'));
      let h = head('Import / Export', (sc ? scopeChip(sc) + ' · ' : '') + 'CSV files' + (scopeLabel ? ' for this ' + scopeLabel.toLowerCase() : ''), '');
      h += '<div class="notice info">Every imported row is checked with the same rules as the Add form (required fields, valid dates, linked records, duplicates). You see an exact preview first; nothing is saved until you confirm. Linked columns accept the other record\'s ID or its exact name. Dates: YYYY-MM-DD or DD/MM/YYYY.</div>';
      h += '<div class="imp-grid">' + items.map(i => { const lab = entityLabel(i.entity, sc); return '<section class="panel imp"><h2>' + esc(lab.plural) + '</h2><p class="note">' + store.count(i.entity, store.isScoped(i.entity) ? { [scopeField]: sc } : null) + ' records</p><div class="row-btns"><button class="btn sm" data-act="import-template" data-entity="' + i.entity + '">' + ui.icon('download') + ' Template</button><label class="btn sm primary">' + ui.icon('upload') + ' Import CSV<input type="file" accept=".csv,text/csv" hidden data-import="' + i.entity + '"></label><button class="btn sm" data-act="export" data-entity="' + i.entity + '">' + ui.icon('download') + ' Export</button></div></section>'; }).join('') + '</div>';
      return { title: 'Import / Export', html: h };
    }
    async function onImportFile(entity, scope, file) {
      if (!file) return; if (file.size > 5 * 1024 * 1024) { ui.toast('That file is larger than 5 MB.', 'error'); return; }
      let text; try { text = await file.text(); } catch (e) { ui.toast('The file could not be read.', 'error'); return; }
      const res = ERP.importer.analyse(store, entity, scope, text, userName);
      if (!res.ok) { ui.toast(res.error, 'error'); return; }
      const s = res.summary, cols = store.fieldsFor(entity, scope).filter(f => f.type !== 'file').slice(0, 4);
      const rows = res.items.slice(0, 200).map(it => '<tr class="' + it.status + '"><td>' + it.line + '</td><td>' + ui.badge(it.status === 'new' ? 'Will add' : it.status === 'duplicate' ? 'Duplicate' : 'Rejected', it.status === 'new' ? 'good' : it.status === 'duplicate' ? 'warn' : 'bad') + '</td>' + cols.map(f => '<td>' + esc(it.values[f.key] == null ? '' : (f.type === 'ref' ? (store.display(f.ref, store.get(f.ref, it.values[f.key])) || it.values[f.key]) : it.values[f.key])) + '</td>').join('') + '<td class="err-t">' + esc(it.errors.join(' · ')) + '</td></tr>').join('');
      const m = ui.modal({ title: 'Import preview — ' + entityLabel(entity, scope).plural, wide: true, body:
        '<div class="sum"><span class="kpi k-good"><b>' + s.valid + '</b><span>will be added</span></span><span class="kpi k-warn"><b>' + s.duplicate + '</b><span>duplicates skipped</span></span><span class="kpi k-bad"><b>' + s.invalid + '</b><span>rejected</span></span><span class="kpi"><b>' + s.total + '</b><span>rows in file</span></span></div>' +
        (res.unknown.length ? '<div class="notice">Columns not recognised and ignored: ' + esc(res.unknown.join(', ')) + '</div>' : '') + '<div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Line</th><th>Result</th>' + cols.map(f => '<th>' + esc(f.label) + '</th>').join('') + '<th>Reason</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + (res.items.length > 200 ? '<p class="note">Showing the first 200 rows of ' + res.items.length + '.</p>' : ''),
        actions: [{ label: 'Cancel', run: x => x.close() }, { label: 'Download problem rows', run: () => { const bad = res.items.filter(x => x.status !== 'new'); if (!bad.length) { ui.toast('There are no problem rows.', 'info'); return; } U.download(U.csvStringify([['line', 'result', 'reason']].concat(bad.map(b => [b.line, b.status, b.errors.join(' | ')]))), entity + '_import_problems.csv', 'text/csv'); } },
          { label: s.valid ? 'Import ' + s.valid + ' record' + (s.valid === 1 ? '' : 's') : 'Nothing to import', cls: 'primary', id: 'commit', run: x => { if (!s.valid) return; try { const r = ERP.importer.commit(store, entity, scope, res.items, userName); x.close(); ui.toast(r.added + ' record' + (r.added === 1 ? '' : 's') + ' imported.' + (r.failed.length ? ' ' + r.failed.length + ' failed.' : ''), r.failed.length ? 'warn' : 'success'); render(); } catch (e) { ui.toast('Import failed and nothing was saved: ' + e.message, 'error'); } } }] });
      if (!s.valid) m.foot.querySelector('[data-id=commit]').disabled = true;
    }

    /* ---------- settings / audit ---------- */
    function settingsView() {
      const counts = Object.keys(config.entities).map(k => '<tr><td>' + esc(config.entities[k].plural || k) + '</td><td class="r">' + store.count(k) + '</td></tr>').join('');
      let h = head('Settings & Backup', 'Storage, backup / restore, demo data and the limits of this build.');
      h += '<div class="notice warn">' + esc(config.limitations || 'Data is kept in this browser on this device only. It is not secure, not shared between users and can be lost if browser data is cleared. Use Backup regularly. A production system needs a server database, sign-in, roles and audit.') + '</div>';
      h += '<div class="grid2"><section class="panel"><h2>Storage</h2><p><b>Records:</b> ' + esc(store.adapter.kind) + '</p><p><b>Documents:</b> ' + esc(files.kind) + '</p><div class="tbl-wrap"><table class="tbl sm"><tbody>' + counts + '</tbody></table></div></section>';
      h += '<section class="panel"><h2>Backup &amp; restore (JSON)</h2><p class="note">A backup contains every table, the history, the audit log and (optionally) the uploaded documents. A backup can only be restored into the same project.</p><div class="row-btns"><button class="btn primary" data-act="backup">' + ui.icon('download') + ' Download backup</button><label class="btn">' + ui.icon('upload') + ' Restore backup…<input type="file" accept=".json,application/json" hidden data-restore></label></div><label class="chk"><input type="checkbox" id="bk-files" checked> include uploaded documents</label></section>';
      h += '<section class="panel"><h2>You</h2><p class="note">This name is stored with every change you make (audit log, history, “Updated by”).</p><div class="row-btns"><input class="inp" id="user-name" value="' + esc(userName) + '" maxlength="60" aria-label="Your name"><button class="btn" data-act="save-user">Save name</button></div></section>';
      h += '<section class="panel"><h2>Demo data</h2><p class="note">' + (config.demo && config.demo.seed ? 'Loads fictional records that run through the real workflow rules. Replaces all current data.' : 'No demo data is configured for this project.') + '</p><div class="row-btns">' + (config.demo && config.demo.seed ? '<button class="btn" data-act="load-demo">Load fictional demo data</button>' : '') + '<button class="btn danger" data-act="clear-all">Delete all data…</button></div></section></div>';
      h += '<section class="panel"><h2>What a production version needs</h2><ul class="plain"><li>Server database (e.g. PostgreSQL / MySQL) instead of browser storage — replace only the storage adapter.</li><li>Sign-in, roles and permissions enforced on the server, not in the browser.</li><li>The same validation rules repeated on the server.</li><li>Server-side audit log, scheduled backups and secure document storage with access control.</li><li>Multi-user conflict handling (two people editing one record).</li></ul></section>';
      return { title: 'Settings', html: h };
    }
    function auditView(q) {
      const n = U.norm(q.q || ''), rows = store.audit.slice().reverse().filter(a => !n || U.norm([a.action, a.entity, a.recordId, a.summary, a.by].join(' ')).indexOf(n) >= 0).slice(0, 300);
      return { title: 'Audit log', html: head('Audit log', 'Latest ' + rows.length + ' of ' + store.audit.length + ' entries') + '<div class="toolbar"><div class="search">' + ui.icon('search') + '<input class="inp sm" id="audit-q" type="search" placeholder="Filter the log…" value="' + esc(q.q || '') + '"></div></div><section class="panel">' + tableHtml([{ key: 'at', label: 'When' }, { key: 'by', label: 'By' }, { key: 'action', label: 'Action', type: 'badge' }, { key: 'entity', label: 'Table' }, { key: 'recordId', label: 'Record' }, { key: 'summary', label: 'Summary' }], rows.map(a => ({ at: a.at.replace('T', ' ').slice(0, 19), by: a.by, action: a.action, entity: a.entity, recordId: a.recordId, summary: a.summary })), { empty: 'Nothing has been recorded yet.' }) + '</section>' };
    }

    /* ======================= shell ======================= */
    function iconOf(n) { return ui.icon(n || 'list'); }
    function navLink(i, sc, route) {
      if (i.section) return '<div class="nv-h">' + esc(i.section) + '</div>';
      let href, on = false, label = i.label;
      if (i.view === 'overview') { href = '#/overview'; on = route.view === 'overview'; }
      else if (i.view === 'home') { href = hrefOf(sc, 'home'); on = route.view === 'home'; }
      else if (i.view === 'entity') { href = hrefOf(sc || 'all', 'e', i.entity); on = route.view === 'entity' && route.id === i.entity; label = label || entityLabel(i.entity, sc).plural; }
      else if (i.view === 'report') { href = hrefOf(sc || 'all', 'r', i.id); on = route.view === 'report' && route.id === i.id; }
      else if (i.view === 'import') { href = hrefOf(sc || 'all', 'import'); on = route.view === 'import'; }
      else return '';
      return '<a class="nv ' + (on ? 'on' : '') + '" href="' + esc(href) + '">' + iconOf(i.icon) + '<span>' + esc(label) + '</span></a>';
    }
    function sidebar(route) {
      const cur2 = route.scope && isScope(route.scope) ? route.scope : null;
      let h = '<div class="brand"><div class="logo">' + esc((config.name || 'ERP').split(/\s+/).map(w => w[0]).slice(0, 2).join('')) + '</div><div><b>' + esc(config.name) + '</b><small>' + esc(config.subtitle || '') + '</small></div></div><nav aria-label="Main">';
      (config.nav.global || []).forEach(i => { h += navLink(i, scopes.length ? null : 'all', route); });
      if (scopes.length) { h += '<div class="nv-h">' + esc(scopeLabel) + 's</div><div class="scope-sw">' + scopes.map(s => '<a class="sc ' + (cur2 === s ? 'on' : '') + '" style="--c:' + esc(colorOf(s)) + '" href="' + esc(hrefOf(s, 'home')) + '"><i></i>' + esc(s) + '</a>').join('') + '</div>'; }
      if (cur2) (config.nav.scope[cur2] || []).forEach(i => { if (i.section) { h += '<div class="nv-h">' + esc(i.section) + '</div>'; return; } h += navLink(i, cur2, route); });
      h += '<div class="nv-h">Tools</div>' + (config.nav.tools || []).map(i => '<a class="nv ' + (route.view === i.view ? 'on' : '') + '" href="#/' + i.view + '">' + iconOf(i.icon) + '<span>' + esc(i.label) + '</span></a>').join('') + '</nav><div class="side-foot">Demo storage — this browser only.<br>Not secure · not multi-user.</div>';
      return h;
    }
    function topbar() {
      const alerts = config.alerts ? config.alerts(store) : [];
      return '<button class="icon-btn menu" data-act="menu" aria-label="Menu">' + ui.icon('menu') + '</button><div class="gs"><span>' + ui.icon('search') + '</span><input id="gsearch" class="inp" type="search" placeholder="Search everything…" autocomplete="off" aria-label="Search all records"><div id="gs-res" class="gs-res" hidden></div></div><div class="tb-right"><button class="icon-btn bell" data-act="alerts" aria-label="Alerts">' + ui.icon('bell') + (alerts.length ? '<em>' + alerts.length + '</em>' : '') + '</button><button class="user" data-act="goto-settings" title="Change your name in Settings">' + esc(userName) + '</button></div><div id="alerts-pop" class="pop" hidden>' + (alerts.length ? alerts.map(a => '<a href="' + esc(drillHref(a.drill, a.scope)) + '" class="al a-' + (a.tone || '') + '">' + esc(a.text) + '</a>').join('') : '<div class="al">No alerts. Everything is up to date.</div>') + '</div>';
    }
    function render() {
      const route = parseHash(); state.drills = [];
      let out;
      try {
        if (route.view === 'overview') out = overviewView();
        else if (route.view === 'settings') out = settingsView();
        else if (route.view === 'audit') out = auditView(route.q);
        else if (route.view === 'home') out = homeView(route.scope);
        else if (route.view === 'entity') out = entityView(route.scope, route.id, route.q);
        else if (route.view === 'report') out = reportView(route.scope, route.id);
        else if (route.view === 'import') out = importView(route.scope);
        else out = { title: 'Not found', html: '<div class="empty">Page not found.</div>' };
      } catch (e) { out = { title: 'Error', html: '<div class="notice err">This page could not be drawn: ' + esc(e.message) + '</div>' }; if (g.console) g.console.error(e); }
      const scopeColor = colorOf(route.scope);
      shell.style.setProperty('--scope', scopeColor);
      shell.querySelector('.side').innerHTML = sidebar(route); shell.querySelector('.top').innerHTML = topbar();
      const main = shell.querySelector('main'); main.innerHTML = out.html; main.scrollTop = 0; g.scrollTo && g.scrollTo(0, 0);
      shell.classList.remove('menu-open'); document.title = out.title + ' · ' + config.name;
      const sx = shell.querySelector('#list-q'); if (sx && document.activeElement === document.body) { /* keep focus behaviour simple */ }
    }

    /* ======================= forms ======================= */
    async function openForm(entity, o) {
      o = o || {}; const e = config.entities[entity]; const old = o.id ? store.get(entity, o.id) : null;
      const scope = old ? recScope(old) : (o.scope && isScope(o.scope) ? o.scope : (store.isScoped(entity) ? null : null));
      if (store.isScoped(entity) && !scope) { ui.toast('Open a ' + scopeLabel.toLowerCase() + ' first, then add the record there.', 'warn'); return; }
      const lab = entityLabel(entity, scope), prefill = Object.assign({}, o.prefill || {});
      if (config.userFields && config.userFields[entity] && !old && !prefill[config.userFields[entity]]) prefill[config.userFields[entity]] = userName;
      let extra = null, fileInput = null;
      if (e.upload) { extra = document.createElement('div'); extra.className = 'upl'; extra.innerHTML = '<label class="lbl">File ' + (old ? '(leave empty to keep the current file)' : '<span class="req">*</span>') + '</label>' + (old && old.fileName ? '<div class="hint">Current: ' + esc(old.fileName) + ' (' + ui.fmtBytes(old.fileSize) + ')</div>' : '') + '<input type="file" class="inp" accept="' + esc(e.upload.accept || '') + '"><div class="hint">Allowed: ' + esc(e.upload.accept || 'any') + ' · up to ' + ui.fmtBytes(e.upload.maxBytes) + '</div><div class="err" hidden></div>'; fileInput = extra.querySelector('input'); }
      const form = ui.Form(store, entity, scope, old, { prefill, extra });
      let saving = false;
      const m = ui.modal({ title: (old ? 'Edit ' : 'Add ') + lab.label.toLowerCase() + (old ? ' · ' + old.id : ''), wide: true, body: form.el, actions: [{ label: 'Cancel', run: x => x.close() }, { label: old ? 'Save changes' : 'Save', cls: 'primary', id: 'save', run: async (x, btn) => {
        if (saving) return; saving = true; btn.disabled = true;
        try {
          const values = form.read(); let fileRec = null, fileErr = '';
          if (e.upload) {
            const f = fileInput.files[0], fe = extra.querySelector('.err'); fe.hidden = true;
            if (f) { const ok = (e.upload.accept || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean); const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
              if (ok.length && ok.indexOf(ext) < 0) fileErr = 'This file type is not allowed. Use: ' + ok.join(', ') + '.'; else if (f.size > e.upload.maxBytes) fileErr = 'The file is larger than ' + ui.fmtBytes(e.upload.maxBytes) + '.'; else if (!f.size) fileErr = 'The file is empty.';
              else { const dataUrl = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = () => rej(rd.error); rd.readAsDataURL(f); }); const fid = 'F' + U.uid(); await files.put(fid, { name: f.name, type: f.type || 'application/octet-stream', size: f.size, dataUrl }); fileRec = { fileId: fid, fileName: f.name, fileType: f.type || ext, fileSize: f.size }; Object.assign(values, fileRec); } }
            else if (!old) fileErr = 'Choose a file to upload.';
            if (fileErr) { fe.textContent = fileErr; fe.hidden = false; form.setErrors({}); saving = false; btn.disabled = false; return; }
          }
          const res = old ? store.update(entity, old.id, values, { by: userName }) : store.create(entity, values, { scope, by: userName });
          if (!res.ok) { if (fileRec) await files.remove(fileRec.fileId); form.setErrors(res.errors, res.warnings); saving = false; btn.disabled = false; return; }
          if (fileRec && old && old.fileId) await files.remove(old.fileId);
          m.close(); ui.toast((res.notes || []).concat(['Saved ' + res.record.id + '.']), 'success'); if ((res.warnings || []).length) ui.toast(res.warnings, 'warn', 9000);
          render();
        } catch (err) { ui.toast('Could not save: ' + err.message, 'error'); saving = false; btn.disabled = false; }
      } }] });
      const first = form.el.querySelector('.inp:not([disabled])'); if (first) first.focus();
    }
    function showView(entity, id) {
      const r = store.get(entity, id); if (!r) return; const sc = recScope(r), fields = store.fieldsFor(entity, sc).filter(f => !f.hidden), lab = entityLabel(entity, sc);
      const rows = [['ID', r.id]].concat(fields.map(f => [f.label, r[f.key] === '' || r[f.key] == null ? '—' : f.type === 'ref' ? (store.display(f.ref, store.get(f.ref, r[f.key])) || r[f.key]) : f.type === 'number' && f.label.indexOf(cur) >= 0 && cur ? ui.fmtNum(r[f.key]) : r[f.key]]));
      if (sc) rows.splice(1, 0, [scopeLabel, sc]);
      (config.entities[entity].computed ? Object.keys(config.entities[entity].computed) : []).forEach(k => { const c = config.entities[entity].computed[k]; if (!/^_/.test(k) || true) rows.push([c.label, String(c.value(r, store))]); });
      rows.push(['Created', (r.createdAt || '').replace('T', ' ').slice(0, 16)], ['Last updated', (r.updatedAt || '').replace('T', ' ').slice(0, 16)]);
      const used = store.usages(entity, id);
      ui.modal({ title: lab.label + ' · ' + r.id, wide: true, body: '<table class="kv"><tbody>' + rows.map(x => '<tr><th>' + esc(x[0]) + '</th><td>' + esc(x[1]) + '</td></tr>').join('') + '</tbody></table>' + (used.length ? '<p class="note">Linked records: ' + used.map(u => u.count + ' ' + esc((config.entities[u.entity].plural || u.entity).toLowerCase())).join(', ') + '.</p>' : '') + timelineHtml(entity, id), actions: [{ label: 'Close' }, { label: 'Edit', cls: 'primary', run: x => { x.close(); openForm(entity, { id }); } }] });
    }
    function timelineHtml(entity, id) {
      const r = store.get(entity, id), sc = recScope(r), h = store.historyOf(entity, id).slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      const lab = k => { const f = store.fieldsFor(entity, sc).find(x => x.key === k); return f ? f.label : k; };
      let out = '';
      if (h.length) out += '<h3>History</h3><ol class="tl">' + h.map(x => '<li><b>' + esc(lab(x.field)) + '</b>: ' + (x.from ? esc(x.from) + ' → ' : '') + '<b>' + esc(x.to) + '</b><small>' + esc((x.date || x.at.slice(0, 10)) + ' · ' + x.by + (x.note ? ' · ' + x.note : '')) + '</small></li>').join('') + '</ol>';
      const rel = (config.entities[entity].timeline || {}).related || [];
      rel.forEach(rr => { const rows = store.list(rr.entity, { [rr.field]: id }); if (!rows.length) return; out += '<h3>' + esc(config.entities[rr.entity].plural) + ' (' + rows.length + ')</h3><ul class="plain">' + rows.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')).slice(0, 15).map(x => '<li>' + esc(store.display(rr.entity, x)) + (x.nextAction ? ' <small>— next: ' + esc(x.nextAction) + (x.dueDate ? ' by ' + esc(x.dueDate) : '') + '</small>' : '') + '</li>').join('') + '</ul>'; });
      return out || '<p class="note">No history recorded yet.</p>';
    }
    function showTimeline(entity, id) { const r = store.get(entity, id); if (!r) return; ui.modal({ title: 'Timeline · ' + store.display(entity, r), wide: true, body: timelineHtml(entity, id), actions: [{ label: 'Close' }] }); }
    async function doDelete(entity, id) {
      const r = store.get(entity, id); if (!r) return;
      const ok = await ui.confirm({ title: 'Delete ' + entityLabel(entity, recScope(r)).label.toLowerCase() + '?', message: 'Delete ' + store.display(entity, r) + ' (' + id + ')? This cannot be undone. A record that other records depend on cannot be deleted.', okLabel: 'Delete', danger: true }); if (!ok) return;
      const res = store.remove(entity, id, { by: userName });
      if (!res.ok) { ui.toast(Object.values(res.errors).join(' '), 'error'); return; }
      if (config.entities[entity].upload && r.fileId) { try { await files.remove(r.fileId); } catch (e) { /* orphan file is harmless */ } }
      ui.toast('Deleted ' + id + '.', 'success'); render();
    }
    async function download(id) {
      const r = store.get('documents', id) || Object.keys(config.entities).map(k => store.get(k, id)).find(Boolean); if (!r || !r.fileId) return;
      const f = await files.get(r.fileId); if (!f) { ui.toast('The stored file is missing (browser data may have been cleared).', 'error'); return; }
      const a = document.createElement('a'); a.href = f.dataUrl; a.download = f.name || r.fileName || 'document'; document.body.appendChild(a); a.click(); a.remove();
    }

    /* ======================= settings actions ======================= */
    async function backup() {
      const inc = shell.querySelector('#bk-files'), data = store.exportJSON();
      if (!inc || inc.checked) { data.files = {}; const ids = await files.ids(); for (const fid of ids) { const f = await files.get(fid); if (f) data.files[fid] = f; } }
      U.download(JSON.stringify(data, null, 2), config.id + '_backup_' + U.todayISO() + '.json', 'application/json'); ui.toast('Backup downloaded.', 'success');
    }
    async function restoreFile(file) {
      if (!file) return; let obj; try { obj = JSON.parse(await file.text()); } catch (e) { ui.toast('That file is not valid JSON.', 'error'); return; }
      const v = store.validateBackup(obj); if (v.errors.length) { ui.toast(v.errors.slice(0, 4), 'error'); return; }
      const rows = Object.keys(config.entities).map(k => '<tr><td>' + esc(config.entities[k].plural || k) + '</td><td class="r">' + ((obj.data[k] || []).length) + '</td><td class="r">' + store.count(k) + '</td></tr>').join('');
      const ok = await ui.confirm({ title: 'Restore this backup?', message: 'Exported ' + (obj.exportedAt || 'unknown date') + '. All current data will be replaced.', okLabel: 'Replace current data', danger: true }).then(x => x);
      if (!ok) return;
      const r = store.restore(obj); if (!r.ok) { ui.toast(r.errors, 'error'); return; }
      if (obj.files) { try { await files.clear(); for (const k of Object.keys(obj.files)) await files.put(k, obj.files[k]); } catch (e) { ui.toast('Records restored, but some documents could not be restored: ' + e.message, 'warn'); } }
      ui.toast(['Backup restored.'].concat(r.warnings.slice(0, 3)), r.warnings.length ? 'warn' : 'success'); render();
    }
    async function loadDemo() {
      const has = Object.keys(config.entities).some(k => store.count(k));
      if (has && !(await ui.confirm({ title: 'Replace all data?', message: 'This deletes every current record and document and loads the fictional demo data.', okLabel: 'Replace with demo data', danger: true }))) return;
      try { store.reset(); await files.clear(); const r = config.demo.seed(store); ui.toast('Demo data loaded: ' + Object.keys(r).map(k => r[k] + ' ' + k).join(', ') + '.', 'success'); } catch (e) { ui.toast('Demo data failed: ' + e.message, 'error'); }
      render();
    }
    async function clearAll() {
      if (!(await ui.confirm({ title: 'Delete ALL data?', message: 'Every record, history entry, audit entry and uploaded document will be permanently deleted from this browser. Download a backup first if unsure.', typeToConfirm: 'DELETE', okLabel: 'Delete everything', danger: true }))) return;
      store.reset(); await files.clear(); ui.toast('All data deleted.', 'success'); render();
    }

    /* ======================= global search ======================= */
    function globalSearch(text) {
      const n = U.norm(text), box = shell.querySelector('#gs-res'); if (!box) return; if (n.length < 2) { box.hidden = true; return; }
      const out = [];
      Object.keys(config.entities).forEach(k => { if ((config.search && config.search.exclude || []).indexOf(k) >= 0) return; store.list(k).forEach(r => { if (out.length >= 40) return; const hay = U.norm([r.id, store.display(k, r)].concat(Object.keys(r).filter(x => typeof r[x] === 'string' && x !== 'id' && !/At$/.test(x)).map(x => r[x])).join(' ')); if (hay.indexOf(n) >= 0) out.push({ k, r }); }); });
      box.innerHTML = out.length ? out.slice(0, 12).map(x => '<a href="' + esc(hrefOf(recScope(x.r) || scopes[0] || 'all', 'e', x.k, qs({ q: x.r.id }))) + '"><b>' + esc(store.display(x.k, x.r)) + '</b><small>' + esc(entityLabel(x.k, recScope(x.r)).label + ' · ' + x.r.id + (recScope(x.r) ? ' · ' + recScope(x.r) : '')) + '</small></a>').join('') : '<div class="al">No records match.</div>'; box.hidden = false;
    }

    /* ======================= events ======================= */
    const shell = document.createElement('div'); shell.className = 'erp-shell'; shell.innerHTML = '<aside class="side"></aside><div class="col"><header class="top"></header><main id="main" tabindex="-1"></main></div><div class="scrim" data-act="menu"></div>';
    function currentQuery() { return parseHash().q; }
    function setQuery(patch, replace) {
      const r = parseHash(), q = Object.assign({}, r.q, patch); Object.keys(q).forEach(k => { if (q[k] === '' || q[k] == null) delete q[k]; });
      const h = hrefOf(r.scope, r.view === 'entity' ? 'e' : r.view === 'report' ? 'r' : r.view, r.id, qs(q));
      if (replace) g.history.replaceState(null, '', h); else go(h);
    }
    shell.addEventListener('click', ev => {
      const row = ev.target.closest('tr[data-href]'); if (row && !ev.target.closest('a,button')) { go(row.dataset.href); return; }
      const t = ev.target.closest('[data-act]'); const r = parseHash();
      if (!t) { if (!ev.target.closest('.pop,.bell')) { const p = shell.querySelector('#alerts-pop'); if (p) p.hidden = true; } if (!ev.target.closest('.gs')) { const b = shell.querySelector('#gs-res'); if (b) b.hidden = true; } return; }
      const a = t.dataset.act, entity = t.dataset.entity, id = t.dataset.id;
      switch (a) {
        case 'menu': shell.classList.toggle('menu-open'); break;
        case 'alerts': { const p = shell.querySelector('#alerts-pop'); p.hidden = !p.hidden; ev.stopPropagation(); break; }
        case 'goto-settings': go('#/settings'); break;
        case 'add': openForm(entity, { scope: t.dataset.scope || (isScope(r.scope) ? r.scope : null) }); break;
        case 'edit': openForm(entity, { id }); break;
        case 'view': showView(entity, id); break;
        case 'delete': doDelete(entity, id); break;
        case 'download': download(id); break;
        case 'rowaction': { const act = config.entities[entity].actions[Number(t.dataset.i)], rec = store.get(entity, id); if (act && rec) act.run({ rec, store, ui: api.ui, scope: recScope(rec) || r.scope }); break; }
        case 'sort': { const k = t.dataset.key, cs = state.sort[r.id] || { key: 'createdAt', dir: -1 }; state.sort[r.id] = { key: k, dir: cs.key === k ? -cs.dir : 1 }; render(); break; }
        case 'page': { const q = r.q; const cp = Number(q.page || state.page[r.id] || 1) + Number(t.dataset.d); state.page[r.id] = Math.max(1, cp); setQuery({ page: state.page[r.id] > 1 ? state.page[r.id] : '' }, true); render(); break; }
        case 'clear-filters': go(hrefOf(r.scope, 'e', r.id)); break;
        case 'export': { const ent = entity || r.id, sc = isScope(r.scope) ? r.scope : defScope, rows = entity && entity !== r.id ? store.list(ent, store.isScoped(ent) ? { [scopeField]: sc } : null) : listRows(ent, sc, r.q); U.download(ERP.importer.exportRows(store, ent, sc, rows), ent + '_' + (sc || 'all') + '_' + U.todayISO() + '.csv', 'text/csv'); break; }
        case 'export-report': { const rep = config.reports[id], sc = isScope(r.scope) ? r.scope : null; U.download(U.csvStringify([rep.columns.map(c => c.label)].concat(rep.rows(store, sc).map(x => rep.columns.map(c => x[c.key])))), id + '_' + U.todayISO() + '.csv', 'text/csv'); break; }
        case 'import-template': { const sc = isScope(r.scope) ? r.scope : defScope; U.download(ERP.importer.template(store, entity, sc), entity + '_template.csv', 'text/csv'); break; }
        case 'backup': backup(); break;
        case 'save-user': { setUser(shell.querySelector('#user-name').value); ui.toast('Name saved.', 'success'); render(); break; }
        case 'load-demo': loadDemo(); break;
        case 'clear-all': clearAll(); break;
        default: break;
      }
    });
    shell.addEventListener('change', ev => {
      const f = ev.target.closest('[data-filter]'); if (f) { setQuery({ [f.dataset.filter]: f.value, page: '' }); return; }
      const im = ev.target.closest('[data-import]'); if (im) { const r = parseHash(); onImportFile(im.dataset.import, isScope(r.scope) ? r.scope : defScope, im.files[0]); im.value = ''; return; }
      const rs = ev.target.closest('[data-restore]'); if (rs) { restoreFile(rs.files[0]); rs.value = ''; }
    });
    shell.addEventListener('input', U.debounce(ev => {
      if (ev.target.id === 'list-q') { const r = parseHash(); setQuery({ q: ev.target.value.trim(), page: '' }, true); const q = parseHash().q, e = r.id, sc = isScope(r.scope) ? r.scope : null, rows = listRows(e, r.scope, q); const cols = colsFor(e, sc || scopes[0]); const sk = state.sort[e] || { key: 'createdAt', dir: -1 }; let c2 = cols; if (!sc && store.isScoped(e) && cols.indexOf(scopeField) < 0) c2 = [cols[0], scopeField].concat(cols.slice(1)); shell.querySelector('#list-body').innerHTML = listBody(e, sc || r.scope, rows, c2, 1, sk, q); const sub = shell.querySelector('.pg-head .sub'); if (sub) sub.innerHTML = scopeChip(sc || 'all') + ' · ' + rows.length + ' record' + (rows.length === 1 ? '' : 's'); }
      else if (ev.target.id === 'audit-q') { setQuery({ q: ev.target.value.trim() }, true); const pos = ev.target.selectionStart; render(); const el = shell.querySelector('#audit-q'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
      else if (ev.target.id === 'gsearch') globalSearch(ev.target.value);
    }, 160));
    g.addEventListener('hashchange', render);
    shell.addEventListener('keydown', ev => { if (ev.key === 'Escape') { const b = shell.querySelector('#gs-res'); if (b) b.hidden = true; const p = shell.querySelector('#alerts-pop'); if (p) p.hidden = true; } });

    const api = {
      store, files, config, go, render, openForm, showTimeline,
      ui: { openForm, showTimeline, navigate: go, toast: ui.toast, confirm: ui.confirm },
      start() { registerDrills(); mount.innerHTML = ''; mount.appendChild(shell); store.subscribe(() => { /* views redraw after each user action */ }); if (!g.location.hash) g.history.replaceState(null, '', '#/overview'); render(); },
      userName: () => userName,
    };
    return api;
  }

  ERP.App = App;
})(typeof window !== 'undefined' ? window : globalThis);

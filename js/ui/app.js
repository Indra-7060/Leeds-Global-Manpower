/* APP SHELL — bootstrap, router, V6 grouped navigation, header (workspace + demo role), V6 "Reports & Excel" toolbar. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const UI = LGM.UI, C = LGM.Config, S = LGM.Store, P = LGM.Permissions, U = LGM.Util, esc = U.esc;

  const DIVISIONS = [['labour', 'Blue-Collar Recruitment', '♙', 'orders'], ['domestic', 'Domestic Workers', '⌂', 'domestic'], ['corporate', 'Corporate Recruitment', '▤', 'corporate']];
  const LABOUR_PAGES = [['clients', 'Client CRM'], ['visits', 'Visits & Follow-ups'], ['demands', 'Demand Letters'], ['orders', 'Manpower Orders'], ['agencies', 'Overseas Agencies'], ['candidates', 'Candidates & CVs'],
    ['interviews', 'Interviews'], ['visas', 'Visa / QVC / RTP'], ['deployment', 'Deployment'], ['tickets', 'Tickets & Arrival'], ['warranty', 'Warranty']];
  const MANAGEMENT = [['visa-master', '▦', 'Master Recruitment Report'], ['reports', '▦', 'Reports & Alerts'], ['import-center', '⇧', 'Excel Import Center'], ['cv-inbox', '✉', 'CV Intake Center'],
    ['ai-reports', '✦', 'AI Reports & Exports'], ['vault', '⚿', 'Credentials Register'], ['finance', '◈', 'Private Finance'], ['settings', '⚙', 'Settings & Data']];
  const NO_TOOLBAR = ['dashboard', 'import-center', 'cv-inbox', 'vault', 'finance', 'settings', 'corporate']; // V6 shows the toolbar everywhere else (corporate has no data to report on)
  const st = UI.state; st.activeDivision = 'labour';

  function divisionOf(page) { if (page === 'domestic') return 'domestic'; if (page === 'corporate') return 'corporate'; return LABOUR_PAGES.some(p => p[0] === page) ? 'labour' : null; }

  function nav() {
    const role = st.role, page = st.page;
    let h = `<button class="${page === 'dashboard' ? 'active' : ''}" data-act="go" data-arg="dashboard" type="button">◫ &nbsp; Dashboard</button>
      <button class="v6-group" data-act="toggleRecruit" type="button" aria-expanded="${st.recruitOpen}">♧ &nbsp; Recruitment <span>${st.recruitOpen ? '▾' : '▸'}</span></button>`;
    if (st.recruitOpen) {
      h += DIVISIONS.map(([d, n, ic, p]) => `<button class="v6-sub ${st.activeDivision === d ? 'active' : ''}" data-act="chooseDivision" data-arg="${d}" type="button">${ic} &nbsp; ${n}</button>`).join('');
      if (st.activeDivision === 'labour') h += `<div class="v6-section">Blue-Collar Modules</div>` + LABOUR_PAGES.map(([p, n]) => `<button class="v6-sub ${page === p ? 'active' : ''}" data-act="go" data-arg="${p}" type="button">· ${n}</button>`).join('');
    }
    h += `<div class="v6-section">Management</div>` + MANAGEMENT.filter(x => x[0] !== 'finance' || P.can(role, 'finance.view')).map(([p, ic, n]) => `<button class="${page === p ? 'active' : ''}" data-act="go" data-arg="${p}" type="button">${ic} &nbsp; ${n}</button>`).join('');
    return h;
  }

  function tools() {
    if (NO_TOOLBAR.includes(st.page)) return '';
    const s = S.state(), f = st.filters, R = LGM.Reports;
    const clients = U.uniqSorted([...s.clients.map(c => c.name), ...s.orders.map(o => o.client), ...s.candidates.map(c => c.client)]);
    const countries = U.uniqSorted([...s.candidates.map(c => c.country), ...s.orders.map(o => o.country)]);
    const sel = (k, label, vals) => `<select data-change="tbFilter" data-k="${k}" aria-label="${label}"><option value="All">All ${label}</option>${vals.map(x => `<option ${f[k] === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    const quick = R.quick(st.page);
    return `<section class="v6-tools"><div class="row between"><div><strong>📊 Reports & Excel</strong><div class="muted">Generate a report directly from this section</div></div>
      <div class="row"><button class="secondary" data-act="tbImport" type="button">⇧ Import Excel</button><button data-act="tbExport" type="button">⇩ Export Report (CSV)</button></div></div>
      <div class="v6-filter">${sel('client', 'Clients', clients)}${sel('country', 'Countries', countries)}<select data-change="tbFilter" data-k="stage" aria-label="Stage">${['All', ...C.stageFilters].map(x => `<option ${f.stage === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="v6-reportlinks">${quick.map(x => `<button data-act="exportReport" data-arg="${esc(x)}" type="button">${esc(x)} ↓</button>`).join('')}</div>
      <small>Reports are calculated from the records in this ${S.mode().toUpperCase()} workspace and download as CSV (opens in Excel). Native XLSX, PDF and server-side permissions need the production build.</small></section>`;
  }

  const App = {
    go(page) {
      if (page === 'finance' && !P.can(st.role, 'finance.view')) { UI.toast('Finance is restricted to the Managing Director and Admin Manager.', 'err'); page = 'dashboard'; }
      if (!LGM.Pages[page]) page = 'dashboard';
      st.page = page; const d = divisionOf(page); if (d) st.activeDivision = d;
      UI.modal.close(); App.render(); window.scrollTo(0, 0);
    },
    render() {
      const mode = S.mode(), role = st.role;
      if (st.page === 'finance' && !P.can(role, 'finance.view')) st.page = 'dashboard';
      const pill = document.getElementById('modePill'); pill.textContent = mode === 'demo' ? 'DEMO DATA' : 'LIVE DATA'; pill.className = 'mode-pill ' + (mode === 'demo' ? 'mode-demo' : 'mode-live');
      document.getElementById('role').value = role;
      document.getElementById('banner').innerHTML = (!S.isSaved() ? `<div class="banner live">⚠ Browser storage is full or disabled — changes are NOT being saved. Download a backup now (Settings & Data).</div>` : '') +
        (mode === 'demo' ? '<div class="banner demo">DEMO WORKSPACE — fictional sample data only. Not business data. Prototype: no login security or server.</div>' : '<div class="banner live">LIVE WORKSPACE — working records stored in this browser only (not encrypted, not shared, not backed up). Download backups regularly.</div>');
      document.getElementById('nav').innerHTML = nav();
      document.getElementById('foot').innerHTML = `V6 developed build<br>${mode === 'demo' ? 'Sample data' : 'Working records'} · Browser only<br>Not production secure`;
      let html;
      try { html = tools() + LGM.Pages[st.page].render(); }
      catch (e) { if (g.console) console.error(e); html = UI.panel('This page could not be displayed', `<p class="muted">An unexpected error occurred: ${esc(e.message)}</p>${UI.btn('Back to dashboard', 'go', 'dashboard')}`); }
      document.getElementById('view').innerHTML = html;
    },
  };
  LGM.App = App;

  UI.on('go', p => App.go(p));
  UI.on('goSettings', () => App.go('settings'));
  UI.on('toggleRecruit', () => { st.recruitOpen = !st.recruitOpen; App.render(); });
  UI.on('chooseDivision', d => { st.activeDivision = d; st.division = d; st.recruitOpen = true; App.go(DIVISIONS.find(x => x[0] === d)[3]); });
  UI.on('tbFilter', (v, el) => { st.filters[el.dataset.k] = v; });
  UI.on('tbImport', () => { App.go('import-center'); if (st.imp && st.imp.target !== 'candidates') UI.actions.impTarget('candidates'); });
  UI.on('tbExport', () => LGM.PageHelpers.exportReport(LGM.Reports.quick(st.page)[0], st.filters));

  function init() {
    S.init();
    const saved = S.getPref('role', 'md'); st.role = C.roles.some(r => r.id === saved) ? saved : 'md';
    const sel = document.getElementById('role'); sel.innerHTML = C.roles.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('');
    sel.addEventListener('change', () => { st.role = sel.value; S.setPref('role', st.role); App.render(); });
    UI.wire(); S.onChange(() => App.render()); App.render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

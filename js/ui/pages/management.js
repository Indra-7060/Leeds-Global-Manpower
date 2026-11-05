/* PAGES — Master Recruitment Report, Reports & Alerts (reminders + audit), AI Reports & Exports (keyword reports). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {}; LGM.PageHelpers = LGM.PageHelpers || {};
  const UI = LGM.UI, C = LGM.Config, M = LGM.Metrics, S = LGM.Store, U = LGM.Util, R = LGM.Reports, esc = U.esc;

  /** Run a report and download it. Shared by the toolbar, Reports & Alerts, AI Reports and Master report. */
  function exportReport(name, filters = {}) {
    const res = R.run(name, S.state(), Object.assign({ today: U.todayISO() }, filters), UI.state.role);
    if (res.error) return UI.toast(res.error, 'err');
    if (!res.rows.length) return UI.toast('No matching records for "' + name + '". Change the filters, add records or import data.', 'err');
    LGM.Exporter.exportRows(name, res.columns, res.rows); UI.toast(`Exported ${res.rows.length} row(s) — ${LGM.Exporter.last().name}`, 'ok');
  }
  LGM.PageHelpers.exportReport = exportReport;
  UI.on('exportReport', name => exportReport(name, UI.state.filters));

  // ---------------- Master Recruitment Report ----------------
  function masterResults() {
    const vm = UI.state.vm, m = M.masterReport(S.state(), { country: vm.country, query: vm.q }), t = m.total;
    const rem = r => (r.remaining < 0 ? UI.raw(`<span class="pill red" title="More candidates than ordered quantity">${r.remaining}</span>`) : r.remaining);
    const row = r => [r.company, r.country, r.demand, r.applied, r.qvc, r.rtp, r.printed, r.deployed, rem(r)];
    return UI.cards([UI.metric('Total Demand', t.demand, 'Selected clients'), UI.metric('Visa Applied', t.applied, 'Current stage'), UI.metric('QVC', t.qvc, 'Current stage'), UI.metric('RTP', t.rtp, 'Current stage'),
      UI.metric('Visa Printed', t.printed, 'Current stage'), UI.metric('Deployed', t.deployed, 'Arrived / joined / warranty')], 'grid-template-columns:repeat(3,minmax(0,1fr))') +
      UI.panel('Company-wise Consolidated Status', UI.table(['Company', 'Country', 'Order', 'Applied', 'QVC', 'RTP', 'Printed', 'Deployed', 'Remaining'],
        m.rows.map(row).concat(m.rows.length ? [[UI.raw('<b>TOTAL</b>'), '', UI.raw(`<b>${t.demand}</b>`), UI.raw(`<b>${t.applied}</b>`), UI.raw(`<b>${t.qvc}</b>`), UI.raw(`<b>${t.rtp}</b>`), UI.raw(`<b>${t.printed}</b>`), UI.raw(`<b>${t.deployed}</b>`), UI.raw(`<b>${t.remaining}</b>`)]] : []),
        { empty: 'No orders or candidates match. Add orders/candidates or import them.' }));
  }
  LGM.Pages['visa-master'] = {
    render() {
      const vm = UI.state.vm, s = S.state(); const countries = U.uniqSorted([...s.orders.map(o => o.country), ...s.candidates.map(c => c.country)]);
      return UI.heading('Master Recruitment Report', 'All clients visa summary — company-wise status in one page, calculated from orders and candidate records') +
        `<div class="panel"><div class="row"><div><label for="vmCountry">Country</label><select id="vmCountry" class="input" style="width:auto" data-change="vmCountry"><option>All</option>${countries.map(c => `<option ${vm.country === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div><label for="vmQuery">Client</label><input id="vmQuery" class="input" style="width:240px" type="search" placeholder="Search company" value="${esc(vm.q)}" data-input="vmQuery"></div>
        <div style="align-self:flex-end">${UI.btn('Export CSV for Excel', 'exportMaster', '', 'secondary')}</div></div></div>` +
        `<div id="vm-results">${masterResults()}</div>` +
        UI.notice('Calculated from live records. Demand = sum of order quantities for the client and country; each candidate is counted once, in their current stage; Remaining = Demand − (Applied + QVC + RTP + Printed + Deployed). Candidates earlier than Visa Applied therefore still count as Remaining. Click-through to candidate lists is available from the Candidates page filters.');
    },
  };
  UI.on('vmCountry', v => { UI.state.vm.country = v; LGM.App.render(); });
  UI.on('vmQuery', v => { UI.state.vm.q = v; document.getElementById('vm-results').innerHTML = masterResults(); });  // partial update: keeps focus (V6 defect D-12)
  UI.on('exportMaster', () => exportReport('Master Recruitment Report', { country: UI.state.vm.country, client: UI.state.vm.q || 'All' }));

  // ---------------- Reports & Alerts ----------------
  const PLANNED = [['Country-wise Recruitment', 'Orders, CVs, selection and deployment'], ['Agent Performance', 'CVs, selection ratio, arrivals (CV quality not defined — OQ-21)'],
    ['Warranty Expiry', 'Upcoming expiries and open complaints'], ['Demand & Sales Visits', 'Follow-up, conversion and open demand']];
  LGM.Pages.reports = {
    render() {
      const s = S.state(), alerts = LGM.Alerts.compute(s);
      const reportRows = [['All Clients Visa Summary', 'One-page company-wise visa position', UI.raw(UI.btn('Open', 'go', 'visa-master', 'secondary small') + ' ' + UI.btn('Export', 'exportMaster', '', 'ghost small'))],
        ...PLANNED.map(([n, p]) => [n, p, UI.raw(UI.btn('Preview', 'runReport', n, 'secondary small') + ' ' + UI.btn('Export', 'exportReportNamed', n, 'ghost small'))])];
      const rem = alerts.map(a => [UI.badge('Pending'), a.action, a.assigned, a.count, UI.raw(a.items.slice(0, 3).map(x => `<span class="tag">${esc(x)}</span>`).join('') + (a.count > 3 ? `<span class="muted">+${a.count - 3} more</span>` : '')), UI.btn('Open', 'go', a.link.page, 'secondary small')]);
      const audit = s.activity.slice(0, 100).map(a => [String(a.at).slice(0, 16).replace('T', ' '), LGM.Permissions.roleLabel(a.by) || '—', a.client || '—', a.text]);
      return UI.heading('Reports, Reminders & Audit', 'Management-wide reports and pending operational actions') +
        UI.panel('Management Reports', UI.table(['Report', 'Purpose', 'Open'], reportRows)) +
        UI.panel('Reminders', UI.table(['Priority', 'Action', 'Assigned To', 'Count', 'Items', ''], rem, { empty: 'No pending reminders. Everything is up to date.' }) +
          UI.muted('Reminders are calculated from live records each time this page opens. They are in-app only: e-mail / WhatsApp / scheduled delivery needs a backend (OQ-17).')) +
        UI.panel('Audit Log (latest 100 changes)', UI.table(['When', 'Role', 'Client', 'Activity'], audit, { empty: 'No activity recorded yet.' }), UI.btn('Export audit log', 'exportAudit', '', 'secondary small')) +
        UI.notice('Financial reports remain private (Managing Director and Admin Manager). The audit log is held in this browser and can be cleared by clearing site data — a tamper-proof server-side audit trail is a production requirement.');
    },
  };
  UI.on('runReport', name => { const r = R.run(name, S.state(), { today: U.todayISO() }, UI.state.role); if (r.error) UI.toast(r.error, 'err'); else UI.previewReport(r); });
  UI.on('exportReportNamed', name => exportReport(name));
  UI.on('exportAudit', () => {
    const rows = S.state().activity.map(a => ({ at: a.at, role: a.by, client: a.client, entity: a.entity, id: a.id, text: a.text }));
    if (LGM.Exporter.exportRows('Audit_Log', ['at', 'role', 'client', 'entity', 'id', 'text'], rows)) UI.toast('Audit log exported', 'ok'); else UI.toast('Audit log is empty', 'err');
  });

  // ---------------- AI Reports & Exports (keyword filter — not AI) ----------------
  LGM.Pages['ai-reports'] = {
    render() {
      const s = S.state(), staff = UI.state.role === 'staff', imp = e => s[e].filter(x => x._src).length;
      const presets = ['QVC pending', 'Flight pending', 'Visa printed', 'All candidates', 'All manpower orders', ...(staff ? [] : ['All finance transactions'])];
      return UI.heading('AI Reports & Excel Exports', 'Ask for pending QVC, flights, client status, agency accounts and more') +
        UI.notice('This is a keyword-based report filter, NOT a connected AI model. It reads the records in this workspace and tells you how it understood your request. CSV opens in Excel; native .xlsx and natural-language reporting need the production system.') +
        UI.panel('Ask for a report', `<label for="aiQuery">Report request</label><input class="input" id="aiQuery" placeholder="e.g. Show QVC pending for ${esc((s.clients[0] || {}).name || 'a client')} Nepal"><p><button class="btn" data-act="aiRun" type="button">Generate report</button></p>
          <div class="row" style="gap:8px">${presets.map(x => UI.btn(x, 'aiPreset', x, 'secondary')).join('')}</div>`) +
        UI.panel('One-click Exports', `<div class="row" style="gap:10px">${[['All Clients Visa Summary', 'Master Recruitment Report'], ['QVC Pending', 'QVC Pending'], ['Flight Pending', 'Flight Pending'], ['Manpower Orders', 'All Orders'], ['CV Intake', 'CV Intake'], ...(staff ? [] : [['Private Finance', 'Private Finance']])]
          .map(([l, n]) => UI.btn(l, 'exportReportNamed', n, 'secondary')).join('')}</div>`) +
        UI.panel('Record Counts', UI.cards([UI.metric('Candidates', s.candidates.length, `${imp('candidates')} imported from files`), UI.metric('Orders', s.orders.length, `${imp('orders')} imported from files`),
          ...(staff ? [] : [UI.metric('Finance entries', s.finance.length, `${imp('finance')} imported from files`)]), UI.metric('CV intake files', s.cvInbox.length, 'Metadata only')]));
    },
  };
  const runAi = q => { const r = R.keyword(q, S.state(), UI.state.role); if (r.error) UI.toast(r.error, 'err'); else UI.previewReport(r); };
  UI.on('aiRun', () => runAi(document.getElementById('aiQuery').value));
  UI.on('aiPreset', q => { document.getElementById('aiQuery').value = q; runAi(q); });
})(typeof window !== 'undefined' ? window : globalThis);

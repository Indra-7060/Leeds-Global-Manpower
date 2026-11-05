/* PAGES — Private Finance (cashbook, costing) and Credentials Register. Role restriction is a DEMO control only (V6: staff cannot see Finance). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {};
  const UI = LGM.UI, Crud = LGM.Crud, C = LGM.Config, M = LGM.Metrics, S = LGM.Store, U = LGM.Util, P = LGM.Permissions, esc = U.esc;
  const divName = d => (d === 'all' ? 'All Divisions' : d === 'labour' ? 'Blue-Collar' : 'Domestic Workers');

  LGM.Pages.finance = {
    render() {
      const fd = UI.state.financeDivision, t = M.financeTotals(S.state(), fd), role = UI.state.role;
      const defDiv = fd === 'all' ? 'labour' : fd;
      const cd = M.costingDefaults('Nepal'), cost = M.costing({ qty: 100, revenue: cd.revenue, client: cd.client, investment: cd.investment, investmentTreatment: 'extra' });
      let h = UI.heading('Private Accounts & Finance', 'Two separate divisions • daily receipts and payments • client costing • partner settlements') +
        UI.notice(S.mode() === 'demo' ? 'DEMO FINANCE ONLY. Role switching is not security. Never enter real financial or personal data. Data entered here is stored only in this browser.' : 'LIVE finance data is held in this browser only: no encryption, no server-side permissions, no immutable ledger. Treat as a working scratchpad until the production system is available.', S.mode() === 'live' ? 'live' : '') +
        UI.tabs([['labour', 'Blue-Collar · Cash'], ['domestic', 'Domestic Workers · QIIB'], ['all', 'Consolidated']], fd, 'finDivision') +
        UI.cards([UI.metric('Money Received', U.money(t.incoming), 'Selected division'), UI.metric('Money Paid', U.money(t.outgoing), 'Selected division'), UI.metric('Net Cash Movement', U.money(t.net), 'Not accounting profit'), UI.metric('Transactions', t.count, 'Cashbook entries')]);
      h += UI.panel('Record Daily Incoming / Outgoing', `<form id="fin-form" novalidate><div class="formerr notice" style="display:none;background:#feeaea;color:#8f2a2a;border-color:#f0c4c4;margin:0 0 14px"></div>${Crud.fieldsGrid('finance', { date: U.todayISO(), division: defDiv, direction: 'Incoming', account: C.financeDefaultAccount[defDiv], category: 'Agency payment' }, { scope: 'inl' })}</form>
        <p>${UI.btn(S.mode() === 'demo' ? 'Save Sample Transaction' : 'Save Transaction', 'finSave')} ${UI.btn('Export CSV', 'finExport', '', 'secondary')} ${UI.btn(S.mode() === 'demo' ? 'Reset Demo Entries…' : 'Clear all entries…', 'finClear', '', 'danger')}</p>`);
      h += Crud.table({
        id: 'finance', entity: 'finance', title: 'Daily Cashbook — ' + divName(fd), canAdd: false, search: ['date', 'party', 'client', 'country', 'category', 'ref', 'order'],
        rows: () => S.list('finance').filter(x => fd === 'all' || x.division === fd), sort: (a, b) => b.date.localeCompare(a.date),
        filters: [{ key: 'category', label: 'Categories' }, { key: 'account', label: 'Accounts' }, { key: 'direction', label: 'Directions' }],
        columns: [{ label: 'Date', get: r => r.date }, { label: 'Agency / Customer', get: r => r.party }, { label: 'Client / Country', get: r => [r.client, r.country].filter(Boolean).join(' / ') }, { label: 'Category', get: r => r.category },
          { label: 'Account', get: r => r.account }, { label: 'Incoming', get: r => (r.direction === 'Incoming' ? U.money(r.amount) : '—') }, { label: 'Outgoing', get: r => (r.direction === 'Outgoing' ? U.money(r.amount) : '—') }],
        emptyText: 'No transactions yet. Record one above or import a finance sheet.',
      });
      h += UI.panel('Client & Country Costing — ' + (S.mode() === 'demo' ? 'Sample' : 'Projection'), `<p class="muted">Change assumptions to estimate projected costs. These figures are projections, not actual transactions.</p>
        <div class="formgrid"><div><label for="costCountry">Country</label><select id="costCountry" class="input" data-change="costCountry"><option>Nepal</option><option>Bangladesh</option></select></div>
        <div><label for="costQty">Candidate quantity</label><input class="input" type="number" id="costQty" value="100" min="0" data-input="calcCost"></div>
        <div><label for="costRevenue">Agency revenue per candidate (QAR)</label><input class="input" type="number" id="costRevenue" value="${cd.revenue}" min="0" data-input="calcCost"></div>
        <div><label for="costClient">Client QVC / visa charges per candidate (QAR)</label><input class="input" type="number" id="costClient" value="${cd.client}" min="0" data-input="calcCost"></div>
        <div><label for="costInvestment">Visa investment per candidate (QAR)</label><input class="input" type="number" id="costInvestment" value="${cd.investment}" min="0" data-input="calcCost"></div>
        <div><label for="costIncluded">Investment treatment</label><select class="input" id="costIncluded" data-change="calcCost"><option value="extra">Additional expense</option><option value="included">Already included in client charges</option></select></div>
        <div><label for="costPartner">Partner payment per candidate (QAR)</label><input class="input" type="number" id="costPartner" value="0" min="0" data-input="calcCost"></div>
        <div><label for="costOther">Other expenses per candidate (QAR)</label><input class="input" type="number" id="costOther" value="0" min="0" data-input="calcCost"></div></div>
        ${UI.cards([UI.metric('Projected Revenue', UI.raw(`<span id="costRevenueResult">${esc(U.money(cost.revenue))}</span>`), 'Not yet earned'), UI.metric('Projected Cost', UI.raw(`<span id="costExpenseResult">${esc(U.money(cost.cost))}</span>`), 'Avoids double-counting'),
          UI.metric('Projected Profit', UI.raw(`<span id="costProfitResult">${esc(U.money(cost.profit))}</span>`), 'Before other unentered costs')], 'grid-template-columns:repeat(3,minmax(0,1fr))')}`);
      h += UI.panel('Accounting Rules & Approvals', `<p><b>Blue-Collar:</b> default Cash. <b>Domestic Workers:</b> default QIIB. Both can have exceptions; record transfers separately from income.</p>
        <p>Overseas agency advances remain unallocated liabilities. Nepal candidate charges of QAR 1,500 arise only on <b>verified Qatar arrival</b>. Every manual advance allocation needs Managing Director approval. Partner liabilities and visa investments must be tracked separately.</p>
        <p>For a production system: server-side MD/Nitija-only permissions, secure receipt uploads, immutable posted ledger, reversal approvals, bank reconciliation, audit log, and automatic candidate-level profitability.</p>
        ${UI.muted('These accounting rules are stated in V6 as text only. This version records and totals transactions; it does not automate the arrival-triggered charge, the approval workflow or reversals (open question OQ-9).')}`);
      return h;
    },
  };
  UI.on('finDivision', d => { UI.state.financeDivision = d; LGM.App.render(); });
  UI.on('finSave', () => {
    if (!P.can(UI.state.role, 'finance.view')) return;
    const res = Crud.inlineSubmit('finance', document.getElementById('fin-form')); if (!res.ok) return UI.toast('Please correct the highlighted fields.', 'err');
    UI.state.financeDivision = res.record.division; UI.toast('Transaction saved', 'ok'); LGM.App.render();
  });
  UI.on('finExport', () => {
    if (!P.can(UI.state.role, 'finance.export')) return UI.toast('Restricted finance report', 'err');
    const fd = UI.state.financeDivision, res = LGM.Reports.run('Private Finance', S.state(), {}, UI.state.role), rows = res.rows.filter(t => fd === 'all' || t.division === fd);
    if (!rows.length) return UI.toast('No transactions to export in this view.', 'err'); LGM.Exporter.exportRows('Finance_' + fd, res.columns, rows); UI.toast('Finance CSV exported', 'ok');
  });
  UI.on('finClear', async () => {
    if (!(await UI.confirm({ title: 'Clear ALL finance entries?', message: `Delete all ${S.list('finance').length} finance entries (every division) in the ${S.mode().toUpperCase()} workspace? Export a CSV first if you need them.`, ok: 'Delete all', danger: true }))) return;
    S.list('finance').slice().forEach(f => S.remove('finance', f.id, { silent: true, defer: true })); S.log('All finance entries cleared', '', 'finance', '', { by: UI.state.role }); S.flush(); UI.toast('Finance entries cleared', 'ok');
  });
  const val = id => Number(document.getElementById(id).value);
  const calcCost = () => {
    const r = M.costing({ qty: val('costQty'), revenue: val('costRevenue'), client: val('costClient'), investment: val('costInvestment'), investmentTreatment: document.getElementById('costIncluded').value, partner: val('costPartner'), other: val('costOther') });
    document.getElementById('costRevenueResult').textContent = U.money(r.revenue); document.getElementById('costExpenseResult').textContent = U.money(r.cost); document.getElementById('costProfitResult').textContent = U.money(r.profit);
  };
  UI.on('calcCost', calcCost);
  UI.on('costCountry', v => { const d = M.costingDefaults(v); document.getElementById('costClient').value = d.client; document.getElementById('costRevenue').value = d.revenue; document.getElementById('costInvestment').value = d.investment; calcCost(); });

  // ---------------- Credentials Register ----------------
  LGM.Pages.vault = {
    render() {
      return UI.heading('Client Credentials Register', 'Restricted reference for government portal accounts and application tracking') +
        Crud.table({
          id: 'credentials', entity: 'credentials', title: 'Register Records', addLabel: '+ Add Record', search: ['client', 'portal', 'record'],
          columns: [{ label: 'Client', get: r => r.client }, { label: 'Portal', get: r => r.portal }, { label: 'Record', get: r => r.record }, { label: 'Access', get: r => UI.badge(r.access) }],
          emptyText: 'No records. This register holds descriptions only — never passwords.',
        }) +
        UI.notice('SECURITY: This register stores descriptions only. The form refuses text that looks like a password, OTP or PIN. Do not put real passwords, OTPs, government login credentials or client documents in this prototype. Production requires encrypted secrets in a vault product, role-based access, MFA and audit logging. Never expose passwords in reports or exports.');
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* PAGES — Client CRM, Sales Visits & Follow-ups, Demand Letters. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {};
  const UI = LGM.UI, Crud = LGM.Crud, M = LGM.Metrics, S = LGM.Store, U = LGM.Util, esc = U.esc;
  const sameClient = (a, b) => U.norm(a) === U.norm(b);

  LGM.Pages.clients = {
    render() {
      const s = S.state(), m = M.crm(s);
      return UI.heading('Client CRM', 'Market visits → company introduction → enquiry → client order', UI.btn('+ Record Visit', 'newVisit')) +
        UI.cards([UI.metric('Clients', m.clients, 'Registered'), UI.metric('Visits', m.visits, 'Recorded'), UI.metric('Follow-ups', m.followUps, 'Pending'), UI.metric('Orders Won', m.ordersWon, 'Open')]) +
        Crud.table({
          id: 'clients', entity: 'clients', title: 'Client Register', addLabel: '+ Add Client', search: ['name', 'sector', 'next_action'], filters: [{ key: 'stage', label: 'Stages' }, { key: 'sector', label: 'Sectors' }],
          columns: [{ label: 'Client', get: r => r.name }, { label: 'Sector', get: r => r.sector }, { label: 'Stage', get: r => UI.badge(r.stage) }, { label: 'Next Action', get: r => r.next_action },
            { label: 'Orders', get: r => s.orders.filter(o => sameClient(o.client, r.name)).length }],
          rowActions: r => UI.btn('+ Order', 'clientOrder', r.id, 'secondary small'), emptyText: 'No clients yet. Add your first client or import orders.',
        }) + UI.muted('Next production step (per V6): salesperson targets and conversion tracking from visit → demand → order.');
    },
  };
  UI.on('newVisit', () => Crud.formModal({ entity: 'visits', defaults: { date: U.todayISO() } }));
  UI.on('clientOrder', id => { const c = S.get('clients', id); if (c) Crud.formModal({ entity: 'orders', defaults: { client: c.name }, title: 'New order for ' + c.name }); });

  LGM.Pages.visits = {
    render() {
      return UI.heading('Sales Visits & Follow-ups', 'Track field marketing from first company visit to confirmed manpower order') +
        Crud.table({
          id: 'visits', entity: 'visits', title: 'Client Visit Register', addLabel: '+ Record Visit', search: ['client', 'contact', 'next_action', 'salesperson'],
          filters: [{ key: 'outcome', label: 'Outcomes' }, { key: 'client', label: 'Clients' }], sort: (a, b) => (b.date || '').localeCompare(a.date || ''), form: { defaults: { date: U.todayISO() } },
          columns: [{ label: 'Client', get: r => r.client }, { label: 'Contact', get: r => r.contact }, { label: 'Visit / Follow-up', get: r => r.date }, { label: 'Outcome', get: r => UI.badge(r.outcome) },
            { label: 'Pipeline stage', get: r => r.pipeline_stage }, { label: 'Next Action', get: r => r.next_action }],
          rowActions: r => (r.outcome === 'Order Received' ? UI.btn('Create order →', 'visitOrder', r.id, 'secondary small') : ''),
        }) + UI.panel('Sales Pipeline', UI.flow(LGM.Config.salesPipeline));
    },
  };
  UI.on('visitOrder', id => { const v = S.get('visits', id); if (v) Crud.formModal({ entity: 'orders', defaults: { client: v.client }, title: 'New order for ' + v.client }); });

  LGM.Pages.demands = {
    render() {
      return UI.heading('Demand Letters & Documents', 'Keep client demand, trade-wise quantities, approvals and revisions in one place') +
        Crud.table({
          id: 'demands', entity: 'demands', title: 'Demand Letter Register', addLabel: '+ Add Demand Letter', search: ['id', 'client', 'countries', 'trades', 'order_id'],
          filters: [{ key: 'status', label: 'Statuses' }, { key: 'client', label: 'Clients' }],
          columns: [{ label: 'Reference', get: r => r.id }, { label: 'Client', get: r => r.client }, { label: 'Order', get: r => r.order_id }, { label: 'Countries', get: r => r.countries },
            { label: 'Trades', get: r => r.trades }, { label: 'Signed', get: r => r.signed }, { label: 'Status', get: r => UI.badge(r.status) }],
        }) + UI.panel('Required Fields', UI.flow(['Client & Order', 'Letter Date', 'Trades & Quantities', 'Nationality', 'Salary & Benefits', 'Signed Letter', 'Agency Allocation'])) +
        UI.notice('Not yet available (needs a backend, see docs/06): version history, scanned originals of the signed letter, document approvals, and links to visa applications. This version records the letter details and links to the order.');
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

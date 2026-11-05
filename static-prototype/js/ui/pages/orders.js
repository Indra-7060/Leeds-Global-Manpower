/* PAGES — Manpower Orders, Overseas Agencies. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {};
  const UI = LGM.UI, Crud = LGM.Crud, M = LGM.Metrics, S = LGM.Store;

  LGM.Pages.orders = {
    render() {
      const prog = Object.fromEntries(M.orderProgress(S.state()).map(p => [p.id, p]));
      return UI.heading('Manpower Orders', 'Client orders allocated to overseas agencies by country and trade') +
        Crud.table({
          id: 'orders', entity: 'orders', title: 'Active Demand Orders', addLabel: S.mode() === 'demo' ? '+ Sample New Order' : '+ New Order', // V6 wording in the demo workspace, search: ['id', 'client', 'country', 'trade', 'status'],
          filters: [{ key: 'client', label: 'Clients' }, { key: 'country', label: 'Countries' }, { key: 'status', label: 'Stages' }],
          columns: [{ label: 'Order', get: r => r.id }, { label: 'Client', get: r => r.client }, { label: 'Country', get: r => r.country }, { label: 'Trade', get: r => r.trade }, { label: 'Qty', get: r => r.qty },
            { label: 'Stage', get: r => UI.badge(r.status) }, { label: 'CVs linked', get: r => (prog[r.id] || {}).cvs || 0 }, { label: 'Deployed', get: r => (prog[r.id] || {}).deployed || 0 }],
          emptyText: 'No orders yet. Add an order or import them from Excel.',
        }) + UI.panel('Order to Deployment Workflow', UI.flow(['Client Order', 'Country Allocation', 'Agency Sourcing', 'CV Review', 'Interviews', 'Selection', 'Offer', 'Visa', 'Deployment'])) +
        UI.muted('“CVs linked” counts candidates whose Order field points at the order. Order stage is set manually (V6 has no rule that derives it from candidates — see open question OQ-3).');
    },
  };

  LGM.Pages.agencies = {
    render() {
      return UI.heading('Overseas Agents', 'Allocate manpower demand and track each agent’s recruitment progress') +
        Crud.table({
          id: 'allocations', entity: 'allocations', title: 'Agency Allocation', addLabel: '+ Allocate to Agency', search: ['agency', 'country', 'order_id'],
          filters: [{ key: 'agency', label: 'Agencies' }, { key: 'status', label: 'Statuses' }],
          columns: [{ label: 'Agency', get: r => r.agency }, { label: 'Country', get: r => r.country }, { label: 'Order', get: r => r.order_id }, { label: 'Allocated', get: r => r.allocated },
            { label: 'CVs Received', get: r => M.allocationStats(S.state(), r).cvs }, { label: 'Status', get: r => UI.badge(r.status) }],
        }) + UI.panel('Agency Tasks', UI.flow(['Receive Demand', 'Submit CVs', 'Schedule Interviews', 'Send Selected List', 'Upload Passports', 'Pre-Medical', 'Visa & Ticket Follow-up']) +
          UI.muted('“CVs Received” counts candidates with the same agency and order. Separate secure agent portals (each agent sees only their own orders) require a backend — see docs/06.'));
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

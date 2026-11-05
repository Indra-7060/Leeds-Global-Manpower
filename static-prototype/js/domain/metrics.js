/* BUSINESS LOGIC — every counter shown on a dashboard/card/report is computed here from records.
   Pure functions of `state` (no DOM, no storage) so they can be unit-tested. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util, Lc = LGM.Lifecycle;
  const n = U.norm;

  const inStages = (s, stages) => s.candidates.filter(c => stages.includes(c.status));
  const inSet = (s, name) => s.candidates.filter(c => Lc.inSet(c.status, name));
  const ticketOf = (s, id) => s.tickets.find(t => t.candidate_id === id) || null;
  const stepRank = step => Math.max(0, C.ticketSteps.indexOf(step));
  const isOpenOrder = o => !C.orderClosed.includes(o.status);

  /** Labour dashboard: cards + mutually-exclusive pipeline bars. */
  function labour(s) {
    const groups = C.pipelineGroups.map(gr => ({ label: gr.label, count: inStages(s, gr.stages).length }));
    const grp = l => (groups.find(x => x.label === l) || {}).count || 0;
    return {
      openOrders: s.orders.filter(isOpenOrder).length,
      cvsReceived: s.candidates.length,
      visaPipeline: grp('Visa Processing'),
      readyToFly: grp('Ready to Deploy'),
      groups,
    };
  }
  function domestic(s) {
    const idx = c => C.domesticStatuses.indexOf(c.status);
    return {
      enquiries: s.domestic.length,
      profilesShared: s.domestic.filter(c => idx(c) >= 1).length,
      visaCases: s.domestic.filter(c => c.status === 'Visa & Travel').length,
      handovers: s.domestic.filter(c => ['Arrival / Handover', 'Guarantee / Complaints'].includes(c.status)).length,
    };
  }
  function crm(s) {
    return {
      clients: s.clients.length,
      visits: s.visits.length,
      followUps: s.visits.filter(v => v.outcome === 'Follow-up').length,
      ordersWon: s.orders.filter(isOpenOrder).length,
    };
  }
  function visaCards(s) {
    const c = st => inStages(s, [st]).length;
    return { applied: c('Visa Applied'), qvc: c('QVC'), rtp: c('RTP'), printed: c('Visa Printed') };
  }
  function deployCards(s) {
    const fp = inSet(s, 'Flight Pending');
    return {
      readyToFly: fp.length,
      ticketsPending: fp.filter(c => { const t = ticketOf(s, c.id); return !t || stepRank(t.step) < 2; }).length,
      arrivalNotices: s.tickets.filter(t => t.step === 'Arrival Notice' && s.candidates.some(c => c.id === t.candidate_id)).length,
      arrivalsVerified: inSet(s, 'Deployed').length,
    };
  }

  /** Six-step deployment checklist for one candidate — derived from stage + travel record (no duplicated state). */
  function deploymentChecklist(s, c) {
    const t = ticketOf(s, c.id); const i = Lc.index(c.status);
    return [
      { label: 'Confirm visa printed', who: 'Operations', done: i >= Lc.index('Visa Printed') },
      { label: 'Request ticket / inform agent', who: 'Operations', done: !!t && stepRank(t.step) >= 1 },
      { label: 'Send client arrival notice', who: 'Operations', done: !!t && stepRank(t.step) >= 3 },
      { label: 'Collect pickup driver name & phone', who: 'Client', done: !!t && !!t.driver_name && !!t.driver_phone },
      { label: 'Verify arrival and client joining', who: 'Operations', done: i >= Lc.index('Arrived') },
      { label: 'Start applicable warranty', who: 'Operations', done: c.status === 'Warranty' || s.warranties.some(w => w.candidate_id === c.id) },
    ];
  }

  /** Master Recruitment Report — V6 formula: Remaining = Demand − (Applied+QVC+RTP+Printed+Deployed). Each candidate in one stage only. */
  function masterReport(s, { country = 'All', query = '' } = {}) {
    const map = new Map();
    const row = (client, ctry) => {
      const k = n(client) + '|' + n(ctry);
      if (!map.has(k)) map.set(k, Object.assign({ company: client, country: ctry, demand: 0 }, Object.fromEntries(C.masterColumns.map(m => [m.key, 0]))));
      return map.get(k);
    };
    s.orders.forEach(o => { row(o.client, o.country).demand += Number(o.qty) || 0; });
    s.candidates.forEach(c => {
      const col = C.masterColumns.find(m => m.stages.includes(c.status));
      const r = row(c.client, c.country); if (col) r[col.key]++;
    });
    const q = n(query);
    let rows = [...map.values()].filter(r => (country === 'All' || r.country === country) && (!q || n(r.company).includes(q)));
    rows.sort((a, b) => a.company.localeCompare(b.company) || a.country.localeCompare(b.country));
    const add = r => { r.remaining = r.demand - C.masterColumns.reduce((a, m) => a + r[m.key], 0); return r; };
    rows.forEach(add);
    const total = add(Object.assign({ company: 'TOTAL', country: '', demand: U.sum(rows, r => r.demand) }, Object.fromEntries(C.masterColumns.map(m => [m.key, U.sum(rows, r => r[m.key])]))));
    return { rows, total };
  }

  function orderProgress(s) {
    return s.orders.map(o => {
      const linked = s.candidates.filter(c => c.order_id === o.id);
      return { id: o.id, client: o.client, country: o.country, trade: o.trade, qty: o.qty, status: o.status, cvs: linked.length,
        selected: linked.filter(c => Lc.index(c.status) >= Lc.index('Selected')).length,
        deployed: linked.filter(c => Lc.inSet(c.status, 'Deployed')).length,
        remaining: Math.max(0, o.qty - linked.filter(c => Lc.inSet(c.status, 'Deployed')).length) };
    });
  }
  function allocationStats(s, a) {
    return { cvs: s.candidates.filter(c => n(c.agency) === n(a.agency) && c.order_id === a.order_id).length };
  }

  /** Planned V6 reports (formulas are ASSUMPTIONS, OQ-21). */
  function countryWise(s) {
    return C.countries.map(country => {
      const cands = s.candidates.filter(c => c.country === country), ords = s.orders.filter(o => o.country === country);
      return { country, orders: ords.length, ordered_qty: U.sum(ords, o => o.qty), cvs: cands.length,
        selected: cands.filter(c => Lc.index(c.status) >= Lc.index('Selected')).length, deployed: cands.filter(c => Lc.inSet(c.status, 'Deployed')).length };
    }).filter(r => r.orders || r.cvs);
  }
  function agentPerformance(s) {
    const names = U.uniqSorted([...s.candidates.map(c => c.agency), ...s.allocations.map(a => a.agency)]);
    return names.map(agency => {
      const cands = s.candidates.filter(c => n(c.agency) === n(agency));
      const sel = cands.filter(c => Lc.index(c.status) >= Lc.index('Selected')).length;
      const arr = cands.filter(c => Lc.inSet(c.status, 'Deployed')).length;
      return { agency, allocated: U.sum(s.allocations.filter(a => n(a.agency) === n(agency)), a => a.allocated), cvs: cands.length, selected: sel,
        selection_ratio: U.pctText(sel, cands.length), arrived: arr };
    });
  }
  function warrantyExpiry(s, today) {
    return s.warranties.filter(w => w.warranty_expiry).map(w => ({ case: w.id, division: w.division, client: w.client, candidate: w.candidate_id || '', issue: w.issue, status: w.status,
      warranty_start: w.warranty_start || '', warranty_expiry: w.warranty_expiry, days_left: U.diffDays(today, w.warranty_expiry) })).sort((a, b) => a.days_left - b.days_left);
  }
  function demandSales(s) {
    const clients = U.uniqSorted([...s.clients.map(c => c.name), ...s.visits.map(v => v.client), ...s.demands.map(d => d.client)]);
    return clients.map(client => {
      const v = s.visits.filter(x => n(x.client) === n(client)), d = s.demands.filter(x => n(x.client) === n(client));
      return { client, visits: v.length, follow_ups: v.filter(x => x.outcome === 'Follow-up').length, orders_received: v.filter(x => x.outcome === 'Order Received').length,
        demand_letters: d.length, open_demand: d.filter(x => x.status !== 'Approved').length, orders: s.orders.filter(o => n(o.client) === n(client)).length };
    });
  }

  /** Finance totals for a division ('labour' | 'domestic' | 'all') — V6: net = incoming − outgoing, "not accounting profit". */
  function financeTotals(s, division) {
    const tx = s.finance.filter(t => division === 'all' || t.division === division);
    const incoming = U.sum(tx.filter(t => t.direction === 'Incoming'), t => t.amount), outgoing = U.sum(tx.filter(t => t.direction === 'Outgoing'), t => t.amount);
    return { count: tx.length, incoming, outgoing, net: incoming - outgoing };
  }
  /** V6 costing: revenue = qty × rev; cost = qty × (client charges + [investment if extra] + partner + other). Negative inputs are treated as 0. */
  function costing(i) {
    const n = v => Math.max(0, Number(v) || 0), qty = n(i.qty);
    const perCand = n(i.client) + (i.investmentTreatment === 'extra' ? n(i.investment) : 0) + n(i.partner) + n(i.other);
    const revenue = qty * n(i.revenue), cost = qty * perCand; return { revenue, cost, profit: revenue - cost };
  }
  const costingDefaults = country => C.costing[country] || C.costing._default;

  LGM.Metrics = { financeTotals, costing, costingDefaults, labour, domestic, crm, visaCards, deployCards, deploymentChecklist, masterReport, orderProgress, allocationStats, countryWise, agentPerformance, warrantyExpiry, demandSales, ticketOf, stepRank, isOpenOrder, inSet, inStages };
})(typeof window !== 'undefined' ? window : globalThis);

/** Every counter on a dashboard / card / report is computed here from records. Pure functions of State. */
import { C } from '../config';
import { diffDays, norm, pctText, sum, uniqSorted } from '../util';
import { index, inSet as stageInSet } from './lifecycle';
import type { Rec, State } from './types';

export const inStages = (s: State, stages: string[]) => s.candidates.filter(c => stages.includes(c.status));
export const inSet = (s: State, name: string) => s.candidates.filter(c => stageInSet(c.status, name));
export const ticketOf = (s: State, candidateId: string) => s.tickets.find(t => t.candidate_id === candidateId) ?? null;
export const stepRank = (step: string) => Math.max(0, C.ticketSteps.indexOf(step));
export const isOpenOrder = (o: Rec) => !C.orderClosed.includes(o.status);

export function labour(s: State) {
  const groups = C.pipelineGroups.map(g => ({ label: g.label, count: inStages(s, g.stages).length }));
  const grp = (l: string) => groups.find(x => x.label === l)?.count ?? 0;
  return { openOrders: s.orders.filter(isOpenOrder).length, cvsReceived: s.candidates.length, visaPipeline: grp('Visa Processing'), readyToFly: grp('Ready to Deploy'), groups };
}
export function domestic(s: State) {
  const idx = (c: Rec) => C.domesticStatuses.indexOf(c.status);
  return {
    enquiries: s.domestic.length, profilesShared: s.domestic.filter(c => idx(c) >= 1).length,
    visaCases: s.domestic.filter(c => c.status === 'Visa & Travel').length,
    handovers: s.domestic.filter(c => ['Arrival / Handover', 'Guarantee / Complaints'].includes(c.status)).length,
  };
}
export const crm = (s: State) => ({
  clients: s.clients.length, visits: s.visits.length, followUps: s.visits.filter(v => v.outcome === 'Follow-up').length, ordersWon: s.orders.filter(isOpenOrder).length,
});
export function visaCards(s: State) {
  const c = (st: string) => inStages(s, [st]).length;
  return { applied: c('Visa Applied'), qvc: c('QVC'), rtp: c('RTP'), printed: c('Visa Printed') };
}
export function deployCards(s: State) {
  const fp = inSet(s, 'Flight Pending');
  return {
    readyToFly: fp.length,
    ticketsPending: fp.filter(c => { const t = ticketOf(s, c.id); return !t || stepRank(t.step) < 2; }).length,
    arrivalNotices: s.tickets.filter(t => t.step === 'Arrival Notice' && s.candidates.some(c => c.id === t.candidate_id)).length,
    arrivalsVerified: inSet(s, 'Deployed').length,
  };
}
/** Six-step deployment checklist, derived from stage + travel record (no duplicated state). */
export function deploymentChecklist(s: State, c: Rec) {
  const t = ticketOf(s, c.id), i = index(c.status);
  return [
    { label: 'Confirm visa printed', who: 'Operations', done: i >= index('Visa Printed') },
    { label: 'Request ticket / inform agent', who: 'Operations', done: !!t && stepRank(t.step) >= 1 },
    { label: 'Send client arrival notice', who: 'Operations', done: !!t && stepRank(t.step) >= 3 },
    { label: 'Collect pickup driver name & phone', who: 'Client', done: !!t && !!t.driver_name && !!t.driver_phone },
    { label: 'Verify arrival and client joining', who: 'Operations', done: i >= index('Arrived') },
    { label: 'Start applicable warranty', who: 'Operations', done: c.status === 'Warranty' || s.warranties.some(w => w.candidate_id === c.id) },
  ];
}
/** Master Recruitment Report — V6: Remaining = Demand − (Applied + QVC + RTP + Printed + Deployed). */
export function masterReport(s: State, { country = 'All', query = '' } = {}) {
  const map = new Map<string, Rec>();
  const row = (client: string, ctry: string) => {
    const k = norm(client) + '|' + norm(ctry);
    if (!map.has(k)) map.set(k, { company: client, country: ctry, demand: 0, ...Object.fromEntries(C.masterColumns.map(m => [m.key, 0])) });
    return map.get(k)!;
  };
  s.orders.forEach(o => { row(o.client, o.country).demand += Number(o.qty) || 0; });
  s.candidates.forEach(c => { const col = C.masterColumns.find(m => m.stages.includes(c.status)); const r = row(c.client, c.country); if (col) r[col.key]++; });
  const q = norm(query);
  const rows = [...map.values()].filter(r => (country === 'All' || r.country === country) && (!q || norm(r.company).includes(q)))
    .sort((a, b) => a.company.localeCompare(b.company) || a.country.localeCompare(b.country));
  const add = (r: Rec) => { r.remaining = r.demand - C.masterColumns.reduce((a, m) => a + r[m.key], 0); return r; };
  rows.forEach(add);
  const total = add({ company: 'TOTAL', country: '', demand: sum(rows, r => r.demand), ...Object.fromEntries(C.masterColumns.map(m => [m.key, sum(rows, r => r[m.key])])) });
  return { rows, total };
}
export function orderProgress(s: State) {
  return s.orders.map(o => {
    const linked = s.candidates.filter(c => c.order_id === o.id);
    const deployed = linked.filter(c => stageInSet(c.status, 'Deployed')).length;
    return { id: o.id, client: o.client, country: o.country, trade: o.trade, qty: o.qty, status: o.status, cvs: linked.length,
      selected: linked.filter(c => index(c.status) >= index('Selected')).length, deployed, remaining: Math.max(0, o.qty - deployed) };
  });
}
export const allocationStats = (s: State, a: Rec) => ({ cvs: s.candidates.filter(c => norm(c.agency) === norm(a.agency) && c.order_id === a.order_id).length });

export function countryWise(s: State) {
  return C.countries.map(country => {
    const cands = s.candidates.filter(c => c.country === country), ords = s.orders.filter(o => o.country === country);
    return { country, orders: ords.length, ordered_qty: sum(ords, o => o.qty), cvs: cands.length,
      selected: cands.filter(c => index(c.status) >= index('Selected')).length, deployed: cands.filter(c => stageInSet(c.status, 'Deployed')).length };
  }).filter(r => r.orders || r.cvs);
}
export function agentPerformance(s: State) {
  const names = uniqSorted([...s.candidates.map(c => c.agency), ...s.allocations.map(a => a.agency)]);
  return names.map(agency => {
    const cands = s.candidates.filter(c => norm(c.agency) === norm(agency));
    const sel = cands.filter(c => index(c.status) >= index('Selected')).length;
    return { agency, allocated: sum(s.allocations.filter(a => norm(a.agency) === norm(agency)), a => a.allocated), cvs: cands.length, selected: sel,
      selection_ratio: pctText(sel, cands.length), arrived: cands.filter(c => stageInSet(c.status, 'Deployed')).length };
  });
}
export function warrantyExpiryReport(s: State, today: string) {
  return s.warranties.filter(w => w.warranty_expiry).map(w => ({ case: w.id, division: w.division, client: w.client, candidate: w.candidate_id || '', issue: w.issue, status: w.status,
    warranty_start: w.warranty_start || '', warranty_expiry: w.warranty_expiry, days_left: diffDays(today, w.warranty_expiry) })).sort((a, b) => a.days_left - b.days_left);
}
export function demandSales(s: State) {
  const clients = uniqSorted([...s.clients.map(c => c.name), ...s.visits.map(v => v.client), ...s.demands.map(d => d.client)]);
  return clients.map(client => {
    const v = s.visits.filter(x => norm(x.client) === norm(client)), d = s.demands.filter(x => norm(x.client) === norm(client));
    return { client, visits: v.length, follow_ups: v.filter(x => x.outcome === 'Follow-up').length, orders_received: v.filter(x => x.outcome === 'Order Received').length,
      demand_letters: d.length, open_demand: d.filter(x => x.status !== 'Approved').length, orders: s.orders.filter(o => norm(o.client) === norm(client)).length };
  });
}
export function financeTotals(s: State, division: string) {
  const tx = s.finance.filter(t => division === 'all' || t.division === division);
  const incoming = sum(tx.filter(t => t.direction === 'Incoming'), t => t.amount), outgoing = sum(tx.filter(t => t.direction === 'Outgoing'), t => t.amount);
  return { count: tx.length, incoming, outgoing, net: incoming - outgoing };
}
export interface CostInput { qty: number; revenue: number; client: number; investment: number; investmentTreatment: string; partner?: number; other?: number }
/** V6 costing: revenue = qty × rev; cost = qty × (client charges + [investment if extra] + partner + other). Negatives count as 0. */
export function costing(i: Partial<CostInput>) {
  const n = (v: unknown) => Math.max(0, Number(v) || 0), qty = n(i.qty);
  const perCand = n(i.client) + (i.investmentTreatment === 'extra' ? n(i.investment) : 0) + n(i.partner) + n(i.other);
  const revenue = qty * n(i.revenue), cost = qty * perCand;
  return { revenue, cost, profit: revenue - cost };
}
export const costingDefaults = (country: string) => C.costing[country] ?? C.costing._default;

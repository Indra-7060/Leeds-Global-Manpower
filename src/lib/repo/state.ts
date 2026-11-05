import 'server-only';
import { prisma } from '@/lib/db';
import type { Workspace } from '@/lib/config';
import { dateToISO } from '@/lib/util';
import type { Rec, State } from '@/lib/domain/types';

/**
 * Loads one workspace and maps database rows to the flat V6-shaped records used by the business logic
 * (client by name, links by code). Tables are small (thousands of rows), so a page loads what it needs in one go.
 */
export async function loadState(ws: Workspace): Promise<State> {
  const where = { workspace: ws };
  const [clients, visits, demands, orders, allocations, candidates, interviews, tickets, warranties, domestic, credentials, finance, cvInbox, activity] = await Promise.all([
    prisma.client.findMany({ where, orderBy: { name: 'asc' } }),
    prisma.visit.findMany({ where, include: { client: true }, orderBy: { date: 'desc' } }),
    prisma.demandLetter.findMany({ where, include: { client: true, order: true }, orderBy: { code: 'asc' } }),
    prisma.order.findMany({ where, include: { client: true }, orderBy: { code: 'asc' } }),
    prisma.agencyAllocation.findMany({ where, include: { order: true }, orderBy: { id: 'asc' } }),
    prisma.candidate.findMany({ where, include: { client: true, order: true, history: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }),
    prisma.interview.findMany({ where, include: { client: true }, orderBy: { id: 'asc' } }),
    prisma.travelRecord.findMany({ where, include: { candidate: true }, orderBy: { id: 'asc' } }),
    prisma.warrantyCase.findMany({ where, include: { client: true, candidate: true }, orderBy: { code: 'asc' } }),
    prisma.domesticCase.findMany({ where, orderBy: { code: 'asc' } }),
    prisma.credentialRecord.findMany({ where, include: { client: true }, orderBy: { id: 'asc' } }),
    prisma.financeEntry.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
    prisma.cvIntakeItem.findMany({ where, orderBy: { id: 'desc' } }),
    prisma.activityLog.findMany({ where, orderBy: { at: 'desc' }, take: 200 }),
  ]);

  const m = (x: Rec) => x;
  return {
    clients: clients.map(c => m({ id: c.id, name: c.name, sector: c.sector, stage: c.stage, next_action: c.nextAction })),
    visits: visits.map(v => m({ id: v.id, client: v.client.name, contact: v.contact, date: dateToISO(v.date), outcome: v.outcome, pipeline_stage: v.pipelineStage, next_action: v.nextAction, salesperson: v.salesperson, notes: v.notes })),
    demands: demands.map(d => m({ id: d.code, dbId: d.id, client: d.client.name, order_id: d.order?.code ?? '', letter_date: dateToISO(d.letterDate), countries: d.countries, trades: d.trades, quantities: d.quantities,
      nationality: d.nationality, salary_benefits: d.salaryBenefits, signed: d.signed, agency_allocation: d.agencyAllocation, status: d.status })),
    orders: orders.map(o => m({ id: o.code, dbId: o.id, client: o.client.name, country: o.country, trade: o.trade, qty: o.qty, status: o.status, agency: o.agency, _key: o.importKey ?? '', _src: o.sourceFile ? { file: o.sourceFile, row: o.sourceRow } : null })),
    allocations: allocations.map(a => m({ id: a.id, agency: a.agency, country: a.country, order_id: a.order.code, allocated: a.allocated, status: a.status })),
    candidates: candidates.map(c => m({ id: c.code, dbId: c.id, name: c.name, passport: c.passport, client: c.client.name, order_id: c.order?.code ?? '', country: c.country, agency: c.agency, trade: c.trade, status: c.status,
      visa_number: c.visaNumber, qvc_date: dateToISO(c.qvcDate), flight_date: dateToISO(c.flightDate), history: c.history.map(h => ({ stage: h.stage, at: h.at.toISOString(), by: h.byRole })),
      _src: c.sourceFile ? { file: c.sourceFile, row: c.sourceRow } : null })),
    interviews: interviews.map(i => m({ id: i.id, client: i.client.name, method: i.method, country: i.country, date: dateToISO(i.date), candidates: i.candidates, status: i.status })),
    tickets: tickets.map(t => m({ id: t.id, candidate_id: t.candidate.code, ticket_by: t.ticketBy, flight: t.flight, driver_name: t.driverName, driver_phone: t.driverPhone, step: t.step })),
    warranties: warranties.map(w => m({ id: w.code, dbId: w.id, division: w.division, client: w.client?.name ?? w.clientLabel, candidate_id: w.candidate?.code ?? '', issue: w.issue, status: w.status,
      warranty_start: dateToISO(w.warrantyStart), warranty_expiry: dateToISO(w.warrantyExpiry) })),
    domestic: domestic.map(d => m({ id: d.code, dbId: d.id, customer: d.customer, origin: d.origin, status: d.status, next_action: d.nextAction, sponsor_type: d.sponsorType, mobile: d.mobile, address: d.address, category: d.category,
      qid_last: d.qidLast, arrival_date: dateToISO(d.arrivalDate), handover_date: dateToISO(d.handoverDate), handover_note: d.handoverNote })),
    credentials: credentials.map(c => m({ id: c.id, client: c.client.name, portal: c.portal, record: c.record, access: c.access })),
    finance: finance.map(f => m({ id: f.id, date: dateToISO(f.date), division: f.division, direction: f.direction, account: f.account, party: f.party, client: f.client, country: f.country,
      order: f.orderRef, category: f.category, amount: Number(f.amount), ref: f.ref, note: f.note, _key: f.importKey ?? '' })),
    cvInbox: cvInbox.map(x => m({ id: x.id, filename: x.filename, size: x.size, type: x.type, source: x.source, client: x.client, agency: x.agency, country: x.country, status: x.status, note: x.note,
      extracted_email: x.extractedEmail, extracted_phone: x.extractedPhone, preview: x.preview, received: x.receivedAt.toISOString() })),
    activity: activity.map(a => m({ at: a.at.toISOString(), role: a.role, entity: a.entity, id: a.recordCode, client: a.client, text: a.text })),
  };
}

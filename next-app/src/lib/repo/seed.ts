/**
 * Workspace data helpers shared by `npm run db:seed` and the in-app Settings page.
 * No 'server-only' import on purpose: the seed script runs outside Next.js and passes its own Prisma client.
 */
import type { PrismaClient } from '@/generated/prisma/client';
import type { Workspace } from '@/lib/config';
import { buildDemoState } from '@/lib/seed-data';
import { candidateKey } from '@/lib/domain/rules';
import { isoToDate, norm } from '@/lib/util';

const d = (s?: string) => isoToDate(s || null);

/** Deletes EVERY business record of one workspace (users are never touched). Child tables first. */
export async function clearWorkspaceData(prisma: PrismaClient, ws: Workspace) {
  const where = { workspace: ws };
  await prisma.$transaction(async tx => {
    await tx.candidateStage.deleteMany({ where: { candidate: where } });
    await tx.travelRecord.deleteMany({ where });
    await tx.warrantyCase.deleteMany({ where });
    await tx.candidate.deleteMany({ where });
    await tx.agencyAllocation.deleteMany({ where });
    await tx.demandLetter.deleteMany({ where });
    await tx.order.deleteMany({ where });
    await tx.visit.deleteMany({ where });
    await tx.interview.deleteMany({ where });
    await tx.credentialRecord.deleteMany({ where });
    await tx.client.deleteMany({ where });
    await tx.domesticCase.deleteMany({ where });
    await tx.financeEntry.deleteMany({ where });
    await tx.cvIntakeItem.deleteMany({ where });
    await tx.activityLog.deleteMany({ where });
    await tx.importRecord.deleteMany({ where });
    await tx.counter.deleteMany({ where });
  }, { timeout: 60000 });
}

/** Re-creates the fictional DEMO workspace from scratch. Returns record counts. */
export async function seedDemoWorkspace(prisma: PrismaClient) {
  const ws = 'demo' as const;
  const s = buildDemoState();
  await clearWorkspaceData(prisma, ws);
  const client = new Map<string, number>(), order = new Map<string, number>(), cand = new Map<string, number>();

  for (const c of s.clients) client.set(c.name, (await prisma.client.create({ data: { workspace: ws, name: c.name, nameKey: norm(c.name), sector: c.sector, stage: c.stage, nextAction: c.next_action } })).id);
  for (const o of s.orders) order.set(o.id, (await prisma.order.create({ data: { workspace: ws, code: o.id, clientId: client.get(o.client)!, country: o.country, trade: o.trade, qty: o.qty, status: o.status, agency: o.agency } })).id);
  for (const a of s.allocations) await prisma.agencyAllocation.create({ data: { workspace: ws, agency: a.agency, country: a.country, orderId: order.get(a.order_id)!, allocated: a.allocated, status: a.status } });
  for (const c of s.candidates) {
    const row = await prisma.candidate.create({ data: { workspace: ws, code: c.id, name: c.name, passport: c.passport, dupKey: candidateKey(c), clientId: client.get(c.client)!, orderId: order.get(c.order_id) ?? null,
      country: c.country, agency: c.agency, trade: c.trade, status: c.status, visaNumber: c.visa_number, qvcDate: d(c.qvc_date), flightDate: d(c.flight_date) } });
    cand.set(c.id, row.id);
    for (const h of c.history) await prisma.candidateStage.create({ data: { candidateId: row.id, stage: h.stage, at: new Date(h.at), byRole: h.by } });
  }
  for (const t of s.tickets) await prisma.travelRecord.create({ data: { workspace: ws, candidateId: cand.get(t.candidate_id)!, ticketBy: t.ticket_by, flight: t.flight, driverName: t.driver_name, driverPhone: t.driver_phone, step: t.step } });
  for (const i of s.interviews) await prisma.interview.create({ data: { workspace: ws, clientId: client.get(i.client)!, method: i.method, country: i.country, date: d(i.date), candidates: i.candidates, status: i.status } });
  for (const v of s.visits) await prisma.visit.create({ data: { workspace: ws, clientId: client.get(v.client)!, contact: v.contact, date: d(v.date)!, outcome: v.outcome, pipelineStage: v.pipeline_stage, nextAction: v.next_action, salesperson: v.salesperson, notes: v.notes } });
  for (const x of s.demands) await prisma.demandLetter.create({ data: { workspace: ws, code: x.id, clientId: client.get(x.client)!, orderId: order.get(x.order_id) ?? null, letterDate: d(x.letter_date), countries: x.countries, trades: x.trades, signed: x.signed, status: x.status } });
  for (const w of s.warranties) await prisma.warrantyCase.create({ data: { workspace: ws, code: w.id, division: w.division, clientId: client.get(w.client) ?? null, clientLabel: client.has(w.client) ? '' : w.client, candidateId: cand.get(w.candidate_id) ?? null, issue: w.issue, status: w.status, warrantyStart: d(w.warranty_start), warrantyExpiry: d(w.warranty_expiry) } });
  for (const x of s.domestic) await prisma.domesticCase.create({ data: { workspace: ws, code: x.id, customer: x.customer, origin: x.origin, status: x.status, nextAction: x.next_action } });
  for (const x of s.credentials) await prisma.credentialRecord.create({ data: { workspace: ws, clientId: client.get(x.client)!, portal: x.portal, record: x.record } });
  for (const f of s.finance) await prisma.financeEntry.create({ data: { workspace: ws, date: d(f.date)!, division: f.division, direction: f.direction, account: f.account, party: f.party, client: f.client, country: f.country, orderRef: f.order, category: f.category, amount: f.amount, ref: f.ref } });
  for (const x of s.cvInbox) await prisma.cvIntakeItem.create({ data: { workspace: ws, filename: x.filename, size: x.size, type: x.type, source: x.source, client: x.client, agency: x.agency, country: x.country, status: x.status, note: x.note, extractedEmail: x.extracted_email, extractedPhone: x.extracted_phone, preview: x.preview } });
  for (const a of s.activity) await prisma.activityLog.create({ data: { workspace: ws, at: new Date(a.at), role: a.role, entity: a.entity, client: a.client, text: a.text } });
  for (const [kind, next] of Object.entries(s.counters)) await prisma.counter.create({ data: { workspace: ws, kind, next } });
  return { clients: s.clients.length, orders: s.orders.length, candidates: s.candidates.length };
}

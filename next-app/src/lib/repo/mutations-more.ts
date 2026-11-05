import 'server-only';
import { prisma } from '@/lib/db';
import { C } from '@/lib/config';
import { validateInput } from '@/lib/forms';
import { canonicalCountry, warrantyExpiry } from '@/lib/domain/rules';
import { norm } from '@/lib/util';
import { encryptText } from '@/lib/crypto';
import { d, fail, findClient, log, nextNumber, type Actor, type Result, type Tx } from './mutations';

/** Candidates from Visa Printed onward may have a travel record (V6: tickets are booked once a visa is printed). */
export const TRAVEL_STAGES = ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];
const NO_CLIENT = 'Client not found — add it under Client CRM first.';

const bad = (entity: string, input: Record<string, unknown>, editing: boolean) => validateInput(entity, input, { editing });
const codeNumber = async (tx: Tx, a: Actor, kind: string, start: number, fmt: (n: number) => string, exists: (code: string) => Promise<unknown>) => {
  let code: string;
  do { code = fmt(await nextNumber(tx, a.workspace, kind, start)); } while (await exists(code));
  return code;
};

// ───────────── visits ─────────────
export async function saveVisit(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('visits', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client); if (!client) return fail({ client: NO_CLIENT });
    const data = { clientId: client.id, contact: clean.contact, date: d(clean.date)!, outcome: clean.outcome, pipelineStage: clean.pipeline_stage, nextAction: clean.next_action, salesperson: clean.salesperson, notes: clean.notes };
    if (id) {
      if (!(await tx.visit.findFirst({ where: { id, workspace: a.workspace } }))) return fail({ _: 'Visit not found.' });
      await tx.visit.update({ where: { id }, data }); await log(tx, a, 'visits', '', client.name, `Visit to ${client.name} updated`);
    } else { await tx.visit.create({ data: { ...data, workspace: a.workspace } }); await log(tx, a, 'visits', '', client.name, `Visit to ${client.name} recorded (${clean.outcome})`); }
    return { ok: true } as Result;
  });
}

// ───────────── demand letters ─────────────
export async function saveDemand(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('demands', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client); if (!client) return fail({ client: NO_CLIENT });
    const order = clean.order_id ? await tx.order.findUnique({ where: { workspace_code: { workspace: a.workspace, code: clean.order_id } } }) : null;
    if (clean.order_id && !order) return fail({ order_id: 'Order not found.' });
    const data = { clientId: client.id, orderId: order?.id ?? null, letterDate: d(clean.letter_date), countries: clean.countries, trades: clean.trades, quantities: clean.quantities, nationality: clean.nationality,
      salaryBenefits: clean.salary_benefits, signed: clean.signed, agencyAllocation: clean.agency_allocation, status: clean.status };
    if (id) {
      const x = await tx.demandLetter.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Demand letter not found.' });
      await tx.demandLetter.update({ where: { id }, data }); await log(tx, a, 'demands', x.code, client.name, `Demand letter ${x.code} updated`); return { ok: true, code: x.code } as Result;
    }
    const code = await codeNumber(tx, a, 'demand', 1001, n => 'DL-' + n, c => tx.demandLetter.findUnique({ where: { workspace_code: { workspace: a.workspace, code: c } } }));
    await tx.demandLetter.create({ data: { ...data, workspace: a.workspace, code } }); await log(tx, a, 'demands', code, client.name, `Demand letter ${code} added`);
    return { ok: true, code } as Result;
  });
}

// ───────────── agency allocations ─────────────
export async function saveAllocation(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('allocations', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { workspace_code: { workspace: a.workspace, code: clean.order_id } }, include: { client: true } });
    if (!order) return fail({ order_id: 'Order not found.' });
    const others = (await tx.agencyAllocation.aggregate({ where: { orderId: order.id, NOT: id ? { id } : undefined }, _sum: { allocated: true } }))._sum.allocated ?? 0;
    const warnings = others + clean.allocated > order.qty ? [`Allocated total ${others + clean.allocated} exceeds order quantity ${order.qty}.`] : [];
    const data = { agency: clean.agency, country: canonicalCountry(clean.country), orderId: order.id, allocated: clean.allocated as number, status: clean.status };
    if (id) {
      if (!(await tx.agencyAllocation.findFirst({ where: { id, workspace: a.workspace } }))) return fail({ _: 'Allocation not found.' });
      await tx.agencyAllocation.update({ where: { id }, data });
    } else await tx.agencyAllocation.create({ data: { ...data, workspace: a.workspace } });
    await log(tx, a, 'allocations', order.code, order.client.name, `${clean.agency} allocated ${clean.allocated} on ${order.code}`);
    return { ok: true, warnings } as Result;
  });
}

// ───────────── interviews ─────────────
export async function saveInterview(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('interviews', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client); if (!client) return fail({ client: NO_CLIENT });
    const data = { clientId: client.id, method: clean.method, country: canonicalCountry(clean.country), date: d(clean.date), candidates: (clean.candidates as number | null) ?? 0, status: clean.status };
    if (id) {
      if (!(await tx.interview.findFirst({ where: { id, workspace: a.workspace } }))) return fail({ _: 'Interview not found.' });
      await tx.interview.update({ where: { id }, data });
    } else await tx.interview.create({ data: { ...data, workspace: a.workspace } });
    await log(tx, a, 'interviews', '', client.name, `Interview (${clean.method}) for ${client.name} ${id ? 'updated' : 'scheduled'}`);
    return { ok: true } as Result;
  });
}

// ───────────── travel records (tickets & arrival) ─────────────
export async function saveTicket(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('tickets', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const cand = await tx.candidate.findUnique({ where: { workspace_code: { workspace: a.workspace, code: clean.candidate_id } }, include: { client: true } });
    if (!cand) return fail({ candidate_id: 'Candidate not found.' });
    if (!TRAVEL_STAGES.includes(cand.status)) return fail({ candidate_id: `${cand.code} is at ${cand.status}; travel records start once the visa is printed.` });
    const other = await tx.travelRecord.findUnique({ where: { candidateId: cand.id } });
    if (other && other.id !== id) return fail({ candidate_id: 'This candidate already has a travel record.' });
    const data = { candidateId: cand.id, ticketBy: clean.ticket_by, flight: clean.flight, driverName: clean.driver_name, driverPhone: clean.driver_phone, step: clean.step };
    if (id) {
      if (!(await tx.travelRecord.findFirst({ where: { id, workspace: a.workspace } }))) return fail({ _: 'Travel record not found.' });
      await tx.travelRecord.update({ where: { id }, data });
    } else await tx.travelRecord.create({ data: { ...data, workspace: a.workspace } });
    if ('flight_date' in clean) await tx.candidate.update({ where: { id: cand.id }, data: { flightDate: d(clean.flight_date) } });
    await log(tx, a, 'tickets', cand.code, cand.client.name, `Travel record for ${cand.code} ${id ? 'updated' : 'added'} (${clean.step})`);
    return { ok: true, code: cand.code } as Result;
  });
}

// ───────────── warranty cases ─────────────
export async function saveWarranty(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('warranties', input, !!id); if (Object.keys(errors).length) return fail(errors);
  const expiry = warrantyExpiry(clean.division, clean.warranty_start, clean.warranty_expiry);
  if (clean.warranty_start && expiry && expiry < clean.warranty_start) return fail({ warranty_expiry: 'Expiry cannot be before start.' });
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client); // registered client → link; otherwise keep the typed name (e.g. a household)
    const cand = clean.candidate_id ? await tx.candidate.findUnique({ where: { workspace_code: { workspace: a.workspace, code: clean.candidate_id } } }) : null;
    if (clean.candidate_id && !cand) return fail({ candidate_id: 'Candidate not found.' });
    const data = { division: clean.division, clientId: client?.id ?? null, clientLabel: client ? '' : clean.client, candidateId: cand?.id ?? null, issue: clean.issue, status: clean.status, warrantyStart: d(clean.warranty_start), warrantyExpiry: d(expiry) };
    if (id) {
      const w = await tx.warrantyCase.findFirst({ where: { id, workspace: a.workspace } }); if (!w) return fail({ _: 'Warranty case not found.' });
      await tx.warrantyCase.update({ where: { id }, data }); await log(tx, a, 'warranties', w.code, clean.client, `Warranty case ${w.code} updated`); return { ok: true, code: w.code } as Result;
    }
    const code = await codeNumber(tx, a, 'warranty', 101, n => 'WR-' + n, c => tx.warrantyCase.findUnique({ where: { workspace_code: { workspace: a.workspace, code: c } } }));
    await tx.warrantyCase.create({ data: { ...data, workspace: a.workspace, code } }); await log(tx, a, 'warranties', code, clean.client, `Warranty case ${code} opened`);
    return { ok: true, code } as Result;
  });
}

// ───────────── domestic cases ─────────────
export async function saveDomestic(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = bad('domestic', input, !!id); if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const qid = String(clean.qid ?? '').trim(); // blank on edit = keep the stored (encrypted) value
    const data = { customer: clean.customer, origin: clean.origin, status: clean.status, nextAction: clean.next_action, sponsorType: clean.sponsor_type, mobile: clean.mobile, address: clean.address, category: clean.category,
      arrivalDate: d(clean.arrival_date), handoverDate: d(clean.handover_date), handoverNote: clean.handover_note, ...(qid ? { qidCipher: encryptText(qid), qidLast: qid.slice(-4) } : {}) };
    if (clean.arrival_date && clean.handover_date && clean.handover_date < clean.arrival_date) return fail({ handover_date: 'Handover cannot be before arrival.' });
    if (id) {
      const x = await tx.domesticCase.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Case not found.' });
      await tx.domesticCase.update({ where: { id }, data }); await log(tx, a, 'domestic', x.code, '', `Domestic case ${x.code} updated`); return { ok: true, code: x.code } as Result;
    }
    const code = await codeNumber(tx, a, 'domestic', 1, n => 'DW-' + String(n).padStart(3, '0'), c => tx.domesticCase.findUnique({ where: { workspace_code: { workspace: a.workspace, code: c } } }));
    await tx.domesticCase.create({ data: { ...data, workspace: a.workspace, code } }); await log(tx, a, 'domestic', code, '', `Domestic case ${code} opened`);
    return { ok: true, code } as Result;
  });
}

// ───────────── deletes and "next step" ─────────────
type SimpleEntity = 'visits' | 'demands' | 'allocations' | 'interviews' | 'tickets' | 'warranties' | 'domestic';
const MODEL: Record<SimpleEntity, string> = { visits: 'visit', demands: 'demandLetter', allocations: 'agencyAllocation', interviews: 'interview', tickets: 'travelRecord', warranties: 'warrantyCase', domestic: 'domesticCase' };

export async function deleteSimple(a: Actor, entity: SimpleEntity, id: number): Promise<Result> {
  return prisma.$transaction(async tx => {
    const model = (tx as any)[MODEL[entity]];
    const row = await model.findFirst({ where: { id, workspace: a.workspace } });
    if (!row) return fail({ _: 'Record not found.' });
    if (entity === 'domestic') { // never cascade-delete money or contract records from a case delete
      const [acc, pay, ref, con] = await Promise.all([tx.domesticAccount.count({ where: { caseId: id } }), tx.receivablePayment.count({ where: { domesticCaseId: id } }), tx.refundClaim.count({ where: { caseId: id } }), tx.contract.count({ where: { domesticCaseId: id } })]);
      if (acc + pay + ref + con) return fail({ _: 'This sponsor case has a fee agreement, payments, refund claims or contracts. Remove those first (finance users only).' });
    }
    await model.delete({ where: { id } });
    await log(tx, a, entity, row.code ?? '', '', `${entity} record ${row.code ?? '#' + id} deleted`);
    return { ok: true } as Result;
  });
}

/** Move a travel record, warranty case or domestic case one step along its V6 workflow. */
export async function advanceStatus(a: Actor, entity: 'tickets' | 'warranties' | 'domestic', id: number): Promise<Result> {
  const lists = { tickets: C.ticketSteps, warranties: C.warrantyStatuses, domestic: C.domesticStatuses } as const;
  const field = entity === 'tickets' ? 'step' : 'status';
  return prisma.$transaction(async tx => {
    const model = (tx as any)[MODEL[entity]];
    const row = await model.findFirst({ where: { id, workspace: a.workspace } });
    if (!row) return fail({ _: 'Record not found.' });
    const list = lists[entity] as readonly string[]; const i = list.findIndex(x => norm(x) === norm(row[field]));
    if (i < 0 || i >= list.length - 1) return fail({ _: 'Already at the last step.' });
    await model.update({ where: { id }, data: { [field]: list[i + 1] } });
    await log(tx, a, entity, row.code ?? '', '', `${row.code ?? entity + ' #' + id}: ${list[i]} → ${list[i + 1]}`);
    return { ok: true, code: row.code } as Result;
  });
}

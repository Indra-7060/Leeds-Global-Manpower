import 'server-only';
import { prisma } from '@/lib/db';
import { can, type RoleId, type Workspace } from '@/lib/config';
import { validateInput, type Errors } from '@/lib/forms';
import { canMove, previousStage } from '@/lib/domain/lifecycle';
import { candidateKey, candidatePrefix, canonicalCountry } from '@/lib/domain/rules';
import { isoToDate, norm } from '@/lib/util';
import type { Prisma } from '@/generated/prisma/client';

export interface Actor { workspace: Workspace; role: RoleId; userId: number }
export type Result = { ok: true; code?: string; warnings?: string[] } | { ok: false; errors: Errors };
export const fail = (errors: Errors): Result => ({ ok: false, errors });
export type Tx = Prisma.TransactionClient;

// ───────────── helpers ─────────────

/** Next running number for a code kind (atomic). Starts at `start` the first time. */
export async function nextNumber(tx: Tx, ws: Workspace, kind: string, start: number): Promise<number> {
  const row = await tx.counter.upsert({ where: { workspace_kind: { workspace: ws, kind } }, create: { workspace: ws, kind, next: start + 1 }, update: { next: { increment: 1 } } });
  return row.next - 1;
}
export async function log(tx: Tx, a: Actor, entity: string, recordCode: string, client: string, text: string) {
  await tx.activityLog.create({ data: { workspace: a.workspace, userId: a.userId, role: a.role, entity, recordCode, client, text } });
}
export async function findClient(tx: Tx, ws: Workspace, name: string) {
  return tx.client.findUnique({ where: { workspace_nameKey: { workspace: ws, nameKey: norm(name) } } });
}
export const d = (s: string | null | undefined) => isoToDate(s || null);

// ───────────── clients ─────────────

export async function saveClient(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = validateInput('clients', input, { editing: !!id });
  if (Object.keys(errors).length) return fail(errors);
  const nameKey = norm(clean.name);
  return prisma.$transaction(async tx => {
    const dup = await tx.client.findUnique({ where: { workspace_nameKey: { workspace: a.workspace, nameKey } } });
    if (dup && dup.id !== id) return fail({ name: 'A client with this name already exists.' });
    const data = { name: clean.name, nameKey, sector: clean.sector, stage: clean.stage, segment: clean.segment || 'Blue-Collar', nextAction: clean.next_action };
    if (id) {
      const before = await tx.client.findFirst({ where: { id, workspace: a.workspace } });
      if (!before) return fail({ _: 'Client not found.' });
      await tx.client.update({ where: { id }, data });
      await log(tx, a, 'clients', '', clean.name, before.name !== clean.name ? `Client renamed ${before.name} → ${clean.name}` : `Client ${clean.name} updated`);
    } else {
      await tx.client.create({ data: { ...data, workspace: a.workspace } });
      await log(tx, a, 'clients', '', clean.name, `Client ${clean.name} added`);
    }
    return { ok: true } as Result;
  });
}

export async function deleteClient(a: Actor, id: number): Promise<Result> {
  return prisma.$transaction(async tx => {
    const c = await tx.client.findFirst({ where: { id, workspace: a.workspace } });
    if (!c) return fail({ _: 'Client not found.' });
    const [o, cand, v, dl, vac, con, svc] = await Promise.all([tx.order.count({ where: { clientId: id } }), tx.candidate.count({ where: { clientId: id } }), tx.visit.count({ where: { clientId: id } }), tx.demandLetter.count({ where: { clientId: id } }),
      tx.corporateVacancy.count({ where: { clientId: id } }), tx.contract.count({ where: { clientId: id } }), tx.serviceFeeTerm.count({ where: { clientId: id } })]);
    const refs = [[o, 'order(s)'], [cand, 'candidate(s)'], [v, 'visit(s)'], [dl, 'demand letter(s)'], [vac, 'vacancy(ies)'], [con, 'contract(s)'], [svc, 'service-charge agreement(s)']].filter(x => x[0] as number);
    if (refs.length) return fail({ _: 'Client is used by ' + refs.map(x => `${x[0]} ${x[1]}`).join(', ') + '. Remove or reassign those first.' });
    await tx.client.delete({ where: { id } });
    await log(tx, a, 'clients', '', c.name, `Client ${c.name} deleted`);
    return { ok: true } as Result;
  });
}

// ───────────── orders ─────────────

export interface ImportRowMeta { file: string; row: number; key: string; code?: string }

export async function saveOrder(a: Actor, input: Record<string, unknown>, id?: number, meta?: ImportRowMeta): Promise<Result> {
  const { errors, clean } = validateInput('orders', input, { editing: !!id });
  if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client);
    if (!client) return fail({ client: 'Client not found — add it under Client CRM first.' });
    if (client.segment === 'Corporate') return fail({ client: 'This company is a Corporate-division client. Orders are for Blue-Collar clients — set its division to “Both” if it also hires blue-collar workers.' });
    const data = { clientId: client.id, country: canonicalCountry(clean.country), trade: clean.trade, qty: clean.qty as number, status: clean.status, agency: clean.agency };
    if (id) {
      const o = await tx.order.findFirst({ where: { id, workspace: a.workspace } });
      if (!o) return fail({ _: 'Order not found.' });
      await tx.order.update({ where: { id }, data });
      await log(tx, a, 'orders', o.code, client.name, `Order ${o.code} updated`);
      return { ok: true, code: o.code } as Result;
    }
    let code: string;
    if (meta?.code && !(await tx.order.findUnique({ where: { workspace_code: { workspace: a.workspace, code: meta.code } } }))) code = meta.code; // a code given in the imported sheet
    else do { code = 'ORD-' + (await nextNumber(tx, a.workspace, 'order', 1001)); } while (await tx.order.findUnique({ where: { workspace_code: { workspace: a.workspace, code } } }));
    await tx.order.create({ data: { ...data, workspace: a.workspace, code, importKey: meta?.key ?? null, sourceFile: meta?.file ?? null, sourceRow: meta?.row ?? null } });
    if (!meta) await log(tx, a, 'orders', code, client.name, `Order ${code} added`);
    return { ok: true, code } as Result;
  });
}

export async function deleteOrder(a: Actor, id: number): Promise<Result> {
  return prisma.$transaction(async tx => {
    const o = await tx.order.findFirst({ where: { id, workspace: a.workspace }, include: { client: true } });
    if (!o) return fail({ _: 'Order not found.' });
    const [c, al, dl] = await Promise.all([tx.candidate.count({ where: { orderId: id } }), tx.agencyAllocation.count({ where: { orderId: id } }), tx.demandLetter.count({ where: { orderId: id } })]);
    if (c || al || dl) return fail({ _: `Order is linked to ${c} candidate(s), ${al} allocation(s), ${dl} demand letter(s). Remove or unlink them first.` });
    await tx.order.delete({ where: { id } });
    await log(tx, a, 'orders', o.code, o.client.name, `Order ${o.code} deleted`);
    return { ok: true } as Result;
  });
}

// ───────────── candidates ─────────────

export async function saveCandidate(a: Actor, input: Record<string, unknown>, id?: number, meta?: ImportRowMeta): Promise<Result> {
  const { errors, clean } = validateInput('candidates', input, { editing: !!id });
  if (Object.keys(errors).length) return fail(errors);
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client);
    if (!client) return fail({ client: 'Client not found — add it under Client CRM first.' });
    const order = clean.order_id ? await tx.order.findUnique({ where: { workspace_code: { workspace: a.workspace, code: clean.order_id } }, include: { client: true } }) : null;
    if (clean.order_id && !order) return fail({ order_id: 'Order not found.' });
    const warnings: string[] = [];
    if (order && norm(order.client.name) !== norm(client.name)) warnings.push(`Order ${order.code} belongs to ${order.client.name}, not ${client.name}.`);
    const dupKey = candidateKey({ passport: clean.passport, name: clean.name, client: client.name });
    const dup = await tx.candidate.findUnique({ where: { workspace_dupKey: { workspace: a.workspace, dupKey } } });
    if (dup && dup.id !== id) return fail({ [clean.passport ? 'passport' : 'name']: `Duplicate of ${dup.code} (${clean.passport ? 'same passport' : 'same name and client'}).` });
    const data = { name: clean.name, passport: clean.passport, dupKey, clientId: client.id, orderId: order?.id ?? null, country: canonicalCountry(clean.country), agency: clean.agency, trade: clean.trade,
      visaNumber: clean.visa_number, qvcDate: d(clean.qvc_date), flightDate: d(clean.flight_date) };
    if (id) {
      const c = await tx.candidate.findFirst({ where: { id, workspace: a.workspace } });
      if (!c) return fail({ _: 'Candidate not found.' });
      await tx.candidate.update({ where: { id }, data });
      await log(tx, a, 'candidates', c.code, client.name, `Candidate ${c.code} ${clean.name} updated`);
      return { ok: true, code: c.code, warnings } as Result;
    }
    let code: string;
    do { code = candidatePrefix(clean.country) + '-' + (await nextNumber(tx, a.workspace, 'candidate', 1001)); } while (await tx.candidate.findUnique({ where: { workspace_code: { workspace: a.workspace, code } } }));
    const created = await tx.candidate.create({ data: { ...data, workspace: a.workspace, code, status: clean.status || 'CV Submitted', sourceFile: meta?.file ?? null, sourceRow: meta?.row ?? null } });
    await tx.candidateStage.create({ data: { candidateId: created.id, stage: created.status, byRole: a.role } });
    if (!meta) await log(tx, a, 'candidates', code, client.name, `Candidate ${code} ${clean.name} added`);
    return { ok: true, code, warnings } as Result;
  });
}

export async function deleteCandidate(a: Actor, id: number): Promise<Result> {
  return prisma.$transaction(async tx => {
    const c = await tx.candidate.findFirst({ where: { id, workspace: a.workspace }, include: { client: true } });
    if (!c) return fail({ _: 'Candidate not found.' });
    await tx.candidate.delete({ where: { id } }); // stage history + travel record cascade; warranty links are cleared
    await log(tx, a, 'candidates', c.code, c.client.name, `Candidate ${c.code} ${c.name} deleted`);
    return { ok: true } as Result;
  });
}

/** Stage change — only moves allowed by the lifecycle (next / skip optional / reject). */
export async function moveCandidate(a: Actor, id: number, to: string): Promise<Result> {
  return prisma.$transaction(async tx => {
    const c = await tx.candidate.findFirst({ where: { id, workspace: a.workspace }, include: { client: true } });
    if (!c) return fail({ _: 'Candidate not found.' });
    if (!canMove(c.status, to)) return fail({ _: `Not allowed: ${c.status} → ${to}.` });
    await tx.candidate.update({ where: { id }, data: { status: to } });
    await tx.candidateStage.create({ data: { candidateId: id, stage: to, byRole: a.role } });
    await log(tx, a, 'candidates', c.code, c.client.name, `${c.code} ${c.name}: ${c.status} → ${to}`);
    return { ok: true, code: c.code } as Result;
  });
}

/** Correct a wrong stage: return to the previous one (Managing Director / Admin Manager only). */
export async function undoCandidate(a: Actor, id: number): Promise<Result> {
  if (!can(a.role, 'stage.undo')) return fail({ _: 'Only the Managing Director or Admin Manager can correct a stage.' });
  return prisma.$transaction(async tx => {
    const c = await tx.candidate.findFirst({ where: { id, workspace: a.workspace }, include: { client: true, history: { orderBy: { id: 'asc' } } } });
    if (!c) return fail({ _: 'Candidate not found.' });
    const prev = previousStage(c.history.map(h => h.stage));
    if (!prev) return fail({ _: 'No earlier stage to return to.' });
    await tx.candidateStage.delete({ where: { id: c.history[c.history.length - 1].id } });
    await tx.candidate.update({ where: { id }, data: { status: prev } });
    await log(tx, a, 'candidates', c.code, c.client.name, `${c.code} ${c.name}: stage corrected ${c.status} → ${prev}`);
    return { ok: true, code: c.code } as Result;
  });
}

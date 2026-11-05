import 'server-only';
import { prisma } from '@/lib/db';
import { C, can } from '@/lib/config';
import { validateInput } from '@/lib/forms';
import { canonicalCountry } from '@/lib/domain/rules';
import { norm } from '@/lib/util';
import { fail, log, type Actor, type Result } from './mutations';

/** Agency register, contract archive and editable lists (second batch of V8 write functions). */

// ───────────── overseas agency register ─────────────
export async function saveAgency(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = validateInput('agencyRecords', input, { editing: !!id });
  if (Object.keys(errors).length) return fail(errors);
  const nameKey = norm(clean.name);
  return prisma.$transaction(async tx => {
    const dup = await tx.agency.findUnique({ where: { workspace_nameKey: { workspace: a.workspace, nameKey } } });
    if (dup && dup.id !== id) return fail({ name: 'An agency with this name is already registered.' });
    const data = { name: clean.name, nameKey, country: clean.country ? canonicalCountry(clean.country) : '', contact: clean.contact, phone: clean.phone, email: clean.email, notes: clean.notes };
    if (id) {
      const x = await tx.agency.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Agency not found.' });
      await tx.agency.update({ where: { id }, data }); await log(tx, a, 'agencies', '', '', `Agency ${x.name} updated`);
    } else { await tx.agency.create({ data: { ...data, workspace: a.workspace } }); await log(tx, a, 'agencies', '', '', `Agency ${clean.name} registered`); }
    return { ok: true } as Result;
  });
}

export async function deleteAgency(a: Actor, id: number): Promise<Result> {
  return prisma.$transaction(async tx => {
    const x = await tx.agency.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Agency not found.' });
    const [al, ca, or] = await Promise.all([tx.agencyAllocation.count({ where: { workspace: a.workspace, agency: x.name } }), tx.candidate.count({ where: { workspace: a.workspace, agency: x.name } }), tx.order.count({ where: { workspace: a.workspace, agency: x.name } })]);
    const refs = [[al, 'allocation(s)'], [ca, 'candidate(s)'], [or, 'order(s)']].filter(r => r[0] as number);
    if (refs.length) return fail({ _: `${x.name} is used by ${refs.map(r => `${r[0]} ${r[1]}`).join(', ')}. Change those first.` });
    await tx.agency.delete({ where: { id } }); await log(tx, a, 'agencies', '', '', `Agency ${x.name} removed from the register`);
    return { ok: true } as Result;
  });
}

// ───────────── contract archive (never a delete) ─────────────
export async function setContractArchived(a: Actor, id: number, archived: boolean): Promise<Result> {
  if (!can(a.role, 'contracts.manage')) return fail({ _: 'Contracts are managed by the Managing Director and Admin Manager.' });
  return prisma.$transaction(async tx => {
    const c = await tx.contract.findFirst({ where: { id, workspace: a.workspace } }); if (!c) return fail({ _: 'Contract not found.' });
    await tx.contract.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await log(tx, a, 'contracts', c.code, '', `Contract ${c.code} ${archived ? 'archived (files kept)' : 'restored from the archive'}`);
    return { ok: true, code: c.code } as Result;
  });
}

// ───────────── editable lists ─────────────
export const LIST_KINDS = { domesticCategory: { label: 'Domestic worker category', base: C.v8.domesticCategories }, jobCategory: { label: 'Corporate job category', base: C.v8.jobCategories } } as const;
export type ListKind = keyof typeof LIST_KINDS;

export async function addListItem(a: Actor, kind: string, value: string): Promise<Result> {
  if (!can(a.role, 'lists.manage')) return fail({ _: 'Only the Managing Director or Admin Manager can edit these lists.' });
  if (!(kind in LIST_KINDS)) return fail({ _: 'Unknown list.' });
  const v = value.trim().replace(/\s+/g, ' ');
  if (v.length < 2 || v.length > 60) return fail({ _: 'Enter 2–60 characters.' });
  if ((LIST_KINDS[kind as ListKind].base as readonly string[]).some(x => norm(x) === norm(v))) return fail({ _: `“${v}” is already in the standard list.` });
  return prisma.$transaction(async tx => {
    const exists = (await tx.listItem.findMany({ where: { workspace: a.workspace, kind } })).some(x => norm(x.value) === norm(v));
    if (exists) return fail({ _: `“${v}” is already in the list.` });
    await tx.listItem.create({ data: { workspace: a.workspace, kind, value: v } });
    await log(tx, a, 'lists', '', '', `${LIST_KINDS[kind as ListKind].label} “${v}” added`);
    return { ok: true } as Result;
  });
}

export async function deleteListItem(a: Actor, id: number): Promise<Result> {
  if (!can(a.role, 'lists.manage')) return fail({ _: 'Only the Managing Director or Admin Manager can edit these lists.' });
  return prisma.$transaction(async tx => {
    const x = await tx.listItem.findFirst({ where: { id, workspace: a.workspace } }); if (!x) return fail({ _: 'Item not found.' });
    await tx.listItem.delete({ where: { id } }); await log(tx, a, 'lists', '', '', `List item “${x.value}” removed (existing records keep their value)`);
    return { ok: true } as Result;
  });
}

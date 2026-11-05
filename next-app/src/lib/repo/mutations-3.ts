import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { C, can, type RoleId } from '@/lib/config';
import { validateInput } from '@/lib/forms';
import { canonicalCountry, looksLikeSecret } from '@/lib/domain/rules';
import { norm } from '@/lib/util';
import { d, fail, findClient, log, type Actor, type Result } from './mutations';
import { clearWorkspaceData, seedDemoWorkspace } from './seed';

const NO_FINANCE = 'Finance is restricted to the Managing Director and Admin Manager.';
const NO_CLIENT = 'Client not found — add it under Client CRM first.';

// ───────────── finance (permission is checked HERE, not only in the UI) ─────────────
export interface ImportMeta { file: string; row: number; key: string }

export async function saveFinance(a: Actor, input: Record<string, unknown>, id?: number, meta?: ImportMeta): Promise<Result> {
  if (!can(a.role, 'finance.view')) return fail({ _: NO_FINANCE });
  const { errors, clean } = validateInput('finance', input, { editing: !!id });
  if (Object.keys(errors).length) return fail(errors);
  const data = { date: d(clean.date)!, division: clean.division, direction: clean.direction, account: clean.account, party: clean.party, client: clean.client, country: clean.country ? canonicalCountry(clean.country) : '',
    orderRef: clean.order, category: clean.category, amount: clean.amount as number, ref: clean.ref, note: clean.note };
  return prisma.$transaction(async tx => {
    if (id) {
      if (!(await tx.financeEntry.findFirst({ where: { id, workspace: a.workspace } }))) return fail({ _: 'Transaction not found.' });
      await tx.financeEntry.update({ where: { id }, data });
      await log(tx, a, 'finance', '', clean.client, `Transaction ${clean.date} ${clean.party} updated`);
    } else {
      await tx.financeEntry.create({ data: { ...data, workspace: a.workspace, importKey: meta?.key ?? null, sourceFile: meta?.file ?? null, sourceRow: meta?.row ?? null } });
      if (!meta) await log(tx, a, 'finance', '', clean.client, `${clean.direction} ${clean.amount} ${clean.category} (${clean.party})`);
    }
    return { ok: true } as Result;
  });
}

export async function deleteFinance(a: Actor, id: number): Promise<Result> {
  if (!can(a.role, 'finance.view')) return fail({ _: NO_FINANCE });
  return prisma.$transaction(async tx => {
    const f = await tx.financeEntry.findFirst({ where: { id, workspace: a.workspace } });
    if (!f) return fail({ _: 'Transaction not found.' });
    await tx.financeEntry.delete({ where: { id } });
    await log(tx, a, 'finance', '', f.client, `Transaction ${f.party} ${f.amount} deleted`);
    return { ok: true } as Result;
  });
}

export async function clearFinance(a: Actor): Promise<Result> {
  if (!can(a.role, 'finance.view')) return fail({ _: NO_FINANCE });
  return prisma.$transaction(async tx => {
    const n = await tx.financeEntry.deleteMany({ where: { workspace: a.workspace } });
    await log(tx, a, 'finance', '', '', `All finance entries cleared (${n.count})`);
    return { ok: true } as Result;
  });
}

// ───────────── credentials register (descriptions only) ─────────────
export async function saveCredential(a: Actor, input: Record<string, unknown>, id?: number): Promise<Result> {
  const { errors, clean } = validateInput('credentials', input, { editing: !!id });
  if (Object.keys(errors).length) return fail(errors);
  if (looksLikeSecret(`${clean.record} ${clean.portal}`)) return fail({ record: 'Do not store passwords or secrets here — describe the record only.' });
  return prisma.$transaction(async tx => {
    const client = await findClient(tx, a.workspace, clean.client); if (!client) return fail({ client: NO_CLIENT });
    const data = { clientId: client.id, portal: clean.portal, record: clean.record, access: 'Authorized only' };
    if (id) {
      if (!(await tx.credentialRecord.findFirst({ where: { id, workspace: a.workspace } }))) return fail({ _: 'Record not found.' });
      await tx.credentialRecord.update({ where: { id }, data });
    } else await tx.credentialRecord.create({ data: { ...data, workspace: a.workspace } });
    await log(tx, a, 'credentials', '', client.name, `Credential record for ${client.name} (${clean.portal}) ${id ? 'updated' : 'added'}`);
    return { ok: true } as Result;
  });
}
export async function deleteCredential(a: Actor, id: number): Promise<Result> {
  return prisma.$transaction(async tx => {
    const r = await tx.credentialRecord.findFirst({ where: { id, workspace: a.workspace }, include: { client: true } });
    if (!r) return fail({ _: 'Record not found.' });
    await tx.credentialRecord.delete({ where: { id } });
    await log(tx, a, 'credentials', '', r.client.name, `Credential record for ${r.client.name} deleted`);
    return { ok: true } as Result;
  });
}

// ───────────── CV intake ─────────────
export interface CvItemInput { filename: string; size: number; type: string; source: string; client: string; agency: string; country: string; note: string; extractedEmail: string; extractedPhone: string; preview: string }

/** Adds intake records; a file with the same name and size already received is skipped. */
export async function addCvItems(a: Actor, items: CvItemInput[]): Promise<{ added: number; skipped: number }> {
  let added = 0, skipped = 0;
  await prisma.$transaction(async tx => {
    for (const it of items) {
      if (await tx.cvIntakeItem.findFirst({ where: { workspace: a.workspace, filename: it.filename, size: it.size } })) { skipped++; continue; }
      await tx.cvIntakeItem.create({ data: { ...it, workspace: a.workspace, source: C.cvSources.includes(it.source) ? it.source : 'Direct upload' } }); added++;
    }
    if (added) await log(tx, a, 'cvInbox', '', items[0]?.client ?? '', `CV intake: ${added} file record(s) added`);
  });
  return { added, skipped };
}
export async function setCvStatus(a: Actor, id: number, status: string): Promise<Result> {
  if (!C.cvStatuses.includes(status)) return fail({ _: 'Unknown status.' });
  const row = await prisma.cvIntakeItem.findFirst({ where: { id, workspace: a.workspace } });
  if (!row) return fail({ _: 'Record not found.' });
  await prisma.cvIntakeItem.update({ where: { id }, data: { status } });
  return { ok: true };
}
export async function deleteCvItem(a: Actor, id: number): Promise<Result> {
  const row = await prisma.cvIntakeItem.findFirst({ where: { id, workspace: a.workspace } });
  if (!row) return fail({ _: 'Record not found.' });
  await prisma.cvIntakeItem.delete({ where: { id } });
  return { ok: true };
}

// ───────────── users ─────────────
const MIN_PW = 10;
const pwError = (pw: string) => (pw.length < MIN_PW ? `Use at least ${MIN_PW} characters.` : '');

export async function createUser(a: Actor, input: { email: string; name: string; role: string; password: string }): Promise<Result> {
  if (!can(a.role, 'users.manage')) return fail({ _: 'Only the Managing Director can manage users.' });
  const email = input.email.trim().toLowerCase(), name = input.name.trim();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) return fail({ email: 'Enter a valid e-mail address.' });
  if (!name) return fail({ name: 'Name is required.' });
  if (!C.roles.some(r => r.id === input.role)) return fail({ role: 'Choose a role.' });
  if (pwError(input.password)) return fail({ password: pwError(input.password) });
  if (await prisma.user.findUnique({ where: { email } })) return fail({ email: 'An account with this e-mail already exists.' });
  await prisma.user.create({ data: { email, name, role: input.role, passwordHash: await bcrypt.hash(input.password, 10) } });
  await prisma.activityLog.create({ data: { workspace: a.workspace, userId: a.userId, role: a.role, entity: 'users', text: `User ${email} (${input.role}) created` } });
  return { ok: true };
}

export async function setUserActive(a: Actor, id: number, active: boolean): Promise<Result> {
  if (!can(a.role, 'users.manage')) return fail({ _: 'Only the Managing Director can manage users.' });
  if (id === a.userId && !active) return fail({ _: 'You cannot disable your own account.' });
  const u = await prisma.user.findUnique({ where: { id } }); if (!u) return fail({ _: 'User not found.' });
  if (!active && u.role === 'md' && (await prisma.user.count({ where: { role: 'md', active: true, NOT: { id } } })) === 0) return fail({ _: 'At least one active Managing Director is required.' });
  await prisma.user.update({ where: { id }, data: { active } });
  await prisma.activityLog.create({ data: { workspace: a.workspace, userId: a.userId, role: a.role, entity: 'users', text: `User ${u.email} ${active ? 'enabled' : 'disabled'}` } });
  return { ok: true };
}

export async function resetUserPassword(a: Actor, id: number, password: string): Promise<Result> {
  if (!can(a.role, 'users.manage')) return fail({ _: 'Only the Managing Director can manage users.' });
  if (pwError(password)) return fail({ password: pwError(password) });
  const u = await prisma.user.findUnique({ where: { id } }); if (!u) return fail({ _: 'User not found.' });
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await prisma.activityLog.create({ data: { workspace: a.workspace, userId: a.userId, role: a.role, entity: 'users', text: `Password reset for ${u.email}` } });
  return { ok: true };
}

export async function changeOwnPassword(a: Actor, current: string, next: string): Promise<Result> {
  const u = await prisma.user.findUnique({ where: { id: a.userId } }); if (!u) return fail({ _: 'User not found.' });
  if (!(await bcrypt.compare(current, u.passwordHash))) return fail({ current: 'Current password is incorrect.' });
  if (pwError(next)) return fail({ password: pwError(next) });
  if (norm(next) === norm(current)) return fail({ password: 'Choose a different password.' });
  await prisma.user.update({ where: { id: a.userId }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true };
}

// ───────────── workspace tools ─────────────
export async function resetDemo(a: Actor): Promise<Result> {
  if (!can(a.role, 'data.reset')) return fail({ _: 'Only the Managing Director or Admin Manager can reset data.' });
  if (a.workspace !== 'demo') return fail({ _: 'Reset is only available in the DEMO workspace.' });
  await seedDemoWorkspace(prisma);
  await prisma.activityLog.create({ data: { workspace: 'demo', userId: a.userId, role: a.role, entity: 'system', text: 'Demo data reset to the original fictional sample' } });
  return { ok: true };
}

export async function clearWorkspace(a: Actor): Promise<Result> {
  if (!can(a.role, 'data.reset')) return fail({ _: 'Only the Managing Director or Admin Manager can clear data.' });
  await clearWorkspaceData(prisma, a.workspace);
  await prisma.activityLog.create({ data: { workspace: a.workspace, userId: a.userId, role: a.role, entity: 'system', text: 'Workspace cleared' } });
  return { ok: true };
}

export const ROLE_IDS: RoleId[] = ['md', 'nitija', 'staff'];

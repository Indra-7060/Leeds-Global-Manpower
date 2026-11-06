import 'server-only';
import { prisma } from '@/lib/db';
import { can } from '@/lib/config';
import { MODULES, LEVELS, LEVEL_LABEL, ROLES, buildMatrix, ceiling, modulesForEntity, rank, type Level, type Matrix, type Role } from '@/lib/access-config';
import { fail, log, type Actor, type Result } from './mutations';

/** Level-wise access, read from the database (defaults from src/lib/access-config.ts where nothing is stored). */
export async function loadMatrix(role: Role): Promise<Matrix> {
  if (role === 'md') return buildMatrix('md');
  const rows = await prisma.roleAccess.findMany({ where: { role } });
  return buildMatrix(role, Object.fromEntries(rows.filter(r => (LEVELS as string[]).includes(r.level)).map(r => [r.module, r.level as Level])));
}
export async function loadAllMatrices(): Promise<Record<Role, Matrix>> {
  const rows = await prisma.roleAccess.findMany();
  const by = (role: Role) => buildMatrix(role, Object.fromEntries(rows.filter(r => r.role === role && (LEVELS as string[]).includes(r.level)).map(r => [r.module, r.level as Level])));
  return { md: by('md'), nitija: by('nitija'), staff: by('staff') };
}

/** null = allowed, otherwise the message to show. `need` is the level the action requires (edit = add/edit, full = delete). */
export async function accessError(role: Role, target: { entity?: string; module?: string }, need: Level): Promise<string | null> {
  const ids = target.module ? [target.module] : modulesForEntity(target.entity ?? '');
  if (!ids.length) return null; // record types without a module (none exist today) fall back to the permission checks inside the write functions
  const m = await loadMatrix(role);
  if (ids.some(id => rank(m[id] ?? 'none') >= rank(need))) return null;
  const label = MODULES.find(x => x.id === ids[0])?.label ?? ids[0];
  const have = m[ids[0]] ?? 'none';
  return have === 'none' ? `Your role has no access to “${label}”.` : `Your role has “${LEVEL_LABEL[have]}” access to “${label}” — ${need === 'full' ? 'deleting needs full access' : 'adding or changing records needs edit access'}.`;
}

/** Managing Director only. Cannot touch the Managing Director's own row and cannot exceed a role's hard ceiling (e.g. staff + finance). */
export async function setAccess(a: Actor, role: Role, moduleId: string, level: Level): Promise<Result> {
  if (!can(a.role, 'users.manage')) return fail({ _: 'Only the Managing Director can change roles and access.' });
  if (!ROLES.some(r => r.id === role) || role === 'md') return fail({ _: 'The Managing Director always has full access.' });
  const m = MODULES.find(x => x.id === moduleId); if (!m || !(LEVELS as string[]).includes(level)) return fail({ _: 'Unknown module or level.' });
  if (rank(level) > rank(ceiling(role, m))) return fail({ _: `${ROLES.find(r => r.id === role)!.label} can never have access to “${m.label}” — money and contract data is limited to the Managing Director and Admin Manager.` });
  return prisma.$transaction(async tx => {
    await tx.roleAccess.upsert({ where: { role_module: { role, module: moduleId } }, create: { role, module: moduleId, level }, update: { level } });
    await log(tx, a, 'access', '', '', `Access for ${role} on “${m.label}” set to ${LEVEL_LABEL[level]}`);
    return { ok: true } as Result;
  });
}

export async function resetAccess(a: Actor, role: Role): Promise<Result> {
  if (!can(a.role, 'users.manage')) return fail({ _: 'Only the Managing Director can change roles and access.' });
  if (role === 'md') return fail({ _: 'Nothing to reset for the Managing Director.' });
  return prisma.$transaction(async tx => { await tx.roleAccess.deleteMany({ where: { role } }); await log(tx, a, 'access', '', '', `Access for ${role} reset to the standard levels`); return { ok: true } as Result; });
}

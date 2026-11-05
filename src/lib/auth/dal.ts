import 'server-only';
import { redirect } from 'next/navigation';
import { can, type Workspace } from '@/lib/config';
import { prisma } from '@/lib/db';
import { getWorkspace, readSession, type Session } from './session';

export interface Ctx { user: Session; ws: Workspace }

/** Every page and server action starts here. Re-checks the user in the database, so a disabled account loses access at once. */
export async function requireUser(): Promise<Ctx> {
  const s = await readSession();
  if (!s) redirect('/login');
  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, active: true, role: true, name: true, email: true } });
  if (!u || !u.active) redirect('/login');
  return { user: { userId: u.id, role: u.role as Session['role'], name: u.name, email: u.email }, ws: await getWorkspace() };
}

/** Server-side permission check (the UI also hides things, but THIS is what protects the data). */
export async function requirePermission(perm: string): Promise<Ctx> {
  const ctx = await requireUser();
  if (!can(ctx.user.role, perm)) redirect('/?denied=' + encodeURIComponent(perm));
  return ctx;
}

/** For route handlers: the verified, active user (or null → respond 401). Never redirects. */
export async function apiUser(): Promise<Ctx | null> {
  const s = await readSession();
  if (!s) return null;
  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, active: true, role: true, name: true, email: true } });
  if (!u || !u.active) return null;
  return { user: { userId: u.id, role: u.role as Session['role'], name: u.name, email: u.email }, ws: await getWorkspace() };
}

'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { createSession, destroySession } from '@/lib/auth/session';
import type { RoleId } from '@/lib/config';

export interface LoginState { error?: string }

// A fixed dummy hash so unknown e-mails cost the same time as wrong passwords (no account-existence leak).
const DUMMY = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.zqF5lH0b9Qw1yZ8rGJ2cWkq0KZ6a';

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your e-mail and password.' };
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !user.active || !ok) return { error: 'E-mail or password is incorrect.' };
  await createSession({ userId: user.id, role: user.role as RoleId, name: user.name, email: user.email });
  redirect('/');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

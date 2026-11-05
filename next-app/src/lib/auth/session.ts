import 'server-only';
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import type { RoleId, Workspace } from '@/lib/config';

const COOKIE = 'lgm_session';
const WS_COOKIE = 'lgm_ws';
const MAX_AGE = 60 * 60 * 8; // 8 hours

export interface Session { userId: number; role: RoleId; name: string; email: string }

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters (see .env.example).');
  return new TextEncoder().encode(secret);
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ role: s.role, name: s.name, email: s.email })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(s.userId)).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return { userId: Number(payload.sub), role: payload.role as RoleId, name: String(payload.name), email: String(payload.email) };
  } catch { return null; }
}

export async function destroySession() { (await cookies()).delete(COOKIE); }

export async function getWorkspace(): Promise<Workspace> {
  const v = (await cookies()).get(WS_COOKIE)?.value;
  return v === 'live' ? 'live' : 'demo';
}
export async function setWorkspace(ws: Workspace) {
  (await cookies()).set(WS_COOKIE, ws, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
}

export const SESSION_COOKIE = COOKIE;

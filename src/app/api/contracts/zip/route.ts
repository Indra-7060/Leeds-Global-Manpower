import { NextResponse, type NextRequest } from 'next/server';
import { apiUser } from '@/lib/auth/dal';
import { accessError } from '@/lib/repo/access';
import { zipContracts } from '@/lib/repo/contracts';

export const runtime = 'nodejs';

/** GET ?client=<id> | ?case=<id> | ?division=<labour|domestic|corporate> → ZIP of every version of the matching contracts. */
export async function GET(req: NextRequest) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  { const denied = await accessError(ctx.user.role, { module: 'contracts' }, 'view'); if (denied) return NextResponse.json({ error: denied }, { status: 403 }); }
  const p = req.nextUrl.searchParams, n = (k: string) => (p.get(k) && Number.isInteger(Number(p.get(k))) ? Number(p.get(k)) : undefined);
  const r = await zipContracts({ workspace: ctx.ws, role: ctx.user.role, userId: ctx.user.userId }, { clientId: n('client'), caseId: n('case'), division: p.get('division') || undefined });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return new NextResponse(new Uint8Array(r.buf), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${r.name}"`, 'Cache-Control': 'no-store', 'X-Row-Count': String(r.files) } });
}

import { NextResponse, type NextRequest } from 'next/server';
import { apiUser } from '@/lib/auth/dal';
import { readContractVersion } from '@/lib/repo/contracts';

export const runtime = 'nodejs';

/** GET ?version=<id> → the exact original file bytes (checksum-verified, audit-logged). */
export async function GET(req: NextRequest) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('version'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Missing version.' }, { status: 400 });
  const r = await readContractVersion({ workspace: ctx.ws, role: ctx.user.role, userId: ctx.user.userId }, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return new NextResponse(new Uint8Array(r.buf), {
    headers: { 'Content-Type': r.mime, 'Content-Disposition': `attachment; filename="${r.filename.replace(/"/g, '')}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

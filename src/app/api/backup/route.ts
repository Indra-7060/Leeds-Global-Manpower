import { NextResponse } from 'next/server';
import { apiUser } from '@/lib/auth/dal';
import { can } from '@/lib/config';
import { loadState } from '@/lib/repo/state';
import { todayISO } from '@/lib/util';

export const runtime = 'nodejs';

/** JSON export of the current workspace (a readable copy of the records). Real backups are database dumps — see Settings & Data. */
export async function GET() {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  if (!can(ctx.user.role, 'data.backup')) return NextResponse.json({ error: 'Only the Managing Director or Admin Manager can export workspace data.' }, { status: 403 });
  const state = await loadState(ctx.ws);
  const body = JSON.stringify({ app: 'LGM-ERP-Next', workspace: ctx.ws, exportedAt: new Date().toISOString(), exportedBy: ctx.user.email, data: state }, null, 1);
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="LGM_${ctx.ws.toUpperCase()}_EXPORT_${todayISO()}.json"`, 'Cache-Control': 'no-store' } });
}

import { NextResponse, type NextRequest } from 'next/server';
import { apiUser } from '@/lib/auth/dal';
import { keywordReport, runReport } from '@/lib/domain/reports';
import { toCsv } from '@/lib/io/csv';
import { loadState } from '@/lib/repo/state';
import { todayISO } from '@/lib/util';

export const runtime = 'nodejs';

/** GET ?report=<name>[&client=&country=&stage=]  or  ?q=<keyword request>. Finance reports are permission-checked inside runReport(). */
export async function GET(req: NextRequest) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const state = await loadState(ctx.ws);
  const res = p.get('q') != null ? keywordReport(p.get('q') ?? '', state, ctx.user.role)
    : runReport(p.get('report') ?? '', state, { client: p.get('client') ?? 'All', country: p.get('country') ?? 'All', stage: p.get('stage') ?? 'All', today: todayISO() }, ctx.user.role);
  const division = p.get('division');
  if (division && division !== 'all') res.rows = res.rows.filter(x => x.division === division);
  if (res.error) return NextResponse.json({ error: res.error }, { status: /restricted/.test(res.error) ? 403 : 400 });
  if (!res.rows.length) return NextResponse.json({ error: `No matching records for "${res.name}". Change the filters or add records.` }, { status: 404 });
  const base = res.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return new NextResponse('﻿' + toCsv(res.columns, res.rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="LGM_${ctx.ws.toUpperCase()}_${base}_${todayISO()}.csv"`, 'Cache-Control': 'no-store', 'X-Row-Count': String(res.rows.length) },
  });
}

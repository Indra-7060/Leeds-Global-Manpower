import { NextResponse, type NextRequest } from 'next/server';
import { apiUser } from '@/lib/auth/dal';
import { can } from '@/lib/config';
import { FIELDS, REQUIRED, guessMapping, problemRows, type Target } from '@/lib/domain/importer';
import { stringifyCsv } from '@/lib/io/csv';
import { readTable } from '@/lib/io/readTable';
import { accessError } from '@/lib/repo/access';
import { analyseUpload, commitImport } from '@/lib/repo/import';

export const runtime = 'nodejs';
const TARGETS = ['candidates', 'orders', 'finance'] as const;
const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/**
 * POST multipart: file, mode = parse | analyse | commit | problems, target, sheet, mapping (JSON).
 * The browser keeps the file and re-sends it each step, so nothing is held on the server between steps.
 */
export async function POST(req: NextRequest) {
  const ctx = await apiUser();
  if (!ctx) return err('Please sign in again.', 401);
  { const denied = await accessError(ctx.user.role, { module: 'import' }, 'edit'); if (denied) return err(denied, 403); }
  const form = await req.formData();
  const file = form.get('file'), mode = String(form.get('mode') ?? 'parse'), target = String(form.get('target') ?? 'candidates') as Target;
  if (!(file instanceof File)) return err('Choose a file first.');
  if (!TARGETS.includes(target)) return err('Unknown destination.');
  if (target === 'finance' && !can(ctx.user.role, 'finance.import')) return err('Finance import is restricted to the Managing Director and Admin Manager.', 403);
  const actor = { workspace: ctx.ws, role: ctx.user.role, userId: ctx.user.userId };

  let table;
  try { table = await readTable(file.name, Buffer.from(await file.arrayBuffer()), Number(form.get('sheet') ?? 0)); }
  catch (e) { return err((e as Error).message); }

  if (mode === 'parse') {
    return NextResponse.json({ fileName: file.name, columns: table.columns, preview: table.rows.slice(0, 5), rowCount: table.rows.length, sheetNames: table.sheetNames, sheetIndex: table.sheetIndex,
      truncated: table.truncated, mapping: guessMapping(target, table.columns), fields: FIELDS[target], required: REQUIRED[target] });
  }

  let mapping: Record<string, string>;
  try { mapping = JSON.parse(String(form.get('mapping') ?? '{}')); } catch { return err('Invalid column mapping.'); }
  const missing = REQUIRED[target].filter(f => mapping[f] === '' || mapping[f] == null);
  if (missing.length) return err('Map the required columns first: ' + missing.join(', ').replace(/_/g, ' '));

  let analysis;
  try { analysis = await analyseUpload(actor, target, table.rows, mapping); } catch (e) { return err((e as Error).message, 403); }

  if (mode === 'problems') {
    return new NextResponse('﻿' + stringifyCsv(problemRows(analysis)), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="LGM_import_problems_${target}.csv"` } });
  }
  if (mode === 'analyse') {
    return NextResponse.json({ target, total: analysis.total, valid: analysis.valid.length, duplicates: analysis.duplicates.length, invalid: analysis.invalid.length, newClients: analysis.newClients,
      warnings: analysis.valid.filter(v => v.warnings.length).length, problems: [...analysis.invalid.map(x => ({ row: x.row, kind: 'Rejected', reason: x.errors.join('; ') })), ...analysis.duplicates.map(x => ({ row: x.row, kind: 'Duplicate', reason: x.reason }))].sort((p, q) => p.row - q.row).slice(0, 100) });
  }
  if (mode === 'commit') {
    if (!analysis.valid.length) return err('There are no valid rows to import.');
    return NextResponse.json(await commitImport(actor, analysis, file.name));
  }
  return err('Unknown mode.');
}

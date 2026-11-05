import 'server-only';
import { prisma } from '@/lib/db';
import { C } from '@/lib/config';
import { analyse, mapRows, type Analysis, type Target } from '@/lib/domain/importer';
import { norm } from '@/lib/util';
import { loadState } from './state';
import { log, saveCandidate, saveOrder, type Actor } from './mutations';
import { saveFinance } from './mutations-3';

/** Dry run against the current workspace data. Nothing is written. */
export async function analyseUpload(a: Actor, target: Target, rows: string[][], mapping: Record<string, string>): Promise<Analysis> {
  const state = await loadState(a.workspace);
  return analyse(target, mapRows(target, rows, mapping), state, a.role);
}

export interface CommitResult { added: number; duplicates: number; invalid: number; newClients: number; problems: { row: number; errors: string[] }[] }

/** Writes the rows that passed analysis. Missing clients are created as Prospects first; every row goes through the normal save rules. */
export async function commitImport(a: Actor, analysis: Analysis, fileName: string): Promise<CommitResult> {
  const result: CommitResult = { added: 0, duplicates: analysis.duplicates.length, invalid: analysis.invalid.length, newClients: 0, problems: [] };
  for (const name of analysis.newClients) {
    const nameKey = norm(name);
    if (await prisma.client.findUnique({ where: { workspace_nameKey: { workspace: a.workspace, nameKey } } })) continue;
    await prisma.client.create({ data: { workspace: a.workspace, name, nameKey, stage: 'Prospect', nextAction: 'Complete client details' } });
    result.newClients++;
  }
  for (const v of analysis.valid) {
    const meta = { file: fileName, row: v.row, key: v.key, code: v.code };
    const res = analysis.target === 'candidates' ? await saveCandidate(a, v.input, undefined, meta)
      : analysis.target === 'orders' ? await saveOrder(a, v.input, undefined, meta) : await saveFinance(a, v.input, undefined, meta);
    if (res.ok) result.added++; else { result.invalid++; result.problems.push({ row: v.row, errors: Object.values(res.errors) }); }
  }
  await prisma.$transaction(async tx => {
    await tx.importRecord.create({ data: { workspace: a.workspace, file: fileName, target: analysis.target, added: result.added, duplicates: result.duplicates, invalid: result.invalid, role: a.role } });
    await log(tx, a, 'import', '', '', `Import ${fileName}: ${result.added} added, ${result.duplicates} duplicate(s) skipped, ${result.invalid} rejected (${analysis.target})${result.newClients ? `, ${result.newClients} new client(s)` : ''}`);
  });
  return result;
}

export const IMPORT_LIMIT = C.importMaxRows;

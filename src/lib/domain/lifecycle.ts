/** Candidate lifecycle — V6 stage order, optional-stage skipping, Reject (ASSUMPTION OQ-1). Pure functions. */
import { C } from '../config';
import { norm } from '../util';

const S = C.stages;
export interface Move { to: string; kind: 'next' | 'skip' | 'reject'; label: string }

export const index = (s: string) => S.indexOf(s);
export const canonical = (v: unknown): string | null => { const t = norm(v); return [...S, C.rejectedStage].find(s => norm(s) === t) ?? null; };

/** Legal moves from a stage. */
export function moves(stage: string): Move[] {
  const out: Move[] = []; const i = index(stage);
  if (i < 0 || i === S.length - 1) return out;
  out.push({ to: S[i + 1], kind: 'next', label: 'Next stage → ' + S[i + 1] });
  let j = i + 1;
  while (j < S.length - 1 && C.optionalStages.includes(S[j])) { j++; out.push({ to: S[j], kind: 'skip', label: `Skip ${S[j - 1]} → ${S[j]}` }); }
  if (C.rejectableFrom.includes(stage)) out.push({ to: C.rejectedStage, kind: 'reject', label: 'Reject candidate' });
  return out;
}
export const canMove = (from: string, to: string) => moves(from).some(m => m.to === to);
export const inSet = (stage: string, setName: string) => (C.stageSets[setName] ?? []).includes(stage);
export const groupOf = (stage: string) => C.pipelineGroups.find(g => g.stages.includes(stage))?.label ?? null;

/** Previous stage for Undo, from a history list of stage names (oldest first). */
export function previousStage(history: string[]): string | null { return history.length >= 2 ? history[history.length - 2] : null; }

/* BUSINESS LOGIC — candidate lifecycle. Pure functions. Linear order from V6; optional-stage skipping from V6 notes
   ("Pre-Medical if Required", "QVC if Applicable"); Rejected is an ASSUMPTION (OQ-1). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util;
  const S = C.stages;

  const isStage = s => S.includes(s) || s === C.rejectedStage;
  const canonical = v => { const t = U.norm(v); return [...S, C.rejectedStage].find(s => U.norm(s) === t) || null; };
  const index = s => S.indexOf(s);

  /** Legal next moves from a stage: [{to, kind:'next'|'skip'|'reject', label}] */
  function moves(stage) {
    const out = []; const i = index(stage);
    if (i < 0 || i === S.length - 1) return out;
    out.push({ to: S[i + 1], kind: 'next', label: 'Next stage → ' + S[i + 1] });
    let j = i + 1;
    while (j < S.length - 1 && C.optionalStages.includes(S[j])) { j++; out.push({ to: S[j], kind: 'skip', label: `Skip ${S[j - 1]} → ${S[j]}` }); }
    if (C.rejectableFrom.includes(stage)) out.push({ to: C.rejectedStage, kind: 'reject', label: 'Reject candidate' });
    return out;
  }
  const canMove = (from, to) => moves(from).some(m => m.to === to);

  /** Patch to apply when moving a candidate. Returns {patch} or {error}. */
  function moveTo(candidate, to, by, at) {
    if (!canMove(candidate.status, to)) return { error: `Not allowed: ${candidate.status} → ${to}.` };
    const history = (candidate.history || []).concat([{ stage: to, at: at || new Date().toISOString(), by: by || '' }]);
    return { patch: { status: to, history } };
  }
  /** Undo the last stage change using history. */
  function undo(candidate, by) {
    const h = candidate.history || [];
    if (h.length < 2) return { error: 'No earlier stage to return to.' };
    const history = h.slice(0, -1);
    return { patch: { status: history[history.length - 1].stage, history } };
  }

  const inSet = (stage, setName) => (C.stageSets[setName] || []).includes(stage);
  const groupOf = stage => (C.pipelineGroups.find(g => g.stages.includes(stage)) || {}).label || null;

  LGM.Lifecycle = { isStage, canonical, index, moves, canMove, moveTo, undo, inSet, groupOf };
})(typeof window !== 'undefined' ? window : globalThis);

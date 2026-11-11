/* Example project "Manpower Recruitment ERP" — LAYER 3: business logic (a small, generic recruitment agency).
   No relation to Leads Global's three-division workflow: single workspace, 7 stages, interview results move candidates, placements fill vacancies. */
(function (g) {
  'use strict';
  const MP = g.MP = g.MP || {}, U = g.ERP.util;
  MP.STAGES = ['Sourced', 'Screened', 'Shortlisted', 'Interviewed', 'Offered', 'Placed', 'Rejected'];
  const rank = s => MP.STAGES.indexOf(s);

  /** positions already filled for a vacancy */
  MP.filled = (s, v) => s.count('placements', { vacancy: v.id });
  MP.fee = p => U.round2(Number(p.monthlySalary || 0) * 12 * Number(p.feePercent || 0) / 100);
  MP.feesEarned = s => U.round2(s.list('placements').reduce((a, p) => a + MP.fee(p), 0));
  MP.fillRate = s => { const need = s.list('vacancies').reduce((a, v) => a + Number(v.positions || 0), 0), done = s.count('placements'); return need ? Math.round(100 * Math.min(done, need) / need) : 0; };

  MP.hooks = {
    beforeSave({ store, entity, values: r }) {
      const errors = {}, warnings = [];
      if (entity === 'placements') {
        const c = store.get('candidates', r.candidate), v = store.get('vacancies', r.vacancy);
        if (c && v && c.vacancy && c.vacancy !== v.id) warnings.push('The candidate was sourced for a different vacancy.');
        if (v && v.status === 'Closed') errors.vacancy = 'This vacancy is closed.';
      }
      if (entity === 'interviews' && r.result === 'Passed' && r.date > U.todayISO()) errors.result = 'A future interview cannot already be marked Passed.';
      return { errors, warnings };
    },
    afterSave({ store, entity, record: r, mode }) {
      const notes = [];
      if (entity === 'interviews') {
        const c = store.get('candidates', r.candidate); if (!c) return {};
        const to = r.result === 'Passed' ? 'Interviewed' : (r.result === 'Failed' || r.result === 'No show') ? 'Rejected' : null;
        if (to && c.stage !== to && c.stage !== 'Placed' && (to === 'Rejected' || rank(c.stage) < rank(to))) {
          store.update('candidates', c.id, { stage: to }, { by: 'workflow', note: 'interview ' + r.id }); notes.push(c.name + ' moved to ' + to + '.');
        }
      }
      if (entity === 'placements' && mode === 'create') {
        const c = store.get('candidates', r.candidate);
        if (c && c.stage !== 'Placed') { store.update('candidates', c.id, { stage: 'Placed' }, { by: 'workflow', note: 'placement ' + r.id }); notes.push(c.name + ' marked Placed.'); }
        const v = store.get('vacancies', r.vacancy);
        if (v && MP.filled(store, v) >= Number(v.positions) && v.status !== 'Filled') { store.update('vacancies', v.id, { status: 'Filled' }, { by: 'workflow' }); notes.push('Vacancy ' + v.id + ' is now Filled.'); }
      }
      return { notes };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

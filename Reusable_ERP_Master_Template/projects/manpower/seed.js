/* Example project "Manpower Recruitment ERP" — fictional demo data, created through the normal store API. */
(function (g) {
  'use strict';
  const MP = g.MP, U = g.ERP.util, today = U.todayISO(), ago = n => U.isoOf(new Date(U.parseISO(today).getTime() - n * 864e5));
  const ok = (r, w) => { if (!r.ok) throw new Error('Seed ' + w + ': ' + JSON.stringify(r.errors)); return r.record; };
  MP.seed = function (s) {
    return s.batch(() => {
      const mk = (e, v) => ok(s.create(e, v, { by: 'demo seed' }), e);
      const e1 = mk('employers', { name: 'Example Retail Group', industry: 'Retail', contact: 'Pat Example' }), e2 = mk('employers', { name: 'Sample Logistics Ltd', industry: 'Logistics' });
      const v1 = mk('vacancies', { employer: e1.id, title: 'Store Manager', positions: 2, salary: 3000, openedOn: ago(40) }), v2 = mk('vacancies', { employer: e2.id, title: 'Forklift Operator', positions: 1, salary: 1800, openedOn: ago(20) });
      const c = (name, v, stage, src, i) => mk('candidates', { name, email: 'test' + i + '@example.test', vacancy: v.id, stage, source: src, skills: 'Test skills' });
      const a = c('Test Candidate One', v1, 'Sourced', 'Referral', 1), b = c('Test Candidate Two', v1, 'Shortlisted', 'Job board', 2), d = c('Test Candidate Three', v1, 'Screened', 'Walk-in', 3);
      c('Test Candidate Four', v2, 'Sourced', 'Social media', 4);
      mk('interviews', { candidate: b.id, date: ago(10), round: 'Technical', result: 'Passed' });
      mk('interviews', { candidate: d.id, date: ago(5), round: 'HR', result: 'Failed' });
      mk('interviews', { candidate: a.id, date: ago(-3), round: 'Phone', result: 'Scheduled' });
      mk('placements', { candidate: b.id, vacancy: v1.id, startDate: ago(2), monthlySalary: 3000, feePercent: 8.33 });
      return { employers: s.count('employers'), vacancies: s.count('vacancies'), candidates: s.count('candidates'), placements: s.count('placements') };
    });
  };
  g.MP.config.demo.seed = MP.seed;
})(typeof window !== 'undefined' ? window : globalThis);

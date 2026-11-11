/* Example project "Manpower Recruitment ERP" — LAYER 2: configuration. No divisions (scope-less), flat menu, its own statuses. */
(function (g) {
  'use strict';
  const MP = g.MP, U = g.ERP.util;
  const T = (key, label, x) => Object.assign({ key, label, type: 'text' }, x), N = (key, label, x) => Object.assign({ key, label, type: 'number', min: 0 }, x), D = (key, label, x) => Object.assign({ key, label, type: 'date' }, x);
  const S = (key, label, options, x) => Object.assign({ key, label, type: 'select', options }, x), A = (key, label) => ({ key, label, type: 'textarea', wide: true, max: 1500 });
  const R = (key, label, ref, x) => Object.assign({ key, label, type: 'ref', ref }, x);
  const lists = { empStatus: ['Active', 'Inactive'], vacStatus: ['Open', 'On hold', 'Filled', 'Closed'], source: ['Referral', 'Job board', 'Walk-in', 'Social media'], round: ['Phone', 'Technical', 'HR', 'Final'], result: ['Scheduled', 'Passed', 'Failed', 'No show'], invoice: ['Not invoiced', 'Invoiced', 'Paid'] };

  const entities = {
    employers: {
      label: 'Employer', plural: 'Employers', idPrefix: 'EMP', unique: [['name']], track: ['status'],
      fields: [T('name', 'Employer name', { required: true }), T('industry', 'Industry'), T('contact', 'Contact person'), T('phone', 'Phone'), { key: 'email', label: 'Email', type: 'email' }, S('status', 'Status', 'empStatus', { default: 'Active' }), A('notes', 'Notes')],
      columns: ['id', 'name', 'industry', 'contact', 'status', '_vac'],
      computed: { _vac: { label: 'Vacancies', value: (r, s) => s.count('vacancies', { employer: r.id }), drill: r => ({ entity: 'vacancies', filter: { employer: r.id } }) } }, filters: ['status'],
    },
    vacancies: {
      label: 'Vacancy', plural: 'Vacancies', idPrefix: 'VAC', track: ['status'], display: (r) => r.id + ' · ' + r.title,
      fields: [R('employer', 'Employer', 'employers', { required: true }), T('title', 'Job title', { required: true }), N('positions', 'Positions', { required: true, min: 1, integer: true, default: 1 }), T('location', 'Location'), N('salary', 'Monthly salary (USD)'), D('openedOn', 'Opened on', { default: () => U.todayISO() }), S('status', 'Status', 'vacStatus', { default: 'Open' }), A('notes', 'Requirements')],
      columns: ['id', 'title', 'employer', 'positions', '_filled', 'openedOn', 'status'],
      computed: { _filled: { label: 'Placed', value: (r, s) => MP.filled(s, r) + ' / ' + r.positions } }, filters: ['employer', 'status'],
    },
    candidates: {
      label: 'Candidate', plural: 'Candidates', idPrefix: 'CND', unique: [['email']], track: ['stage'],
      fields: [T('name', 'Full name', { required: true }), { key: 'email', label: 'Email', type: 'email' }, T('phone', 'Phone'), T('skills', 'Skills'), N('expectedSalary', 'Expected monthly salary (USD)'), S('source', 'Source', 'source'), R('vacancy', 'Applied for vacancy', 'vacancies'), S('stage', 'Stage', MP.STAGES, { required: true, default: 'Sourced' }), A('notes', 'Notes')],
      columns: ['id', 'name', 'skills', 'vacancy', 'source', 'stage'], filters: ['vacancy', 'stage', 'source'],
      actions: [{ id: 'iv', label: 'Schedule interview', run: ({ rec, ui }) => ui.openForm('interviews', { prefill: { candidate: rec.id, date: U.todayISO() } }) }, { id: 'tl', label: 'Timeline', run: ({ rec, ui }) => ui.showTimeline('candidates', rec.id) }],
      timeline: { related: [{ entity: 'interviews', field: 'candidate' }, { entity: 'placements', field: 'candidate' }] },
    },
    interviews: {
      label: 'Interview', plural: 'Interviews', idPrefix: 'INT', track: ['result'], display: (r, s) => r.id + ' · ' + s.display('candidates', s.get('candidates', r.candidate)),
      fields: [R('candidate', 'Candidate', 'candidates', { required: true }), D('date', 'Date', { required: true }), S('round', 'Round', 'round', { required: true }), S('result', 'Result', 'result', { default: 'Scheduled' }), A('notes', 'Feedback')],
      columns: ['id', 'date', 'candidate', 'round', 'result'], filters: ['round', 'result'],
    },
    placements: {
      label: 'Placement', plural: 'Placements', idPrefix: 'PLC', unique: [['candidate']], display: (r, s) => r.id + ' · ' + s.display('candidates', s.get('candidates', r.candidate)),
      fields: [R('candidate', 'Candidate', 'candidates', { required: true }), R('vacancy', 'Vacancy', 'vacancies', { required: true }), D('startDate', 'Start date', { required: true }), N('monthlySalary', 'Monthly salary (USD)', { required: true }), N('feePercent', 'Fee (% of annual salary)', { required: true, max: 100, default: 8.33 }), S('invoice', 'Invoice status', 'invoice', { default: 'Not invoiced' })],
      columns: ['id', 'candidate', 'vacancy', 'startDate', 'monthlySalary', 'feePercent', '_fee', 'invoice'],
      computed: { _fee: { label: 'Fee (USD)', value: r => U.money(MP.fee(r), '').trim() } }, filters: ['invoice'],
    },
  };

  const reports = {
    stages: { title: 'Candidates by stage', columns: [{ key: 'stage', label: 'Stage' }, { key: 'n', label: 'Candidates', type: 'number' }], rows: s => MP.STAGES.map(st => ({ stage: st, n: s.count('candidates', { stage: st }), drill: { entity: 'candidates', filter: { stage: st } } })) },
    fill: { title: 'Vacancy fill status', columns: [{ key: 'v', label: 'Vacancy' }, { key: 'e', label: 'Employer' }, { key: 'need', label: 'Positions', type: 'number' }, { key: 'done', label: 'Placed', type: 'number' }, { key: 'st', label: 'Status', type: 'badge' }], rows: s => s.list('vacancies').map(v => ({ v: v.title, e: s.display('employers', s.get('employers', v.employer)), need: v.positions, done: MP.filled(s, v), st: v.status })) },
    fees: { title: 'Placement fees', columns: [{ key: 'c', label: 'Candidate' }, { key: 'sal', label: 'Monthly salary', type: 'money' }, { key: 'pct', label: 'Fee %', type: 'number' }, { key: 'fee', label: 'Fee', type: 'money' }, { key: 'inv', label: 'Invoice', type: 'badge' }], rows: s => s.list('placements').map(p => ({ c: s.display('candidates', s.get('candidates', p.candidate)), sal: p.monthlySalary, pct: p.feePercent, fee: MP.fee(p), inv: p.invoice })), totals: s => ({ fee: MP.feesEarned(s) }) },
  };

  g.MP.config = {
    id: 'example-manpower-recruitment', name: 'Manpower Recruitment ERP', subtitle: 'Example configuration', currency: 'USD', storageKey: 'erp_example_manpower_v1', filesKey: 'erp_example_manpower_files_v1',
    scope: null, lists, entities, reports, hooks: MP.hooks,
    pipeline: { entity: 'candidates', field: 'stage', title: 'Candidate pipeline', negative: ['Rejected'] },
    overview: {
      notice: 'Example configuration on the reusable ERP core. Fictional demo data, kept in this browser only.',
      cards: [
        { label: 'Employers', value: s => s.count('employers'), drill: { entity: 'employers' } },
        { label: 'Open vacancies', tone: 'warn', value: s => s.count('vacancies', { status: 'Open' }), drill: { entity: 'vacancies', filter: { status: 'Open' } } },
        { label: 'Candidates', value: s => s.count('candidates'), drill: { entity: 'candidates' } },
        { label: 'Interviews', value: s => s.count('interviews'), drill: { entity: 'interviews' } },
        { label: 'Placements', tone: 'good', value: s => s.count('placements'), drill: { entity: 'placements' } },
        { label: 'Fees earned', format: 'money', tone: 'good', value: s => MP.feesEarned(s), drill: { report: 'fees' } },
        { label: 'Fill rate', value: s => MP.fillRate(s) + '%' },
      ],
      stageCards: MP.STAGES, panels: ['fill', 'fees'],
    },
    nav: {
      global: [{ view: 'overview', label: 'Dashboard', icon: 'grid' }, { section: 'Recruitment' }, { view: 'entity', entity: 'employers', icon: 'users' }, { view: 'entity', entity: 'vacancies', icon: 'clipboard' }, { view: 'entity', entity: 'candidates', icon: 'user' }, { view: 'entity', entity: 'interviews', icon: 'mic' }, { view: 'entity', entity: 'placements', icon: 'coins' },
        { section: 'Reports' }, { view: 'report', id: 'stages', label: 'Candidates by stage', icon: 'chart' }, { view: 'report', id: 'fill', label: 'Vacancy fill', icon: 'chart' }, { view: 'report', id: 'fees', label: 'Placement fees', icon: 'chart' }, { view: 'import', label: 'Import / Export', icon: 'upload' }],
      tools: [{ view: 'settings', label: 'Settings & Backup', icon: 'cog' }, { view: 'audit', label: 'Audit log', icon: 'list' }],
    },
    tone: v => ({ Rejected: 'bad', Closed: 'bad', 'No show': 'bad', Failed: 'bad', Inactive: 'bad', Open: 'warn', 'On hold': 'warn', Scheduled: 'warn', Placed: 'good', Filled: 'good', Passed: 'good', Active: 'good', Paid: 'good', Invoiced: 'info' }[v] || ''),
    alerts: s => { const a = [], o = s.count('vacancies', { status: 'Open' }); if (o) a.push({ tone: 'warn', text: o + ' open vacanc' + (o > 1 ? 'ies' : 'y'), drill: { entity: 'vacancies', filter: { status: 'Open' } } }); return a; },
    text: { emptyHint: 'Start with an employer, then add a vacancy and candidates — or load the demo data.' },
    demo: { seed: null },
  };
})(typeof window !== 'undefined' ? window : globalThis);

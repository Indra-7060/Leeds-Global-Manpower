/* Example project "CRM / Lead Management ERP" — LAYER 2: configuration. Two pipelines (B2B / B2C) with their own fields, stages, menus and dashboards. */
(function (g) {
  'use strict';
  const CRM = g.CRM, U = g.ERP.util;
  const T = (key, label, x) => Object.assign({ key, label, type: 'text' }, x), N = (key, label, x) => Object.assign({ key, label, type: 'number', min: 0 }, x), D = (key, label, x) => Object.assign({ key, label, type: 'date' }, x);
  const S = (key, label, options, x) => Object.assign({ key, label, type: 'select', options }, x), A = (key, label) => ({ key, label, type: 'textarea', wide: true, max: 1500 });
  const R = (key, label, ref, x) => Object.assign({ key, label, type: 'ref', ref }, x);
  const stage = (label, x) => Object.assign({ key: 'stage', label, type: 'select', required: true, default: 'New', options: ({ scope }) => CRM.STAGES[scope] }, x);
  const lists = { size: ['1–50', '51–500', '500+'], source: ['Website', 'Referral', 'Event', 'Cold outreach', 'Advert'], type: ['Call', 'Email', 'Meeting', 'Demo'], lost: CRM.LOST_REASONS };
  const inScope = (sc, s) => ({ pipeline: sc });

  const entities = {
    accounts: {
      label: 'Account', plural: 'Accounts', idPrefix: 'ACC', scoped: true, unique: [['name']],
      labels: { byScope: { B2B: { label: 'Company', plural: 'Companies' }, B2C: { label: 'Customer', plural: 'Customers' } } },
      fields: {
        B2B: [T('name', 'Company name', { required: true }), T('industry', 'Industry'), S('size', 'Company size', 'size'), T('website', 'Website'), A('notes', 'Notes')],
        B2C: [T('name', 'Customer name', { required: true }), T('city', 'City'), T('phone', 'Phone'), { key: 'email', label: 'Email', type: 'email' }, A('notes', 'Notes')],
      },
      columns: { B2B: ['id', 'name', 'industry', 'size', '_leads'], B2C: ['id', 'name', 'city', 'phone', '_leads'] },
      computed: { _leads: { label: 'Leads', value: (r, s) => s.count('leads', { account: r.id }), drill: r => ({ entity: 'leads', filter: { account: r.id } }) } },
    },
    contacts: {
      label: 'Contact', plural: 'Contacts', idPrefix: 'CON', scoped: true,
      fields: { B2B: [R('account', 'Company', 'accounts', { required: true }), T('name', 'Contact name', { required: true }), T('role', 'Role'), { key: 'email', label: 'Email', type: 'email' }, T('phone', 'Phone')], B2C: [] },
      columns: ['id', 'name', 'account', 'role', 'email'], filters: ['account'],
    },
    leads: {
      label: 'Lead', plural: 'Leads', idPrefix: 'LD', scoped: true, track: ['stage', 'dealValue'], display: r => r.title,
      fields: {
        B2B: [T('title', 'Opportunity', { required: true }), R('account', 'Company', 'accounts', { required: true }), R('contact', 'Main contact', 'contacts', { filter: (t, rec) => !rec.account || t.account === rec.account }), T('owner', 'Owner', { required: true }), S('source', 'Source', 'source'), N('dealValue', 'Deal value (USD)', { required: true, min: 1 }), stage('Stage'), D('expectedClose', 'Expected close'), S('lostReason', 'Lost reason', 'lost', { required: r => r.stage === 'Lost' }), D('closedDate', 'Closed on')],
        B2C: [T('title', 'Enquiry', { required: true }), R('account', 'Customer', 'accounts', { required: true }), T('owner', 'Owner', { required: true }), S('source', 'Source', 'source'), T('interest', 'Product interest'), stage('Stage'), S('lostReason', 'Lost reason', 'lost', { required: r => r.stage === 'Lost' }), D('closedDate', 'Closed on')],
      },
      columns: { B2B: ['id', 'title', 'account', 'owner', 'dealValue', 'stage', '_weighted', 'expectedClose'], B2C: ['id', 'title', 'account', 'owner', 'interest', 'stage', 'source'] },
      computed: { _weighted: { label: 'Weighted (USD)', value: r => (CRM.isOpen(r) ? U.money(Number(r.dealValue || 0) * (CRM.WEIGHT[r.stage] || 0) / 100, '').trim() : '—') } },
      filters: ['account', 'stage', 'source', 'owner'],
      actions: [{ id: 'log', label: 'Log activity', run: ({ rec, ui, scope }) => ui.openForm('activities', { prefill: { lead: rec.id, date: U.todayISO() }, scope }) }, { id: 'tl', label: 'Timeline', run: ({ rec, ui }) => ui.showTimeline('leads', rec.id) }],
      timeline: { related: [{ entity: 'activities', field: 'lead' }] },
    },
    activities: {
      label: 'Activity', plural: 'Activities', idPrefix: 'ACT', scoped: true, display: (r, s) => r.id + ' · ' + r.type,
      fields: [R('lead', 'Lead', 'leads', { required: true }), D('date', 'Date', { required: true, default: () => U.todayISO() }), S('type', 'Type', 'type', { required: true }), T('summary', 'What happened', { required: true, max: 400 }), S('moveTo', 'Move lead to stage', ({ scope }) => CRM.STAGES[scope]), S('lostReason', 'Lost reason', 'lost'), T('nextStep', 'Next step'), D('nextDate', 'Next step date')],
      columns: ['id', 'date', 'lead', 'type', 'summary', 'moveTo', 'nextStep', 'nextDate'], filters: ['type'],
    },
  };

  const cnt = (e, label, f) => ({ label, value: (s, sc) => s.count(e, Object.assign({ pipeline: sc }, f || {})), drill: { entity: e, filter: f || {} } });
  const reports = {
    funnel: { title: 'Funnel by stage', scoped: true, columns: [{ key: 'stage', label: 'Stage' }, { key: 'n', label: 'Leads', type: 'number' }, { key: 'v', label: 'Deal value', type: 'money' }, { key: 'w', label: 'Weight %', type: 'number' }],
      rows: (s, sc) => CRM.STAGES[sc].map(st => { const ls = s.list('leads', { pipeline: sc, stage: st }); return { stage: st, n: ls.length, v: sc === 'B2B' ? U.round2(ls.reduce((a, l) => a + Number(l.dealValue || 0), 0)) : '', w: CRM.WEIGHT[st], drill: { entity: 'leads', filter: { stage: st } } }; }) },
    nextSteps: { title: 'Next steps due', scoped: true, note: 'The next step of the latest activity on each open lead.', columns: [{ key: 'due', label: 'Due' }, { key: 'lead', label: 'Lead' }, { key: 'step', label: 'Next step' }, { key: 'st', label: 'Status', type: 'badge' }],
      rows: (s, sc) => CRM.nextSteps(s, sc).map(x => ({ due: x.due, lead: x.lead.title, step: x.step, st: x.overdue ? 'Overdue' : 'Scheduled', tone: x.overdue ? 'bad' : '', drill: { entity: 'leads', id: x.lead.id } })) },
    lost: { title: 'Lost leads by reason', scoped: true, columns: [{ key: 'r', label: 'Reason' }, { key: 'n', label: 'Leads', type: 'number' }], rows: (s, sc) => CRM.LOST_REASONS.map(r => ({ r, n: s.count('leads', { pipeline: sc, stage: 'Lost', lostReason: r }) })).filter(x => x.n) },
  };

  const home = {
    B2B: { intro: 'Company → Contact → Lead → Activities → Proposal → Negotiation → Won / Lost',
      cards: [cnt('accounts', 'Companies'), cnt('contacts', 'Contacts'), { label: 'Open leads', value: (s, sc) => CRM.leads(s, sc).filter(CRM.isOpen).length, drill: { entity: 'leads' } }, { label: 'Pipeline value', format: 'money', value: (s, sc) => CRM.openValue(s, sc), drill: { report: 'funnel' } }, { label: 'Weighted forecast', format: 'money', tone: 'good', value: (s, sc) => CRM.forecast(s, sc), drill: { report: 'funnel' } }, { label: 'Won value', format: 'money', tone: 'good', value: (s, sc) => CRM.wonValue(s, sc), drill: { entity: 'leads', filter: { stage: 'Won' } } }, { label: 'Win rate', value: (s, sc) => CRM.winRate(s, sc) + '%' }, { label: 'Overdue next steps', tone: 'bad', value: (s, sc) => CRM.nextSteps(s, sc).filter(x => x.overdue).length, drill: { report: 'nextSteps' } }],
      stageCards: CRM.STAGES.B2B, panels: ['funnel', 'nextSteps', 'lost'], quick: ['accounts', 'contacts', 'leads', 'activities'] },
    B2C: { intro: 'Customer → Enquiry → Activities → Interested → Won / Lost',
      cards: [cnt('accounts', 'Customers'), { label: 'Open enquiries', value: (s, sc) => CRM.leads(s, sc).filter(CRM.isOpen).length, drill: { entity: 'leads' } }, { label: 'Won', tone: 'good', value: (s, sc) => s.count('leads', { pipeline: sc, stage: 'Won' }), drill: { entity: 'leads', filter: { stage: 'Won' } } }, { label: 'Lost', tone: 'bad', value: (s, sc) => s.count('leads', { pipeline: sc, stage: 'Lost' }), drill: { entity: 'leads', filter: { stage: 'Lost' } } }, { label: 'Conversion rate', value: (s, sc) => CRM.winRate(s, sc) + '%' }, { label: 'Overdue next steps', tone: 'bad', value: (s, sc) => CRM.nextSteps(s, sc).filter(x => x.overdue).length, drill: { report: 'nextSteps' } }],
      stageCards: CRM.STAGES.B2C, panels: ['funnel', 'nextSteps', 'lost'], quick: ['accounts', 'leads', 'activities'] },
  };
  const E = (entity, icon) => ({ view: 'entity', entity, icon });
  const nav = { global: [{ view: 'overview', label: 'Sales overview', icon: 'grid' }], scope: {
    B2B: [{ view: 'home', label: 'B2B dashboard', icon: 'grid' }, { section: 'Sales' }, E('accounts', 'users'), E('contacts', 'user'), E('leads', 'clipboard'), E('activities', 'edit'), { section: 'Reports' }, { view: 'report', id: 'funnel', label: 'Funnel', icon: 'chart' }, { view: 'report', id: 'nextSteps', label: 'Next steps', icon: 'bell' }, { view: 'report', id: 'lost', label: 'Lost reasons', icon: 'chart' }, { view: 'import', label: 'Import / Export', icon: 'upload' }],
    B2C: [{ view: 'home', label: 'B2C dashboard', icon: 'grid' }, { section: 'Sales' }, E('accounts', 'users'), E('leads', 'clipboard'), E('activities', 'edit'), { section: 'Reports' }, { view: 'report', id: 'funnel', label: 'Funnel', icon: 'chart' }, { view: 'report', id: 'nextSteps', label: 'Next steps', icon: 'bell' }, { view: 'import', label: 'Import / Export', icon: 'upload' }] },
    tools: [{ view: 'settings', label: 'Settings & Backup', icon: 'cog' }, { view: 'audit', label: 'Audit log', icon: 'list' }] };

  g.CRM.config = {
    id: 'example-crm-lead-management', name: 'CRM / Lead Management', subtitle: 'Example configuration', currency: 'USD', storageKey: 'erp_example_crm_v1', filesKey: 'erp_example_crm_files_v1',
    scope: { field: 'pipeline', label: 'Pipeline', values: ['B2B', 'B2C'], default: 'B2B', colors: { B2B: '#5b4bb7', B2C: '#c2571a' } },
    lists, entities, reports, home, nav, hooks: CRM.hooks,
    pipeline: { entity: 'leads', field: 'stage', title: 'Sales funnel', negative: ['Lost'] },
    overview: { notice: 'Example configuration on the reusable ERP core. Fictional demo data, kept in this browser only.',
      cards: [{ label: 'All leads', value: s => s.count('leads'), drill: { entity: 'leads', all: true } }, { label: 'Open leads', value: s => s.count('leads', l => CRM.isOpen(l)), drill: { entity: 'leads', all: true, filterFn: l => CRM.isOpen(l) } }, { label: 'Won deals', tone: 'good', value: s => s.count('leads', { stage: 'Won' }), drill: { entity: 'leads', all: true, filter: { stage: 'Won' } } }, { label: 'B2B pipeline value', format: 'money', value: s => CRM.openValue(s, 'B2B') }, { label: 'Overdue next steps', tone: 'bad', value: s => CRM.nextSteps(s, null).filter(x => x.overdue).length }],
      divisionTable: { title: 'Pipelines at a glance', columns: ['Accounts', 'Leads', 'Open', 'Won', 'Lost', 'Win rate %'], row: (s, p) => ({ Accounts: s.count('accounts', { pipeline: p }), Leads: s.count('leads', { pipeline: p }), Open: CRM.leads(s, p).filter(CRM.isOpen).length, Won: s.count('leads', { pipeline: p, stage: 'Won' }), Lost: s.count('leads', { pipeline: p, stage: 'Lost' }), 'Win rate %': CRM.winRate(s, p) }) } },
    tone: v => ({ Lost: 'bad', Overdue: 'bad', Won: 'good', Negotiation: 'info', Proposal: 'info', Qualified: 'info', Interested: 'info', New: 'warn' }[v] || ''),
    alerts: s => { const a = [], o = CRM.nextSteps(s, null).filter(x => x.overdue); if (o.length) a.push({ tone: 'bad', text: o.length + ' overdue next step' + (o.length > 1 ? 's' : ''), drill: { report: 'nextSteps' }, scope: o[0].lead.pipeline }); return a; },
    text: { emptyHint: 'Pick a pipeline and add the first company or customer — or load the demo data.' },
    demo: { seed: null },
  };
})(typeof window !== 'undefined' ? window : globalThis);

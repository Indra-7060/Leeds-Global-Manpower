/* Leads Global ERP — project/config.js  (LAYER 2: project configuration)
   Declares the business: divisions, tables, fields per division, menus, dashboard cards, reports. Contains no DOM code and no storage code.
   Field lists are taken from the client's V8.7 reference (same keys, same labels) so imports/exports stay compatible; additions are marked [DEV].
   Load order: core/*  →  logic.js  →  config.js  →  seed.js  →  app start. */
(function (g) {
  'use strict';
  const L = g.LGM, U = g.ERP.util;
  const DIV = ['Blue-Collar', 'Domestic', 'Corporate'];

  /* ---------- lists ---------- */
  const lists = {
    orderStatus: ['Open', 'In progress', 'Fulfilled', 'On hold', 'Cancelled'],             // [DEV] V8.7 had free text
    clientStatus: ['Active', 'Inactive'],
    payer: ['Overseas Agent', 'Qatar Company', 'Sponsor', 'Corporate Company'],            // [V8.7]
    kind: ['Invoice', 'Payment received', 'Expense', 'Refund', 'Deposit'],                 // [V8.7]
    interviewResult: ['Pending', 'Selected', 'Rejected', 'On hold', 'No show'],            // [DEV]
    ticketStatus: ['Pending', 'Booked', 'Travelled', 'Cancelled'],                         // [DEV]
    domesticCategory: ['Housemaid', 'Cook', 'Driver', 'Nanny', 'Caregiver', 'Gardener'],   // [V8.7]
    claimType: L.CLAIM_TYPES, claimStatus: L.CLAIM_STATUSES, feeBasis: L.FEE_BASIS,
    docType: ['Passport copy', 'CV', 'Photo', 'Medical report', 'QVC / medical', 'Visa copy', 'Ticket copy', 'Contract / agreement', 'Invoice / receipt', 'Other'],   // [DEV]
    stagesAll: L.ALL_STAGES,
  };

  /* ---------- field helpers ---------- */
  const T = (key, label, extra) => Object.assign({ key, label, type: 'text' }, extra);
  const N = (key, label, extra) => Object.assign({ key, label, type: 'number', min: 0 }, extra);
  const D = (key, label, extra) => Object.assign({ key, label, type: 'date' }, extra);
  const S = (key, label, options, extra) => Object.assign({ key, label, type: 'select', options }, extra);
  const A = (key, label, extra) => Object.assign({ key, label, type: 'textarea', wide: true, max: 2000 }, extra);
  const clientOf = (label, req) => ({ key: 'client', label, type: 'ref', ref: 'clients', required: req !== false });
  const orderOf = label => ({ key: 'order', label, type: 'ref', ref: 'orders', fills: { client: 'client' }, filter: (t, rec) => !rec.client || t.client === rec.client });
  const agencyOf = (label, extra) => Object.assign({ key: 'agency', label, type: 'ref', ref: 'agencies', sameScope: false,
    filter: (t, rec, store) => !rec.order || store.count('allocations', a => a.order === rec.order && a.agency === t.id) > 0 }, extra);
  const candOf = (label, req, extra) => Object.assign({ key: 'candidate', label, type: 'ref', ref: 'candidates', required: !!req, fills: { client: 'client' }, filter: (t, rec) => !rec.client || t.client === rec.client }, extra);
  const stageField = (label, extra) => Object.assign({ key: 'stage', label, type: 'select', required: true, options: ({ scope }) => L.stagesFor(scope) }, extra);

  /* ---------- entities ---------- */
  const entities = {
    clients: {
      label: 'Client', plural: 'Clients & Sponsors', idPrefix: 'CL', scoped: true, unique: [['name']], track: ['status'],
      labels: { byScope: { 'Blue-Collar': { label: 'Qatar client', plural: 'Clients' }, Domestic: { label: 'Sponsor', plural: 'Sponsors' }, Corporate: { label: 'Corporate company', plural: 'Companies' } } },
      fields: {
        'Blue-Collar': [T('name', 'Client name', { required: true, max: 120 }), T('phone', 'Phone', { max: 40 }), { key: 'email', label: 'Email', type: 'email' }, S('status', 'Status', 'clientStatus', { default: 'Active' }), A('notes', 'Notes')],
        Domestic: [T('name', 'Sponsor name', { required: true, max: 120 }), T('qid', 'Sponsor QID', { max: 30 }), T('phone', 'Phone', { max: 40 }), { key: 'email', label: 'Email', type: 'email' }, S('status', 'Status', 'clientStatus', { default: 'Active' }), A('notes', 'Notes')],
        Corporate: [T('name', 'Company name', { required: true, max: 120 }), T('phone', 'Phone', { max: 40 }), { key: 'email', label: 'Email', type: 'email' }, S('status', 'Status', 'clientStatus', { default: 'Active' }), A('notes', 'Notes')],
      },
      columns: { 'Blue-Collar': ['id', 'name', 'phone', 'email', 'status', '_orders', '_candidates'], Domestic: ['id', 'name', 'qid', 'phone', 'status', '_orders', '_candidates'], Corporate: ['id', 'name', 'phone', 'email', 'status', '_orders', '_candidates'] },
      computed: {
        _orders: { label: 'Orders', value: (r, s) => s.count('orders', { client: r.id }), drill: r => ({ entity: 'orders', filter: { client: r.id } }) },
        _candidates: { label: 'Candidates', value: (r, s) => s.count('candidates', { client: r.id }), drill: r => ({ entity: 'candidates', filter: { client: r.id } }) },
      },
      filters: ['status'],
    },

    orders: {
      label: 'Order', plural: 'Orders', idPrefix: 'ORD', scoped: true, track: ['status'],
      labels: { byScope: { 'Blue-Collar': { label: 'Manpower order', plural: 'Manpower Orders' }, Domestic: { label: 'Worker requirement', plural: 'Worker Requirements' }, Corporate: { label: 'Job requirement', plural: 'Job Requirements' } } },
      display: (r, s) => r.id + ' · ' + (r.trade || 'order') + (r.client ? ' · ' + s.display('clients', s.get('clients', r.client)) : ''),
      fields: {
        'Blue-Collar': [clientOf('Client / Sponsor'), T('country', 'Recruitment country'), T('nationality', 'Required nationality'), T('trade', 'Trade / Position', { required: true }), N('quantity', 'Number of people required', { required: true, min: 1, integer: true }), N('basicSalary', 'Basic salary (QAR)'),
          T('food', 'Food allowance / provided'), T('accommodation', 'Accommodation'), T('transport', 'Transportation'), T('workingHours', 'Working hours'), T('contractPeriod', 'Contract period'), D('orderDate', 'Order date', { default: () => U.todayISO() }), S('status', 'Order status', 'orderStatus', { default: 'Open' }), A('notes', 'Notes')],
        Domestic: [clientOf('Individual sponsor'), T('nationality', 'Preferred worker nationality'), T('country', 'Recruitment country'), S('trade', 'Domestic worker category', 'domesticCategory', { required: true }), N('quantity', 'Workers required (usually 1)', { required: true, min: 1, integer: true, default: 1 }), T('preferredAge', 'Preferred age range'), T('language', 'Language preference'), T('experience', 'Experience / skills required'),
          N('basicSalary', 'Monthly salary (QAR)'), T('food', 'Food arrangement'), T('accommodation', 'Accommodation arrangement'), T('contractPeriod', 'Contract period'), D('orderDate', 'Request date', { default: () => U.todayISO() }), S('status', 'Request status', 'orderStatus', { default: 'Open' }), A('notes', 'Sponsor preferences / special instructions')],
        Corporate: [clientOf('Corporate company'), T('trade', 'Job title / designation', { required: true }), N('quantity', 'Number of vacancies', { required: true, min: 1, integer: true }), T('nationality', 'Preferred nationality'), T('country', 'Recruitment source (Qatar / overseas)'), T('location', 'Work location'), T('experience', 'Required experience'), T('qualification', 'Qualification / skills'),
          N('basicSalary', 'Basic monthly salary (QAR)'), N('totalSalary', 'Total monthly package (QAR)'), S('feeBasis', 'Placement fee basis', 'feeBasis'), N('customFee', 'Custom fee (QAR)', { required: (r) => r.feeBasis === 'Custom' }), N('paymentMilestone', 'Invoice due after joining (months)', { integer: true }),
          D('orderDate', 'Request date', { default: () => U.todayISO() }), S('status', 'Job order status', 'orderStatus', { default: 'Open' }), A('notes', 'Job description / conditions')],
      },
      columns: { 'Blue-Collar': ['id', 'client', 'trade', 'country', 'quantity', '_registered', '_delivered', 'orderDate', 'status'], Domestic: ['id', 'client', 'trade', 'nationality', 'quantity', '_registered', '_delivered', 'orderDate', 'status'], Corporate: ['id', 'client', 'trade', 'quantity', 'feeBasis', '_registered', '_delivered', 'orderDate', 'status'] },
      computed: {
        _registered: { label: 'Registered', value: (r, s) => s.count('candidates', { order: r.id }), drill: r => ({ entity: 'candidates', filter: { order: r.id } }) },
        _delivered: { label: L.DELIVERED_LABEL, value: (r, s) => L.deliveredForOrder(s, r) },
      },
      filters: ['client', 'status'],
    },

    agencies: {   // [V8.7] overseas agencies are global (not tied to one division); used by the Blue-Collar workflow
      label: 'Overseas agency', plural: 'Overseas Agencies', idPrefix: 'AG', scoped: false, unique: [['name', 'country']],
      fields: [T('name', 'Agency name', { required: true, max: 120 }), T('country', 'Country', { required: true }), T('contact', 'Contact'), T('phone', 'Phone', { max: 40 }), A('notes', 'Notes')],
      columns: ['id', 'name', 'country', 'contact', 'phone', '_allocations'],
      computed: { _allocations: { label: 'Allocations', value: (r, s) => s.count('allocations', { agency: r.id }), drill: r => ({ entity: 'allocations', filter: { agency: r.id } }) } },
      filters: ['country'],
    },

    allocations: {
      label: 'Allocation', plural: 'Agency Allocations', idPrefix: 'AL', scoped: true, unique: [['order', 'agency']],
      display: (r, s) => r.id + ' · ' + s.display('agencies', s.get('agencies', r.agency)) + ' ← ' + s.display('orders', s.get('orders', r.order)),
      fields: { 'Blue-Collar': [clientOf('Qatar client'), Object.assign(orderOf('Order reference'), { required: true }), { key: 'agency', label: 'Overseas agency', type: 'ref', ref: 'agencies', required: true, sameScope: false }, N('quantity', 'Allocated quantity', { required: true, min: 1, integer: true }), N('fee', 'Agency fee per deployed worker (QAR)', { required: true }), A('notes', 'Payment terms / notes')], default: [] },
      columns: { 'Blue-Collar': ['id', 'client', 'order', 'agency', 'quantity', 'fee', '_deployed'] },
      computed: { _deployed: { label: 'Verified deployed', value: (r, s) => L.deployedCount(s, r), drill: r => ({ entity: 'candidates', filter: { order: r.order, agency: r.agency } }) } },
      filters: ['client', 'agency'],
    },

    candidates: {
      label: 'Candidate', plural: 'Candidates', idPrefix: 'CAN', scoped: true, unique: [['passport']], track: ['stage', 'interviewDate', 'qvcDate', 'rtpDate', 'visaDate', 'ticketDate', 'arrivalDate', 'deploymentDate', 'handoverDate', 'joiningDate'],
      labels: { byScope: { 'Blue-Collar': { label: 'Candidate', plural: 'Candidates & CVs' }, Domestic: { label: 'Worker', plural: 'Domestic Workers' }, Corporate: { label: 'Candidate', plural: 'Candidates' } } },
      display: r => r.name,
      fields: {
        'Blue-Collar': [T('name', 'Candidate full name', { required: true, max: 120 }), clientOf('Client'), orderOf('Order reference'), agencyOf('Overseas agency'), T('passport', 'Passport number', { max: 30 }), T('nationality', 'Nationality'), T('country', 'Source country'), T('trade', 'Trade / Role'),
          stageField('Current stage', { default: 'CV Received' }), D('interviewDate', 'Interview date'), D('qvcDate', 'QVC / medical date'), D('rtpDate', 'RTP date'), D('visaDate', 'Visa date'), D('ticketDate', 'Ticket booking date'), T('flight', 'Flight number'),
          D('arrivalDate', 'Actual arrival date'), D('deploymentDate', 'Verified deployment date'), D('handoverDate', 'Handover date'), N('salary', 'Basic salary (QAR)'), A('notes', 'Notes')],
        Domestic: [T('name', 'Worker full name', { required: true, max: 120 }), clientOf('Individual sponsor'), orderOf('Worker requirement'), T('passport', 'Passport number', { max: 30 }), T('nationality', 'Nationality'), T('country', 'Source country'), T('trade', 'Category / Role'),
          stageField('Current stage', { default: 'CV Received' }), D('interviewDate', 'Interview date'), D('qvcDate', 'QVC / medical date'), D('rtpDate', 'RTP date'), D('visaDate', 'Visa date'), D('ticketDate', 'Ticket booking date'), T('flight', 'Flight number'),
          D('arrivalDate', 'Actual arrival date'), D('handoverDate', 'Sponsor handover date'), N('salary', 'Monthly salary (QAR)'), A('notes', 'Notes')],
        Corporate: [T('name', 'Candidate full name', { required: true, max: 120 }), clientOf('Corporate company'), orderOf('Job requirement'), T('passport', 'Passport / ID number', { max: 30 }), T('nationality', 'Nationality'), T('country', 'Current location'), T('trade', 'Job title / role'),
          stageField('Current stage', { default: 'CV Received' }), D('interviewDate', 'Interview date'), D('joiningDate', 'Joining date'), N('salary', 'Offered / basic salary (QAR)'), A('notes', 'Notes')],
      },
      columns: { 'Blue-Collar': ['id', 'name', 'client', 'order', 'agency', 'trade', 'stage', 'deploymentDate', '_next'], Domestic: ['id', 'name', 'client', 'trade', 'stage', 'handoverDate', '_warranty', '_next'], Corporate: ['id', 'name', 'client', 'order', 'trade', 'stage', 'joiningDate', '_next'] },
      computed: {
        _next: { label: 'Next follow-up', value: (r, s) => { const u = L.latestUpdate(s, r.id); return u && u.nextAction ? (u.dueDate ? u.dueDate + ' · ' : '') + u.nextAction : '—'; }, tone: (r, s) => { const u = L.latestUpdate(s, r.id); return u && u.dueDate && u.nextAction && u.dueDate < U.todayISO() ? 'bad' : ''; } },
        _warranty: { label: 'Warranty', value: (r, s) => { const w = L.warrantyOf(s, r.id); if (!w) return r.handoverDate ? 'Not registered' : '—'; const st = L.warrantyState(w); return (st.hasClaim && st.open ? 'Open claim · ' : '') + st.text + ' (to ' + w.end + ')'; }, tone: (r, s) => { const w = L.warrantyOf(s, r.id); if (!w) return ''; const st = L.warrantyState(w); return st.open ? 'warn' : st.expired ? 'bad' : 'good'; } },
      },
      filters: ['client', 'order', 'agency', 'stage'],
      actions: [
        { id: 'update', label: 'Daily update', run: ({ rec, ui, scope }) => ui.openForm('updates', { prefill: { candidate: rec.id, client: rec.client, stage: rec.stage, date: U.todayISO() }, scope }) },
        { id: 'history', label: 'Timeline', run: ({ rec, ui }) => ui.showTimeline('candidates', rec.id) },
        { id: 'warranty', label: 'Warranty', when: (rec, s) => rec.division === 'Domestic' && !L.warrantyOf(s, rec.id), run: ({ rec, ui, scope }) => ui.openForm('warranties', { prefill: { candidate: rec.id, client: rec.client, start: rec.handoverDate || '', months: L.WARRANTY_MONTHS }, scope }) },
      ],
    },

    accounts: {
      label: 'Transaction', plural: 'Accounts & Collections', idPrefix: 'AC', scoped: true,
      display: (r, s) => r.id + ' · ' + r.kind + ' · ' + U.money(r.amount),
      fields: {
        'Blue-Collar': [clientOf('Client'), agencyOf('Agency (if payer / payee)', { filter: undefined }), { key: 'allocation', label: 'Allocation (links the payment to an agency fee)', type: 'ref', ref: 'allocations', filter: (t, rec) => (!rec.client || t.client === rec.client) && (!rec.agency || t.agency === rec.agency) },
          candOf('Candidate (optional)', false), S('payer', 'Payer type', 'payer'), S('kind', 'Transaction type', 'kind', { required: true }), N('amount', 'Amount (QAR)', { required: true, min: 0.01 }), D('date', 'Transaction date', { required: true, default: () => U.todayISO() }), T('reference', 'Invoice / receipt reference'), A('notes', 'Notes')],
        Domestic: [clientOf('Individual sponsor'), candOf('Worker (optional)', false), S('payer', 'Payer type', 'payer'), S('kind', 'Transaction type', 'kind', { required: true }), N('amount', 'Amount (QAR)', { required: true, min: 0.01 }), D('date', 'Transaction date', { required: true, default: () => U.todayISO() }), T('reference', 'Invoice / receipt reference'), A('notes', 'Notes')],
        Corporate: [clientOf('Corporate company'), candOf('Placed candidate (optional)', false), S('payer', 'Payer type', 'payer'), S('kind', 'Transaction type', 'kind', { required: true }), N('amount', 'Amount (QAR)', { required: true, min: 0.01 }), D('date', 'Transaction date', { required: true, default: () => U.todayISO() }), T('reference', 'Invoice / receipt reference'), A('notes', 'Notes')],
      },
      columns: { 'Blue-Collar': ['id', 'date', 'client', 'agency', 'kind', 'amount', 'reference'], Domestic: ['id', 'date', 'client', 'candidate', 'kind', 'amount', 'reference'], Corporate: ['id', 'date', 'client', 'candidate', 'kind', 'amount', 'reference'] },
      filters: ['client', 'kind'],
    },

    documents: {
      label: 'Document', plural: 'Documents', idPrefix: 'DOC', scoped: true, upload: { maxBytes: 5 * 1024 * 1024, accept: '.pdf,.png,.jpg,.jpeg,.doc,.docx' },   // [DEV] 5 MB (V8.7: 1 MB in base64)
      display: (r) => r.fileName || r.type || r.id,
      fields: [clientOf('Client / Sponsor'), candOf('Candidate (optional)', false), S('type', 'Document type', 'docType', { required: true }), T('fileName', 'File name', { hidden: true }), T('fileType', 'File type', { hidden: true }), N('fileSize', 'File size', { hidden: true }), T('fileId', 'File id', { hidden: true }), A('notes', 'Notes')],
      columns: ['id', 'type', 'client', 'candidate', 'fileName', 'fileSize', 'createdAt'],
      filters: ['client', 'type'],
    },

    interviews: {
      label: 'Interview', plural: 'Interviews', idPrefix: 'IV', scoped: true, unique: [['candidate', 'date']], track: ['result'],
      display: (r, s) => r.id + ' · ' + s.display('candidates', s.get('candidates', r.candidate)) + ' · ' + r.date,
      fields: [clientOf('Client / Sponsor'), candOf('Candidate', true), D('date', 'Interview date', { required: true }), S('result', 'Result', 'interviewResult', { default: 'Pending' }), A('notes', 'Feedback')],
      columns: ['id', 'date', 'candidate', 'client', 'result', 'notes'], filters: ['client', 'result'],
    },

    tickets: {
      label: 'Ticket', plural: 'Tickets & Deployment', idPrefix: 'TK', scoped: true, track: ['status'],
      display: (r, s) => r.id + ' · ' + s.display('candidates', s.get('candidates', r.candidate)) + ' · ' + (r.flight || ''),
      fields: { 'Blue-Collar': [clientOf('Client'), candOf('Candidate', true), T('flight', 'Flight number'), D('date', 'Flight date', { required: true }), S('status', 'Ticket status', 'ticketStatus', { default: 'Pending' }), A('notes', 'Notes')],
        Domestic: [clientOf('Individual sponsor'), candOf('Worker', true), T('flight', 'Flight number'), D('date', 'Flight date', { required: true }), S('status', 'Ticket status', 'ticketStatus', { default: 'Pending' }), A('notes', 'Notes')], Corporate: [] },
      columns: ['id', 'date', 'candidate', 'client', 'flight', 'status'], filters: ['client', 'status'],
    },

    updates: {
      label: 'Daily update', plural: 'Daily Updates & Follow-ups', idPrefix: 'UP', scoped: true,
      display: (r, s) => r.id + ' · ' + s.display('candidates', s.get('candidates', r.candidate)) + ' → ' + r.stage,
      fields: [clientOf('Client / Sponsor'), candOf('Candidate', true), D('date', 'Update date', { required: true, default: () => U.todayISO() }), stageField('New recruitment stage'), T('staff', 'Updated by', { required: true }), T('action', 'Work completed / action', { required: true, max: 500 }), T('nextAction', 'Next follow-up', { max: 300 }), D('dueDate', 'Follow-up due date', { required: r => !!r.nextAction }), A('notes', 'Remarks')],
      columns: ['id', 'date', 'candidate', 'client', 'stage', 'staff', 'action', 'nextAction', 'dueDate'], filters: ['client', 'stage'],
      /* an update is a historical record: it can be corrected but deleting it never reverts the candidate (the candidate's stage history keeps the event) */
    },

    warranties: {
      label: 'Warranty', plural: 'Warranty', idPrefix: 'WR', scoped: true, unique: [['candidate']], track: ['status', 'end'],
      labels: { byScope: { Domestic: { label: 'Warranty', plural: 'Domestic Warranty (9 months)' } } },
      display: (r, s) => r.id + ' · ' + s.display('candidates', s.get('candidates', r.candidate)),
      fields: {
        Domestic: [clientOf('Individual sponsor'), candOf('Domestic worker', true), D('start', 'Warranty start / sponsor handover date', { required: true }), N('months', 'Warranty period (months)', { required: true, min: 1, max: 60, integer: true, default: L.WARRANTY_MONTHS }), D('end', 'Warranty expiry date (calculated)', { readonly: true, computedHint: 'Start date + period (calendar months). Calculated automatically.', compute: r => (r.start && U.isValidISO(r.start) && Number(r.months) > 0 ? L.warrantyEnd(r.start, r.months) : '') }),
          A('reason', 'Complaint / claim reason', { wide: true }), D('claimDate', 'Complaint received date'), S('claimType', 'Claim type', 'claimType'), S('status', 'Claim status', 'claimStatus', { default: 'Active' }),
          { key: 'replacementCandidate', label: 'Replacement worker (if any)', type: 'ref', ref: 'candidates', filter: (t, rec) => !rec.client || t.client === rec.client }, N('refundAmount', 'Refund amount (if applicable, QAR)'), D('resolutionDate', 'Claim resolved date'), A('notes', 'Warranty terms / remarks')],
        default: [clientOf('Client'), candOf('Candidate', true), D('start', 'Verified start date', { required: true }), D('end', 'Warranty end date', { required: true }), A('reason', 'Claim / complaint reason'), S('status', 'Claim status', 'claimStatus', { default: 'Active' }), A('notes', 'Notes')],
      },
      columns: { Domestic: ['id', 'candidate', 'client', 'start', 'end', '_left', 'status', 'claimType', 'reason', '_mismatch'], 'Blue-Collar': ['id', 'candidate', 'client', 'start', 'end', 'status'], Corporate: ['id', 'candidate', 'client', 'start', 'end', 'status'] },
      computed: {
        _left: { label: 'Time left', value: r => L.warrantyState(r).text, tone: r => { const s = L.warrantyState(r); return s.open ? 'warn' : s.expired ? 'bad' : s.expiringSoon ? 'warn' : 'good'; } },
        _mismatch: { label: 'Start vs handover', value: (r, s) => { const c = s.get('candidates', r.candidate); if (!c || !c.handoverDate) return 'No handover date'; return c.handoverDate === r.start ? 'Matches' : 'Differs (' + c.handoverDate + ')'; }, tone: (r, s) => (L.startMismatch(s, r) ? 'warn' : '') },
      },
      filters: ['client', 'status'],
    },
  };

  /* ---------- reports / panels (tables built from live data; also exported as CSV) ---------- */
  const money = { type: 'money' };
  const reports = {
    stageSummary: { title: 'Recruitment stages', scoped: true, note: 'Current = candidates now at the stage. Ever reached = candidates whose stage history contains it (a candidate who moved on is still counted).',
      columns: [{ key: 'stage', label: 'Stage' }, { key: 'current', label: 'Current', type: 'number' }, { key: 'reached', label: 'Ever reached', type: 'number' }],
      rows: (s, scope) => L.stageTable(s, scope).map(r => Object.assign(r, { drill: { entity: 'candidates', filter: { stage: r.stage } } })) },
    followUps: { title: 'Follow-ups', scoped: true, note: 'The next action of each candidate\'s latest daily update.',
      columns: [{ key: 'due', label: 'Due' }, { key: 'candidate', label: 'Candidate' }, { key: 'stage', label: 'Stage', type: 'badge' }, { key: 'action', label: 'Next follow-up' }, { key: 'state', label: 'Status', type: 'badge' }],
      rows: (s, scope) => L.followUps(s, scope).map(f => ({ due: f.due, candidate: f.candidate.name, stage: f.candidate.stage, action: f.update.nextAction, state: f.overdue ? 'Overdue ' + (-f.days) + ' d' : f.days === 0 ? 'Due today' : 'In ' + f.days + ' d', tone: f.overdue ? 'bad' : f.days <= 2 ? 'warn' : '', drill: { entity: 'candidates', id: f.candidate.id } })) },
    orderFulfilment: { title: 'Order fulfilment', scoped: true,
      columns: [{ key: 'order', label: 'Order' }, { key: 'client', label: 'Client' }, { key: 'required', label: 'Required', type: 'number' }, { key: 'registered', label: 'Registered', type: 'number' }, { key: 'delivered', label: 'Delivered', type: 'number' }, { key: 'remaining', label: 'Still to deliver', type: 'number' }, { key: 'status', label: 'Status', type: 'badge' }],
      rows: (s, scope) => s.list('orders', { division: scope }).map(o => { const d = L.deliveredForOrder(s, o), q = Number(o.quantity || 0); return { order: s.display('orders', o), client: s.display('clients', s.get('clients', o.client)), required: q, registered: s.count('candidates', { order: o.id }), delivered: d, remaining: Math.max(0, q - d), status: o.status, drill: { entity: 'candidates', filter: { order: o.id } } }; }) },
    agencyLedger: { title: 'Agency ledger (verified deployments)', scope: 'Blue-Collar', note: 'Earned = candidates with a verified deployment date × fee per deployed worker. Outstanding = earned − payments linked to the allocation.',
      columns: [{ key: 'agency', label: 'Agency' }, { key: 'client', label: 'Client' }, { key: 'order', label: 'Order' }, { key: 'quantity', label: 'Allocated', type: 'number' }, { key: 'deployed', label: 'Verified deployed', type: 'number' }, { key: 'fee', label: 'Fee / worker', type: 'money' }, { key: 'earned', label: 'Earned', type: 'money' }, { key: 'paid', label: 'Paid', type: 'money' }, { key: 'outstanding', label: 'Outstanding', type: 'money' }, { key: 'flag', label: 'Check', type: 'badge' }],
      rows: s => L.agencyLedger(s).rows.map(r => ({ agency: s.display('agencies', s.get('agencies', r.allocation.agency)), client: s.display('clients', s.get('clients', r.allocation.client)), order: r.allocation.order, quantity: r.quantity, deployed: r.deployed, fee: r.fee, earned: r.earned, paid: r.paid, outstanding: r.outstanding, flag: r.overDeployed ? 'Deployed > allocated' : '', tone: r.overDeployed ? 'warn' : '', drill: { entity: 'candidates', filter: { order: r.allocation.order, agency: r.allocation.agency } } })),
      totals: s => { const t = L.agencyLedger(s).totals; return { deployed: t.deployed, earned: t.earned, paid: t.paid, outstanding: t.outstanding }; } },
    warrantyRegister: { title: 'Warranty register (Domestic)', scope: 'Domestic', note: 'End date = start + period (calendar months). The last covered day counts as active. Start date is typed or taken from the worker\'s sponsor handover date — client confirmation pending.',
      columns: [{ key: 'worker', label: 'Worker' }, { key: 'sponsor', label: 'Sponsor' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' }, { key: 'left', label: 'Time left', type: 'badge' }, { key: 'claim', label: 'Claim', type: 'badge' }, { key: 'status', label: 'Status', type: 'badge' }, { key: 'check', label: 'Check', type: 'badge' }],
      rows: s => s.list('warranties', { division: 'Domestic' }).sort((a, b) => (a.end || '').localeCompare(b.end || '')).map(w => { const st = L.warrantyState(w), c = s.get('candidates', w.candidate); return { worker: c ? c.name : w.candidate, sponsor: s.display('clients', s.get('clients', w.client)), start: w.start, end: w.end, left: st.text, claim: st.hasClaim ? (w.claimType || 'Claim') : '—', status: w.status, check: L.startMismatch(s, w) ? 'Start ≠ handover' : '', tone: st.open ? 'warn' : st.expired ? 'bad' : st.expiringSoon ? 'warn' : 'good', drill: { entity: 'warranties', id: w.id } }; }) },
    corporateReceivables: { title: 'Placement fees (Corporate)', scope: 'Corporate', note: 'Fee = basis × salary (or custom fee). Due date = joining date + invoice months. Received = payments linked to the candidate.',
      columns: [{ key: 'candidate', label: 'Candidate' }, { key: 'client', label: 'Company' }, { key: 'joined', label: 'Joined' }, { key: 'basis', label: 'Basis' }, { key: 'fee', label: 'Fee', type: 'money' }, { key: 'due', label: 'Due' }, { key: 'invoiced', label: 'Invoiced', type: 'money' }, { key: 'received', label: 'Received', type: 'money' }, { key: 'outstanding', label: 'Outstanding', type: 'money' }, { key: 'flag', label: 'Check', type: 'badge' }],
      rows: s => L.corporateReceivables(s).map(r => ({ candidate: r.candidate.name, client: s.display('clients', s.get('clients', r.candidate.client)), joined: r.joined, basis: r.basis || '—', fee: r.fee, due: r.due || '—', invoiced: r.invoiced, received: r.received, outstanding: r.outstanding, flag: r.overdue ? 'Overdue' : r.ok ? '' : r.why, tone: r.overdue ? 'bad' : r.ok ? '' : 'warn', drill: { entity: 'candidates', id: r.candidate.id } })),
      totals: s => { const rs = L.corporateReceivables(s); const sum = k => U.round2(rs.reduce((a, r) => a + r[k], 0)); return { fee: sum('fee'), invoiced: sum('invoiced'), received: sum('received'), outstanding: sum('outstanding') }; } },
    partyLedger: { title: 'Account balances by client', scoped: true, note: 'Outstanding = invoices − payments received + refunds.',
      columns: [{ key: 'client', label: 'Client' }, { key: 'Invoice', label: 'Invoiced', type: 'money' }, { key: 'Payment received', label: 'Received', type: 'money' }, { key: 'Refund', label: 'Refunds', type: 'money' }, { key: 'Expense', label: 'Expenses', type: 'money' }, { key: 'Deposit', label: 'Deposits', type: 'money' }, { key: 'outstanding', label: 'Outstanding', type: 'money' }],
      rows: (s, scope) => L.partyLedger(s, scope).map(r => Object.assign({}, r, { client: s.display('clients', s.get('clients', r.client)), drill: { entity: 'accounts', filter: { client: r.client } } })) },
  };

  /* ---------- dashboards ---------- */
  const stageCards = (stages, scope) => stages.map(st => ({ id: 'st-' + st, label: st, value: s => L.stageCount(s, st, scope), drill: { entity: 'candidates', filter: { stage: st } } }));
  const cnt = (entity, label, filter) => ({ label, value: (s, scope) => s.count(entity, Object.assign({}, scope && s.isScoped(entity) ? { division: scope } : {}, filter || {})), drill: { entity, filter: filter || {} } });
  const fu = (s, scope) => L.followUps(s, scope);
  const home = {
    'Blue-Collar': {
      intro: 'Client → Order → Overseas Agency → Allocation → Candidate → Interview → QVC → RTP → Visa → Ticket → Arrival → Deployment → Handover → Accounts',
      cards: [cnt('clients', 'Clients'), cnt('orders', 'Orders'), { label: 'Workers required', value: (s, sc) => s.list('orders', { division: sc }).reduce((a, o) => a + Number(o.quantity || 0), 0), drill: { entity: 'orders' } }, cnt('agencies', 'Agencies'), cnt('allocations', 'Allocations'), cnt('candidates', 'Candidates'), cnt('interviews', 'Interview records'), cnt('tickets', 'Tickets'), cnt('documents', 'Documents'),
        { label: 'Verified deployed', value: (s, sc) => s.count('candidates', c => c.division === sc && !!c.deploymentDate), drill: { entity: 'candidates', filter: { deploymentDate: { nonEmpty: true } } } },
        { label: 'Agency fee earned', format: 'money', value: s => L.agencyLedger(s).totals.earned, drill: { report: 'agencyLedger' } }, { label: 'Agency fee paid', format: 'money', value: s => L.agencyLedger(s).totals.paid, drill: { report: 'agencyLedger' } }, { label: 'Agency fee outstanding', format: 'money', tone: 'warn', value: s => L.agencyLedger(s).totals.outstanding, drill: { report: 'agencyLedger' } },
        { label: 'Overdue follow-ups', tone: 'bad', value: (s, sc) => fu(s, sc).filter(f => f.overdue).length, drill: { report: 'followUps' } }],
      stageCards: L.STAGES['Blue-Collar'], panels: ['stageSummary', 'orderFulfilment', 'agencyLedger', 'followUps'],
    },
    Domestic: {
      intro: 'Sponsor → Worker requirement → Worker registration → Recruitment progress → Ticket / Arrival → Sponsor handover → 9-month warranty → Complaint / Replacement / Refund',
      cards: [cnt('clients', 'Sponsors'), cnt('orders', 'Worker requirements'), cnt('candidates', 'Workers'), cnt('interviews', 'Interview records'), cnt('tickets', 'Tickets'), cnt('documents', 'Documents'),
        { label: 'Handed over to sponsors', value: (s, sc) => s.count('candidates', c => c.division === sc && !!c.handoverDate), drill: { entity: 'candidates', filter: { handoverDate: { nonEmpty: true } } } },
        { label: 'Warranties active', tone: 'good', value: s => s.count('warranties', w => w.division === 'Domestic' && L.warrantyState(w).active), drill: { entity: 'warranties', filterFn: w => L.warrantyState(w).active } },
        { label: 'Expiring in 30 days', tone: 'warn', value: s => s.count('warranties', w => w.division === 'Domestic' && L.warrantyState(w).expiringSoon), drill: { entity: 'warranties', filterFn: w => L.warrantyState(w).expiringSoon } },
        { label: 'Warranties expired', value: s => s.count('warranties', w => w.division === 'Domestic' && L.warrantyState(w).expired), drill: { entity: 'warranties', filterFn: w => L.warrantyState(w).expired } },
        { label: 'Open complaints', tone: 'bad', value: s => s.count('warranties', w => w.division === 'Domestic' && L.warrantyState(w).open), drill: { entity: 'warranties', filterFn: w => L.warrantyState(w).open } },
        { label: 'Handed over, no warranty', tone: 'warn', value: s => s.count('candidates', c => c.division === 'Domestic' && !!c.handoverDate && !L.warrantyOf(s, c.id)), drill: { entity: 'candidates', filterFn: (c, s) => c.division === 'Domestic' && !!c.handoverDate && !L.warrantyOf(s, c.id) } },
        { label: 'Refund amounts recorded', format: 'money', value: s => U.round2(s.list('warranties', { division: 'Domestic' }).reduce((a, w) => a + Number(w.refundAmount || 0), 0)), drill: { entity: 'warranties', filterFn: w => Number(w.refundAmount) > 0 } },
        { label: 'Overdue follow-ups', tone: 'bad', value: (s, sc) => fu(s, sc).filter(f => f.overdue).length, drill: { report: 'followUps' } }],
      stageCards: L.STAGES.Domestic, panels: ['warrantyRegister', 'stageSummary', 'orderFulfilment', 'followUps', 'partyLedger'],
    },
    Corporate: {
      intro: 'Company → Job requirement → Candidate registration → Interview → Selection → Offer → Joining → Placement fee / Accounts',
      cards: [cnt('clients', 'Companies'), cnt('orders', 'Job requirements'), { label: 'Vacancies', value: (s, sc) => s.list('orders', { division: sc }).reduce((a, o) => a + Number(o.quantity || 0), 0), drill: { entity: 'orders' } }, cnt('candidates', 'Candidates'), cnt('interviews', 'Interview records'), cnt('documents', 'Documents'),
        { label: 'Joined', tone: 'good', value: (s, sc) => L.stageCount(s, 'Joined', sc), drill: { entity: 'candidates', filter: { stage: 'Joined' } } },
        { label: 'Placement fees earned', format: 'money', value: s => U.round2(L.corporateReceivables(s).reduce((a, r) => a + r.fee, 0)), drill: { report: 'corporateReceivables' } },
        { label: 'Fees received', format: 'money', value: s => U.round2(L.corporateReceivables(s).reduce((a, r) => a + r.received, 0)), drill: { report: 'corporateReceivables' } },
        { label: 'Fees outstanding', format: 'money', tone: 'warn', value: s => U.round2(L.corporateReceivables(s).reduce((a, r) => a + r.outstanding, 0)), drill: { report: 'corporateReceivables' } },
        { label: 'Overdue invoices', tone: 'bad', value: s => L.corporateReceivables(s).filter(r => r.overdue).length, drill: { report: 'corporateReceivables' } },
        { label: 'Overdue follow-ups', tone: 'bad', value: (s, sc) => fu(s, sc).filter(f => f.overdue).length, drill: { report: 'followUps' } }],
      stageCards: L.STAGES.Corporate, panels: ['stageSummary', 'orderFulfilment', 'corporateReceivables', 'followUps', 'partyLedger'],
    },
  };

  const overview = {
    notice: 'Local demonstration build: data is stored in this browser only. It is not a secure, shared or multi-user system. Do not enter real passport, QID, financial or confidential data.',
    cards: [
      { label: 'Clients / Sponsors', value: s => s.count('clients'), drill: { entity: 'clients', all: true } },
      { label: 'Orders', value: s => s.count('orders'), drill: { entity: 'orders', all: true } },
      { label: 'Candidates', value: s => s.count('candidates'), drill: { entity: 'candidates', all: true } },
      { label: 'Interview records', value: s => s.count('interviews'), drill: { entity: 'interviews', all: true } },
      { label: 'Tickets', value: s => s.count('tickets'), drill: { entity: 'tickets', all: true } },
      { label: 'Documents', value: s => s.count('documents'), drill: { entity: 'documents', all: true } },
      { label: 'Overdue follow-ups', tone: 'bad', value: s => L.followUps(s, null).filter(f => f.overdue).length },
      { label: 'Open warranty complaints', tone: 'bad', value: s => s.count('warranties', w => w.division === 'Domestic' && L.warrantyState(w).open), drill: { entity: 'warranties', scope: 'Domestic', filterFn: w => L.warrantyState(w).open } },
      { label: 'Agency fee outstanding', format: 'money', tone: 'warn', value: s => L.agencyLedger(s).totals.outstanding, drill: { report: 'agencyLedger', scope: 'Blue-Collar' } },
    ],
    divisionTable: { title: 'Division-wise recruitment summary', note: 'Counts are candidates whose CURRENT stage matches. Each division only has the stages of its own workflow, so "—" means the stage does not exist there.',
      columns: ['Orders', 'Candidates', 'Interviewed', 'QVC Completed', 'RTP', 'Ticket Booked', 'Arrived', 'Deployed', 'Handed Over', 'Joined'],
      row: (s, d) => { const sc = s.count('candidates', { division: d }); const stg = L.stagesFor(d); const cell = st => stg.includes(st) ? L.stageCount(s, st, d) : null; return { Orders: s.count('orders', { division: d }), Candidates: sc, Interviewed: cell('Interviewed'), 'QVC Completed': cell('QVC Completed'), RTP: cell('RTP'), 'Ticket Booked': cell('Ticket Booked'), Arrived: cell('Arrived'), Deployed: cell('Deployed'), 'Handed Over': cell('Handed Over'), Joined: cell('Joined') }; } },
  };

  /* ---------- navigation ---------- */
  const E = (entity, icon) => ({ view: 'entity', entity, icon });
  const nav = {
    global: [{ view: 'overview', label: 'Main Dashboard', icon: 'grid' }],
    scope: {
      'Blue-Collar': [{ view: 'home', label: 'Division dashboard', icon: 'grid' }, { section: 'Workflow' }, E('clients', 'users'), E('orders', 'clipboard'), E('agencies', 'globe'), E('allocations', 'link'), E('candidates', 'user'), E('updates', 'edit'), E('interviews', 'mic'), E('tickets', 'plane'), E('documents', 'file'), E('accounts', 'coins'), E('warranties', 'shield'), { section: 'Reports' }, { view: 'report', id: 'agencyLedger', label: 'Agency ledger', icon: 'chart' }, { view: 'report', id: 'followUps', label: 'Follow-ups', icon: 'bell' }, { view: 'report', id: 'orderFulfilment', label: 'Order fulfilment', icon: 'chart' }, { view: 'report', id: 'partyLedger', label: 'Account balances', icon: 'chart' }, { view: 'import', label: 'Import / Export', icon: 'upload' }],
      Domestic: [{ view: 'home', label: 'Division dashboard', icon: 'grid' }, { section: 'Workflow' }, E('clients', 'users'), E('orders', 'clipboard'), E('candidates', 'user'), E('updates', 'edit'), E('interviews', 'mic'), E('tickets', 'plane'), E('warranties', 'shield'), E('documents', 'file'), E('accounts', 'coins'), { section: 'Reports' }, { view: 'report', id: 'warrantyRegister', label: 'Warranty register', icon: 'chart' }, { view: 'report', id: 'followUps', label: 'Follow-ups', icon: 'bell' }, { view: 'report', id: 'orderFulfilment', label: 'Order fulfilment', icon: 'chart' }, { view: 'report', id: 'partyLedger', label: 'Account balances', icon: 'chart' }, { view: 'import', label: 'Import / Export', icon: 'upload' }],
      Corporate: [{ view: 'home', label: 'Division dashboard', icon: 'grid' }, { section: 'Workflow' }, E('clients', 'users'), E('orders', 'clipboard'), E('candidates', 'user'), E('updates', 'edit'), E('interviews', 'mic'), E('documents', 'file'), E('accounts', 'coins'), E('warranties', 'shield'), { section: 'Reports' }, { view: 'report', id: 'corporateReceivables', label: 'Placement fees', icon: 'chart' }, { view: 'report', id: 'followUps', label: 'Follow-ups', icon: 'bell' }, { view: 'report', id: 'orderFulfilment', label: 'Order fulfilment', icon: 'chart' }, { view: 'report', id: 'partyLedger', label: 'Account balances', icon: 'chart' }, { view: 'import', label: 'Import / Export', icon: 'upload' }],
    },
    tools: [{ view: 'settings', label: 'Settings & Backup', icon: 'cog' }, { view: 'audit', label: 'Audit log', icon: 'list' }],
  };
  // Corporate has no ticket workflow and Blue-Collar/Corporate have no warranty workflow in the stated division workflows;
  // entity tables that a division does not use have no fields (tickets: Corporate) and are hidden. Generic warranties remain for Blue-Collar/Corporate as in V8.7.
  nav.scope.Corporate = nav.scope.Corporate.filter(i => i.entity !== 'warranties');
  nav.scope['Blue-Collar'] = nav.scope['Blue-Collar'].filter(i => i.entity !== 'warranties');

  home['Blue-Collar'].quick = ['clients', 'orders', 'allocations', 'candidates', 'updates', 'interviews', 'tickets', 'accounts', 'documents'];
  home.Domestic.quick = ['clients', 'orders', 'candidates', 'updates', 'tickets', 'warranties', 'documents', 'accounts'];
  home.Corporate.quick = ['clients', 'orders', 'candidates', 'updates', 'interviews', 'accounts', 'documents'];
  entities.candidates.timeline = { related: [{ entity: 'updates', field: 'candidate' }, { entity: 'interviews', field: 'candidate' }, { entity: 'tickets', field: 'candidate' }, { entity: 'warranties', field: 'candidate' }, { entity: 'accounts', field: 'candidate' }, { entity: 'documents', field: 'candidate' }] };
  entities.warranties.timeline = { related: [] };

  /** header bell: every alert is computed from live data, nothing is typed in */
  const alerts = s => {
    const out = [], today = U.todayISO();
    const od = L.followUps(s, null).filter(f => f.overdue); if (od.length) out.push({ tone: 'bad', text: od.length + ' overdue follow-up' + (od.length > 1 ? 's' : ''), drill: { report: 'followUps' }, scope: od[0].candidate.division });
    const oc = s.count('warranties', w => w.division === 'Domestic' && L.warrantyState(w).open); if (oc) out.push({ tone: 'bad', text: oc + ' open warranty complaint' + (oc > 1 ? 's' : ''), drill: { report: 'warrantyRegister' }, scope: 'Domestic' });
    const ex = s.count('warranties', w => w.division === 'Domestic' && L.warrantyState(w).expiringSoon); if (ex) out.push({ tone: 'warn', text: ex + ' warrant' + (ex > 1 ? 'ies' : 'y') + ' expiring within 30 days', drill: { report: 'warrantyRegister' }, scope: 'Domestic' });
    const nw = s.count('candidates', c => c.division === 'Domestic' && !!c.handoverDate && !L.warrantyOf(s, c.id)); if (nw) out.push({ tone: 'warn', text: nw + ' handed-over worker' + (nw > 1 ? 's' : '') + ' without a warranty record', drill: { entity: 'candidates', filter: { handoverDate: { nonEmpty: true } } }, scope: 'Domestic' });
    const oi = L.corporateReceivables(s, today).filter(r => r.overdue).length; if (oi) out.push({ tone: 'bad', text: oi + ' placement fee' + (oi > 1 ? 's' : '') + ' overdue', drill: { report: 'corporateReceivables' }, scope: 'Corporate' });
    const ag = L.agencyLedger(s).totals.outstanding; if (ag > 0) out.push({ tone: 'warn', text: 'Agency fee outstanding: ' + U.money(ag, 'QAR'), drill: { report: 'agencyLedger' }, scope: 'Blue-Collar' });
    return out;
  };

  g.LGM.config = {
    alerts, userFields: { updates: 'staff' }, pipeline: { entity: 'candidates', field: 'stage', title: 'Recruitment pipeline', negative: ['Rejected'] }, pipelineReached: (s, st, sc) => L.reachedCount(s, st, sc),
    limitations: 'Local demonstration build. Records and uploaded documents are saved in THIS browser on THIS device only — not secure, not shared, not multi-user, and lost if browser data is cleared. There is no sign-in or role control. Do not enter real passport, QID, financial or confidential data. Use Download backup regularly.',
    id: 'leads-global-erp-final', name: 'Leads Global ERP', subtitle: 'Recruitment ERP · Final', version: '1.0.0', currency: 'QAR', storageKey: 'lgm_erp_final_v1', filesKey: 'lgm_erp_final_files_v1',
    scope: { field: 'division', label: 'Division', values: DIV, default: 'Blue-Collar', colors: { 'Blue-Collar': '#1766ac', Domestic: '#2f8f6b', Corporate: '#7a4fb3' } },
    lists, entities, reports, home, overview, nav, hooks: L.hooks,
    stageField: 'stage', stages: L.STAGES,
    tone: v => ({ Rejected: 'bad', Cancelled: 'bad', Expired: 'bad', 'No show': 'bad', Inactive: 'bad', Open: 'warn', 'On hold': 'warn', Pending: 'warn', 'Ticket Pending': 'warn', 'QVC Pending': 'warn',
      Deployed: 'good', 'Handed Over': 'good', Joined: 'good', Arrived: 'good', Resolved: 'good', Active: 'good', Fulfilled: 'good', Selected: 'good', Travelled: 'good', Booked: 'info', 'In progress': 'info' }[v] || ''),
    demo: { seed: g.LGM.seed || null },
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* SCHEMA — field definitions for every entity (drives forms, validation and import). Fields come from V6 tables/forms. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util;

  const F = (key, label, type, o = {}) => Object.assign({ key, label, type }, o);
  const sel = (key, label, options, o = {}) => F(key, label, 'select', Object.assign({ options }, o));
  // Free text with suggestions: real sheets contain countries beyond the V6 dropdown list; known names are canonicalised in Rules.derive.
  const countryF = (o = {}) => F('country', 'Country', 'text', Object.assign({ suggestList: C.countries, required: true }, o));
  const clientRef = (o = {}) => F('client', 'Client', 'text', Object.assign({ suggest: { entity: 'clients', key: 'name' }, required: true }, o));

  const entities = {
    clients: {
      label: 'Client', plural: 'Clients', title: r => r.name,
      fields: [F('name', 'Client name', 'text', { required: true }), F('sector', 'Sector', 'text'),
        sel('stage', 'Stage', C.clientStages, { required: true, default: 'Prospect' }), F('next_action', 'Next action', 'text')],
    },
    visits: {
      label: 'Visit', plural: 'Visits', title: r => `${r.client} · ${r.date || ''}`,
      fields: [clientRef(), F('contact', 'Contact', 'text'), F('date', 'Visit / follow-up date', 'date', { required: true }),
        sel('outcome', 'Outcome', C.visitOutcomes, { required: true, default: 'Profile Presented' }),
        sel('pipeline_stage', 'Sales pipeline stage', C.salesPipeline, { default: 'Company Identified' }),
        F('next_action', 'Next action', 'text'), F('salesperson', 'Salesperson', 'text'), F('notes', 'Notes', 'textarea', { full: true })],
    },
    demands: {
      label: 'Demand letter', plural: 'Demand letters', idKind: 'demand', title: r => r.id,
      fields: [clientRef(), F('order_id', 'Linked order', 'refselect', { source: { entity: 'orders', value: 'id', label: o => `${o.id} · ${o.client} · ${o.trade}` } }),
        F('letter_date', 'Letter date', 'date'), F('countries', 'Countries', 'text'), F('trades', 'Trades', 'text'),
        F('quantities', 'Trade-wise quantities', 'text'), F('nationality', 'Nationality', 'text'), F('salary_benefits', 'Salary & benefits', 'text'),
        sel('signed', 'Signed letter received', ['Yes', 'No'], { default: 'No' }), F('agency_allocation', 'Agency allocation', 'text'),
        sel('status', 'Status', C.demandStatuses, { required: true, default: 'Received' })],
    },
    orders: {
      label: 'Order', plural: 'Orders', idKind: 'order', title: r => r.id,
      fields: [clientRef(), countryF({ default: 'Bangladesh' }),
        F('trade', 'Trade', 'text', { required: true, placeholder: 'e.g. Steel Fixer' }),
        F('qty', 'Quantity', 'int', { required: true, min: 1, default: 50 }),
        F('agency', 'Overseas agency (optional)', 'text', { suggest: { entity: 'allocations', key: 'agency' }, help: 'Formal agency allocations are recorded under Overseas Agencies.' }),
        sel('status', 'Stage', C.orderStatuses, { required: true, default: 'New Order' })],
    },
    allocations: {
      label: 'Agency allocation', plural: 'Agency allocations', title: r => `${r.agency} · ${r.order_id}`,
      fields: [F('agency', 'Agency', 'text', { required: true, suggest: { entity: 'allocations', key: 'agency' } }),
        countryF(),
        F('order_id', 'Order', 'refselect', { required: true, source: { entity: 'orders', value: 'id', label: o => `${o.id} · ${o.client} · ${o.country}` } }),
        F('allocated', 'Allocated quantity', 'int', { required: true, min: 1 }),
        sel('status', 'Status', C.agencyStatuses, { required: true, default: 'Sourcing' })],
    },
    candidates: {
      label: 'Candidate', plural: 'Candidates', idKind: 'candidate', title: r => `${r.id} ${r.name}`,
      fields: [F('name', 'Candidate name', 'text', { required: true }), F('passport', 'Passport no.', 'text', { help: 'Used to detect duplicates. Fictional values only in this prototype.' }),
        clientRef(), F('order_id', 'Order', 'refselect', { source: { entity: 'orders', value: 'id', label: o => `${o.id} · ${o.client} · ${o.trade}` } }),
        countryF({ default: 'Bangladesh' }), F('agency', 'Overseas agency', 'text', { suggest: { entity: 'allocations', key: 'agency' } }),
        F('trade', 'Trade', 'text', { required: true }),
        sel('status', 'Starting stage', C.stages.concat([C.rejectedStage]), { default: 'CV Submitted', createOnly: true, help: 'Later changes use the stage buttons so the workflow is respected.' }),
        F('visa_number', 'Visa number', 'text'), F('qvc_date', 'QVC date', 'date'), F('flight_date', 'Flight date', 'date')],
    },
    interviews: {
      label: 'Interview event', plural: 'Interview events', title: r => `${r.client} · ${r.method}`,
      fields: [clientRef(), sel('method', 'Method', C.interviewMethods, { required: true }), countryF(),
        F('date', 'Date', 'date'), F('candidates', 'Candidates', 'int', { min: 0, default: 0 }),
        sel('status', 'Status', C.interviewStatuses, { required: true, default: 'Scheduled' })],
    },
    tickets: {
      label: 'Travel record', plural: 'Travel records', title: r => r.candidate_id,
      fields: [F('candidate_id', 'Candidate', 'refselect', { required: true, source: { entity: 'candidates', value: 'id', label: c => `${c.id} · ${c.name} · ${c.client}`, filter: c => ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'].includes(c.status), taken: ['tickets', 'candidate_id'] } }),
        sel('ticket_by', 'Ticket by', C.ticketBy), F('flight', 'Flight details', 'text'),
        F('driver_name', 'Pickup driver name', 'text'), F('driver_phone', 'Pickup driver phone', 'text'),
        sel('step', 'Ticket status', C.ticketSteps, { required: true, default: 'Pending' })],
    },
    warranties: {
      label: 'Warranty case', plural: 'Warranty cases', idKind: 'warranty', title: r => r.id,
      fields: [sel('division', 'Division', C.warrantyDivisions, { required: true, default: 'Labour' }), clientRef({ label: 'Client / household' }),
        F('candidate_id', 'Candidate (optional)', 'refselect', { source: { entity: 'candidates', value: 'id', label: c => `${c.id} · ${c.name}` } }),
        F('issue', 'Issue', 'text', { required: true }), sel('status', 'Status', C.warrantyStatuses, { required: true, default: 'Pending' }),
        F('warranty_start', 'Warranty start', 'date'),
        F('warranty_expiry', 'Warranty expiry', 'date', { help: 'Labour: filled automatically as start + 3 months if left blank (illustrative period, OQ-8). Domestic: enter manually after legal check.' })],
    },
    domestic: {
      label: 'Domestic case', plural: 'Domestic cases', idKind: 'domestic', title: r => r.id,
      fields: [F('customer', 'Customer / household', 'text'), F('origin', 'Worker origin', 'text', { required: true, placeholder: 'e.g. Philippines' }),
        sel('status', 'Status', C.domesticStatuses, { required: true, default: 'Customer Enquiry' }), F('next_action', 'Next action', 'text')],
    },
    credentials: {
      label: 'Credential record', plural: 'Credential records', title: r => `${r.client} · ${r.portal}`,
      fields: [clientRef(), sel('portal', 'Portal', C.credentialPortals, { required: true }),
        F('record', 'Record (description only)', 'text', { required: true, placeholder: 'e.g. Credentials on file', help: 'Never type passwords, OTPs or login details here.' }),
        F('access', 'Access', 'text', { default: 'Authorized only', readonly: true })],
    },
    finance: {
      label: 'Transaction', plural: 'Transactions', title: r => `${r.date} ${r.party}`,
      fields: [F('date', 'Date', 'date', { required: true }), sel('division', 'Business division', C.financeDivisions.map(d => d[0]), { required: true, default: 'labour', labels: Object.fromEntries(C.financeDivisions) }),
        sel('direction', 'Incoming / Outgoing', ['Incoming', 'Outgoing'], { required: true, default: 'Incoming' }), sel('account', 'Payment account', C.financeAccounts, { required: true, default: 'Cash' }),
        F('party', 'Agency / customer / partner', 'text', { required: true }), F('client', 'Qatar client', 'text', { suggest: { entity: 'clients', key: 'name' } }),
        countryF({ required: false }), F('order', 'Order reference', 'text'),
        sel('category', 'Category', C.financeCategories, { required: true, default: 'Agency payment' }),
        F('amount', 'Amount (QAR)', 'number', { required: true, min: 0.01 }), F('ref', 'Reference / receipt number', 'text'), F('note', 'Remarks', 'text')],
    },
    cvInbox: {
      label: 'CV intake item', plural: 'CV intake', title: r => r.filename,
      fields: [F('filename', 'File', 'text', { required: true }), F('size', 'Size (bytes)', 'int', { min: 0 }), F('type', 'Type', 'text'), F('received', 'Received', 'text'),
        sel('source', 'Source', C.cvSources), F('client', 'Client', 'text'), F('agency', 'Agency', 'text'), F('country', 'Country', 'text'),
        sel('status', 'Status', C.cvStatuses, { default: 'Needs review' }), F('note', 'Extraction note', 'text'), F('extracted_email', 'E-mail', 'text'), F('extracted_phone', 'Phone', 'text'), F('preview', 'Preview', 'textarea')],
    },
  };

  const MAXLEN = { text: 200, textarea: 2000 };

  /** Validate + coerce. Returns { errors:{field:msg}, clean:{...} }. Unknown keys are dropped. */
  function validate(entity, input, opts = {}) {
    const def = entities[entity]; const errors = {}, clean = {};
    for (const f of def.fields) {
      if (opts.partial && !(f.key in input)) continue;
      if (opts.skipCreateOnly && f.createOnly) continue;
      let v = input[f.key];
      if (typeof v === 'string') v = v.trim();
      let blank = v == null || v === '';
      // A default may fill a blank DROPDOWN (e.g. stage = "New Order"). Never invent quantities, countries or other typed data:
      // text/number defaults are only form pre-fills (Schema.defaults), not silent substitutions.
      if (blank && opts.useDefaults && f.default != null && f.type === 'select') { v = f.default; blank = false; }
      if (blank) {
        if (f.required) errors[f.key] = `${f.label} is required.`;
        clean[f.key] = '';
        continue;
      }
      switch (f.type) {
        case 'int': case 'number': {
          const n = U.num(v);
          if (!Number.isFinite(n)) { errors[f.key] = `${f.label} must be a number.`; break; }
          if (f.type === 'int' && !Number.isInteger(n)) { errors[f.key] = `${f.label} must be a whole number.`; break; }
          if (f.min != null && n < f.min) { errors[f.key] = `${f.label} must be at least ${f.min}.`; break; }
          clean[f.key] = n; break;
        }
        case 'date': {
          const d = U.parseDate(v);
          if (!d) errors[f.key] = `${f.label} is not a valid date.`; else clean[f.key] = d; break;
        }
        case 'select': {
          const hit = f.options.find(o => U.norm(o) === U.norm(v));
          if (hit === undefined) errors[f.key] = `${f.label}: "${v}" is not an allowed value.`; else clean[f.key] = hit; break;
        }
        default: {
          const s = String(v); const max = MAXLEN[f.type === 'textarea' ? 'textarea' : 'text'];
          if (s.length > max) errors[f.key] = `${f.label} is too long (max ${max}).`; else clean[f.key] = s;
        }
      }
    }
    return { errors, clean };
  }

  const defaults = entity => Object.fromEntries(entities[entity].fields.filter(f => f.default != null).map(f => [f.key, f.default]));

  LGM.Schema = { entities, validate, defaults };
})(typeof window !== 'undefined' ? window : globalThis);

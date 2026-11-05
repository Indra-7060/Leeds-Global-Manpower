/* REPORTS — one registry of report definitions (replaces V6's regex-on-status lookups, defects D-9/D-10).
   Every report is built from the live records and returns { columns, rows }. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util, M = LGM.Metrics, Lc = LGM.Lifecycle;
  const n = U.norm;

  const col = (...pairs) => pairs.map(([key, label]) => ({ key, label }));
  const CAND = col(['id', 'Candidate ID'], ['name', 'Candidate'], ['passport', 'Passport'], ['client', 'Client'], ['order_id', 'Order'], ['country', 'Country'], ['agency', 'Agency'], ['trade', 'Trade'], ['status', 'Stage'], ['visa_number', 'Visa No.'], ['qvc_date', 'QVC date'], ['flight_date', 'Flight date']);
  const ORD = col(['id', 'Order'], ['client', 'Client'], ['country', 'Country'], ['trade', 'Trade'], ['qty', 'Qty'], ['status', 'Stage'], ['agency', 'Agency']);

  const setReport = (label, setName) => ({ label, build: s => ({ columns: CAND, rows: s.candidates.filter(c => Lc.inSet(c.status, setName)) }), stage: setName });
  const travelRows = (s, pred) => s.tickets.map(t => ({ t, c: s.candidates.find(c => c.id === t.candidate_id) })).filter(x => x.c && pred(x.t, x.c))
    .map(({ t, c }) => ({ candidate_id: c.id, candidate: c.name, client: c.client, country: c.country, ticket_by: t.ticket_by, flight: t.flight, flight_date: c.flight_date, driver_name: t.driver_name, driver_phone: t.driver_phone, ticket_status: t.step, stage: c.status }));
  const TRAVEL = col(['candidate_id', 'Candidate ID'], ['candidate', 'Candidate'], ['client', 'Client'], ['country', 'Country'], ['ticket_by', 'Ticket by'], ['flight', 'Flight'], ['flight_date', 'Flight date'], ['driver_name', 'Driver'], ['driver_phone', 'Driver phone'], ['ticket_status', 'Ticket status'], ['stage', 'Candidate stage']);

  const defs = {
    'Candidate List': { build: s => ({ columns: CAND, rows: s.candidates }) },
    'QVC Pending': setReport('QVC Pending', 'QVC Pending'),
    'RTP Pending': setReport('RTP Pending', 'RTP Pending'),
    'Visa Printed': setReport('Visa Printed', 'Visa Printed'),
    'Flight Pending': setReport('Flight Pending', 'Flight Pending'),
    'Arrived': setReport('Arrived', 'Arrived'),
    'Joined': setReport('Joined', 'Joined'),
    'Selected Candidates': setReport('Selected Candidates', 'Selected'),
    'Rejected Candidates': setReport('Rejected Candidates', 'Rejected'),
    'Deployment Schedule': { build: s => ({ columns: CAND, rows: s.candidates.filter(c => ['Visa Printed', 'Deployment Ready', 'Arrived'].includes(c.status)) }) }, // V6 /deployment|printed|arrived/
    'Interview Schedule': { build: s => ({ columns: col(['client', 'Client'], ['method', 'Method'], ['country', 'Country'], ['date', 'Date'], ['candidates', 'Candidates'], ['status', 'Status']), rows: s.interviews.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')) }) },
    'Tickets Issued': { build: s => ({ columns: TRAVEL, rows: travelRows(s, t => M.stepRank(t.step) >= 2) }) },
    'Arrival Schedule': { build: s => ({ columns: TRAVEL, rows: travelRows(s, (t, c) => !!c.flight_date).sort((a, b) => a.flight_date.localeCompare(b.flight_date)) }) },
    'Order Progress': { build: s => ({ columns: col(['id', 'Order'], ['client', 'Client'], ['country', 'Country'], ['trade', 'Trade'], ['qty', 'Qty'], ['status', 'Stage'], ['cvs', 'CVs linked'], ['selected', 'Selected+'], ['deployed', 'Deployed'], ['remaining', 'Remaining']), rows: M.orderProgress(s) }) },
    'Open Orders': { build: s => ({ columns: ORD, rows: s.orders.filter(M.isOpenOrder) }) },
    'All Orders': { build: s => ({ columns: ORD, rows: s.orders }) },
    'Agency Candidates': { build: s => ({ columns: CAND, rows: s.candidates.filter(c => c.agency).sort((a, b) => a.agency.localeCompare(b.agency)) }) },
    'Agency Deployment': { build: s => ({ columns: col(['agency', 'Agency'], ['allocated', 'Allocated'], ['cvs', 'CVs'], ['selected', 'Selected+'], ['arrived', 'Deployed']), rows: M.agentPerformance(s) }) },
    'Warranty Cases': { build: s => ({ columns: col(['id', 'Case'], ['division', 'Division'], ['client', 'Client'], ['candidate_id', 'Candidate'], ['issue', 'Issue'], ['status', 'Status'], ['warranty_start', 'Start'], ['warranty_expiry', 'Expiry']), rows: s.warranties }) },
    'Domestic Worker Cases': { build: s => ({ columns: col(['id', 'Case'], ['customer', 'Customer'], ['origin', 'Worker origin'], ['status', 'Status'], ['next_action', 'Next action']), rows: s.domestic }) },
    'Demand Letters': { build: s => ({ columns: col(['id', 'Reference'], ['client', 'Client'], ['order_id', 'Order'], ['countries', 'Countries'], ['trades', 'Trades'], ['letter_date', 'Letter date'], ['signed', 'Signed'], ['status', 'Status']), rows: s.demands }) },
    // V6 "Planned" reports — formulas are ASSUMPTIONS (OQ-21)
    'Country-wise Recruitment': { build: s => ({ columns: col(['country', 'Country'], ['orders', 'Orders'], ['ordered_qty', 'Ordered qty'], ['cvs', 'CVs'], ['selected', 'Selected+'], ['deployed', 'Deployed']), rows: M.countryWise(s) }) },
    'Agent Performance': { build: s => ({ columns: col(['agency', 'Agency'], ['allocated', 'Allocated'], ['cvs', 'CVs'], ['selected', 'Selected+'], ['selection_ratio', 'Selection ratio'], ['arrived', 'Deployed']), rows: M.agentPerformance(s) }) },
    'Warranty Expiry': { build: (s, f) => ({ columns: col(['case', 'Case'], ['division', 'Division'], ['client', 'Client'], ['candidate', 'Candidate'], ['issue', 'Issue'], ['status', 'Status'], ['warranty_expiry', 'Expiry'], ['days_left', 'Days left']), rows: M.warrantyExpiry(s, f.today || U.todayISO()) }) },
    'Demand & Sales Visits': { build: s => ({ columns: col(['client', 'Client'], ['visits', 'Visits'], ['follow_ups', 'Follow-ups'], ['orders_received', 'Orders received'], ['demand_letters', 'Demand letters'], ['open_demand', 'Open demand'], ['orders', 'Orders']), rows: M.demandSales(s) }) },
    'Master Recruitment Report': { build: (s, f) => { const m = M.masterReport(s, { country: f.country || 'All', query: f.client && f.client !== 'All' ? f.client : '' }); return { columns: col(['company', 'Company'], ['country', 'Country'], ['demand', 'Order'], ['applied', 'Applied'], ['qvc', 'QVC'], ['rtp', 'RTP'], ['printed', 'Printed'], ['deployed', 'Deployed'], ['remaining', 'Remaining']), rows: [...m.rows, m.total], skipFilters: true }; } },
    'CV Intake': { build: s => ({ columns: col(['filename', 'File'], ['source', 'Source'], ['client', 'Client'], ['agency', 'Agency'], ['country', 'Country'], ['extracted_email', 'E-mail'], ['extracted_phone', 'Phone'], ['status', 'Status'], ['received', 'Received']), rows: s.cvInbox }) },
    'Private Finance': { permission: 'finance.export', build: s => ({ columns: col(['date', 'Date'], ['division', 'Division'], ['direction', 'Direction'], ['account', 'Account'], ['party', 'Party'], ['client', 'Client'], ['country', 'Country'], ['order', 'Order'], ['category', 'Category'], ['amount', 'Amount'], ['ref', 'Reference'], ['note', 'Note']), rows: s.finance }) },
  };

  // Quick-report chips per page (V6 v6QuickReports; entries that could never return data in V6 are removed — see doc 01 D-9).
  const quick = {
    interviews: ['Interview Schedule', 'Selected Candidates', 'Rejected Candidates'],
    visas: ['QVC Pending', 'RTP Pending', 'Visa Printed'],
    deployment: ['Flight Pending', 'Deployment Schedule', 'Arrived', 'Joined'],
    tickets: ['Flight Pending', 'Tickets Issued', 'Arrival Schedule'],
    orders: ['Order Progress', 'Open Orders'],
    candidates: ['Candidate List', 'QVC Pending'],
    agencies: ['Agency Candidates', 'Agency Deployment'],
    warranty: ['Warranty Cases', 'Warranty Expiry'],
    domestic: ['Domestic Worker Cases'],
    demands: ['Demand Letters', 'Demand & Sales Visits'],
    clients: ['Demand & Sales Visits', 'Candidate List'],
    visits: ['Demand & Sales Visits'],
    'visa-master': ['Master Recruitment Report'],
  };
  const defaultQuick = ['Candidate List', 'QVC Pending', 'Flight Pending'];

  function applyFilters(rows, f) {
    return rows.filter(r => (!f.client || f.client === 'All' || !('client' in r) || n(r.client) === n(f.client))
      && (!f.country || f.country === 'All' || !('country' in r) || n(r.country) === n(f.country)));
  }

  /** Run a report by name with toolbar filters {client,country,stage}. Returns {name, columns, rows} or {error}. */
  function run(name, state, filters = {}, role) {
    const d = defs[name]; if (!d) return { error: 'Unknown report: ' + name };
    if (d.permission && !LGM.Permissions.can(role, d.permission)) return { error: 'Financial reports are restricted to Managing Director and Admin Manager.' };
    const out = d.build(state, filters);
    let rows = out.skipFilters ? out.rows : applyFilters(out.rows, filters);
    if (!out.skipFilters && filters.stage && filters.stage !== 'All' && rows.length && 'status' in rows[0] && 'passport' in rows[0]) {
      rows = rows.filter(c => Lc.inSet(c.status, filters.stage));
    }
    return { name, columns: out.columns, rows };
  }

  /** Keyword report router (V6 v5RunReport, same precedence) + an explanation of how the request was read. */
  function keyword(query, state, role) {
    const q = String(query || '').trim(), l = q.toLowerCase();
    if (!q) return { error: 'Type a request, e.g. "QVC pending for <client> Nepal".' };
    const why = []; let name;
    if (/finance|payment|expense|cash|qiib|profit|agency balance|outstanding/.test(l)) { name = 'Private Finance'; why.push('finance terms found'); }
    else if (/order|demand/.test(l)) { name = 'All Orders'; why.push('"order/demand" found'); }
    else if (/qvc/.test(l)) name = 'QVC Pending';
    else if (/rtp/.test(l)) name = 'RTP Pending';
    else if (/flight|ticket|deploy|ready to fly/.test(l)) name = 'Flight Pending';
    else if (/printed/.test(l)) name = 'Visa Printed';
    else if (/arrived|arrival/.test(l)) name = 'Arrived';
    else if (/joined/.test(l)) name = 'Joined';
    else if (/rejected/.test(l)) name = 'Rejected Candidates';
    else if (/selected/.test(l)) name = 'Selected Candidates';
    else if (/warranty/.test(l)) name = 'Warranty Cases';
    else if (/domestic/.test(l)) name = 'Domestic Worker Cases';
    else { name = 'Candidate List'; why.push('no stage keyword — showing all candidates'); }
    const clients = U.uniqSorted([...state.clients.map(c => c.name), ...state.orders.map(o => o.client), ...state.candidates.map(c => c.client)]).sort((a, b) => b.length - a.length);
    const client = clients.find(c => l.includes(c.toLowerCase()));
    const countries = U.uniqSorted([...C.countries, ...state.candidates.map(c => c.country), ...state.orders.map(o => o.country)]).filter(x => x !== 'Other');
    const country = countries.find(c => l.includes(c.toLowerCase()));
    const filters = { client: client || 'All', country: country || 'All' };
    const res = run(name, state, filters, role);
    if (res.error) return res;
    res.interpretation = [`Report: ${name}`, client ? `Client: ${client}` : null, country ? `Country: ${country}` : null, ...why].filter(Boolean);
    return res;
  }

  LGM.Reports = { defs, quick: p => quick[p] || defaultQuick, run, keyword, applyFilters, CAND };
})(typeof window !== 'undefined' ? window : globalThis);

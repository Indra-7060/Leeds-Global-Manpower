/** One registry of reports (replaces V6's regex-on-status lookups). Every report is built from live records → {columns, rows}. */
import { C, can } from '../config';
import { norm, todayISO, uniqSorted } from '../util';
import { inSet as stageInSet } from './lifecycle';
import * as M from './metrics';
import type { Rec, ReportColumn, ReportResult, State } from './types';

const col = (...pairs: [string, string][]): ReportColumn[] => pairs.map(([key, label]) => ({ key, label }));
export const CAND = col(['id', 'Candidate ID'], ['name', 'Candidate'], ['passport', 'Passport'], ['client', 'Client'], ['order_id', 'Order'], ['country', 'Country'], ['agency', 'Agency'], ['trade', 'Trade'], ['status', 'Stage'], ['visa_number', 'Visa No.'], ['qvc_date', 'QVC date'], ['flight_date', 'Flight date']);
const ORD = col(['id', 'Order'], ['client', 'Client'], ['country', 'Country'], ['trade', 'Trade'], ['qty', 'Qty'], ['status', 'Stage'], ['agency', 'Agency']);
const TRAVEL = col(['candidate_id', 'Candidate ID'], ['candidate', 'Candidate'], ['client', 'Client'], ['country', 'Country'], ['ticket_by', 'Ticket by'], ['flight', 'Flight'], ['flight_date', 'Flight date'], ['driver_name', 'Driver'], ['driver_phone', 'Driver phone'], ['ticket_status', 'Ticket status'], ['stage', 'Candidate stage']);

type Filters = { client?: string; country?: string; stage?: string; today?: string };
interface Def { permission?: string; build: (s: State, f: Filters) => { columns: ReportColumn[]; rows: Rec[]; skipFilters?: boolean } }

const setReport = (setName: string): Def => ({ build: s => ({ columns: CAND, rows: s.candidates.filter(c => stageInSet(c.status, setName)) }) });
const travelRows = (s: State, pred: (t: Rec, c: Rec) => boolean) => s.tickets.map(t => ({ t, c: s.candidates.find(c => c.id === t.candidate_id) })).filter((x): x is { t: Rec; c: Rec } => !!x.c && pred(x.t, x.c))
  .map(({ t, c }) => ({ candidate_id: c.id, candidate: c.name, client: c.client, country: c.country, ticket_by: t.ticket_by, flight: t.flight, flight_date: c.flight_date, driver_name: t.driver_name, driver_phone: t.driver_phone, ticket_status: t.step, stage: c.status }));

export const defs: Record<string, Def> = {
  'Candidate List': { build: s => ({ columns: CAND, rows: s.candidates }) },
  'QVC Pending': setReport('QVC Pending'), 'RTP Pending': setReport('RTP Pending'), 'Visa Printed': setReport('Visa Printed'), 'Flight Pending': setReport('Flight Pending'),
  Arrived: setReport('Arrived'), Joined: setReport('Joined'), 'Selected Candidates': setReport('Selected'), 'Rejected Candidates': setReport('Rejected'),
  'Deployment Schedule': { build: s => ({ columns: CAND, rows: s.candidates.filter(c => ['Visa Printed', 'Deployment Ready', 'Arrived'].includes(c.status)) }) },
  'Interview Schedule': { build: s => ({ columns: col(['client', 'Client'], ['method', 'Method'], ['country', 'Country'], ['date', 'Date'], ['candidates', 'Candidates'], ['status', 'Status']), rows: s.interviews.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')) }) },
  'Tickets Issued': { build: s => ({ columns: TRAVEL, rows: travelRows(s, t => M.stepRank(t.step) >= 2) }) },
  'Arrival Schedule': { build: s => ({ columns: TRAVEL, rows: travelRows(s, (_t, c) => !!c.flight_date).sort((a, b) => a.flight_date.localeCompare(b.flight_date)) }) },
  'Order Progress': { build: s => ({ columns: col(['id', 'Order'], ['client', 'Client'], ['country', 'Country'], ['trade', 'Trade'], ['qty', 'Qty'], ['status', 'Stage'], ['cvs', 'CVs linked'], ['selected', 'Selected+'], ['deployed', 'Deployed'], ['remaining', 'Remaining']), rows: M.orderProgress(s) }) },
  'Open Orders': { build: s => ({ columns: ORD, rows: s.orders.filter(M.isOpenOrder) }) },
  'All Orders': { build: s => ({ columns: ORD, rows: s.orders }) },
  'Agency Candidates': { build: s => ({ columns: CAND, rows: s.candidates.filter(c => c.agency).sort((a, b) => a.agency.localeCompare(b.agency)) }) },
  'Agency Deployment': { build: s => ({ columns: col(['agency', 'Agency'], ['allocated', 'Allocated'], ['cvs', 'CVs'], ['selected', 'Selected+'], ['arrived', 'Deployed']), rows: M.agentPerformance(s) }) },
  'Warranty Cases': { build: s => ({ columns: col(['id', 'Case'], ['division', 'Division'], ['client', 'Client'], ['candidate_id', 'Candidate'], ['issue', 'Issue'], ['status', 'Status'], ['warranty_start', 'Start'], ['warranty_expiry', 'Expiry']), rows: s.warranties }) },
  'Domestic Worker Cases': { build: s => ({ columns: col(['id', 'Case'], ['customer', 'Sponsor'], ['sponsor_type', 'Sponsor type'], ['category', 'Category'], ['origin', 'Worker nationality'], ['status', 'Status'], ['next_action', 'Next action']), rows: s.domestic }) },
  'Demand Letters': { build: s => ({ columns: col(['id', 'Reference'], ['client', 'Client'], ['order_id', 'Order'], ['countries', 'Countries'], ['trades', 'Trades'], ['letter_date', 'Letter date'], ['signed', 'Signed'], ['status', 'Status']), rows: s.demands }) },
  'Country-wise Recruitment': { build: s => ({ columns: col(['country', 'Country'], ['orders', 'Orders'], ['ordered_qty', 'Ordered qty'], ['cvs', 'CVs'], ['selected', 'Selected+'], ['deployed', 'Deployed']), rows: M.countryWise(s) }) },
  'Agent Performance': { build: s => ({ columns: col(['agency', 'Agency'], ['allocated', 'Allocated'], ['cvs', 'CVs'], ['selected', 'Selected+'], ['selection_ratio', 'Selection ratio'], ['arrived', 'Deployed']), rows: M.agentPerformance(s) }) },
  'Warranty Expiry': { build: (s, f) => ({ columns: col(['case', 'Case'], ['division', 'Division'], ['client', 'Client'], ['candidate', 'Candidate'], ['issue', 'Issue'], ['status', 'Status'], ['warranty_expiry', 'Expiry'], ['days_left', 'Days left']), rows: M.warrantyExpiryReport(s, f.today || todayISO()) }) },
  'Demand & Sales Visits': { build: s => ({ columns: col(['client', 'Client'], ['visits', 'Visits'], ['follow_ups', 'Follow-ups'], ['orders_received', 'Orders received'], ['demand_letters', 'Demand letters'], ['open_demand', 'Open demand'], ['orders', 'Orders']), rows: M.demandSales(s) }) },
  'Master Recruitment Report': { build: (s, f) => {
    const m = M.masterReport(s, { country: f.country || 'All', query: f.client && f.client !== 'All' ? f.client : '' });
    return { columns: col(['company', 'Company'], ['country', 'Country'], ['demand', 'Order'], ['applied', 'Applied'], ['qvc', 'QVC'], ['rtp', 'RTP'], ['printed', 'Printed'], ['deployed', 'Deployed'], ['remaining', 'Remaining']), rows: [...m.rows, m.total], skipFilters: true };
  } },
  'CV Intake': { build: s => ({ columns: col(['filename', 'File'], ['source', 'Source'], ['client', 'Client'], ['agency', 'Agency'], ['country', 'Country'], ['extracted_email', 'E-mail'], ['extracted_phone', 'Phone'], ['status', 'Status'], ['received', 'Received']), rows: s.cvInbox }) },
  'Audit Log': { build: s => ({ columns: col(['at', 'When'], ['role', 'Role'], ['client', 'Client'], ['entity', 'Entity'], ['id', 'Record'], ['text', 'Activity']), rows: s.activity }) },
  'Private Finance': { permission: 'finance.export', build: s => ({ columns: col(['date', 'Date'], ['division', 'Division'], ['direction', 'Direction'], ['account', 'Account'], ['party', 'Party'], ['client', 'Client'], ['country', 'Country'], ['order', 'Order'], ['category', 'Category'], ['amount', 'Amount'], ['ref', 'Reference'], ['note', 'Note']), rows: s.finance }) },
};

export { quickReports } from '../quick';

export function applyFilters(rows: Rec[], f: Filters): Rec[] {
  return rows.filter(r => (!f.client || f.client === 'All' || !('client' in r) || norm(r.client) === norm(f.client)) && (!f.country || f.country === 'All' || !('country' in r) || norm(r.country) === norm(f.country)));
}

export function runReport(name: string, s: State, filters: Filters = {}, role?: string): ReportResult {
  const d = defs[name];
  if (!d) return { name, columns: [], rows: [], error: 'Unknown report: ' + name };
  if (d.permission && !can(role, d.permission)) return { name, columns: [], rows: [], error: 'Financial reports are restricted to Managing Director and Admin Manager.' };
  const out = d.build(s, filters);
  let rows = out.skipFilters ? out.rows : applyFilters(out.rows, filters);
  if (!out.skipFilters && filters.stage && filters.stage !== 'All' && rows.length && 'status' in rows[0] && 'passport' in rows[0]) rows = rows.filter(c => stageInSet(c.status, filters.stage!));
  return { name, columns: out.columns, rows };
}

/** Keyword report router (same precedence as V6) with an explanation of how the request was read. */
export function keywordReport(query: string, s: State, role?: string): ReportResult {
  const q = String(query ?? '').trim(), l = q.toLowerCase();
  if (!q) return { name: '', columns: [], rows: [], error: 'Type a request, e.g. "QVC pending for <client> Nepal".' };
  const why: string[] = []; let name: string;
  if (/finance|payment|expense|cash|qiib|profit|agency balance|outstanding/.test(l)) { name = 'Private Finance'; why.push('finance terms found'); }
  else if (/order|demand/.test(l)) { name = 'All Orders'; why.push('"order/demand" found'); }
  else if (/qvc/.test(l)) name = 'QVC Pending'; else if (/rtp/.test(l)) name = 'RTP Pending';
  else if (/flight|ticket|deploy|ready to fly/.test(l)) name = 'Flight Pending'; else if (/printed/.test(l)) name = 'Visa Printed';
  else if (/arrived|arrival/.test(l)) name = 'Arrived'; else if (/joined/.test(l)) name = 'Joined';
  else if (/rejected/.test(l)) name = 'Rejected Candidates'; else if (/selected/.test(l)) name = 'Selected Candidates';
  else if (/warranty/.test(l)) name = 'Warranty Cases'; else if (/domestic/.test(l)) name = 'Domestic Worker Cases';
  else { name = 'Candidate List'; why.push('no stage keyword — showing all candidates'); }
  const clients = uniqSorted([...s.clients.map(c => c.name), ...s.orders.map(o => o.client), ...s.candidates.map(c => c.client)]).sort((a, b) => b.length - a.length);
  const client = clients.find(c => l.includes(c.toLowerCase()));
  const countries = uniqSorted([...C.countries, ...s.candidates.map(c => c.country), ...s.orders.map(o => o.country)]).filter(x => x !== 'Other');
  const country = countries.find(c => l.includes(c.toLowerCase()));
  const res = runReport(name, s, { client: client || 'All', country: country || 'All' }, role);
  if (res.error) return res;
  res.interpretation = [`Report: ${name}`, client ? `Client: ${client}` : '', country ? `Country: ${country}` : '', ...why].filter(Boolean);
  return res;
}

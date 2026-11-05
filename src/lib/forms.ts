/**
 * Form definitions — one place that drives (a) the form the user sees and (b) the server-side validation.
 * Fields come from the V6 tables/forms. Safe to import from client components (no server-only code here).
 */
import { C } from './config';
import { num, parseDate, norm } from './util';
import { v8Specs } from './forms-v8';

export type FieldType = 'text' | 'textarea' | 'select' | 'int' | 'number' | 'date' | 'lookup';
export interface Field {
  key: string; label: string; type: FieldType;
  required?: boolean; options?: readonly string[]; min?: number; default?: string | number;
  help?: string; placeholder?: string; full?: boolean;
  /** Only shown when creating (e.g. a candidate's starting stage — later changes go through the stage buttons). */
  createOnly?: boolean;
  /** type 'lookup': name of the option list supplied by the page (e.g. 'clients', 'orders'). */
  lookup?: string;
  /** Display names for select options (value → label). */
  labels?: Record<string, string>;
  /** Free text with suggestions from a list supplied by the page (e.g. countries). */
  suggest?: string;
}
export interface Spec { label: string; fields: Field[] }

const country = (o: Partial<Field> = {}): Field => ({ key: 'country', label: 'Country', type: 'text', required: true, suggest: 'countries', ...o });

export const specs: Record<string, Spec> = {
  clients: { label: 'Client', fields: [
    { key: 'name', label: 'Client name', type: 'text', required: true }, { key: 'sector', label: 'Sector', type: 'text' },
    { key: 'stage', label: 'Stage', type: 'select', options: C.clientStages, required: true, default: 'Prospect' },
    { key: 'segment', label: 'Division', type: 'select', options: C.clientSegments, required: true, default: 'Blue-Collar', help: 'Corporate = local/overseas placement client. Choose Both if the company uses both services.' }, { key: 'next_action', label: 'Next action', type: 'text' },
  ] },
  orders: { label: 'Order', fields: [
    { key: 'client', label: 'Client', type: 'lookup', lookup: 'clients', required: true },
    country({ default: 'Bangladesh' }),
    { key: 'trade', label: 'Trade', type: 'text', required: true, placeholder: 'e.g. Steel Fixer' },
    { key: 'qty', label: 'Quantity', type: 'int', required: true, min: 1, default: 50 },
    { key: 'status', label: 'Stage', type: 'select', options: C.orderStatuses, required: true, default: 'New Order' },
    { key: 'agency', label: 'Overseas agency (optional)', type: 'text', suggest: 'agencies', help: 'Formal agency allocations are recorded under Overseas Agencies.' },
  ] },
  candidates: { label: 'Candidate', fields: [
    { key: 'name', label: 'Candidate name', type: 'text', required: true },
    { key: 'passport', label: 'Passport no.', type: 'text', help: 'Used to detect duplicates. Fictional values only until the production system is secured.' },
    { key: 'client', label: 'Client', type: 'lookup', lookup: 'clients', required: true },
    { key: 'order_id', label: 'Order', type: 'lookup', lookup: 'orders' },
    country({ default: 'Bangladesh' }), { key: 'agency', label: 'Overseas agency', type: 'text', suggest: 'agencies' },
    { key: 'trade', label: 'Trade', type: 'text', required: true },
    { key: 'status', label: 'Starting stage', type: 'select', options: [...C.stages, C.rejectedStage], default: 'CV Submitted', createOnly: true, help: 'Later changes use the stage buttons so the workflow is respected.' },
    { key: 'visa_number', label: 'Visa number', type: 'text' }, { key: 'qvc_date', label: 'QVC date', type: 'date' }, { key: 'flight_date', label: 'Flight date', type: 'date' },
  ] },
};

export type Errors = Record<string, string>;

/** Validate + coerce. A default only fills a blank DROPDOWN; typed data (quantity, country…) is never invented. */
export function validateInput(entity: string, input: Record<string, unknown>, opts: { editing?: boolean } = {}): { errors: Errors; clean: Record<string, any> } {
  const spec = specs[entity]; const errors: Errors = {}; const clean: Record<string, any> = {};
  for (const f of spec.fields) {
    if (opts.editing && f.createOnly) continue;
    let v = input[f.key]; if (typeof v === 'string') v = v.trim();
    let blank = v == null || v === '';
    if (blank && !opts.editing && f.default != null && f.type === 'select') { v = f.default; blank = false; }
    if (blank) { if (f.required) errors[f.key] = `${f.label} is required.`; clean[f.key] = f.type === 'int' || f.type === 'number' ? null : ''; continue; }
    switch (f.type) {
      case 'int': case 'number': {
        const n = num(v);
        if (!Number.isFinite(n)) errors[f.key] = `${f.label} must be a number.`;
        else if (f.type === 'int' && !Number.isInteger(n)) errors[f.key] = `${f.label} must be a whole number.`;
        else if (f.min != null && n < f.min) errors[f.key] = `${f.label} must be at least ${f.min}.`;
        else clean[f.key] = n; break;
      }
      case 'date': { const d = parseDate(v); if (!d) errors[f.key] = `${f.label} is not a valid date.`; else clean[f.key] = d; break; }
      case 'select': { const hit = f.options!.find(o => norm(o) === norm(v)); if (hit === undefined) errors[f.key] = `${f.label}: "${v}" is not an allowed value.`; else clean[f.key] = hit; break; }
      default: { const s = String(v), max = f.type === 'textarea' ? 2000 : 200; if (s.length > max) errors[f.key] = `${f.label} is too long (max ${max}).`; else clean[f.key] = s; }
    }
  }
  return { errors, clean };
}

export const defaultsFor = (entity: string): Record<string, string | number> =>
  Object.fromEntries(specs[entity].fields.filter(f => f.default != null).map(f => [f.key, f.default as string | number]));

// ───────────── Stage 2 record types ─────────────
const sel = (key: string, label: string, options: readonly string[], o: Partial<Field> = {}): Field => ({ key, label, type: 'select', options, ...o });

Object.assign(specs, {
  visits: { label: 'Visit', fields: [
    { key: 'client', label: 'Client', type: 'lookup', lookup: 'clients', required: true }, { key: 'contact', label: 'Contact', type: 'text' },
    { key: 'date', label: 'Visit / follow-up date', type: 'date', required: true },
    sel('outcome', 'Outcome', C.visitOutcomes, { required: true, default: 'Profile Presented' }), sel('pipeline_stage', 'Sales pipeline stage', C.salesPipeline, { default: 'Company Identified' }),
    { key: 'next_action', label: 'Next action', type: 'text' }, { key: 'salesperson', label: 'Salesperson', type: 'text' }, { key: 'notes', label: 'Notes', type: 'textarea', full: true },
  ] },
  demands: { label: 'Demand letter', fields: [
    { key: 'client', label: 'Client', type: 'lookup', lookup: 'clients', required: true }, { key: 'order_id', label: 'Linked order', type: 'lookup', lookup: 'orders' },
    { key: 'letter_date', label: 'Letter date', type: 'date' }, { key: 'countries', label: 'Countries', type: 'text' }, { key: 'trades', label: 'Trades', type: 'text' },
    { key: 'quantities', label: 'Trade-wise quantities', type: 'text' }, { key: 'nationality', label: 'Nationality', type: 'text' }, { key: 'salary_benefits', label: 'Salary & benefits', type: 'text' },
    sel('signed', 'Signed letter received', ['Yes', 'No'], { default: 'No' }), { key: 'agency_allocation', label: 'Agency allocation', type: 'text' },
    sel('status', 'Status', C.demandStatuses, { required: true, default: 'Received' }),
  ] },
  allocations: { label: 'Agency allocation', fields: [
    { key: 'agency', label: 'Agency', type: 'text', required: true, suggest: 'agencies' }, country({}),
    { key: 'order_id', label: 'Order', type: 'lookup', lookup: 'orders', required: true },
    { key: 'allocated', label: 'Allocated quantity', type: 'int', required: true, min: 1 }, sel('status', 'Status', C.agencyStatuses, { required: true, default: 'Sourcing' }),
  ] },
  interviews: { label: 'Interview event', fields: [
    { key: 'client', label: 'Client', type: 'lookup', lookup: 'clients', required: true }, sel('method', 'Method', C.interviewMethods, { required: true }), country({}),
    { key: 'date', label: 'Date', type: 'date' }, { key: 'candidates', label: 'Candidates', type: 'int', min: 0 }, sel('status', 'Status', C.interviewStatuses, { required: true, default: 'Scheduled' }),
  ] },
  tickets: { label: 'Travel record', fields: [
    { key: 'candidate_id', label: 'Candidate', type: 'lookup', lookup: 'travelCandidates', required: true, help: 'Only candidates from Visa Printed onward without a travel record are listed.' },
    sel('ticket_by', 'Ticket by', C.ticketBy), { key: 'flight', label: 'Flight details', type: 'text' },
    { key: 'flight_date', label: 'Flight date', type: 'date', help: 'Saved on the candidate record.' },
    { key: 'driver_name', label: 'Pickup driver name', type: 'text' }, { key: 'driver_phone', label: 'Pickup driver phone', type: 'text' },
    sel('step', 'Ticket status', C.ticketSteps, { required: true, default: 'Pending' }),
  ] },
  warranties: { label: 'Warranty case', fields: [
    sel('division', 'Division', C.warrantyDivisions, { required: true, default: 'Labour' }),
    { key: 'client', label: 'Client / household', type: 'text', required: true, suggest: 'clients' }, { key: 'candidate_id', label: 'Candidate (optional)', type: 'lookup', lookup: 'candidates' },
    { key: 'issue', label: 'Issue', type: 'text', required: true }, sel('status', 'Status', C.warrantyStatuses, { required: true, default: 'Pending' }),
    { key: 'warranty_start', label: 'Warranty start', type: 'date' },
    { key: 'warranty_expiry', label: 'Warranty expiry', type: 'date', help: 'Labour: filled automatically as start + 3 months if left blank (illustrative, OQ-8). Domestic: enter manually after legal check.' },
  ] },
  domestic: { label: 'Sponsor case', fields: [
    // V8: the client is an INDIVIDUAL sponsor — no company / CR / purchase-order fields exist on purpose.
    sel('sponsor_type', 'Sponsor type', C.v8.sponsorTypes, { required: true, default: 'Qatari Citizen' }),
    { key: 'customer', label: 'Sponsor full name', type: 'text', required: true },
    { key: 'qid', label: 'QID / sponsor reference', type: 'text', help: 'Stored encrypted; only the last characters are ever shown. On edit, leave blank to keep the saved value.' },
    { key: 'mobile', label: 'Mobile', type: 'text' }, { key: 'address', label: 'Address', type: 'text', full: true },
    { key: 'category', label: 'Worker category', type: 'text', required: true, suggest: 'domesticCategories', placeholder: 'e.g. Housemaid', help: 'Pick from the list or type a new one. The list is managed in Settings → Editable lists.' },
    { key: 'origin', label: 'Worker nationality', type: 'text', required: true, placeholder: 'e.g. Philippines', suggest: 'countries' },
    sel('status', 'Status', C.domesticStatuses, { required: true, default: 'Customer Enquiry' }), { key: 'next_action', label: 'Next action', type: 'text' },
    { key: 'arrival_date', label: 'Arrival date', type: 'date' },
    { key: 'handover_date', label: 'Handover date', type: 'date', help: 'Starts the nine-month guarantee window.' },
    { key: 'handover_note', label: 'Handover evidence / note', type: 'text', full: true, help: 'Describe the evidence on file (e.g. signed handover form). Files go in the Contract Library.' },
  ] },
} satisfies Record<string, Spec>);

Object.assign(specs, {
  finance: { label: 'Transaction', fields: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'division', label: 'Business division', type: 'select', options: C.financeDivisions.map(d => d[0]), labels: Object.fromEntries(C.financeDivisions), required: true, default: 'labour' },
    sel('direction', 'Incoming / Outgoing', ['Incoming', 'Outgoing'], { required: true, default: 'Incoming' }), sel('account', 'Payment account', C.financeAccounts, { required: true, default: 'Cash' }),
    { key: 'party', label: 'Agency / customer / partner', type: 'text', required: true }, { key: 'client', label: 'Qatar client', type: 'text', suggest: 'clients' }, country({ required: false }),
    { key: 'order', label: 'Order reference', type: 'text' }, sel('category', 'Category', C.financeCategories, { required: true, default: 'Agency payment' }),
    { key: 'amount', label: 'Amount (QAR)', type: 'number', required: true, min: 0.01 }, { key: 'ref', label: 'Reference / receipt number', type: 'text' }, { key: 'note', label: 'Remarks', type: 'text' },
  ] },
  credentials: { label: 'Credential record', fields: [
    { key: 'client', label: 'Client', type: 'lookup', lookup: 'clients', required: true }, sel('portal', 'Portal', C.credentialPortals, { required: true }),
    { key: 'record', label: 'Record (description only)', type: 'text', required: true, placeholder: 'e.g. Credentials on file', help: 'Never type passwords, OTPs or login details here.' },
  ] },
} satisfies Record<string, Spec>);

// V8 record types (client developer package) — defined in forms-v8.ts
Object.assign(specs, v8Specs);

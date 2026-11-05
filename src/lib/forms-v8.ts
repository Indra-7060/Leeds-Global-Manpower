/** V8 form definitions (client developer package). Merged into `specs` by forms.ts. Safe for client components. */
import { C } from './config';
import type { Field, Spec } from './forms';

const sel = (key: string, label: string, options: readonly string[], o: Partial<Field> = {}): Field => ({ key, label, type: 'select', options, ...o });
const yn = (key: string, label: string, def: 'Yes' | 'No', o: Partial<Field> = {}): Field => sel(key, label, ['Yes', 'No'], { required: true, default: def, ...o });
const lookup = (key: string, label: string, name: string, o: Partial<Field> = {}): Field => ({ key, label, type: 'lookup', lookup: name, ...o });
const optionKeys = (m: Record<string, string>) => ({ options: Object.keys(m), labels: m });

export const v8Specs: Record<string, Spec> = {
  domAccount: { label: 'Sponsor fee agreement', fields: [
    lookup('case_id', 'Sponsor case', 'domesticCases', { required: true }),
    { key: 'agreed_fee', label: 'Agreed recruitment fee (QAR)', type: 'number', required: true, min: 0 },
    { key: 'gov_fees', label: 'Applicable government fees (QAR)', type: 'number', min: 0, help: 'Used in refund estimates. Confirm against the signed contract and current rules.' },
    { key: 'notes', label: 'Notes', type: 'text', full: true },
  ] },
  domPayments: { label: 'Sponsor payment', fields: [
    lookup('case_id', 'Sponsor case', 'domesticCases', { required: true }),
    sel('direction', 'Direction', ['Incoming', 'Outgoing'], { required: true, default: 'Incoming', help: 'Incoming = received from the sponsor. Outgoing = a refund actually paid (record only after approval).' }),
    sel('category', 'Payment type', C.v8.domesticPaymentCategories, { required: true, default: 'Advance' }),
    { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'amount', label: 'Amount (QAR)', type: 'number', required: true, min: 0.01 },
    sel('account', 'Account', C.financeAccounts, { required: true, default: C.financeDefaultAccount.domestic }), { key: 'reference', label: 'Bank / QIIB reference', type: 'text' },
    { key: 'note', label: 'Remarks', type: 'text', full: true, help: 'A receipt number is issued automatically for incoming payments.' },
  ] },
  refunds: { label: 'Refund claim', fields: [
    lookup('case_id', 'Sponsor case', 'domesticCases', { required: true }),
    { key: 'months_served', label: 'Completed months of service (0–9)', type: 'int', required: true, min: 0 },
    sel('reason', 'Reason for return / claim', C.v8.refundReasons, { required: true }),
    { key: 'evidence', label: 'Evidence on file', type: 'textarea', required: true, full: true, help: 'What proves the reason (medical report, complaint letter, police report…). Required.' },
    { key: 'fee_paid', label: 'Recruitment fee paid (QAR)', type: 'number', min: 0, help: 'Leave blank to use the payments received so far.' },
    { key: 'gov_fees', label: 'Government fees (QAR)', type: 'number', min: 0, help: 'Leave blank to use the fee agreement.' },
  ] },
  vacancies: { label: 'Vacancy', fields: [
    lookup('client', 'Company / client', 'clients', { required: true }), { key: 'title', label: 'Job title / vacancy', type: 'text', required: true },
    sel('category', 'Job category', C.v8.jobCategories), { key: 'quantity', label: 'Number of vacancies', type: 'int', required: true, min: 1, default: 1 },
    sel('source', 'Candidate source', C.v8.vacancySources, { required: true, default: 'Local Qatar' }), sel('status', 'Status', C.v8.vacancyStatuses, { required: true, default: 'Open' }),
    { key: 'notes', label: 'Notes', type: 'text', full: true },
  ] },
  placements: { label: 'Candidate placement', fields: [
    lookup('vacancy_id', 'Vacancy', 'vacancies', { required: true }), { key: 'candidate_name', label: 'Candidate name', type: 'text', required: true },
    sel('source', 'Source', C.v8.placementSources, { required: true, default: 'Local Qatar' }), { key: 'country', label: 'Country (overseas)', type: 'text', suggest: 'countries' },
    sel('stage', 'Stage', C.v8.placementStages, { required: true, default: 'Shortlisted' }),
    { key: 'offer_date', label: 'Offer date', type: 'date' },
    { key: 'joining_date', label: 'Confirmed joining date', type: 'date', help: 'Only enter once joining is verified — the placement-fee clock starts from this date.' },
    { key: 'notes', label: 'Notes', type: 'text', full: true },
  ] },
  placementFees: { label: 'Placement fee', fields: [
    lookup('placement_id', 'Placement', 'placements', { required: true }),
    { key: 'basic_salary', label: 'Candidate monthly BASIC salary (QAR)', type: 'number', required: true, min: 0 },
    { type: 'select', key: 'basis', label: 'Agreed fee basis', required: true, default: 'one', ...optionKeys(C.v8.feeBasis) },
    { key: 'custom_fee', label: 'Custom fee (QAR)', type: 'number', min: 0, help: 'Only used for “Custom fixed fee”.' },
    sel('due_months', 'Payment due after confirmed joining', C.v8.feeDueMonths.map(String), { required: true, default: '1', labels: { '1': '1 calendar month', '3': '3 calendar months' } }),
    { key: 'invoice_no', label: 'Invoice number', type: 'text' }, { key: 'invoice_date', label: 'Invoice date', type: 'date' },
    { key: 'credit_note', label: 'Credit note (QAR)', type: 'number', min: 0 }, { key: 'credit_reason', label: 'Credit / cancellation reason', type: 'text' },
    { key: 'note', label: 'Contract wording / notes', type: 'text', full: true, help: 'The signed agreement decides the real trigger — note any exception here.' },
  ] },
  placePayments: { label: 'Fee receipt', fields: [
    lookup('placement_fee_id', 'Placement fee', 'placementFees', { required: true }), { key: 'date', label: 'Date received', type: 'date', required: true },
    { key: 'amount', label: 'Amount (QAR)', type: 'number', required: true, min: 0.01 }, sel('account', 'Account', C.financeAccounts, { required: true, default: 'Other bank' }),
    { key: 'reference', label: 'Reference', type: 'text' }, { key: 'note', label: 'Remarks', type: 'text' },
  ] },
  serviceTerms: { label: 'Service-charge agreement', fields: [
    lookup('client', 'Client', 'clients', { required: true }), lookup('order_id', 'Order (optional — blank = all orders of the client)', 'orders'),
    yn('enabled', 'Client pays a service charge?', 'No', { help: 'No charge unless the signed agreement enables it.' }),
    sel('currency', 'Currency', C.v8.serviceCurrencies, { required: true, default: 'USD' }),
    { type: 'select', key: 'basis', label: 'Charge basis', required: true, default: 'worker', ...optionKeys(C.v8.serviceBasis) },
    { key: 'amount', label: 'Negotiated charge', type: 'number', required: true, min: 0 }, sel('trigger', 'Invoice trigger', C.v8.serviceTriggers, { required: true, default: 'Verified arrival' }),
    yn('taxable', 'Taxable?', 'No'), { key: 'notes', label: 'Agreement reference / notes', type: 'text', full: true },
  ] },
  serviceInvoices: { label: 'Service-charge invoice', fields: [
    lookup('term_id', 'Agreement', 'serviceTerms', { required: true }),
    { key: 'workers', label: 'Workers invoiced', type: 'int', min: 0, help: 'Per-worker agreements only. Cannot exceed workers who reached the trigger and are not yet invoiced.' },
    { key: 'invoice_no', label: 'Invoice number', type: 'text' }, { key: 'date', label: 'Invoice date', type: 'date', required: true }, { key: 'note', label: 'Remarks', type: 'text' },
  ] },
  servicePayments: { label: 'Service-charge receipt', fields: [
    lookup('service_invoice_id', 'Invoice', 'serviceInvoices', { required: true }), { key: 'date', label: 'Date received', type: 'date', required: true },
    { key: 'amount', label: 'Amount (invoice currency)', type: 'number', required: true, min: 0.01 }, sel('account', 'Account', C.financeAccounts, { required: true, default: 'Other bank' }),
    { key: 'reference', label: 'Reference', type: 'text' }, { key: 'note', label: 'Remarks', type: 'text' },
  ] },
  fundAllocations: { label: 'Deposit allocation', fields: [
    lookup('finance_entry_id', 'Agency deposit', 'deposits', { required: true }), lookup('order_id', 'Order', 'orderIds'), lookup('candidate_id', 'Candidate (optional)', 'candidateIds'),
    { key: 'amount', label: 'Amount to allocate (QAR)', type: 'number', required: true, min: 0.01, help: 'Stays a proposal until the Managing Director approves it.' }, { key: 'note', label: 'Note', type: 'text', full: true },
  ] },
  contracts: { label: 'Contract', fields: [
    { type: 'select', key: 'division', label: 'Division', required: true, default: 'labour', options: C.v8.contractDivisions.map(d => d[0]), labels: Object.fromEntries(C.v8.contractDivisions) },
    lookup('client', 'Company (Blue-Collar / Corporate)', 'clients', { help: 'Filed under the company folder.' }),
    lookup('case_id', 'Individual sponsor (Domestic)', 'domesticCases', { help: 'Domestic contracts are filed by sponsor, never by company.' }),
    { key: 'title', label: 'Title', type: 'text', required: true }, sel('agreement_type', 'Agreement type', C.v8.agreementTypes, { required: true, default: 'Manpower supply agreement' }),
    { key: 'signed_date', label: 'Signed date', type: 'date' }, { key: 'effective_date', label: 'Effective date', type: 'date' }, { key: 'expiry_date', label: 'Expiry date', type: 'date', help: 'Alerts at 90 / 30 / 7 days.' },
    lookup('order_id', 'Linked order', 'orderIds'),
    { key: 'billing_terms', label: 'Billing terms', type: 'textarea', full: true }, { key: 'warranty_terms', label: 'Warranty terms', type: 'textarea', full: true }, { key: 'notes', label: 'Notes', type: 'textarea', full: true },
  ] },
  tasks: { label: 'Task', fields: [
    { key: 'title', label: 'Task', type: 'text', required: true }, sel('kind', 'Type', C.v8.taskKinds, { required: true, default: 'Manual' }),
    lookup('assignee_id', 'Assigned to', 'users', { required: true }), { key: 'due_date', label: 'Due date', type: 'date' }, sel('priority', 'Priority', C.v8.taskPriorities, { required: true, default: 'Normal' }),
    { key: 'linked_code', label: 'Related record (e.g. ORD-1001)', type: 'text' }, { key: 'detail', label: 'Details', type: 'textarea', full: true },
  ] },
  interviewEntries: { label: 'Interview result', fields: [
    lookup('interview_id', 'Interview event', 'interviewIds', { required: true }), lookup('candidate_id', 'Candidate', 'candidateIds', { required: true }),
    sel('attended', 'Attended?', ['Yes', 'No']), sel('decision', 'Client decision', C.v8.interviewDecisions, { required: true, default: 'Pending' }), { key: 'note', label: 'Note', type: 'text', full: true },
  ] },
};

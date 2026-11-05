/**
 * Import analysis — pure and testable. Same targets, field lists and aliases as V6; every row is validated with the same
 * rules as manual entry, duplicates are found against ALL existing records, and NOTHING is written here (dry run).
 */
import { C, can } from '../config';
import { validateInput } from '../forms';
import { norm, num, parseDate } from '../util';
import { canonical } from './lifecycle';
import { candidateKey, canonicalCountry, financeKey, orderKey } from './rules';
import type { Rec, State } from './types';

export type Target = 'candidates' | 'orders' | 'finance';
export const FIELDS: Record<Target, string[]> = {
  candidates: ['candidate_name', 'passport', 'client', 'country', 'agency', 'trade', 'status', 'visa_number', 'qvc_date', 'flight_date', 'order_id'],
  orders: ['client', 'country', 'agency', 'trade', 'quantity', 'status', 'order_id'],
  finance: ['date', 'division', 'direction', 'account', 'party', 'client', 'country', 'order', 'category', 'amount', 'ref', 'note'],
};
export const REQUIRED: Record<Target, string[]> = {
  candidates: ['candidate_name', 'client', 'country', 'trade'], orders: ['client', 'country', 'trade', 'quantity'], finance: ['date', 'direction', 'party', 'category', 'amount'],
};
/** V6's alias lists (unchanged) + a few obvious header spellings. */
export const ALIASES: Record<string, string[]> = {
  candidate_name: ['name', 'candidate', 'candidate name', 'full name', 'worker name'], passport: ['passport', 'passport number', 'passport no', 'pp no'],
  client: ['client', 'company', 'company name', 'employer', 'qatar company'], country: ['country', 'nationality', 'source country'],
  agency: ['agency', 'agent', 'recruitment agency', 'overseas agency'], trade: ['trade', 'profession', 'category', 'job title', 'position'],
  status: ['status', 'visa status', 'stage', 'current status'], visa_number: ['visa number', 'visa no', 'vp number'], qvc_date: ['qvc date', 'appointment date'],
  flight_date: ['flight date', 'travel date', 'ticket date'], order_id: ['order id', 'order no', 'demand number'], quantity: ['quantity', 'qty', 'required', 'total'],
  date: ['date', 'transaction date', 'payment date'], division: ['division', 'business', 'business division'], direction: ['direction', 'type', 'incoming outgoing', 'receipt payment'],
  account: ['account', 'payment method', 'bank cash'], party: ['party', 'agency name', 'paid to', 'received from', 'customer'], order: ['order', 'order ref'],
  amount: ['amount', 'qar', 'total amount'], ref: ['reference', 'receipt no', 'transaction id'], note: ['remarks', 'notes', 'description'], category: ['expense type', 'category', 'purpose'],
};
export const label = (f: string) => f.replace(/_/g, ' ');

export function guessMapping(target: Target, columns: string[]): Record<string, string> {
  const used = new Set<number>(), map: Record<string, string> = {};
  for (const f of FIELDS[target]) {
    const opts = [label(f), ...(ALIASES[f] ?? [])].map(norm);
    const i = columns.findIndex((c, ci) => !used.has(ci) && opts.includes(norm(c)));
    map[f] = i < 0 ? '' : String(i); if (i >= 0) used.add(i);
  }
  return map;
}
export const mapRows = (target: Target, rows: string[][], mapping: Record<string, string>): Rec[] =>
  rows.map(row => Object.fromEntries(FIELDS[target].map(f => [f, mapping[f] === '' || mapping[f] == null ? '' : String(row[Number(mapping[f])] ?? '').trim()])));

export interface ValidRow { row: number; input: Rec; key: string; code?: string; newClient?: string; warnings: string[] }
export interface Analysis { target: Target; total: number; valid: ValidRow[]; duplicates: { row: number; reason: string; raw: Rec }[]; invalid: { row: number; errors: string[]; raw: Rec }[]; newClients: string[] }

const OUT = /(^|\b)(out|outgoing|expense|payment|paid|debit|dr)\b/i, INN = /^(in|incoming|receipt|received|credit|cr)\b/i;

function normaliseRow(target: Target, r: Rec): { input: Rec; entity: string; key: string; code?: string; errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const missing = REQUIRED[target].filter(f => !r[f]);
  if (missing.length) errors.push('Missing required: ' + missing.map(label).join(', '));
  if (target === 'candidates') {
    const input: Rec = { name: r.candidate_name, passport: r.passport, client: r.client, order_id: r.order_id, country: canonicalCountry(r.country), agency: r.agency, trade: r.trade, visa_number: r.visa_number, qvc_date: r.qvc_date, flight_date: r.flight_date };
    if (r.status) { const st = canonical(r.status); if (st) input.status = st; else errors.push(`Unknown status "${r.status}"`); }
    return { input, entity: 'candidates', key: candidateKey({ passport: r.passport, name: r.candidate_name, client: r.client }), errors, warnings };
  }
  if (target === 'orders') {
    const input: Rec = { client: r.client, country: canonicalCountry(r.country), agency: r.agency, trade: r.trade, qty: r.quantity };
    if (r.status) { const st = C.orderStatuses.find(x => norm(x) === norm(r.status)); if (st) input.status = st; else errors.push(`Unknown order stage "${r.status}"`); }
    return { input, entity: 'orders', code: r.order_id || undefined, key: orderKey({ id: r.order_id, client: r.client, country: r.country, trade: r.trade }), errors, warnings };
  }
  const division = /domestic/i.test(r.division) ? 'domestic' : 'labour';
  let direction = '';
  if (r.direction) { if (OUT.test(r.direction)) direction = 'Outgoing'; else if (INN.test(r.direction)) direction = 'Incoming'; else errors.push(`Direction "${r.direction}" is not Incoming/Outgoing`); }
  const account = r.account ? C.financeAccounts.find(a => norm(a) === norm(r.account)) ?? null : C.financeDefaultAccount[division];
  if (r.account && !account) errors.push(`Account "${r.account}" is not one of ${C.financeAccounts.join(', ')}`);
  let category = C.financeCategories.find(c => norm(c) === norm(r.category)) ?? '', note = r.note;
  if (r.category && !category) { category = 'Other'; note = (note ? note + ' | ' : '') + 'Original category: ' + r.category; warnings.push(`Category "${r.category}" mapped to Other`); }
  const amount = num(r.amount);
  const input: Rec = { date: r.date, division, direction, account: account ?? '', party: r.party, client: r.client, country: r.country ? canonicalCountry(r.country) : '', order: r.order, category, amount: Number.isFinite(amount) ? amount : r.amount, ref: r.ref, note };
  return { input, entity: 'finance', key: financeKey({ date: parseDate(r.date) ?? r.date, ref: r.ref, party: r.party, amount: Number.isFinite(amount) ? amount : r.amount, direction }), errors, warnings };
}

/** Dry run: classify every row as valid / duplicate / invalid. Throws if the role may not import this target. */
export function analyse(target: Target, mapped: Rec[], s: State, role: string): Analysis {
  if (target === 'finance' && !can(role, 'finance.import')) throw new Error('Finance import is restricted to the Managing Director and Admin Manager.');
  const out: Analysis = { target, total: mapped.length, valid: [], duplicates: [], invalid: [], newClients: [] };
  const batch = new Set<string>(), registered = new Set(s.clients.map(c => norm(c.name))), orderCodes = new Set(s.orders.map(o => norm(o.id))), newClients = new Map<string, string>();
  const existing = target === 'candidates' ? new Set(s.candidates.map(candidateKey))
    : target === 'orders' ? new Set([...s.orders.map(o => orderKey(o)), ...s.orders.map(o => o._key).filter(Boolean)]) : new Set(s.finance.map(financeKey));

  mapped.forEach((r, i) => {
    const row = i + 1, x = normaliseRow(target, r);
    if (x.errors.length) return void out.invalid.push({ row, errors: x.errors, raw: r });
    if (batch.has(x.key) || existing.has(x.key)) return void out.duplicates.push({ row, reason: batch.has(x.key) ? 'Duplicate of an earlier row in this file' : 'Already exists', raw: r });
    if (target === 'orders' && x.code && orderCodes.has(norm(x.code))) return void out.invalid.push({ row, errors: [`Order id ${x.code} is already used by a different order`], raw: r });
    const v = validateInput(target, target === 'orders' ? x.input : x.input);
    if (Object.keys(v.errors).length) return void out.invalid.push({ row, errors: Object.values(v.errors), raw: r });
    const warnings = [...x.warnings];
    let newClient: string | undefined;
    if (target !== 'finance' && !registered.has(norm(x.input.client))) { newClient = x.input.client; newClients.set(norm(x.input.client), x.input.client); warnings.push(`Client "${x.input.client}" will be added to the register as Prospect`); }
    batch.add(x.key); if (x.code) orderCodes.add(norm(x.code));
    out.valid.push({ row, input: x.input, key: x.key, code: x.code, newClient, warnings });
  });
  out.newClients = [...newClients.values()];
  return out;
}

/** Rejected + duplicate rows as a table (header first) so staff can fix and re-import. */
export function problemRows(a: Analysis): string[][] {
  const head = ['data_row', 'problem', ...FIELDS[a.target].map(label)];
  const lines = [...a.invalid.map(x => [x.row, 'REJECTED: ' + x.errors.join('; '), x.raw] as const), ...a.duplicates.map(x => [x.row, 'DUPLICATE: ' + x.reason, x.raw] as const)]
    .sort((p, q) => p[0] - q[0]).map(([row, why, raw]) => [String(row), why, ...FIELDS[a.target].map(f => String(raw[f] ?? ''))]);
  return [head, ...lines];
}

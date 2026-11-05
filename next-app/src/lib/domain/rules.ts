/** Duplicate keys (V6's own rules) and derived values. Pure. */
import { C } from '../config';
import { addMonths, norm } from '../util';
import type { Rec } from './types';

/** V6: passport if present, else name + client. */
export const candidateKey = (c: Rec) => (c.passport ? `pp:${norm(c.passport)}` : `name:${norm(c.name)}:${norm(c.client)}`);
export const orderKey = (o: Rec) => `${norm(o.id ?? o.order_id)}:${norm(o.client)}:${norm(o.country)}:${norm(o.trade)}`;
export const financeKey = (f: Rec) => `${f.date}:${norm(f.ref)}:${norm(f.party)}:${f.amount}:${f.direction}`;

/** Known country names are written in their canonical spelling; unknown ones are kept as typed. */
export const canonicalCountry = (v: string) => C.countries.find(x => norm(x) === norm(v)) ?? v;

/** Labour warranty expiry = start + 3 months when not given (V6 "illustrative"); domestic gets no default (OQ-8). */
export function warrantyExpiry(division: string, start: string, expiry: string): string {
  if (expiry) return expiry;
  const months = C.warrantyMonths[division];
  return start && months ? addMonths(start, months) : '';
}

/** Anything that looks like a password/secret must not be stored in the credentials register. */
export const looksLikeSecret = (text: string) => /pass(word|code)?\s*[:=]|otp\s*[:=]|pin\s*[:=]|secret\s*[:=]/i.test(text);

export const candidatePrefix = (country: string) => C.countryPrefix[canonicalCountry(country)] ?? 'XX';

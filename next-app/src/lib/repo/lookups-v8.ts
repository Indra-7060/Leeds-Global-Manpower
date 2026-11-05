import 'server-only';
import { prisma } from '@/lib/db';
import { C, can, type RoleId, type Workspace } from '@/lib/config';
import * as V from '@/lib/domain/v8';
import { dateToISO } from '@/lib/util';
import type { Lookups } from '@/components/EntityForm';

const num = (x: unknown) => Number(x ?? 0);

/** Option lists for the V8 forms. Money-related lists are only returned to users who may see finance. */
export async function v8Lookups(ws: Workspace, role: RoleId): Promise<Lookups> {
  const where = { workspace: ws }, fin = can(role, 'finance.view');
  const [cases, vacancies, placements, fees, terms, invoices, deposits, orders, cands, interviews, users, clients] = await Promise.all([
    prisma.domesticCase.findMany({ where, orderBy: { code: 'asc' } }),
    prisma.corporateVacancy.findMany({ where, include: { client: true }, orderBy: { code: 'asc' } }),
    prisma.corporatePlacement.findMany({ where, orderBy: { code: 'asc' } }),
    fin ? prisma.placementFee.findMany({ where, include: { placement: true }, orderBy: { id: 'asc' } }) : [],
    fin ? prisma.serviceFeeTerm.findMany({ where, include: { client: true }, orderBy: { id: 'asc' } }) : [],
    fin ? prisma.serviceFeeInvoice.findMany({ where, include: { term: { include: { client: true } } }, orderBy: { code: 'asc' } }) : [],
    fin ? prisma.financeEntry.findMany({ where: { ...where, category: C.v8.allocationCategory, direction: 'Incoming' }, include: { allocations: true }, orderBy: { date: 'desc' } }) : [],
    prisma.order.findMany({ where, include: { client: true }, orderBy: { code: 'asc' } }),
    prisma.candidate.findMany({ where, select: { id: true, code: true, name: true, client: { select: { name: true } } }, orderBy: { code: 'asc' } }),
    prisma.interview.findMany({ where, include: { client: true }, orderBy: { id: 'asc' } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.client.findMany({ where, orderBy: { name: 'asc' } }),
  ]);
  const o = (value: string | number, label: string) => ({ value: String(value), label });
  return {
    clients: clients.map(c => o(c.name, c.name)),
    countries: C.countries.map(x => o(x, x)),
    domesticCases: cases.map(c => o(c.id, `${c.code} · ${c.customer || '(no name)'}`)),
    vacancies: vacancies.map(v => o(v.id, `${v.code} · ${v.client.name} · ${v.title}`)),
    placements: placements.map(p => o(p.id, `${p.code} · ${p.candidateName}`)),
    placementFees: fees.map(f => o(f.id, `${f.placement.code} · ${f.placement.candidateName}`)),
    serviceTerms: terms.map(t => o(t.id, `${t.client.name} · ${C.v8.serviceBasis[t.basis]} · ${t.currency} ${num(t.amount)}`)),
    serviceInvoices: invoices.map(i => o(i.id, `${i.code} · ${i.term.client.name} · ${i.term.currency} ${num(i.amount)}`)),
    deposits: deposits.map(e => ({ e, u: V.unallocated(num(e.amount), e.allocations.map(a => ({ status: a.status, amount: num(a.amount) }))) })).filter(x => x.u.unallocated > 0)
      .map(({ e, u }) => o(e.id, `${dateToISO(e.date)} · ${e.party} · QAR ${num(e.amount)} (free ${u.unallocated})`)),
    orders: orders.map(x => o(x.code, `${x.code} · ${x.client.name} · ${x.trade}`)),
    orderIds: orders.map(x => o(x.id, `${x.code} · ${x.client.name} · ${x.trade}`)),
    candidateIds: cands.map(c => o(c.id, `${c.code} · ${c.name} · ${c.client.name}`)),
    candidates: cands.map(c => o(c.code, `${c.code} · ${c.name}`)),
    interviewIds: interviews.map(i => o(i.id, `${dateToISO(i.date) || 'no date'} · ${i.client.name} · ${i.method} · ${i.country}`)),
    users: users.map(u => o(u.id, u.name)),
  };
}

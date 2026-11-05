import { C } from './config';
import { uniqSorted } from './util';
import type { State } from './domain/types';
import type { Lookups } from '@/components/EntityForm';

const TRAVEL_STAGES = ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];

/** Option lists used by the forms (clients, orders, countries, agencies, candidates). */
export function buildLookups(s: State, opts: { keepTravelCandidate?: string } = {}): Lookups {
  const withTravel = new Set(s.tickets.map(t => t.candidate_id));
  return {
    clients: s.clients.filter(c => c.segment !== 'Corporate').map(c => ({ value: c.name, label: c.name })), // Corporate-only companies are not offered for blue-collar records
    countries: C.countries.map(x => ({ value: x, label: x })),
    orders: s.orders.map(o => ({ value: o.id, label: `${o.id} · ${o.client} · ${o.trade}` })),
    agencies: uniqSorted([...s.allocations.map(a => a.agency), ...s.candidates.map(c => c.agency)]).map(x => ({ value: x, label: x })),
    candidates: s.candidates.map(c => ({ value: c.id, label: `${c.id} · ${c.name}` })),
    travelCandidates: s.candidates.filter(c => TRAVEL_STAGES.includes(c.status) && (!withTravel.has(c.id) || c.id === opts.keepTravelCandidate)).map(c => ({ value: c.id, label: `${c.id} · ${c.name} · ${c.client}` })),
  };
}

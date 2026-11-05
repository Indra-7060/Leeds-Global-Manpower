/** Reminders — V6 shows three static rows; each is a rule evaluated on live data. In-app only (OQ-17). */
import { C } from '../config';
import { diffDays, todayISO } from '../util';
import { inSet, inStages, stepRank, ticketOf } from './metrics';
import type { Rec, State } from './types';

export interface Alert { id: string; action: string; assigned: string; count: number; items: string[]; page: string }

export function computeAlerts(s: State, today = todayISO()): Alert[] {
  const fp = inSet(s, 'Flight Pending');
  const label = (c: Rec) => `${c.id} ${c.name} (${c.client})`;
  const out: Alert[] = [];
  const add = (id: string, action: string, assigned: string, items: string[], page: string) => { if (items.length) out.push({ id, action, assigned, count: items.length, items: items.slice(0, 8), page }); };

  add('ticket-responsibility', 'Confirm who books the ticket (client or agency)', 'Operations', fp.filter(c => { const t = ticketOf(s, c.id); return !t || !t.ticket_by; }).map(label), 'tickets');
  add('ticket-request', 'Request flight ticket from client', 'Operations', fp.filter(c => { const t = ticketOf(s, c.id); return t && t.ticket_by === 'Client' && stepRank(t.step) < 1; }).map(label), 'tickets');
  add('ticket-date', 'Ticket date / flight details missing', 'Operations', fp.filter(c => { const t = ticketOf(s, c.id); return t && stepRank(t.step) >= 1 && !c.flight_date; }).map(label), 'tickets');
  add('driver', 'Collect arrival driver name & phone', 'Operations', fp.filter(c => { const t = ticketOf(s, c.id); return !t || !t.driver_name || !t.driver_phone; }).map(label), 'tickets');
  add('qvc', 'Follow up QVC result', 'Visa Team', inStages(s, ['QVC']).map(label), 'visas');
  add('followup', 'Sales follow-up pending', 'Sales', s.visits.filter(v => v.outcome === 'Follow-up').map(v => `${v.client}${v.next_action ? ' — ' + v.next_action : ''}`), 'visits');
  add('warranty-expiry', `Warranty expiring within ${C.warrantyAlertDays} days (or expired)`, 'Operations',
    s.warranties.filter(w => w.warranty_expiry && w.status !== 'Closed' && diffDays(today, w.warranty_expiry) <= C.warrantyAlertDays).map(w => `${w.id} ${w.client} — ${w.warranty_expiry}`), 'warranty');
  add('warranty-open', 'Open warranty complaints', 'Operations', s.warranties.filter(w => w.status !== 'Closed').map(w => `${w.id} ${w.client} — ${w.issue}`), 'warranty');
  add('cv-review', 'CV intake files awaiting review', 'Operations', s.cvInbox.filter(x => x.status === 'Needs review').map(x => x.filename), 'cv-inbox');
  add('no-order-link', 'Candidates not linked to an order', 'Operations', s.candidates.filter(c => !c.order_id).map(label), 'candidates');
  return out;
}

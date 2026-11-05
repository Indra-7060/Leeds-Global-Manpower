/* BUSINESS LOGIC — reminders / notifications. V6 shows three static reminders; here each is a rule evaluated on live data.
   In-app only: e-mail/WhatsApp delivery needs a backend (OQ-17). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util, M = LGM.Metrics;

  function compute(s, today = U.todayISO()) {
    const fp = M.inSet(s, 'Flight Pending');
    const tk = c => M.ticketOf(s, c.id);
    const label = c => `${c.id} ${c.name} (${c.client})`;
    const out = [];
    const add = (id, action, assigned, items, link) => { if (items.length) out.push({ id, action, assigned, count: items.length, items: items.slice(0, 8), link }); };

    add('ticket-responsibility', 'Confirm who books the ticket (client or agency)', 'Operations',
      fp.filter(c => { const t = tk(c); return !t || !t.ticket_by; }).map(label), { page: 'tickets' });
    add('ticket-request', 'Request flight ticket from client', 'Operations',
      fp.filter(c => { const t = tk(c); return t && t.ticket_by === 'Client' && M.stepRank(t.step) < 1; }).map(label), { page: 'tickets' });
    add('ticket-date', 'Ticket date / flight details missing', 'Operations',
      fp.filter(c => { const t = tk(c); return t && M.stepRank(t.step) >= 1 && !c.flight_date; }).map(label), { page: 'tickets' });
    add('driver', 'Collect arrival driver name & phone', 'Operations',
      fp.filter(c => { const t = tk(c); return !t || !t.driver_name || !t.driver_phone; }).map(label), { page: 'tickets' });
    add('qvc', 'Follow up QVC result', 'Visa Team', M.inStages(s, ['QVC']).map(label), { page: 'visas' });
    add('followup', 'Sales follow-up pending', 'Sales', s.visits.filter(v => v.outcome === 'Follow-up').map(v => `${v.client}${v.next_action ? ' — ' + v.next_action : ''}`), { page: 'visits' });
    add('warranty-expiry', `Warranty expiring within ${C.warrantyAlertDays} days (or expired)`, 'Operations',
      s.warranties.filter(w => w.warranty_expiry && w.status !== 'Closed' && U.diffDays(today, w.warranty_expiry) <= C.warrantyAlertDays).map(w => `${w.id} ${w.client} — ${w.warranty_expiry}`), { page: 'warranty' });
    add('warranty-open', 'Open warranty complaints', 'Operations', s.warranties.filter(w => w.status !== 'Closed').map(w => `${w.id} ${w.client} — ${w.issue}`), { page: 'warranty' });
    add('cv-review', 'CV intake files awaiting review', 'Operations', s.cvInbox.filter(x => x.status === 'Needs review' || /review/i.test(x.status || '')).map(x => x.filename), { page: 'cv-inbox' });
    add('no-order-link', 'Candidates not linked to an order', 'Operations', s.candidates.filter(c => !c.order_id).map(label), { page: 'candidates' });
    return out;
  }

  LGM.Alerts = { compute };
})(typeof window !== 'undefined' ? window : globalThis);

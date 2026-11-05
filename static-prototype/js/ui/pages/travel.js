/* PAGES — Deployment & Arrival, Tickets & Arrival Coordination, Warranty & Replacements. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {};
  const UI = LGM.UI, Crud = LGM.Crud, C = LGM.Config, M = LGM.Metrics, S = LGM.Store, U = LGM.Util;
  const tick = d => UI.raw(d ? '<span class="pill green">✓</span>' : '<span class="muted">—</span>');
  const DEPLOY_STAGES = ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];

  LGM.Pages.deployment = {
    render() {
      const s = S.state(), d = M.deployCards(s);
      const steps = ['Visa printed', 'Ticket requested', 'Arrival notice', 'Driver details', 'Arrival verified', 'Warranty started'];
      return UI.heading('Deployment & Arrival', 'Ticket booking, arrival notice, pickup driver and joining verification') +
        UI.cards([UI.metric('Ready to Fly', d.readyToFly, 'Visa printed / deployment ready'), UI.metric('Tickets Pending', d.ticketsPending, 'Flight details not yet shared'), UI.metric('Arrival Notices', d.arrivalNotices, 'Sent to clients'), UI.metric('Arrivals Verified', d.arrivalsVerified, 'Arrived / joined / warranty')]) +
        Crud.table({
          id: 'deploy', entity: 'candidates', title: 'Deployment Checklist', canAdd: false, canEdit: false, canDelete: false, search: ['id', 'name', 'client'],
          rows: () => S.list('candidates').filter(c => DEPLOY_STAGES.includes(c.status)), filters: [{ key: 'client', label: 'Clients' }, { key: 'status', label: 'Stages', values: () => DEPLOY_STAGES }],
          columns: [{ label: 'Candidate', get: r => `${r.id} · ${r.name}` }, { label: 'Client', get: r => r.client }, { label: 'Stage', get: r => UI.badge(r.status) },
            ...steps.map((label, i) => ({ label, get: r => tick(M.deploymentChecklist(S.state(), r)[i].done) }))],
          rowActions: r => LGM.PageHelpers.stageButtons(r) + UI.btn('Travel', 'go', 'tickets', 'ghost small'), emptyText: 'No candidates have reached Visa Printed yet.',
        }) +
        UI.panel('Checklist steps and who is responsible', UI.table(['Step', 'Responsible', 'Completed when…'], [
          ['Confirm visa printed', 'Operations', 'Candidate stage is Visa Printed or later'], ['Request ticket / inform agent', 'Operations', 'Travel record status is Request Booking or later'],
          ['Send client arrival notice', 'Operations', 'Travel record status is Arrival Notice'], ['Collect pickup driver name & phone', 'Client', 'Driver name and phone are recorded'],
          ['Verify arrival and client joining', 'Operations', 'Candidate stage is Arrived or later'], ['Start applicable warranty', 'Operations', 'Stage is Warranty, or a warranty case is linked']])) +
        UI.panel('Post-Arrival', '<p>Verified arrival creates the basis for an overseas agency charge according to the applicable agreement. Finance staff separately handle payment requests, deposits, manual allocations and Managing Director approvals.</p>' +
          UI.muted('The agency-charge calculation is not automated: V6 states the rule only in text (open question OQ-9).'));
    },
  };

  LGM.Pages.tickets = {
    render() {
      const s = S.state();
      const cand = id => s.candidates.find(c => c.id === id) || {};
      const flightVirtual = [{ key: 'flight_date', label: 'Flight date', type: 'date', help: 'Saved on the candidate record.', get: r => cand(r.candidate_id).flight_date || '',
        after: (vals, rec) => { if ((cand(rec.candidate_id).flight_date || '') !== (vals.flight_date || '')) S.update('candidates', rec.candidate_id, { flight_date: vals.flight_date || '' }, { silent: true, by: UI.state.role }); } }];
      return UI.heading('Tickets & Arrival Coordination', 'Coordinate ticket payer, booking reminders, arrival notice and pickup confirmation') +
        Crud.table({
          id: 'tickets', entity: 'tickets', title: 'Flight Coordination', addLabel: '+ Add Travel Record', search: ['candidate_id', 'flight', 'driver_name'], form: { virtual: flightVirtual },
          filters: [{ key: 'ticket_by', label: 'Ticket by' }, { key: 'step', label: 'Statuses', values: () => C.ticketSteps }, { key: 'client', label: 'Clients', get: r => cand(r.candidate_id).client || '' }],
          columns: [{ label: 'Client', get: r => cand(r.candidate_id).client }, { label: 'Candidate', get: r => `${r.candidate_id} · ${cand(r.candidate_id).name || '?'}` }, { label: 'Ticket By', get: r => r.ticket_by || 'Not confirmed' },
            { label: 'Flight', get: r => [r.flight, cand(r.candidate_id).flight_date].filter(Boolean).join(' · ') || 'Pending' },
            { label: 'Pickup Driver', get: r => r.driver_name ? `${r.driver_name} ${r.driver_phone || ''}` : 'Not provided' }, { label: 'Status', get: r => UI.badge(r.step) }],
          rowActions: r => (M.stepRank(r.step) < C.ticketSteps.length - 1 ? UI.btn('Next →', 'ticketNext', r.id, 'small', `title="${U.esc(C.ticketSteps[M.stepRank(r.step) + 1])}"`) : ''),
          emptyText: 'No travel records yet. Add one for a candidate whose visa is printed.',
        }) +
        UI.panel('Travel Checklist', UI.flow(['Visa Printed', 'Confirm Ticket Responsibility', 'Request Booking', 'Share Flight Details', 'Send Arrival Notice', 'Driver Name & Phone', 'Verify Qatar Arrival', 'Confirm Joining'])) +
        UI.notice('Reminders for missing ticket responsibility, ticket dates and driver details appear under Reports & Alerts. Ticket copies / arrival evidence need file storage (backend) — not available in this version.');
    },
  };
  UI.on('ticketNext', id => {
    const t = S.get('tickets', id); if (!t) return; const next = C.ticketSteps[M.stepRank(t.step) + 1];
    const r = S.update('tickets', id, { step: next }, { by: UI.state.role }); UI.toast(r.ok ? 'Travel status → ' + next : Object.values(r.errors).join(' '), r.ok ? 'ok' : 'err');
  });

  LGM.Pages.warranty = {
    render() {
      const today = U.todayISO();
      const left = r => { if (!r.warranty_expiry) return UI.raw('<span class="muted">—</span>'); const d = U.diffDays(today, r.warranty_expiry); return UI.raw(`${U.esc(r.warranty_expiry)} ${r.status === 'Closed' ? '' : d < 0 ? '<span class="pill red">Expired</span>' : d <= C.warrantyAlertDays ? `<span class="pill orange">${d} d left</span>` : ''}`); };
      return UI.heading('Warranty & Replacements', 'Track labour client warranty and domestic-worker statutory guarantees separately') +
        Crud.table({
          id: 'warranty', entity: 'warranties', title: 'Warranty Cases', addLabel: '+ New Case', search: ['id', 'client', 'issue', 'candidate_id'],
          filters: [{ key: 'division', label: 'Divisions' }, { key: 'status', label: 'Statuses', values: () => C.warrantyStatuses }],
          columns: [{ label: 'Case', get: r => r.id }, { label: 'Division', get: r => r.division }, { label: 'Client', get: r => r.client }, { label: 'Candidate', get: r => r.candidate_id }, { label: 'Issue', get: r => r.issue },
            { label: 'Status', get: r => UI.badge(r.status) }, { label: 'Start', get: r => r.warranty_start }, { label: 'Expiry', get: left }],
          rowActions: r => { const i = C.warrantyStatuses.indexOf(r.status); return i < C.warrantyStatuses.length - 1 ? UI.btn('Next →', 'warrantyNext', r.id, 'small', `title="${U.esc(C.warrantyStatuses[i + 1])}"`) : ''; },
        }) + UI.panel('Case Workflow', UI.flow(['Client Complaint', 'Check Agreement & Dates', 'Record Evidence', 'Return / Replacement Decision', 'Coordinate Agency', 'Close Case'])) +
        UI.notice('Labour: illustrative 3-month contractual warranty — the expiry is filled automatically from the start date and can be overwritten. Domestic: legal guarantee/refund rules must be verified against current Qatar requirements, so no period is assumed; enter the expiry manually (open question OQ-8).');
    },
  };
  UI.on('warrantyNext', id => {
    const w = S.get('warranties', id); if (!w) return; const next = C.warrantyStatuses[C.warrantyStatuses.indexOf(w.status) + 1];
    const r = S.update('warranties', id, { status: next }, { by: UI.state.role }); UI.toast(r.ok ? `${w.id} → ${next}` : Object.values(r.errors).join(' '), r.ok ? 'ok' : 'err');
  });
})(typeof window !== 'undefined' ? window : globalThis);

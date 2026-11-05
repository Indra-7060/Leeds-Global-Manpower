/* PAGES — Candidates & CVs, Interviews & Selection, Visa / QVC / RTP. Stage changes always go through the lifecycle rules. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {}; LGM.PageHelpers = LGM.PageHelpers || {};
  const UI = LGM.UI, Crud = LGM.Crud, C = LGM.Config, Lc = LGM.Lifecycle, M = LGM.Metrics, S = LGM.Store, U = LGM.Util, esc = U.esc;

  /** Stage buttons for one candidate: V6 "Next Stage →" plus skip-optional / reject / undo (all rule-checked). */
  function stageButtons(c) {
    let h = Lc.moves(c.status).map(m => UI.btn(m.kind === 'next' ? 'Next Stage →' : m.kind === 'skip' ? 'Skip → ' + m.to : 'Reject', 'stageMove', c.id,
      m.kind === 'reject' ? 'danger small' : m.kind === 'next' ? 'small' : 'secondary small', `data-to="${esc(m.to)}" title="${esc(m.label)}"`)).join('');
    if (LGM.Permissions.can(UI.state.role, 'stage.undo') && (c.history || []).length > 1) h += UI.btn('Undo', 'stageUndo', c.id, 'ghost small', 'title="Return to the previous stage (logged)"');
    return h;
  }
  LGM.PageHelpers.stageButtons = stageButtons;

  UI.on('stageMove', async (id, el) => {
    const to = el.dataset.to, c = S.get('candidates', id); if (!c) return;
    if (to === C.rejectedStage && !(await UI.confirm({ title: 'Reject candidate?', message: `${c.name} will be marked Rejected. This can be undone by the Managing Director or Admin Manager.`, ok: 'Reject', danger: true }))) return;
    const r = S.moveCandidate(id, to, { by: UI.state.role }); UI.toast(r.ok ? `${c.name} → ${to}` : r.error, r.ok ? 'ok' : 'err');
  });
  UI.on('stageUndo', async id => {
    const c = S.get('candidates', id); if (!c) return;
    const prev = c.history[c.history.length - 2].stage;
    if (!(await UI.confirm({ title: 'Return to previous stage?', message: `${c.name}: ${c.status} → ${prev}. The correction is recorded in the activity log.`, ok: 'Return to ' + prev }))) return;
    const r = S.undoCandidate(id, { by: UI.state.role }); UI.toast(r.ok ? `${c.name} returned to ${prev}` : r.error, r.ok ? 'ok' : 'err');
  });

  UI.on('candView', id => {
    const s = S.state(), c = S.get('candidates', id); if (!c) return;
    const t = M.ticketOf(s, c.id), ord = c.order_id ? S.get('orders', c.order_id) : null;
    const hist = UI.table(['Stage', 'When', 'By'], (c.history || []).map(h => [h.stage, String(h.at).slice(0, 16).replace('T', ' '), h.by || '—']));
    const check = M.deploymentChecklist(s, c);
    UI.modal.open({
      title: `${c.id} · ${c.name}`,
      body: UI.kv({ Client: c.client, Order: ord ? `${ord.id} · ${ord.trade} (${ord.country})` : c.order_id || '—', Country: c.country, Trade: c.trade, Agency: c.agency, Passport: c.passport, 'Visa number': c.visa_number, 'QVC date': c.qvc_date, 'Flight date': c.flight_date, 'Current stage': UI.badge(c.status),
        Source: c._src ? `Imported from ${c._src.file} (row ${c._src.row})` : 'Entered manually' }) +
        `<div class="divider"></div><b style="font-size:13px">Stage history</b>${hist}<div class="divider"></div><b style="font-size:13px">Deployment checklist</b>` +
        `<ul class="checklist">${check.map(x => `<li><span class="ck ${x.done ? 'done' : ''}">${x.done ? '✓' : ''}</span><span style="flex:1">${esc(x.label)}</span><span class="muted">${esc(x.who)}</span></li>`).join('')}</ul>` +
        (t ? '' : UI.muted('No travel record yet — add one under Tickets & Arrival once the visa is printed.')),
      footer: `<button class="btn secondary" data-act="modalClose" type="button">Close</button>`,
    });
  });

  LGM.Pages.candidates = {
    render() {
      return UI.heading('Candidates & CVs', 'Candidate status is tracked individually against each client order') +
        Crud.table({
          id: 'candidates', entity: 'candidates', title: 'Candidate Register', addLabel: '+ Add Candidate', search: ['id', 'name', 'passport', 'client', 'trade', 'agency', 'order_id'],
          filters: [{ key: 'client', label: 'Clients' }, { key: 'country', label: 'Countries' }, { key: 'status', label: 'Stages', values: () => C.stages.concat([C.rejectedStage]) }, { key: 'agency', label: 'Agencies' }],
          columns: [{ label: 'Candidate ID', get: r => r.id }, { label: 'Candidate', get: r => UI.raw(`${esc(r.name)}${r._src ? '<span class="src">imported</span>' : ''}`) }, { label: 'Client', get: r => r.client },
            { label: 'Trade', get: r => r.trade }, { label: 'Country', get: r => r.country }, { label: 'Current Stage', get: r => UI.raw(`${UI.badge(r.status)}${UI.stagebar(r.status)}`) }],
          rowActions: r => UI.btn('View', 'candView', r.id, 'ghost small') + stageButtons(r), emptyText: 'No candidates yet. Add one, or import an Excel/CSV list.',
        }) + UI.panel('Full Candidate Lifecycle', UI.flow(C.stages)) +
        UI.notice('Stage changes follow the lifecycle: one step at a time; Pre-Medical and QVC may be skipped when not applicable; Reject is available only during screening (CV Submitted, Client Review, Interview). Editing a candidate never changes the stage.');
    },
  };

  LGM.Pages.interviews = {
    render() {
      return UI.heading('Interviews & Selection', 'Client CV review, Zoom interviews and overseas selection drives') +
        Crud.table({
          id: 'interviews', entity: 'interviews', title: 'Interview Events', addLabel: '+ Schedule Interview', search: ['client', 'method', 'country'], sort: (a, b) => (a.date || '9').localeCompare(b.date || '9'),
          filters: [{ key: 'client', label: 'Clients' }, { key: 'method', label: 'Methods' }, { key: 'status', label: 'Statuses' }],
          columns: [{ label: 'Client', get: r => r.client }, { label: 'Method', get: r => r.method }, { label: 'Country', get: r => r.country }, { label: 'Date', get: r => r.date || '—' }, { label: 'Candidates', get: r => r.candidates }, { label: 'Status', get: r => UI.badge(r.status) }],
        }) +
        UI.panel('Candidates at interview / selection', `<p class="muted">Candidates are moved through Interview → Selected on the Candidates page. Currently: <b>${M.inStages(S.state(), ['Interview']).length}</b> at Interview, <b>${M.inStages(S.state(), ['Selected']).length}</b> Selected, <b>${M.inStages(S.state(), ['Rejected']).length}</b> Rejected.</p>`) +
        UI.panel('After Selection', UI.flow(['Selected Candidate List', 'Passport & CV', 'Client Offer Letter', 'Candidate Acceptance', 'Pre-Medical if Required', 'Visa Application'])) +
        UI.muted('Interview attendance is not tracked because V6 defines no attendance field (open question OQ-1).');
    },
  };

  LGM.Pages.visas = {
    render() {
      const c = M.visaCards(S.state());
      return UI.heading('Visa Processing', 'Apply → QVC → RTP → Print, with country-specific exceptions') +
        UI.cards([UI.metric('Visa Applied', c.applied, 'Current stage'), UI.metric('QVC', c.qvc, 'Current stage'), UI.metric('RTP', c.rtp, 'Ready to print'), UI.metric('Visa Printed', c.printed, 'Current stage')]) +
        Crud.table({
          id: 'visas', entity: 'candidates', title: 'Visa Tracking', canAdd: false, canDelete: false, search: ['id', 'name', 'client', 'visa_number'],
          rows: () => S.list('candidates').filter(x => C.visaStages.includes(x.status)),
          filters: [{ key: 'client', label: 'Clients' }, { key: 'status', label: 'Stages', values: () => C.visaStages }, { key: 'country', label: 'Countries' }],
          columns: [{ label: 'Candidate', get: r => `${r.id} · ${r.name}` }, { label: 'Client', get: r => r.client }, { label: 'Current Stage', get: r => UI.badge(r.status) }, { label: 'Visa No.', get: r => r.visa_number }, { label: 'QVC date', get: r => r.qvc_date },
            { label: 'Action', get: r => C.visaActions[r.status] || '—' }],
          rowActions: stageButtons, emptyText: 'No candidates are in a visa stage yet.', form: {},
        }) + UI.panel('Process Stages', UI.flow(['Offer Accepted', 'Pre-Medical if Required', 'Visa Applied', 'QVC if Applicable', 'RTP', 'Visa Printed']));
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

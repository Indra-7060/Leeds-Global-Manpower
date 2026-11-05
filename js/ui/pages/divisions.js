/* PAGES — Domestic Workers (active division) and Local Corporate (planned division). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {};
  const UI = LGM.UI, Crud = LGM.Crud, C = LGM.Config, M = LGM.Metrics, S = LGM.Store, U = LGM.Util;

  LGM.Pages.domestic = {
    render() {
      const m = M.domestic(S.state());
      return UI.heading('Domestic Workers', 'Active division — household client recruitment under applicable Qatar regulations') +
        UI.cards([UI.metric('Enquiries', m.enquiries, 'Cases'), UI.metric('Workers Shared', m.profilesShared, 'Profiles stage or later'), UI.metric('Visa Cases', m.visaCases, 'Visa & Travel'), UI.metric('Handovers', m.handovers, 'Arrival / guarantee')]) +
        UI.panel('Domestic Worker Workflow', UI.flow(C.domesticStatuses)) +
        Crud.table({
          id: 'domestic', entity: 'domestic', title: 'Customer Cases', addLabel: '+ New Case', search: ['id', 'customer', 'origin', 'next_action'],
          filters: [{ key: 'status', label: 'Statuses', values: () => C.domesticStatuses }, { key: 'origin', label: 'Origins' }],
          columns: [{ label: 'Case', get: r => r.id }, { label: 'Customer', get: r => r.customer }, { label: 'Worker Origin', get: r => r.origin }, { label: 'Status', get: r => UI.badge(r.status) }, { label: 'Next Action', get: r => r.next_action }],
          rowActions: r => { const i = C.domesticStatuses.indexOf(r.status); return i < C.domesticStatuses.length - 1 ? UI.btn('Next →', 'domesticNext', r.id, 'small', `title="${U.esc(C.domesticStatuses[i + 1])}"`) : ''; },
        }) + UI.notice('Fees, payment timing, guarantees, refunds and replacements must be configured and validated against current Qatar law and the signed recruitment contract. This version tracks case progress only; it does not calculate fees or refunds (open question OQ-10).');
    },
  };
  UI.on('domesticNext', id => {
    const d = S.get('domestic', id); if (!d) return; const next = C.domesticStatuses[C.domesticStatuses.indexOf(d.status) + 1];
    const r = S.update('domestic', id, { status: next }, { by: UI.state.role }); UI.toast(r.ok ? `${d.id} → ${next}` : Object.values(r.errors).join(' '), r.ok ? 'ok' : 'err');
  });

  LGM.Pages.corporate = {
    render() {
      return UI.heading('Local Corporate Recruitment', 'Planned division — not yet operational') +
        UI.panel('Launch Status', `<span class="pill grey">Not Started</span><p>Future workflow: client vacancy → Qatar-local candidate sourcing → shortlist → interview → offer → joining → negotiated placement fee.</p>${UI.muted('No vacancy / placement records are kept until the division starts and its data model is defined (open question OQ-11).')}`) +
        UI.panel('Illustrative Client Fee Calculator', `<div class="formgrid"><div><label for="salary">Candidate basic monthly salary (QAR)</label><input id="salary" class="input" type="number" min="0" value="6000" data-input="calcFee"></div>
          <div><label for="rate">Negotiated fee</label><select id="rate" class="input" data-change="calcFee">${C.corporateFeeRates.map(([v, l]) => `<option value="${v}">${U.esc(l)}</option>`).join('')}</select></div></div>
          <div class="divider"></div><div class="muted">Sample client placement fee</div><div class="metric" id="feeResult">${U.money(6000)}</div>
          <p class="muted">Invoice milestone, payment terms and any warranty are negotiated separately with each client.</p>`);
    },
  };
  UI.on('calcFee', () => { const s = Math.max(0, Number(document.getElementById('salary').value) || 0), r = Number(document.getElementById('rate').value); document.getElementById('feeResult').textContent = U.money(s * r); });
})(typeof window !== 'undefined' ? window : globalThis);

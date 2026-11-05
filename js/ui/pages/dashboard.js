/* PAGE — Dashboard. Every number is computed from records (V6 had hard-coded values). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {}); LGM.Pages = LGM.Pages || {};
  const UI = LGM.UI, C = LGM.Config, M = LGM.Metrics, S = LGM.Store, U = LGM.Util;

  function recent(s) {
    const rows = s.activity.filter(a => a.text).slice(0, 7).map(a => [a.client || '—', a.text, String(a.at).slice(0, 10)]);
    return UI.table(['Client', 'Update', 'Date'], rows, { empty: 'No activity yet — add or import records and the latest changes appear here.' });
  }
  function pending(s) {
    const rows = LGM.Alerts.compute(s).slice(0, 6).map(a => [a.action, a.assigned, a.count, UI.btn('Open', 'go', a.link.page, 'secondary small')]);
    return UI.table(['Pending action', 'Assigned to', 'Count', ''], rows, { empty: 'Nothing pending.' });
  }

  LGM.Pages.dashboard = {
    render() {
      const s = S.state(), div = UI.state.division;
      let h = UI.heading('Management Dashboard', 'Overview of both operating recruitment divisions') +
        UI.tabs([['labour', 'Overseas Labour · Active'], ['domestic', 'Domestic Workers · Active'], ['corporate', 'Local Corporate · Future']], div, 'setDivision');
      if (div === 'labour') {
        const m = M.labour(s), total = Math.max(1, U.sum(m.groups, x => x.count));
        h += UI.cards([UI.metric('Open Orders', m.openOrders, 'Across active clients'), UI.metric('CVs Received', m.cvsReceived.toLocaleString('en-US'), 'Candidate records'),
          UI.metric('Visa Pipeline', m.visaPipeline, 'Across visa stages'), UI.metric('Ready to Fly', m.readyToFly, 'Deployment queue')]);
        h += `<div class="split">${UI.panel('Live Recruitment Pipeline', m.groups.map(x => UI.bar(x.label, x.count, (x.count / total) * 100)).join('') + UI.muted('Each candidate is counted once, in their current stage group. Deployed and rejected candidates are not shown here.'))}${UI.panel('Recent Activity', recent(s))}</div>`;
        h += UI.panel('Pending Actions', pending(s), UI.btn('All reminders', 'go', 'reports', 'secondary small'));
      } else if (div === 'domestic') {
        const m = M.domestic(s);
        h += UI.cards([UI.metric('Enquiries', m.enquiries, 'Customer leads'), UI.metric('Profiles Shared', m.profilesShared, 'Worker CVs'), UI.metric('Visa Cases', m.visaCases, 'Processing'), UI.metric('Handovers', m.handovers, 'Arrived / handed over')]);
        h += UI.panel('Domestic Worker Journey', UI.flow(C.domesticDashboardFlow));
      } else {
        h += UI.panel('Future Division', `<p>Local Qatar corporate recruitment has <b>not yet started</b>. When activated, the client pays a negotiated placement fee, typically half or one month of the candidate’s basic salary, with the payment trigger determined by the client agreement.</p>${UI.btn('View future module', 'go', 'corporate', 'secondary')}`);
      }
      h += S.mode() === 'demo'
        ? UI.notice('DEMO WORKSPACE — all candidates, clients and transactions are fictional sample data. Counters are calculated from these records; switch workspace in Settings & Data.')
        : UI.notice('LIVE WORKSPACE — counters are calculated from the records entered or imported here. Data is held in this browser only (not secure, not shared). Take regular backups in Settings & Data.', 'live');
      return h;
    },
  };
  UI.on('setDivision', d => { UI.state.division = d; LGM.App.render(); });
})(typeof window !== 'undefined' ? window : globalThis);

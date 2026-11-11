/* Example project "CRM / Lead Management ERP" — LAYER 3: business logic.
   Two pipelines (B2B, B2C) with different stage lists. Logging an activity can move the lead; Won/Lost stamp the closed date; forecast = value × stage weight.
   Shares nothing with the recruitment examples except the reusable core. */
(function (g) {
  'use strict';
  const CRM = g.CRM = g.CRM || {}, U = g.ERP.util;
  CRM.STAGES = { B2B: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'], B2C: ['New', 'Contacted', 'Interested', 'Won', 'Lost'] };
  CRM.WEIGHT = { New: 10, Contacted: 20, Qualified: 40, Proposal: 60, Negotiation: 80, Interested: 50, Won: 100, Lost: 0 };   // % chance — a configuration assumption
  CRM.LOST_REASONS = ['Price', 'Competitor', 'No budget', 'No response', 'Not a fit', 'Other'];
  CRM.isOpen = l => l.stage !== 'Won' && l.stage !== 'Lost';
  CRM.leads = (s, scope) => s.list('leads', scope ? { pipeline: scope } : null);
  CRM.openValue = (s, scope) => U.round2(CRM.leads(s, scope).filter(CRM.isOpen).reduce((a, l) => a + Number(l.dealValue || 0), 0));
  CRM.forecast = (s, scope) => U.round2(CRM.leads(s, scope).filter(CRM.isOpen).reduce((a, l) => a + Number(l.dealValue || 0) * (CRM.WEIGHT[l.stage] || 0) / 100, 0));
  CRM.wonValue = (s, scope) => U.round2(CRM.leads(s, scope).filter(l => l.stage === 'Won').reduce((a, l) => a + Number(l.dealValue || 0), 0));
  CRM.winRate = (s, scope) => { const w = CRM.leads(s, scope).filter(l => l.stage === 'Won').length, x = CRM.leads(s, scope).filter(l => l.stage === 'Lost').length; return w + x ? Math.round(100 * w / (w + x)) : 0; };
  CRM.latestActivity = (s, leadId) => s.list('activities', { lead: leadId }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
  CRM.nextSteps = (s, scope, today) => { today = today || U.todayISO(); return CRM.leads(s, scope).filter(CRM.isOpen).map(l => ({ l, a: CRM.latestActivity(s, l.id) })).filter(x => x.a && x.a.nextStep && x.a.nextDate).map(x => ({ lead: x.l, step: x.a.nextStep, due: x.a.nextDate, overdue: x.a.nextDate < today })).sort((p, q) => p.due.localeCompare(q.due)); };

  CRM.hooks = {
    beforeSave({ store, entity, values: r, scope }) {
      const errors = {}, warnings = [], today = U.todayISO();
      if (entity === 'leads') {
        if (r.stage === 'Lost' && !r.lostReason) errors.lostReason = 'Say why the lead was lost.';
        if (r.stage === 'Won' && scope === 'B2B' && !(Number(r.dealValue) > 0)) errors.dealValue = 'A won B2B deal needs a deal value.';
        if (r.stage === 'Won' || r.stage === 'Lost') { if (!r.closedDate) r.closedDate = today; } else { r.closedDate = ''; if (r.lostReason) r.lostReason = ''; }
        const a = store.get('accounts', r.account); if (a && r.contact) { const c = store.get('contacts', r.contact); if (c && c.account !== a.id) errors.contact = 'This contact works for a different account.'; }
      }
      if (entity === 'activities') {
        const l = store.get('leads', r.lead);
        if (l && l.pipeline !== scope) errors.lead = 'This lead is in another pipeline.';
        if (l && r.moveTo && !CRM.STAGES[l.pipeline].includes(r.moveTo)) errors.moveTo = '"' + r.moveTo + '" is not a stage of the ' + l.pipeline + ' pipeline.';
        if (r.moveTo === 'Lost' && !r.lostReason) errors.lostReason = 'Say why the lead was lost.';
        if (r.nextStep && !r.nextDate) errors.nextDate = 'Give the follow-up a date.';
        if (r.nextDate && r.date && r.nextDate < r.date) errors.nextDate = 'Follow-up date is before the activity date.';
      }
      return { errors, warnings };
    },
    afterSave({ store, entity, record: r, mode }) {
      const notes = [];
      if (entity === 'activities' && mode === 'create' && r.moveTo) {
        const l = store.get('leads', r.lead);
        if (l && l.stage !== r.moveTo) {
          const patch = { stage: r.moveTo }; if (r.moveTo === 'Lost') patch.lostReason = r.lostReason; if (r.moveTo === 'Won' || r.moveTo === 'Lost') patch.closedDate = r.date;
          const res = store.update('leads', l.id, patch, { by: 'workflow', note: 'activity ' + r.id, historyExtra: { activityId: r.id, date: r.date } });
          if (!res.ok) throw new Error('Lead could not be updated: ' + Object.values(res.errors).join(' ')); else notes.push('Lead "' + l.title + '" moved to ' + r.moveTo + '.');
        }
      }
      return { notes };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

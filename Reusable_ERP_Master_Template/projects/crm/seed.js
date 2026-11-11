/* Example project "CRM / Lead Management ERP" — fictional demo data, created through the normal store API (activities move leads). */
(function (g) {
  'use strict';
  const CRM = g.CRM, U = g.ERP.util, today = U.todayISO(), ago = n => U.isoOf(new Date(U.parseISO(today).getTime() - n * 864e5));
  const ok = (r, w) => { if (!r.ok) throw new Error('Seed ' + w + ': ' + JSON.stringify(r.errors)); return r.record; };
  CRM.seed = function (s) {
    return s.batch(() => {
      const mk = (e, sc, v) => ok(s.create(e, v, { scope: sc, by: 'demo seed' }), e);
      const act = (sc, lead, d, type, summary, extra) => mk('activities', sc, Object.assign({ lead: lead.id, date: ago(d), type, summary }, extra || {}));
      const a1 = mk('accounts', 'B2B', { name: 'Example Industries', industry: 'Manufacturing', size: '51–500' }), a2 = mk('accounts', 'B2B', { name: 'Sample Health Co', industry: 'Healthcare', size: '500+' }), a3 = mk('accounts', 'B2B', { name: 'Test Software Ltd', industry: 'Software', size: '1–50' });
      const c1 = mk('contacts', 'B2B', { account: a1.id, name: 'Test Contact A', role: 'Procurement' }), c2 = mk('contacts', 'B2B', { account: a2.id, name: 'Test Contact B', role: 'Director' });
      const l1 = mk('leads', 'B2B', { title: 'Plant software licence', account: a1.id, contact: c1.id, owner: 'Rep One', source: 'Event', dealValue: 40000, stage: 'New' });
      const l2 = mk('leads', 'B2B', { title: 'Clinic rollout', account: a2.id, contact: c2.id, owner: 'Rep Two', source: 'Referral', dealValue: 90000, stage: 'New' });
      const l3 = mk('leads', 'B2B', { title: 'Starter plan', account: a3.id, owner: 'Rep One', source: 'Website', dealValue: 6000, stage: 'New' });
      const l4 = mk('leads', 'B2B', { title: 'Pilot project', account: a1.id, owner: 'Rep Two', source: 'Cold outreach', dealValue: 15000, stage: 'New' });
      act('B2B', l1, 30, 'Call', 'Intro call', { moveTo: 'Contacted' }); act('B2B', l1, 20, 'Meeting', 'Needs workshop', { moveTo: 'Qualified' }); act('B2B', l1, 10, 'Email', 'Sent proposal', { moveTo: 'Proposal', nextStep: 'Chase for feedback', nextDate: ago(2) });
      act('B2B', l2, 25, 'Demo', 'Product demo', { moveTo: 'Qualified' }); act('B2B', l2, 12, 'Meeting', 'Commercial discussion', { moveTo: 'Negotiation', nextStep: 'Send final terms', nextDate: ago(-4) });
      act('B2B', l3, 15, 'Call', 'Intro call', { moveTo: 'Contacted' }); act('B2B', l3, 5, 'Email', 'Agreed starter plan', { moveTo: 'Won' });
      act('B2B', l4, 18, 'Call', 'Intro call', { moveTo: 'Contacted' }); act('B2B', l4, 8, 'Email', 'No reply after two attempts', { moveTo: 'Lost', lostReason: 'No response' });
      const b1 = mk('accounts', 'B2C', { name: 'Test Customer One', city: 'Doha' }), b2 = mk('accounts', 'B2C', { name: 'Test Customer Two', city: 'Lusail' });
      const m1 = mk('leads', 'B2C', { title: 'Home package enquiry', account: b1.id, owner: 'Rep Three', source: 'Website', interest: 'Home package', stage: 'New' }), m2 = mk('leads', 'B2C', { title: 'Premium plan enquiry', account: b2.id, owner: 'Rep Three', source: 'Advert', interest: 'Premium', stage: 'New' }), m3 = mk('leads', 'B2C', { title: 'Family plan enquiry', account: b1.id, owner: 'Rep Three', source: 'Referral', interest: 'Family', stage: 'New' });
      act('B2C', m1, 9, 'Call', 'Called back', { moveTo: 'Interested', nextStep: 'Send quote', nextDate: ago(1) }); act('B2C', m2, 14, 'Call', 'Explained pricing', { moveTo: 'Contacted' }); act('B2C', m2, 6, 'Email', 'Customer chose a competitor', { moveTo: 'Lost', lostReason: 'Competitor' }); act('B2C', m3, 4, 'Call', 'Signed up', { moveTo: 'Won' });
      return { accounts: s.count('accounts'), leads: s.count('leads'), activities: s.count('activities') };
    });
  };
  g.CRM.config.demo.seed = CRM.seed;
})(typeof window !== 'undefined' ? window : globalThis);

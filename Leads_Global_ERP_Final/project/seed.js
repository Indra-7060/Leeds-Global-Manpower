/* Leads Global ERP — project/seed.js  (demo data — 100 % fictional)
   Every record goes through the normal store API (validation + hooks), so the demo also exercises the real workflow:
   candidates are advanced ONLY by daily updates, warranties are created by the sponsor-handover rule, agency earnings come from verified deployments.
   Dates are relative to "today" so warranty states (active / expiring / expired) are always visible. Names, passports and amounts are invented. */
(function (g) {
  'use strict';
  const L = g.LGM, U = g.ERP.util;

  L.seed = function seed(store) {
    const today = U.todayISO();
    const ago = n => U.isoOf(new Date(U.parseISO(today).getTime() - n * 86400000));
    const ahead = n => ago(-n);
    const ok = (r, what) => { if (!r.ok) throw new Error('Seed failed (' + what + '): ' + JSON.stringify(r.errors)); return r.record; };
    const mk = (entity, scope, values) => ok(store.create(entity, values, { scope, by: 'demo seed', note: 'demo data' }), entity + ' ' + JSON.stringify(values).slice(0, 80));
    const step = (cand, date, stage, action, extra) => mk('updates', cand.division, Object.assign({ client: cand.client, candidate: cand.id, date, stage, staff: 'Demo Staff A', action }, extra || {}));
    const run = (cand, list) => list.forEach(([date, stage, action, extra]) => step(cand, date, stage, action, extra));

    return store.batch(() => {
      /* ---------------- Blue-Collar ---------------- */
      const BC = 'Blue-Collar';
      const c1 = mk('clients', BC, { name: 'Demo Contracting WLL', phone: '+974 0000 1001', email: 'ops@demo-contracting.test' });
      const c2 = mk('clients', BC, { name: 'Sample Facilities Co', phone: '+974 0000 1002' });
      const c3 = mk('clients', BC, { name: 'Test Logistics QPSC', phone: '+974 0000 1003' });
      const a1 = mk('agencies', BC, { name: 'Demo Overseas Manpower', country: 'Nepal', contact: 'Agent One', phone: '+977 0000 0001' });
      const a2 = mk('agencies', BC, { name: 'Sample Recruit Services', country: 'India', contact: 'Agent Two' });
      const o1 = mk('orders', BC, { client: c1.id, country: 'Nepal', trade: 'Welder', quantity: 6, basicSalary: 1200, orderDate: ago(90), status: 'In progress', nationality: 'Nepali' });
      const o2 = mk('orders', BC, { client: c2.id, country: 'India', trade: 'Cleaner', quantity: 10, basicSalary: 900, orderDate: ago(60), status: 'Open', nationality: 'Indian' });
      const o3 = mk('orders', BC, { client: c3.id, country: 'Nepal', trade: 'Driver', quantity: 3, basicSalary: 1500, orderDate: ago(30), status: 'Open' });
      const al1 = mk('allocations', BC, { client: c1.id, order: o1.id, agency: a1.id, quantity: 6, fee: 400 });
      const al2 = mk('allocations', BC, { client: c2.id, order: o2.id, agency: a2.id, quantity: 10, fee: 300 });
      const al3 = mk('allocations', BC, { client: c3.id, order: o3.id, agency: a1.id, quantity: 3, fee: 450 });
      const bc = (name, o, ag, n, trade) => mk('candidates', BC, { name, client: o.client, order: o.id, agency: ag.id, passport: 'TEST-BC-' + U.pad(n, 4), nationality: ag.country === 'Nepal' ? 'Nepali' : 'Indian', country: ag.country, trade });
      const w1 = bc('Test Worker Alpha', o1, a1, 1, 'Welder'), w2 = bc('Test Worker Bravo', o1, a1, 2, 'Welder'), w3 = bc('Test Worker Charlie', o1, a1, 3, 'Welder'), w4 = bc('Test Worker Delta', o1, a1, 4, 'Welder');
      const w5 = bc('Test Worker Echo', o2, a2, 5, 'Cleaner'), w6 = bc('Test Worker Foxtrot', o2, a2, 6, 'Cleaner'), w7 = bc('Test Worker Golf', o2, a2, 7, 'Cleaner'), w8 = bc('Test Worker Hotel', o3, a1, 8, 'Driver');
      run(w1, [[ago(80), 'Interview Scheduled', 'Interview fixed'], [ago(75), 'Interviewed', 'Interview done'], [ago(72), 'Selected', 'Client selected'], [ago(70), 'QVC Pending', 'QVC booked'], [ago(60), 'QVC Completed', 'QVC cleared'], [ago(55), 'RTP', 'RTP received'], [ago(50), 'Visa Applied', 'Visa applied'], [ago(40), 'Visa Printed', 'Visa printed'], [ago(35), 'Ticket Booked', 'Ticket booked'], [ago(30), 'Arrived', 'Arrived in Doha'], [ago(28), 'Deployed', 'Reported to site — verified by client']]);
      run(w2, [[ago(78), 'Interviewed', 'Interviewed'], [ago(70), 'Selected', 'Selected'], [ago(60), 'QVC Completed', 'QVC cleared'], [ago(50), 'RTP', 'RTP'], [ago(30), 'Visa Printed', 'Visa printed'], [ago(20), 'Arrived', 'Arrived'], [ago(18), 'Deployed', 'Deployed — verified']]);
      run(w3, [[ago(40), 'Interviewed', 'Interviewed'], [ago(30), 'Selected', 'Selected'], [ago(14), 'QVC Completed', 'QVC cleared', { nextAction: 'Chase RTP from ministry', dueDate: ago(3) }]]);
      run(w4, [[ago(10), 'Interview Scheduled', 'Interview fixed', { nextAction: 'Confirm interview slot with client', dueDate: ahead(2) }]]);
      run(w5, [[ago(50), 'Interviewed', 'Interviewed'], [ago(45), 'Selected', 'Selected'], [ago(40), 'QVC Completed', 'QVC done'], [ago(30), 'RTP', 'RTP'], [ago(25), 'Visa Printed', 'Visa printed'], [ago(15), 'Ticket Booked', 'Ticket booked'], [ago(10), 'Arrived', 'Arrived'], [ago(8), 'Deployed', 'Deployed — verified']]);
      run(w6, [[ago(40), 'Interviewed', 'Interviewed'], [ago(35), 'Selected', 'Selected'], [ago(20), 'Rejected', 'Failed medical']]);
      run(w7, [[ago(5), 'CV Received', 'CV received', { nextAction: 'Schedule interview', dueDate: ahead(5) }]]);
      run(w8, [[ago(12), 'Interviewed', 'Interviewed'], [ago(6), 'Selected', 'Selected', { nextAction: 'Start QVC', dueDate: ago(1) }]]);
      mk('interviews', BC, { client: c1.id, candidate: w1.id, date: ago(75), result: 'Selected', notes: 'Good trade test' });
      mk('interviews', BC, { client: c2.id, candidate: w6.id, date: ago(40), result: 'Rejected' });
      mk('tickets', BC, { client: c1.id, candidate: w1.id, flight: 'QR-TEST-101', date: ago(30), status: 'Travelled' });
      mk('tickets', BC, { client: c2.id, candidate: w5.id, flight: 'QR-TEST-202', date: ago(10), status: 'Travelled' });
      // payments: invoices to the clients and part-payments to agencies, linked to the allocation they settle
      mk('accounts', BC, { client: c1.id, kind: 'Invoice', payer: 'Qatar Company', amount: 5000, date: ago(25), reference: 'INV-DEMO-001' });
      mk('accounts', BC, { client: c1.id, agency: a1.id, allocation: al1.id, kind: 'Payment received', payer: 'Overseas Agent', amount: 400, date: ago(15), reference: 'RCPT-DEMO-001', notes: 'Part payment for the first deployed worker' });
      mk('accounts', BC, { client: c2.id, agency: a2.id, allocation: al2.id, kind: 'Payment received', payer: 'Overseas Agent', amount: 100, date: ago(4), reference: 'RCPT-DEMO-002' });
      mk('accounts', BC, { client: c1.id, kind: 'Expense', amount: 150, date: ago(20), reference: 'EXP-DEMO-001', notes: 'Courier and attestation' });

      /* ---------------- Domestic ---------------- */
      const DM = 'Domestic';
      const s1 = mk('clients', DM, { name: 'Sponsor Demo Family One', qid: 'TEST-QID-0001', phone: '+974 0000 2001' });
      const s2 = mk('clients', DM, { name: 'Sponsor Sample Family Two', qid: 'TEST-QID-0002' });
      const s3 = mk('clients', DM, { name: 'Sponsor Test Family Three', qid: 'TEST-QID-0003' });
      const r1 = mk('orders', DM, { client: s1.id, trade: 'Housemaid', quantity: 1, nationality: 'Filipino', country: 'Philippines', basicSalary: 1100, orderDate: ago(330), status: 'Fulfilled', contractPeriod: '2 years' });
      const r2 = mk('orders', DM, { client: s2.id, trade: 'Cook', quantity: 2, nationality: 'Indian', country: 'India', basicSalary: 1300, orderDate: ago(300), status: 'In progress' });
      const r3 = mk('orders', DM, { client: s3.id, trade: 'Nanny', quantity: 1, nationality: 'Sri Lankan', country: 'Sri Lanka', orderDate: ago(60), status: 'Open' });
      const dw = (name, o, n) => mk('candidates', DM, { name, client: o.client, order: o.id, passport: 'TEST-DM-' + U.pad(n, 4), trade: o.trade, nationality: o.nationality, country: o.country });
      const d1 = dw('Test Housemaid Ana', r1, 1), d2 = dw('Test Cook Bina', r2, 2), d3 = dw('Test Cook Chandra', r2, 3), d4 = dw('Test Nanny Devi', r3, 4), d5 = dw('Test Housemaid Eva', r1, 5);
      const path = (c, h) => [[h + 60, 'Interviewed', 'Sponsor interview'], [h + 50, 'Selected', 'Sponsor selected'], [h + 40, 'QVC Completed', 'Medical done'], [h + 30, 'RTP', 'RTP'], [h + 20, 'Visa Printed', 'Visa printed'], [h + 10, 'Ticket Booked', 'Ticket booked'], [h + 3, 'Arrived', 'Arrived']];
      const dated = (list, h2) => list.map(([d, s, a]) => [ago(d), s, a]).concat(h2);
      run(d1, dated(path(d1, 60), [[ago(60), 'Handed Over', 'Handed over to sponsor']]));          // warranty runs ~7 months more → active
      run(d2, dated(path(d2, 250), [[ago(250), 'Handed Over', 'Handed over to sponsor']]));        // 250 days ≈ 8.2 months → expiring soon / may be near end
      run(d3, dated(path(d3, 320), [[ago(320), 'Handed Over', 'Handed over to sponsor']]));        // > 9 months → expired
      run(d4, [[ago(20), 'Interviewed', 'Sponsor interview'], [ago(10), 'Selected', 'Sponsor selected', { nextAction: 'Medical appointment', dueDate: ahead(4) }]]);
      run(d5, dated(path(d5, 120), [[ago(120), 'Handed Over', 'Handed over to sponsor']]));        // complaint + replacement
      // complaint, replacement and refund cases (edit the auto-created warranties through the normal store API)
      const wr = c => L.warrantyOf(store, c.id);
      ok(store.update('warranties', wr(d5).id, { reason: 'Worker left the household without notice', claimDate: ago(40), claimType: 'Replacement', status: 'Open' }, { by: 'demo seed' }), 'warranty claim');
      ok(store.update('warranties', wr(d3).id, { reason: 'Contract dispute', claimDate: ago(100), claimType: 'Refund', refundAmount: 1500, status: 'Resolved', resolutionDate: ago(80) }, { by: 'demo seed' }), 'warranty refund');
      mk('interviews', DM, { client: s1.id, candidate: d1.id, date: ago(120), result: 'Selected' });
      mk('tickets', DM, { client: s1.id, candidate: d1.id, flight: 'QR-TEST-303', date: ago(63), status: 'Travelled' });
      mk('accounts', DM, { client: s1.id, kind: 'Invoice', payer: 'Sponsor', amount: 7500, date: ago(60), reference: 'INV-DEMO-D01' });
      mk('accounts', DM, { client: s1.id, kind: 'Payment received', payer: 'Sponsor', amount: 7500, date: ago(55), reference: 'RCPT-DEMO-D01' });
      mk('accounts', DM, { client: s2.id, kind: 'Invoice', payer: 'Sponsor', amount: 8000, date: ago(250), reference: 'INV-DEMO-D02' });
      mk('accounts', DM, { client: s2.id, kind: 'Payment received', payer: 'Sponsor', amount: 5000, date: ago(240), reference: 'RCPT-DEMO-D02' });

      /* ---------------- Corporate ---------------- */
      const CP = 'Corporate';
      const k1 = mk('clients', CP, { name: 'Demo Technologies WLL', phone: '+974 0000 3001', email: 'hr@demo-tech.test' });
      const k2 = mk('clients', CP, { name: 'Sample Holdings QSC', phone: '+974 0000 3002' });
      const j1 = mk('orders', CP, { client: k1.id, trade: 'Accountant', quantity: 2, basicSalary: 8000, totalSalary: 10000, feeBasis: '1 month', paymentMilestone: 1, orderDate: ago(100), status: 'In progress', location: 'Doha' });
      const j2 = mk('orders', CP, { client: k2.id, trade: 'Sales Executive', quantity: 3, basicSalary: 6000, feeBasis: '0.5 month', paymentMilestone: 3, orderDate: ago(70), status: 'Open' });
      const j3 = mk('orders', CP, { client: k2.id, trade: 'Project Engineer', quantity: 1, basicSalary: 15000, feeBasis: 'Custom', customFee: 9000, paymentMilestone: 2, orderDate: ago(50), status: 'Open' });
      const cc = (name, o, n, salary) => mk('candidates', CP, { name, client: o.client, order: o.id, passport: 'TEST-CP-' + U.pad(n, 4), trade: o.trade, salary, nationality: 'Test' });
      const p1 = cc('Test Candidate Priya', j1, 1, 8500), p2 = cc('Test Candidate Omar', j1, 2, 7500), p3 = cc('Test Candidate Sara', j2, 3, 6000), p4 = cc('Test Candidate Tariq', j2, 4, 6200), p5 = cc('Test Candidate Uma', j3, 5, 16000);
      run(p1, [[ago(80), 'Interview Scheduled', 'Interview fixed'], [ago(75), 'Interviewed', 'Interviewed'], [ago(70), 'Selected', 'Selected'], [ago(65), 'Offer Issued', 'Offer signed'], [ago(45), 'Joined', 'Joined the company']]);
      run(p2, [[ago(60), 'Interviewed', 'Interviewed'], [ago(50), 'Selected', 'Selected'], [ago(40), 'Offer Issued', 'Offer issued', { nextAction: 'Confirm joining date', dueDate: ago(6) }]]);
      run(p3, [[ago(50), 'Interviewed', 'Interviewed'], [ago(40), 'Selected', 'Selected'], [ago(35), 'Offer Issued', 'Offer signed'], [ago(20), 'Joined', 'Joined']]);
      run(p4, [[ago(15), 'Interview Scheduled', 'Interview fixed', { nextAction: 'Collect interview feedback', dueDate: ahead(1) }]]);
      run(p5, [[ago(10), 'CV Received', 'CV shortlisted']]);
      mk('interviews', CP, { client: k1.id, candidate: p1.id, date: ago(75), result: 'Selected' });
      mk('accounts', CP, { client: k1.id, candidate: p1.id, kind: 'Invoice', payer: 'Corporate Company', amount: 8500, date: ago(44), reference: 'INV-DEMO-C01' });
      mk('accounts', CP, { client: k1.id, candidate: p1.id, kind: 'Payment received', payer: 'Corporate Company', amount: 8500, date: ago(30), reference: 'RCPT-DEMO-C01' });
      mk('accounts', CP, { client: k2.id, candidate: p3.id, kind: 'Invoice', payer: 'Corporate Company', amount: 3000, date: ago(19), reference: 'INV-DEMO-C02' });
      return { clients: store.count('clients'), orders: store.count('orders'), candidates: store.count('candidates'), updates: store.count('updates'), warranties: store.count('warranties') };
    });
  };
  if (g.LGM.config) g.LGM.config.demo = { seed: g.LGM.seed };
})(typeof window !== 'undefined' ? window : globalThis);

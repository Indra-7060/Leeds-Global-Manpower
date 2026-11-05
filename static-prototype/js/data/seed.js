/* DEMO DATA — 100% fictional. Same shape as V6's sample (orders, candidates, interviews, cases…) but larger so that counters,
   pipeline bars and reports have something real to calculate. Lives ONLY in the "demo" workspace. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config;

  function build() {
    const t0 = '2026-11-04T09:00:00.000Z';
    const s = LGM.Store.blank('demo');

    s.clients = [
      ['Demo Facilities Co.', 'Facility Management', 'Active', 'Confirm interview'],
      ['Demo Construction Ltd', 'Construction', 'Active', 'Review CVs'],
      ['Demo Logistics Co.', 'Logistics', 'Active', 'Ticket follow-up'],
      ['Demo Hospitality Group', 'Hospitality', 'Prospect', 'Arrange visit'],
      ['Demo Contracting WLL', 'Contracting', 'Active', 'Check demand'],
    ].map((r, i) => ({ id: 'cl_demo' + (i + 1), name: r[0], sector: r[1], stage: r[2], next_action: r[3], createdAt: t0 }));

    s.orders = [
      ['ORD-1001', 'Demo Facilities Co.', 'Bangladesh', 'Cleaners / Helpers', 400, 'Interview'],
      ['ORD-1002', 'Demo Construction Ltd', 'Bangladesh', 'Construction Trades', 150, 'CV Review'],
      ['ORD-1003', 'Demo Contracting WLL', 'Nepal', 'Cleaners', 100, 'Visa Processing'],
      ['ORD-1004', 'Demo Logistics Co.', 'Nepal', 'Helpers', 30, 'Deployment'],
      ['ORD-1005', 'Demo Hospitality Group', 'Nepal', 'Housekeeping', 60, 'New Order'],
    ].map(r => ({ id: r[0], client: r[1], country: r[2], trade: r[3], qty: r[4], status: r[5], createdAt: t0 }));

    s.allocations = [
      ['Demo Dhaka Agency', 'Bangladesh', 'ORD-1001', 250, 'Sourcing'],
      ['Demo Chattogram Agency', 'Bangladesh', 'ORD-1001', 150, 'CV Review'],
      ['Demo Kathmandu Agency', 'Nepal', 'ORD-1003', 100, 'Interview'],
    ].map((r, i) => ({ id: 'al_demo' + (i + 1), agency: r[0], country: r[1], order_id: r[2], allocated: r[3], status: r[4], createdAt: t0 }));

    // Candidates: [order, [[stage, count], ...]]
    const plan = [
      ['ORD-1001', [['CV Submitted', 4], ['Client Review', 3], ['Interview', 3], ['Selected', 2], ['Rejected', 1]]],
      ['ORD-1002', [['CV Submitted', 3], ['Client Review', 2], ['Interview', 1]]],
      ['ORD-1003', [['Offer Accepted', 2], ['Pre-Medical', 1], ['Visa Applied', 3], ['QVC', 2], ['RTP', 2], ['Visa Printed', 2], ['Deployment Ready', 1]]],
      ['ORD-1004', [['Visa Printed', 1], ['Deployment Ready', 1], ['Arrived', 2], ['Joined', 1], ['Warranty', 1]]],
      ['ORD-1005', [['CV Submitted', 2]]],
    ];
    const agencyFor = (o, i) => ({ 'ORD-1001': ['Demo Dhaka Agency', 'Demo Chattogram Agency'][i % 2], 'ORD-1002': 'Demo Dhaka Agency', 'ORD-1003': 'Demo Kathmandu Agency', 'ORD-1004': 'Demo Pokhara Agency', 'ORD-1005': 'Demo Pokhara Agency' }[o]);
    const shortTrade = { 'ORD-1001': 'Cleaner', 'ORD-1002': 'Steel Fixer', 'ORD-1003': 'Cleaner', 'ORD-1004': 'Helper', 'ORD-1005': 'Housekeeper' };
    let seq = 0;
    plan.forEach(([oid, groups]) => {
      const o = s.orders.find(x => x.id === oid); let k = 0;
      groups.forEach(([stage, cnt]) => {
        for (let i = 0; i < cnt; i++, k++) {
          seq++;
          const idx = C.stages.indexOf(stage);
          const path = stage === C.rejectedStage ? ['CV Submitted', 'Client Review', 'Interview', 'Rejected'] : C.stages.slice(0, idx + 1);
          const num = String(seq).padStart(3, '0');
          const c = {
            id: C.countryPrefix[o.country] + '-' + (1000 + seq), name: 'Demo Candidate ' + num, passport: 'DEMO-P' + String(seq).padStart(4, '0'),
            client: o.client, order_id: oid, country: o.country, agency: agencyFor(oid, k), trade: shortTrade[oid], status: stage,
            visa_number: idx >= C.stages.indexOf('Visa Printed') ? 'DEMO-V' + String(seq).padStart(4, '0') : '',
            qvc_date: idx >= C.stages.indexOf('QVC') ? '2026-10-' + String(10 + (seq % 15)).padStart(2, '0') : '',
            flight_date: idx >= C.stages.indexOf('Deployment Ready') ? '2026-11-' + String(6 + (seq % 10)).padStart(2, '0') : '',
            history: path.map((st, j) => ({ stage: st, at: '2026-10-' + String(1 + j).padStart(2, '0') + 'T08:00:00.000Z', by: 'md' })), createdAt: t0,
          };
          s.candidates.push(c);
        }
      });
    });
    s.meta.counters.candidate = 1000 + seq + 1;

    // Travel records for candidates from Visa Printed onward in ORD-1003 / ORD-1004.
    const travelStages = ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];
    const steps = ['Pending', 'Request Booking', 'Flight Details Shared', 'Arrival Notice'];
    s.candidates.filter(c => travelStages.includes(c.status)).forEach((c, i) => {
      if (i === 0) return; // first flight-ready candidate deliberately has no travel record yet (shows the reminder + the add-record flow)
      const late = ['Arrived', 'Joined', 'Warranty'].includes(c.status);
      s.tickets.push({
        id: 'tk_demo' + (i + 1), candidate_id: c.id, ticket_by: i % 3 === 2 ? '' : C.ticketBy[i % 2], flight: late || i % 2 === 0 ? 'DEMO-QR 000' + (i + 1) : '',
        driver_name: late || i % 3 === 1 ? 'Demo Driver ' + (i + 1) : '', driver_phone: late || i % 3 === 1 ? '+000-0000-' + String(1000 + i) : '',
        step: late ? 'Arrival Notice' : steps[i % 3], createdAt: t0,
      });
    });

    s.interviews = [
      ['Demo Facilities Co.', 'Overseas Drive', 'Bangladesh', '2026-11-12', 240, 'Scheduled'],
      ['Demo Construction Ltd', 'Zoom', 'Bangladesh', '2026-11-15', 45, 'Pending'],
      ['Demo Contracting WLL', 'CV Selection', 'Nepal', '2026-10-28', 100, 'Selected'],
    ].map((r, i) => ({ id: 'iv_demo' + (i + 1), client: r[0], method: r[1], country: r[2], date: r[3], candidates: r[4], status: r[5], createdAt: t0 }));

    s.visits = [
      ['Demo Facilities Co.', 'HR Manager', '2026-10-05', 'Profile Presented', 'Profile Briefing', 'Call for demand'],
      ['Demo Construction Ltd', 'Operations', '2026-10-18', 'Order Received', 'Demand Received', 'Confirm trade list'],
      ['Demo Hospitality Group', 'HR Department', '2026-11-02', 'Follow-up', 'Client Interested', 'Schedule meeting'],
    ].map((r, i) => ({ id: 'vs_demo' + (i + 1), client: r[0], contact: r[1], date: r[2], outcome: r[3], pipeline_stage: r[4], next_action: r[5], salesperson: 'Demo Sales', notes: '', createdAt: t0 }));

    s.demands = [
      ['DL-1001', 'Demo Facilities Co.', 'ORD-1001', 'Bangladesh / Nepal', 'Cleaning / Labour', 'Received'],
      ['DL-1002', 'Demo Construction Ltd', 'ORD-1002', 'Bangladesh', 'Construction', 'Under Review'],
      ['DL-1003', 'Demo Logistics Co.', 'ORD-1004', 'Nepal', 'Helpers', 'Approved'],
    ].map(r => ({ id: r[0], client: r[1], order_id: r[2], countries: r[3], trades: r[4], status: r[5], letter_date: '2026-10-01', quantities: '', nationality: '', salary_benefits: '', signed: r[5] === 'Approved' ? 'Yes' : 'No', agency_allocation: '', createdAt: t0 }));
    s.meta.counters.demand = 1004;

    const warrantyCand = s.candidates.find(c => c.status === 'Warranty');
    s.warranties = [
      { id: 'WR-101', division: 'Labour', client: 'Demo Logistics Co.', candidate_id: warrantyCand ? warrantyCand.id : '', issue: 'Performance complaint', status: 'Under Review', warranty_start: '2026-09-20', warranty_expiry: '2026-12-20', createdAt: t0 },
      { id: 'WR-102', division: 'Domestic', client: 'Demo Household', candidate_id: '', issue: 'Replacement request', status: 'Pending', warranty_start: '', warranty_expiry: '', createdAt: t0 },
    ];
    s.meta.counters.warranty = 103;

    s.domestic = [
      ['DW-001', 'Demo Household 1', 'Philippines', 'Client Selection', 'Arrange interview'],
      ['DW-002', 'Demo Household 2', 'Bangladesh', 'Visa & Travel', 'Follow up'],
      ['DW-003', 'Demo Household 3', 'Kenya', 'Arrival / Handover', 'Warranty tracking'],
    ].map(r => ({ id: r[0], customer: r[1], origin: r[2], status: r[3], next_action: r[4], createdAt: t0 }));
    s.meta.counters.domestic = 4;

    s.credentials = [
      ['Demo Facilities Co.', 'MOL / MOI', 'Credentials on file'],
      ['Demo Construction Ltd', 'MOL', 'Approval details'],
    ].map((r, i) => ({ id: 'cr_demo' + (i + 1), client: r[0], portal: r[1], record: r[2], access: 'Authorized only', createdAt: t0 }));

    s.finance = [
      ['2026-11-01', 'labour', 'Outgoing', 'Cash', 'Demo Dhaka Agency', 'Demo Facilities Co.', 'Bangladesh', 'ORD-1001', 'Agency advance', 15000],
      ['2026-11-02', 'labour', 'Incoming', 'Cash', 'Demo Contracting WLL', 'Demo Contracting WLL', 'Nepal', 'ORD-1003', 'Client visa charge', 8600],
      ['2026-11-03', 'domestic', 'Incoming', 'QIIB', 'Demo Household 3', '', 'Other', '', 'Domestic customer payment', 12000],
      ['2026-11-03', 'labour', 'Outgoing', 'Cash', 'Demo Kathmandu Agency', 'Demo Contracting WLL', 'Nepal', 'ORD-1003', 'Agency payment', 4500],
      ['2026-11-04', 'domestic', 'Outgoing', 'QIIB', 'Demo Manila Agency', '', 'Philippines', '', 'Agency expense', 3000],
      ['2026-11-04', 'labour', 'Outgoing', 'Cash', 'Demo Office Supplies', '', 'Other', '', 'Office expense', 800],
    ].map((r, i) => ({ id: 'fn_demo' + (i + 1), date: r[0], division: r[1], direction: r[2], account: r[3], party: r[4], client: r[5], country: r[6], order: r[7], category: r[8], amount: r[9], ref: 'DEMO-' + String(i + 1).padStart(3, '0'), note: '', createdAt: t0 }));

    s.cvInbox = [
      { id: 'cv_demo1', filename: 'demo_cv_batch_1.txt', size: 1240, type: 'txt', received: t0, source: 'Email attachment', client: 'Demo Facilities Co.', agency: 'Demo Dhaka Agency', country: 'Bangladesh', status: 'Needs review', note: 'Text extracted', extracted_email: 'demo.candidate@example.test', extracted_phone: '', preview: 'Fictional CV text for demonstration.' },
      { id: 'cv_demo2', filename: 'demo_cv_batch_2.pdf', size: 88231, type: 'pdf', received: t0, source: 'WeTransfer download', client: 'Demo Construction Ltd', agency: '', country: 'Bangladesh', status: 'Needs review', note: 'PDF received — text extraction needs a backend service', extracted_email: '', extracted_phone: '', preview: '' },
    ];

    s.activity = [
      ['Interview scheduling', 'Demo Facilities Co.', '2026-11-04T14:20:00.000Z'],
      ['CV review pending', 'Demo Construction Ltd', '2026-11-04T11:05:00.000Z'],
      ['Travel coordination', 'Demo Logistics Co.', '2026-11-03T16:40:00.000Z'],
      ['Visa follow-up', 'Demo Contracting WLL', '2026-11-03T10:15:00.000Z'],
    ].map(r => ({ at: r[2], by: 'md', entity: 'system', id: '', client: r[1], text: r[0] }));
    return s;
  }

  LGM.Seed = { build };
})(typeof window !== 'undefined' ? window : globalThis);

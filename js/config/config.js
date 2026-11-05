/* CONFIGURATION — every list, stage name, mapping and default in one place.
   Vocabulary comes from V6. Anything V6 does not define is tagged ASSUMPTION and listed in docs/06 + OQ-* in docs/01. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});

  // V6 candidate lifecycle (v6 `statuses`, in order).
  const STAGES = ['CV Submitted', 'Client Review', 'Interview', 'Selected', 'Offer Accepted', 'Pre-Medical',
    'Visa Applied', 'QVC', 'RTP', 'Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'];

  LGM.Config = {
    app: { company: 'Leads Global Manpower', tagline: 'Recruitment Operations Platform · Qatar', version: 'V6 Developed', currency: 'QAR' },

    roles: [
      { id: 'md', label: 'Managing Director' },
      { id: 'nitija', label: 'Admin Manager (Nitija)' },
      { id: 'staff', label: 'Operations Staff' },
    ],
    // V6 only restricts Finance for `staff`. Other rows are ASSUMPTION (OQ-15) — demo roles, NOT security.
    permissions: {
      'finance.view': ['md', 'nitija'],
      'finance.import': ['md', 'nitija'],
      'finance.export': ['md', 'nitija'],
      'stage.undo': ['md', 'nitija'],            // ASSUMPTION: correction of a wrong stage
      'workspace.switch': ['md', 'nitija'],      // ASSUMPTION
      'data.restore': ['md', 'nitija'],          // ASSUMPTION
      'data.reset': ['md', 'nitija'],            // ASSUMPTION
      'audit.view': ['md', 'nitija', 'staff'],
    },

    countries: ['Bangladesh', 'Nepal', 'India', 'Philippines', 'Other'],
    // V6 ids: BD-1001, NP-1003. Other prefixes are ASSUMPTION (OQ-22).
    countryPrefix: { Bangladesh: 'BD', Nepal: 'NP', India: 'IN', Philippines: 'PH', Other: 'XX' },

    stages: STAGES,
    // V6 flow notes: "Pre-Medical if Required", "QVC if Applicable".
    optionalStages: ['Pre-Medical', 'QVC'],
    // ASSUMPTION (OQ-1): V6 has a "Rejected Candidates" report but no Rejected status.
    rejectedStage: 'Rejected',
    rejectableFrom: ['CV Submitted', 'Client Review', 'Interview'],

    // Named stage sets. Taken from V6 report regexes where they exist.
    stageSets: {
      'QVC Pending': ['Visa Applied', 'QVC'],                 // V6 /qvc|visa applied/
      'RTP Pending': ['RTP'],                                 // V6 /rtp/
      'Visa Printed': ['Visa Printed'],
      'Flight Pending': ['Visa Printed', 'Deployment Ready'], // V6 v6ReportRows (OQ-4)
      'Arrived': ['Arrived'],
      'Joined': ['Joined'],
      'Interview': ['Interview'],
      'Selected': ['Selected'],                               // V6 /selected/
      'Rejected': ['Rejected'],
      'Deployed': ['Arrived', 'Joined', 'Warranty'],          // ASSUMPTION (OQ-5): Warranty = already deployed
    },
    // Report-filter list shown in the toolbar (V6 list minus "QVC Completed", which V6 never defined — OQ-1).
    stageFilters: ['QVC Pending', 'RTP Pending', 'Visa Printed', 'Flight Pending', 'Arrived', 'Joined', 'Interview', 'Selected', 'Rejected'],

    // Dashboard pipeline — values in V6 are hard-coded; groups below are ASSUMPTION (OQ-2).
    // Mutually exclusive so a candidate is counted once. "Visa Pipeline" card == Visa Processing bar,
    // "Ready to Fly" card == Ready to Deploy bar (V6 shows identical numbers: 324/324, 186/186).
    pipelineGroups: [
      { label: 'CV Screening', stages: ['CV Submitted', 'Client Review'] },
      { label: 'Interviews & Selection', stages: ['Interview', 'Selected', 'Offer Accepted'] },
      { label: 'Visa Processing', stages: ['Pre-Medical', 'Visa Applied', 'QVC', 'RTP'] },
      { label: 'Ready to Deploy', stages: ['Visa Printed', 'Deployment Ready'] },
    ],
    // Master Recruitment Report columns (V6): Applied, QVC, RTP, Printed, Deployed.
    masterColumns: [
      { key: 'applied', label: 'Applied', stages: ['Visa Applied'] },
      { key: 'qvc', label: 'QVC', stages: ['QVC'] },
      { key: 'rtp', label: 'RTP', stages: ['RTP'] },
      { key: 'printed', label: 'Printed', stages: ['Visa Printed'] },
      { key: 'deployed', label: 'Deployed', stages: ['Arrived', 'Joined', 'Warranty'] },
    ],
    // V6 Visas page: "Action" column samples.
    visaActions: { 'Visa Applied': 'Follow up', 'QVC': 'Track appointment', 'Visa Printed': 'Plan ticket' },
    visaStages: ['Offer Accepted', 'Pre-Medical', 'Visa Applied', 'QVC', 'RTP', 'Visa Printed'],

    // V6 order data uses these values; the order flow diagram has the rest. 'Closed' added (OQ-3).
    orderStatuses: ['New Order', 'Country Allocation', 'Agency Sourcing', 'CV Review', 'Interview', 'Selection', 'Offer', 'Visa Processing', 'Deployment', 'Closed'],
    orderClosed: ['Closed'],

    clientStages: ['Active', 'Prospect'],
    visitOutcomes: ['Profile Presented', 'Follow-up', 'Order Received'],
    salesPipeline: ['Company Identified', 'Profile Briefing', 'Client Interested', 'Requirement Discussion', 'Demand Received', 'Order Created'],
    demandStatuses: ['Received', 'Under Review', 'Approved'],
    interviewMethods: ['Overseas Drive', 'Zoom', 'CV Selection'],
    interviewStatuses: ['Scheduled', 'Pending', 'Selected'],
    // V6 "Agency Tasks" flow; first three match the statuses shown in V6's table.
    agencyStatuses: ['Sourcing', 'CV Review', 'Interview', 'Selected List Sent', 'Passports Uploaded', 'Pre-Medical', 'Visa & Ticket Follow-up'],

    ticketBy: ['Client', 'Agency'],
    // V6 ticket statuses 'Request Booking' / 'Arrival Notice' + checklist steps between them.
    ticketSteps: ['Pending', 'Request Booking', 'Flight Details Shared', 'Arrival Notice'],

    warrantyDivisions: ['Labour', 'Domestic'],
    // V6 workflow: Complaint → Check Agreement & Dates → Record Evidence → Decision → Coordinate Agency → Close
    warrantyStatuses: ['Pending', 'Under Review', 'Evidence Recorded', 'Decision Made', 'Agency Coordinated', 'Closed'],
    warrantyMonths: { Labour: 3, Domestic: null },  // V6: labour "illustrative 3-month"; domestic must be verified (OQ-8)
    warrantyAlertDays: 30,                          // ASSUMPTION (OQ-21)

    // Domestic: V6 page workflow (8 steps) used as case status (OQ-10).
    domesticStatuses: ['Customer Enquiry', 'Worker Profiles', 'Client Selection', 'Approved Contract', 'Regulated Payment', 'Visa & Travel', 'Arrival / Handover', 'Guarantee / Complaints'],
    domesticDashboardFlow: ['Customer Enquiry', 'Worker Selection', 'Contract & Legal Payment', 'Visa / QVC', 'Arrival & Handover', 'Guarantee & Refunds'],

    credentialPortals: ['MOL', 'MOI', 'MOL / MOI', 'Other'],

    // Finance (V6)
    financeDivisions: [['labour', 'Blue-Collar Recruitment'], ['domestic', 'Domestic Workers']],
    financeAccounts: ['Cash', 'QIIB', 'Other bank'],
    financeDefaultAccount: { labour: 'Cash', domestic: 'QIIB' },
    financeCategories: ['Agency advance', 'Agency payment', 'Client visa charge', 'QVC charge', 'Visa investment', 'Partner commission',
      'Domestic customer payment', 'Agency expense', 'Refund', 'Office expense', 'Other'],
    costing: { Bangladesh: { client: 2500, revenue: 4000, investment: 300 }, _default: { client: 860, revenue: 1500, investment: 0 } },
    corporateFeeRates: [[1, "One month's basic (100%)"], [0.5, "Half month's basic (50%)"]],

    cvSources: ['Direct upload', 'Email attachment', 'WeTransfer download', 'Overseas agency'],
    cvStatuses: ['Needs review', 'Reviewed', 'Candidate created', 'Ignored'],

    // Import (V6 v5Fields / v5Aliases) — same field lists, same aliases.
    importMaxRows: 20000,

    activityCap: 500,
    storageKeyPrefix: 'lgm_v6dev_',
  };
})(typeof window !== 'undefined' ? window : globalThis);

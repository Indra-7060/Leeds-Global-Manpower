/**
 * CONFIGURATION — every list, stage name, mapping and default in one place.
 * Vocabulary comes from the V6 dashboard. Anything V6 did not define is tagged ASSUMPTION (OQ-n refers to the
 * open-question list in the V6 analysis documents). Change a value here when the client confirms a rule.
 */
export const STAGES = ['CV Submitted', 'Client Review', 'Interview', 'Selected', 'Offer Accepted', 'Pre-Medical',
  'Visa Applied', 'QVC', 'RTP', 'Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'] as const;

export type RoleId = 'md' | 'nitija' | 'staff';
export type Workspace = 'demo' | 'live';

export const C = {
  app: { company: 'Leads Global Manpower', tagline: 'Recruitment Operations Platform · Qatar', currency: 'QAR' },

  roles: [
    { id: 'md', label: 'Managing Director' },
    { id: 'nitija', label: 'Admin Manager (Nitija)' },
    { id: 'staff', label: 'Operations Staff' },
  ] as { id: RoleId; label: string }[],

  /** V6 only restricted Finance for Staff; the other rows are ASSUMPTION (OQ-15). Enforced on the SERVER. */
  permissions: {
    'finance.view': ['md', 'nitija'],
    'finance.import': ['md', 'nitija'],
    'finance.export': ['md', 'nitija'],
    'stage.undo': ['md', 'nitija'],
    'workspace.switch': ['md', 'nitija'],
    'data.reset': ['md', 'nitija'],
    'users.manage': ['md'],
    'data.backup': ['md', 'nitija'],
    // V8. All ASSUMPTIONS (V8-Q1…) until the client confirms; the V8 text only fixes finance (MD + Nitija) and MD-approved allocations.
    'refund.approve': ['md'],
    'allocation.approve': ['md'],
    'contracts.view': ['md', 'nitija'],
    'contracts.manage': ['md', 'nitija'],
    'tasks.assign': ['md', 'nitija'],
  } as Record<string, RoleId[]>,

  countries: ['Bangladesh', 'Nepal', 'India', 'Philippines', 'Other'],
  /** BD / NP are from V6; the rest ASSUMPTION (OQ-22). */
  countryPrefix: { Bangladesh: 'BD', Nepal: 'NP', India: 'IN', Philippines: 'PH', Other: 'XX' } as Record<string, string>,

  stages: STAGES as readonly string[],
  optionalStages: ['Pre-Medical', 'QVC'],
  rejectedStage: 'Rejected',
  rejectableFrom: ['CV Submitted', 'Client Review', 'Interview'], // ASSUMPTION (OQ-1)

  stageSets: {
    'QVC Pending': ['Visa Applied', 'QVC'],
    'RTP Pending': ['RTP'],
    'Visa Printed': ['Visa Printed'],
    'Flight Pending': ['Visa Printed', 'Deployment Ready'], // OQ-4
    Arrived: ['Arrived'],
    Joined: ['Joined'],
    Interview: ['Interview'],
    Selected: ['Selected'],
    Rejected: ['Rejected'],
    Deployed: ['Arrived', 'Joined', 'Warranty'], // ASSUMPTION (OQ-5)
  } as Record<string, string[]>,
  stageFilters: ['QVC Pending', 'RTP Pending', 'Visa Printed', 'Flight Pending', 'Arrived', 'Joined', 'Interview', 'Selected', 'Rejected'],

  /** ASSUMPTION (OQ-2): mutually exclusive pipeline groups. */
  pipelineGroups: [
    { label: 'CV Screening', stages: ['CV Submitted', 'Client Review'] },
    { label: 'Interviews & Selection', stages: ['Interview', 'Selected', 'Offer Accepted'] },
    { label: 'Visa Processing', stages: ['Pre-Medical', 'Visa Applied', 'QVC', 'RTP'] },
    { label: 'Ready to Deploy', stages: ['Visa Printed', 'Deployment Ready'] },
  ],
  masterColumns: [
    { key: 'applied', label: 'Applied', stages: ['Visa Applied'] },
    { key: 'qvc', label: 'QVC', stages: ['QVC'] },
    { key: 'rtp', label: 'RTP', stages: ['RTP'] },
    { key: 'printed', label: 'Printed', stages: ['Visa Printed'] },
    { key: 'deployed', label: 'Deployed', stages: ['Arrived', 'Joined', 'Warranty'] },
  ],
  visaActions: { 'Visa Applied': 'Follow up', QVC: 'Track appointment', 'Visa Printed': 'Plan ticket' } as Record<string, string>,
  visaStages: ['Offer Accepted', 'Pre-Medical', 'Visa Applied', 'QVC', 'RTP', 'Visa Printed'],

  orderStatuses: ['New Order', 'Country Allocation', 'Agency Sourcing', 'CV Review', 'Interview', 'Selection', 'Offer', 'Visa Processing', 'Deployment', 'Closed'],
  orderClosed: ['Closed'],

  clientStages: ['Active', 'Prospect'],
  visitOutcomes: ['Profile Presented', 'Follow-up', 'Order Received'],
  salesPipeline: ['Company Identified', 'Profile Briefing', 'Client Interested', 'Requirement Discussion', 'Demand Received', 'Order Created'],
  demandStatuses: ['Received', 'Under Review', 'Approved'],
  interviewMethods: ['Overseas Drive', 'Zoom', 'CV Selection'],
  interviewStatuses: ['Scheduled', 'Pending', 'Selected'],
  agencyStatuses: ['Sourcing', 'CV Review', 'Interview', 'Selected List Sent', 'Passports Uploaded', 'Pre-Medical', 'Visa & Ticket Follow-up'],
  ticketBy: ['Client', 'Agency'],
  ticketSteps: ['Pending', 'Request Booking', 'Flight Details Shared', 'Arrival Notice'],
  warrantyDivisions: ['Labour', 'Domestic'],
  warrantyStatuses: ['Pending', 'Under Review', 'Evidence Recorded', 'Decision Made', 'Agency Coordinated', 'Closed'],
  warrantyMonths: { Labour: 3, Domestic: null } as Record<string, number | null>, // OQ-8
  warrantyAlertDays: 30, // ASSUMPTION (OQ-21)
  domesticStatuses: ['Customer Enquiry', 'Worker Profiles', 'Client Selection', 'Approved Contract', 'Regulated Payment', 'Visa & Travel', 'Arrival / Handover', 'Guarantee / Complaints'],
  credentialPortals: ['MOL', 'MOI', 'MOL / MOI', 'Other'],

  financeDivisions: [['labour', 'Blue-Collar Recruitment'], ['domestic', 'Domestic Workers']] as [string, string][],
  financeAccounts: ['Cash', 'QIIB', 'Other bank'],
  financeDefaultAccount: { labour: 'Cash', domestic: 'QIIB' } as Record<string, string>,
  financeCategories: ['Agency advance', 'Agency payment', 'Client visa charge', 'QVC charge', 'Visa investment', 'Partner commission',
    'Domestic customer payment', 'Agency expense', 'Refund', 'Office expense', 'Other'],
  costing: { Bangladesh: { client: 2500, revenue: 4000, investment: 300 }, _default: { client: 860, revenue: 1500, investment: 0 } } as Record<string, { client: number; revenue: number; investment: number }>,

  /** ───────── V8 (client developer package). Every figure/rule here is configurable, none is hard-coded in the logic. ───────── */
  v8: {
    sponsorTypes: ['Qatari Citizen', 'Eligible Qatar Resident'],
    domesticCategories: ['Housemaid', 'Cook', 'Family Driver', 'Gardener', 'Nanny', 'Caregiver', 'Housekeeper', 'Other approved category'],
    domesticPaymentCategories: ['Advance', 'Deployment balance', 'Additional payment', 'Refund paid'],
    /** Refund rule as described in the V8 package. NOT legally verified — a legal/compliance reviewer must confirm before use (V8 §1). */
    refundRule: {
      version: 'MD-21-2021 draft-1', source: 'Client V8 package (Ministerial Decision 21/2021 summary)', effective: 'UNVERIFIED', reviewer: 'PENDING — legal / compliance reviewer',
      fullRefundMonths: 3, totalMonths: 9, deductionPerMonth: 0.15,
    },
    refundReasons: ['Worker refuses work', 'Worker absconds', 'Chronic illness', 'Medical unfitness', 'Recruitment contract breach', 'Other / disputed'],
    refundNeedsReview: ['Other / disputed'],
    refundStatuses: ['Pending review', 'Approved', 'Rejected'],
    vacancySources: ['Local Qatar', 'Overseas', 'Both'],
    vacancyStatuses: ['Open', 'Filled', 'Closed'],
    jobCategories: ['Accountant', 'Engineer', 'HR / Admin', 'Sales', 'Manager', 'IT', 'Other'],
    placementStages: ['Shortlisted', 'Interview', 'Offer', 'Joined', 'Cancelled', 'Replaced'],
    placementSources: ['Local Qatar', 'Overseas'],
    feeBasis: { half: 'Half month basic salary (50%)', one: 'One month basic salary (100%)', custom: 'Custom fixed fee' } as Record<string, string>,
    feeDueMonths: [1, 3],
    serviceTriggers: ['Order confirmed', 'Visa printed', 'Verified arrival', 'Confirmed joining'],
    /** Which candidate stages count as "the trigger has happened" for a service charge (ASSUMPTION V8-Q4). */
    serviceTriggerStages: {
      'Visa printed': ['Visa Printed', 'Deployment Ready', 'Arrived', 'Joined', 'Warranty'],
      'Verified arrival': ['Arrived', 'Joined', 'Warranty'],
      'Confirmed joining': ['Joined', 'Warranty'],
    } as Record<string, string[]>,
    serviceCurrencies: ['USD', 'QAR'],
    serviceBasis: { worker: 'Per deployed worker', order: 'Fixed per order' } as Record<string, string>,
    contractDivisions: [['labour', 'Blue-Collar'], ['domestic', 'Domestic'], ['corporate', 'Corporate']] as [string, string][],
    agreementTypes: ['Manpower supply agreement', 'Service fee agreement', 'Sponsor agreement', 'Placement agreement', 'Warranty / replacement terms', 'Amendment', 'Other'],
    contractAlertDays: [90, 30, 7],
    uploadExtensions: ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'xlsx'],
    uploadMaxMB: 15,
    taskKinds: ['Manual', 'QVC', 'Interview', 'Visa / document expiry', 'Ticket / arrival', 'Warranty', 'Receivable follow-up', 'Other'],
    taskPriorities: ['Normal', 'High'],
    taskEscalateAfterDays: 3, // an Open task this many days past due is flagged for escalation (ASSUMPTION V8-Q6)
    interviewDecisions: ['Pending', 'Selected', 'Rejected'],
    allocationStatuses: ['Proposed', 'Approved', 'Rejected'],
    allocationCategory: 'Agency advance',
  },

  cvSources: ['Direct upload', 'Email attachment', 'WeTransfer download', 'Overseas agency'],
  cvStatuses: ['Needs review', 'Reviewed', 'Candidate created', 'Ignored'],
  importMaxRows: 20000,
};

export function can(role: string | undefined, perm: string): boolean {
  return !!role && (C.permissions[perm] ?? []).includes(role as RoleId);
}
export const roleLabel = (role: string) => C.roles.find(r => r.id === role)?.label ?? role;

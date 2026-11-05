/** Quick-report chips per page (V6 list; entries that could never return data in V6 are removed). Kept separate so the browser bundle stays small. */
const quick: Record<string, string[]> = {
  interviews: ['Interview Schedule', 'Interview Attendance', 'Selected Candidates', 'Rejected Candidates'], visas: ['QVC Pending', 'RTP Pending', 'Visa Printed'],
  deployment: ['Flight Pending', 'Deployment Schedule', 'Arrived', 'Joined'], tickets: ['Flight Pending', 'Tickets Issued', 'Arrival Schedule'],
  orders: ['Order Progress', 'Open Orders'], candidates: ['Candidate List', 'QVC Pending'], agencies: ['Agency Candidates', 'Agency Deployment'],
  warranty: ['Warranty Cases', 'Warranty Expiry'], domestic: ['Domestic Sponsor Cases', 'Domestic Warranty', 'Domestic Balances', 'Refund Claims'], corporate: ['Corporate Vacancies', 'Corporate Placements', 'Placement Fees'], contracts: ['Contract Expiry'], tasks: ['Tasks'], servicefees: ['Service Charges'], demands: ['Demand Letters', 'Demand & Sales Visits'],
  clients: ['Demand & Sales Visits', 'Candidate List'], visits: ['Demand & Sales Visits'], 'visa-master': ['Master Recruitment Report'],
};
export const quickReports = (page: string) => quick[page] ?? ['Candidate List', 'QVC Pending', 'Flight Pending'];

/** Reports implemented in src/lib/repo/reports-v8.ts (database-backed). Kept here so client code and unit tests can reference the names. */
export const V8_REPORT_NAMES = [
  'Contract Expiry', 'Domestic Sponsor Cases', 'Domestic Warranty', 'Domestic Balances', 'Domestic Collections', 'Refund Claims', 'Corporate Vacancies', 'Corporate Placements',
  'Placement Fees', 'Service Charges', 'Agency Deposits', 'Interview Attendance', 'Tasks', 'Receipts Ledger',
];

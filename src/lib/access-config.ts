/**
 * Level-wise access: every screen belongs to a MODULE, and each role has one LEVEL per module:
 *   none  – the screen is hidden and refused (page, API and actions)
 *   view  – can look, cannot add / edit / delete
 *   edit  – can add, edit and move records through their workflow
 *   full  – edit + delete
 * The Managing Director can change the matrix in Settings → Roles & Access. Two hard limits cannot be changed:
 *   • Finance-type modules (and the contract library) never go beyond "none" for Operations Staff (V8 §5);
 *   • the Managing Director always keeps "full" everywhere.
 * Pure data and functions — safe to import from client components.
 */
export type Level = 'none' | 'view' | 'edit' | 'full';
export const LEVELS: Level[] = ['none', 'view', 'edit', 'full'];
export const LEVEL_LABEL: Record<Level, string> = { none: 'No access', view: 'View only', edit: 'View + add/edit', full: 'Full (incl. delete)' };
export const rank = (l: Level) => LEVELS.indexOf(l);

export type Role = 'md' | 'nitija' | 'staff';
export const ROLES: { id: Role; label: string }[] = [{ id: 'md', label: 'Managing Director' }, { id: 'nitija', label: 'Admin Manager (Nitija)' }, { id: 'staff', label: 'Operations Staff' }];

export interface Module {
  id: string; label: string; group: 'Blue-Collar' | 'Domestic' | 'Corporate' | 'Management';
  paths: string[];            // URL prefixes that belong to the module (longest match wins)
  entities: string[];         // record types (saveEntity / deleteEntity) that belong to the module
  /** Roles that may EVER hold more than "none" (finance-type modules). Omitted = all roles. */
  restrictedTo?: Role[];
  staff: Level;               // starting level for Operations Staff (md and nitija start at "full")
}

export const MODULES: Module[] = [
  { id: 'clients', label: 'Client CRM', group: 'Blue-Collar', paths: ['/clients'], entities: ['clients'], staff: 'edit' },
  { id: 'visits', label: 'Visits & Follow-ups', group: 'Blue-Collar', paths: ['/visits'], entities: ['visits'], staff: 'edit' },
  { id: 'demands', label: 'Demand Letters', group: 'Blue-Collar', paths: ['/demands'], entities: ['demands'], staff: 'edit' },
  { id: 'orders', label: 'Manpower Orders', group: 'Blue-Collar', paths: ['/orders'], entities: ['orders'], staff: 'edit' },
  { id: 'agencies', label: 'Overseas Agencies', group: 'Blue-Collar', paths: ['/agencies'], entities: ['allocations', 'agencyRecords'], staff: 'edit' },
  { id: 'candidates', label: 'Candidates, Visa & Deployment', group: 'Blue-Collar', paths: ['/candidates', '/visas', '/deployment'], entities: ['candidates'], staff: 'edit' },
  { id: 'interviews', label: 'Interviews & Attendance', group: 'Blue-Collar', paths: ['/interviews'], entities: ['interviews', 'interviewEntries'], staff: 'edit' },
  { id: 'tickets', label: 'Tickets & Arrival', group: 'Blue-Collar', paths: ['/tickets'], entities: ['tickets'], staff: 'edit' },
  { id: 'warranty', label: 'Warranty', group: 'Blue-Collar', paths: ['/warranty'], entities: ['warranties'], staff: 'edit' },
  { id: 'service_fees', label: 'Service Charges (money)', group: 'Blue-Collar', paths: ['/service-fees'], entities: ['serviceTerms', 'serviceInvoices', 'servicePayments'], restrictedTo: ['md', 'nitija'], staff: 'none' },
  { id: 'domestic', label: 'Domestic Sponsors & Guarantee', group: 'Domestic', paths: ['/domestic'], entities: ['domestic'], staff: 'edit' },
  { id: 'domestic_payments', label: 'Sponsor Payments & Refunds (money)', group: 'Domestic', paths: ['/domestic/payments'], entities: ['domAccount', 'domPayments', 'refunds'], restrictedTo: ['md', 'nitija'], staff: 'none' },
  { id: 'corporate', label: 'Corporate Companies, Vacancies & Candidates', group: 'Corporate', paths: ['/corporate'], entities: ['vacancies', 'placements'], staff: 'edit' },
  { id: 'corporate_fees', label: 'Placement Fees (money)', group: 'Corporate', paths: ['/corporate/fees'], entities: ['placementFees', 'placePayments'], restrictedTo: ['md', 'nitija'], staff: 'none' },
  { id: 'tasks', label: 'Tasks & Alerts', group: 'Management', paths: ['/tasks'], entities: ['tasks'], staff: 'edit' },
  { id: 'contracts', label: 'Contract Library', group: 'Management', paths: ['/contracts'], entities: ['contracts'], restrictedTo: ['md', 'nitija'], staff: 'none' },
  { id: 'finance', label: 'Private Finance (money)', group: 'Management', paths: ['/finance'], entities: ['finance', 'fundAllocations'], restrictedTo: ['md', 'nitija'], staff: 'none' },
  { id: 'vault', label: 'Credentials Register', group: 'Management', paths: ['/vault'], entities: ['credentials'], staff: 'edit' },
  { id: 'import', label: 'Excel Import Center', group: 'Management', paths: ['/import-center'], entities: [], staff: 'edit' },
  { id: 'cv_inbox', label: 'CV Intake Center', group: 'Management', paths: ['/cv-inbox'], entities: [], staff: 'edit' },
  { id: 'reports', label: 'Reports, Master Report & Excel export', group: 'Management', paths: ['/reports', '/visa-master', '/ai-reports'], entities: [], staff: 'view' },
];
/** Screens everyone with a login may open (their own content is still filtered by the rules above). */
const OPEN_PATHS = ['/', '/settings', '/automations', '/login'];

const byPathLength = [...MODULES].flatMap(m => m.paths.map(p => ({ p, m }))).sort((a, b) => b.p.length - a.p.length);
export function moduleForPath(pathname: string): Module | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (OPEN_PATHS.includes(path)) return null;
  return byPathLength.find(x => path === x.p || path.startsWith(x.p + '/'))?.m ?? null;
}
/** Modules that may authorise a record type. `clients` is also needed by the Corporate Companies list. */
export function modulesForEntity(entity: string): string[] {
  const own = MODULES.filter(m => m.entities.includes(entity)).map(m => m.id);
  return entity === 'clients' ? [...own, 'corporate'] : own;
}

export const defaultLevel = (role: Role, m: Module): Level => (role === 'staff' ? m.staff : 'full');
/** Highest level a role may ever be given for a module. */
export function ceiling(role: Role, m: Module): Level {
  if (role === 'md') return 'full';
  if (m.restrictedTo && !m.restrictedTo.includes(role)) return 'none';
  return 'full';
}
/** Resolve one cell: stored override (if valid) else the default, never above the ceiling; the MD is always full. */
export function resolve(role: Role, m: Module, stored?: Level | null): Level {
  if (role === 'md') return 'full';
  const want = stored && LEVELS.includes(stored) ? stored : defaultLevel(role, m);
  return rank(want) > rank(ceiling(role, m)) ? ceiling(role, m) : want;
}
export type Matrix = Record<string, Level>;
export const buildMatrix = (role: Role, stored: Record<string, Level> = {}): Matrix => Object.fromEntries(MODULES.map(m => [m.id, resolve(role, m, stored[m.id])]));

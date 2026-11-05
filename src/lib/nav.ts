/** V6 navigation (same groups and order). `built: true` pages show a "planned" notice until their stage is built. */
export interface NavItem { slug: string; label: string; icon?: string; built: boolean; perm?: string }

export const DIVISIONS = [
  { id: 'labour', label: 'Blue-Collar Recruitment', icon: '♙', href: '/orders' },
  { id: 'domestic', label: 'Domestic Workers', icon: '⌂', href: '/domestic' },
  { id: 'corporate', label: 'Corporate Recruitment', icon: '▤', href: '/corporate' },
];

export const LABOUR_PAGES: NavItem[] = [
  { slug: 'clients', label: 'Client CRM', built: true }, { slug: 'visits', label: 'Visits & Follow-ups', built: true }, { slug: 'demands', label: 'Demand Letters', built: true },
  { slug: 'orders', label: 'Manpower Orders', built: true }, { slug: 'agencies', label: 'Overseas Agencies', built: true }, { slug: 'candidates', label: 'Candidates & CVs', built: true },
  { slug: 'interviews', label: 'Interviews', built: true }, { slug: 'visas', label: 'Visa / QVC / RTP', built: true }, { slug: 'deployment', label: 'Deployment', built: true },
  { slug: 'tickets', label: 'Tickets & Arrival', built: true }, { slug: 'warranty', label: 'Warranty', built: true },
  { slug: 'service-fees', label: 'Service Charges', built: true, perm: 'finance.view' },
];

export const DOMESTIC_PAGES: NavItem[] = [
  { slug: 'domestic', label: 'Sponsors & Cases', built: true }, { slug: 'domestic/payments', label: 'Sponsor Payments', built: true, perm: 'finance.view' },
  { slug: 'domestic/warranty', label: '9-Month Guarantee', built: true }, { slug: 'domestic/reports', label: 'Domestic Reports', built: true },
];
export const CORPORATE_PAGES: NavItem[] = [
  { slug: 'corporate', label: 'Companies & Vacancies', built: true }, { slug: 'corporate/candidates', label: 'Candidates', built: true },
  { slug: 'corporate/fees', label: 'Placement Fees', built: true, perm: 'finance.view' }, { slug: 'corporate/reports', label: 'Corporate Reports', built: true },
];

export const MANAGEMENT: NavItem[] = [
  { slug: 'tasks', label: 'Tasks & Alerts', icon: '◷', built: true }, { slug: 'automations', label: 'Automations', icon: '⚙', built: true }, { slug: 'contracts', label: 'Contract Library', icon: '▣', built: true, perm: 'contracts.view' },
  { slug: 'visa-master', label: 'Master Recruitment Report', icon: '▦', built: true }, { slug: 'reports', label: 'Reports & Alerts', icon: '▦', built: true },
  { slug: 'import-center', label: 'Excel Import Center', icon: '⇧', built: true }, { slug: 'cv-inbox', label: 'CV Intake Center', icon: '✉', built: true },
  { slug: 'ai-reports', label: 'AI Reports & Exports', icon: '✦', built: true }, { slug: 'vault', label: 'Credentials Register', icon: '⚿', built: true },
  { slug: 'finance', label: 'Private Finance', icon: '◈', built: true, perm: 'finance.view' }, { slug: 'settings', label: 'Settings & Data', icon: '⚙', built: true },
];

export const ALL_NAV: NavItem[] = [...LABOUR_PAGES, ...MANAGEMENT, { slug: 'domestic', label: 'Domestic Workers', built: true }, { slug: 'corporate', label: 'Corporate Recruitment', built: true }];
export const hrefOf = (i: NavItem) => (i.built ? `/${i.slug}` : `/soon/${i.slug}`);

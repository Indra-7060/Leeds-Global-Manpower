import type { ReactNode } from 'react';

/** Small line-icon set (24×24, currentColor). One name per module / widget — used by the sidebar and dashboard. */
const P: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="5" rx="2" /><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  recruitment: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M3 12.5h18" /></>,
  clients: <><path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5H13v16" /><path d="M13 10h5.5A1.5 1.5 0 0 1 20 11.5V21" /><path d="M2.5 21h19" /><path d="M8 9h1M8 13h1M16 14h1M16 17.5h1" /></>,
  visits: <><path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></>,
  demands: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></>,
  orders: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h6M9 18h3" /></>,
  agencies: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" /></>,
  candidates: <><circle cx="9" cy="8" r="3.3" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16 5.2a3.3 3.3 0 0 1 0 6M18 14.2a6.2 6.2 0 0 1 3.2 5.8" /></>,
  interviews: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" /><path d="M8 9h8M8 12h5" /></>,
  visas: <><rect x="4.5" y="3" width="15" height="18" rx="2.5" /><circle cx="12" cy="10" r="3" /><path d="M8.5 16.5h7" /></>,
  deployment: <><path d="M2.5 14.5 21 5l-3.5 14-5-4-3 3.5V15z" /><path d="M21 5 11.5 15" /></>,
  tickets: <><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5V10a2 2 0 0 0 0 4v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5V14a2 2 0 0 0 0-4z" /><path d="M14 7v10" strokeDasharray="1.5 2" /></>,
  warranty: <><path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  fees: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  money: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v.01M17.5 14.5v.01" /></>,
  domestic: <><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 10v10h13V10" /><path d="M10 20v-5.5h4V20" /></>,
  corporate: <><rect x="4" y="3" width="10" height="18" rx="1.5" /><path d="M14 9h4.5A1.5 1.5 0 0 1 20 10.5V21h-6" /><path d="M7.5 7h3M7.5 11h3M7.5 15h3" /></>,
  tasks: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  contracts: <><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" /><path d="M8.5 13.5h7" /></>,
  automations: <><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" /></>,
  reports: <><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7.5" y="11" width="3" height="6" rx=".8" /><rect x="12.5" y="7" width="3" height="10" rx=".8" /><rect x="17.5" y="13" width="2" height="4" rx=".8" /></>,
  import: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  inbox: <><path d="M3.5 13.5 6 5.5A1.5 1.5 0 0 1 7.4 4.5h9.2A1.5 1.5 0 0 1 18 5.5l2.5 8" /><path d="M3.5 13.5V18A1.5 1.5 0 0 0 5 19.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5H15a3 3 0 0 1-6 0z" /></>,
  sparkles: <><path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18.5 15.5v4M16.5 17.5h4" /></>,
  vault: <><circle cx="8" cy="14" r="4" /><path d="M11 12 20 3.5M16.5 7l2.5 2.5M14 9.5l2 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  pipeline: <><path d="M3 6h18M6 12h12M9 18h6" /></>,
  logout: <><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
};

const ALIAS: Record<string, string> = {
  'domestic/payments': 'money', 'domestic/warranty': 'warranty', 'domestic/reports': 'reports',
  'corporate/candidates': 'candidates', 'corporate/fees': 'fees', 'corporate/reports': 'reports',
  'service-fees': 'money', 'visa-master': 'reports', 'import-center': 'import', 'cv-inbox': 'inbox', 'ai-reports': 'sparkles', finance: 'money',
};
export const iconName = (slug: string) => ALIAS[slug] ?? slug;

export default function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const shape = P[iconName(name)] ?? P.dashboard;
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shape}</svg>;
}

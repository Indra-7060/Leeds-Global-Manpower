import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/dal';
import { can } from '@/lib/config';
import SubTabs from '@/components/SubTabs';

/** Domestic Workers has its own tabs (V8 §2). Payments need the finance permission, so the tab is only offered to MD / Nitija (the page re-checks). */
export default async function DomesticLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  const tabs = [{ href: '/domestic', label: 'Sponsors & Cases' }, ...(can(user.role, 'finance.view') ? [{ href: '/domestic/payments', label: 'Sponsor Payments' }] : []),
    { href: '/domestic/warranty', label: '9-Month Guarantee' }, { href: '/domestic/reports', label: 'Domestic Reports' }, ...(can(user.role, 'contracts.view') ? [{ href: '/contracts?division=domestic', label: 'Sponsor Contracts' }] : [])];
  return <><SubTabs tabs={tabs} />{children}</>;
}

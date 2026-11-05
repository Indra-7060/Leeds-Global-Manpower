import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/dal';
import { can } from '@/lib/config';
import SubTabs from '@/components/SubTabs';

export default async function CorporateLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  const tabs = [{ href: '/corporate', label: 'Companies & Vacancies' }, { href: '/corporate/candidates', label: 'Candidates (Local / Overseas)' }, ...(can(user.role, 'finance.view') ? [{ href: '/corporate/fees', label: 'Placement Fees' }] : []),
    { href: '/corporate/reports', label: 'Corporate Reports' }, ...(can(user.role, 'contracts.view') ? [{ href: '/contracts?division=corporate', label: 'Company Contracts' }] : [])];
  return <><SubTabs tabs={tabs} />{children}</>;
}

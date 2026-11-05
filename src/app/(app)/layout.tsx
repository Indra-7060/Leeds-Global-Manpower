import type { ReactNode } from 'react';
import { logoutAction } from '@/app/login/actions';
import { requireUser } from '@/lib/auth/dal';
import { can, roleLabel } from '@/lib/config';
import Sidebar from '@/components/Sidebar';
import WorkspaceSwitch from '@/components/WorkspaceSwitch';
import { ToastProvider } from '@/components/Toaster';
import ReportsToolbar from '@/components/ReportsToolbar';
import { prisma } from '@/lib/db';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, ws } = await requireUser();
  const [cl, co1, co2] = await Promise.all([prisma.client.findMany({ where: { workspace: ws }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.candidate.findMany({ where: { workspace: ws }, select: { country: true }, distinct: ['country'] }), prisma.order.findMany({ where: { workspace: ws }, select: { country: true }, distinct: ['country'] })]);
  const countries = [...new Set([...co1, ...co2].map(x => x.country))].sort();
  return (
    <ToastProvider>
      <div className="shell">
        <aside>
          <div className="brand"><div className="logo">◎</div><div><strong>LEADS GLOBAL</strong><small>MANPOWER · ERP</small></div></div>
          <Sidebar perms={['finance.view', 'contracts.view'].filter(p => can(user.role, p))} />
          <div className="foot" style={{ padding: 15 }}>Next.js build<br />{ws === 'demo' ? 'Sample data' : 'Working records'} · MySQL</div>
        </aside>
        <main>
          <header>
            <div><strong>Leads Global Manpower</strong><div className="muted">Recruitment Operations Platform · Qatar</div></div>
            <div className="who">
              <WorkspaceSwitch ws={ws} canSwitch={can(user.role, 'workspace.switch')} />
              <span className="muted">{user.name === roleLabel(user.role) ? user.name : `${user.name} · ${roleLabel(user.role)}`}</span>
              <form action={logoutAction}><button className="btn secondary small" type="submit">Sign out</button></form>
            </div>
          </header>
          <div className={`banner ${ws === 'demo' ? 'demo' : 'live'}`}>
            {ws === 'demo' ? 'DEMO WORKSPACE — fictional sample data only. Not business data.' : 'LIVE WORKSPACE — real business records. Changes are saved to the database and logged.'}
          </div>
          <div className="content"><ReportsToolbar clients={cl.map(c => c.name)} countries={countries} />{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}

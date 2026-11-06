import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MODULES, moduleForPath, LEVEL_LABEL } from '@/lib/access-config';
import { loadMatrix } from '@/lib/repo/access';
import { logoutAction } from '@/app/login/actions';
import { requireUser } from '@/lib/auth/dal';
import { can, roleLabel } from '@/lib/config';
import Sidebar from '@/components/Sidebar';
import WorkspaceSwitch from '@/components/WorkspaceSwitch';
import { ToastProvider } from '@/components/Toaster';
import ReportsToolbar from '@/components/ReportsToolbar';
import { prisma } from '@/lib/db';
import { AutoRefresh } from '@/components/V8Controls';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, ws } = await requireUser();
  // level-wise access: one check for every screen (the write actions and APIs check again)
  const matrix = await loadMatrix(user.role), here = moduleForPath((await headers()).get('x-pathname') ?? '/');
  if (here && matrix[here.id] === 'none') redirect('/?denied=' + encodeURIComponent(`no access to ${here.label}`));
  const readOnly = !!here && matrix[here.id] === 'view';
  const hidden = MODULES.filter(m => matrix[m.id] === 'none').map(m => m.id);
  const [cl, co1, co2] = await Promise.all([prisma.client.findMany({ where: { workspace: ws }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.candidate.findMany({ where: { workspace: ws }, select: { country: true }, distinct: ['country'] }), prisma.order.findMany({ where: { workspace: ws }, select: { country: true }, distinct: ['country'] })]);
  const countries = [...new Set([...co1, ...co2].map(x => x.country))].sort();
  const perms = ['finance.view', 'contracts.view'].filter(p => can(user.role, p));
  return (
    <ToastProvider>
      <div className="shell">
        <aside>
          <div className="brand"><div className="logo">◎</div><div><strong>LEADS GLOBAL</strong><small>MANPOWER · ERP</small></div></div>
          <Sidebar perms={perms} hidden={hidden} />
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
          <div className={`content ${readOnly ? 'readonly' : ''}`}>{readOnly && <div className="notice" style={{ marginTop: 0 }}><b>{LEVEL_LABEL.view}.</b> Your role can look at this screen but not add, change or delete records.</div>}<ReportsToolbar clients={cl.map(c => c.name)} countries={countries} perms={perms} /><AutoRefresh />{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}

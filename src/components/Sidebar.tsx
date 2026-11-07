'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { moduleForPath } from '@/lib/access-config';
import { CORPORATE_PAGES, DIVISIONS, DOMESTIC_PAGES, LABOUR_PAGES, MANAGEMENT, hrefOf, type NavItem } from '@/lib/nav';
import Icon from './icons';

/** `perms` lists the permissions the signed-in user has (computed on the server). The server still re-checks every page. */
export default function Sidebar({ perms, hidden }: { perms: string[]; hidden: string[] }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const active = path.startsWith('/domestic') ? 'domestic' : path.startsWith('/corporate') ? 'corporate' : LABOUR_PAGES.some(p => path === hrefOf(p) || path.startsWith(hrefOf(p) + '/')) ? 'labour' : '';
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => open[id] ?? id === active;
  const is = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const allowed = (i: NavItem) => (!i.perm || perms.includes(i.perm)) && !hidden.includes(moduleForPath('/' + i.slug)?.id ?? '');
  const sections: { id: string; label: string; icon: string; pages: NavItem[] }[] = [
    { id: 'labour', label: DIVISIONS[0].label, icon: 'candidates', pages: LABOUR_PAGES }, { id: 'domestic', label: DIVISIONS[1].label, icon: 'domestic', pages: DOMESTIC_PAGES }, { id: 'corporate', label: DIVISIONS[2].label, icon: 'corporate', pages: CORPORATE_PAGES },
  ];
  /** exact page wins over its sub-pages (e.g. /domestic vs /domestic/payments) */
  const current = (p: NavItem, pages: NavItem[]) => path === hrefOf(p) || (is(hrefOf(p)) && !pages.some(q => q !== p && q.slug.startsWith(p.slug + '/') && is(hrefOf(q))));
  return (
    <>
      <button className="menu-btn" type="button" onClick={() => setMenu(m => !m)} aria-expanded={menu}><Icon name="menu" /> Menu</button>
      <nav id="nav" aria-label="Main navigation" className={menu ? 'open' : ''} onClick={e => { if ((e.target as HTMLElement).closest('a')) setMenu(false); }}>
        <Link href="/" className={is('/') ? 'active' : ''}><Icon name="dashboard" /> Dashboard</Link>
        <div className="nav-label">Recruitment</div>
        {sections.map(sec => (
          <div key={sec.id}>
            <button className="nav-group" type="button" aria-expanded={isOpen(sec.id)} onClick={() => setOpen(o => ({ ...o, [sec.id]: !isOpen(sec.id) }))}>
              <Icon name={sec.icon} /> {sec.label}<span className="chev"><Icon name="chevron" size={15} /></span>
            </button>
            {isOpen(sec.id) && <div className="nav-sub">{sec.pages.filter(allowed).map(p => <Link key={p.slug} href={hrefOf(p)} className={current(p, sec.pages) ? 'active' : ''}>{p.label}{!p.built && <span className="soon">soon</span>}</Link>)}</div>}
          </div>
        ))}
        <div className="nav-label">Management</div>
        {MANAGEMENT.filter(allowed).map(m => <Link key={m.slug} href={hrefOf(m)} className={is(hrefOf(m)) ? 'active' : ''}><Icon name={m.slug} /> {m.label}{!m.built && <span className="soon">soon</span>}</Link>)}
      </nav>
    </>
  );
}

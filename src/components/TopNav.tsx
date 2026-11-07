'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { moduleForPath } from '@/lib/access-config';
import { CORPORATE_PAGES, DIVISIONS, DOMESTIC_PAGES, LABOUR_PAGES, MANAGEMENT, hrefOf, type NavItem } from '@/lib/nav';
import Icon from './icons';

type MenuId = 'rec' | 'mgmt' | null;

/**
 * Top navigation: brand, main menu with drop-down panels (Recruitment → three divisions, Management), a section strip with the
 * pages of the division you are in, and the workspace / user area (passed in as `right`). `perms` and `hidden` come from the
 * server; the server still re-checks every page and action.
 */
export default function TopNav({ perms, hidden, right }: { perms: string[]; hidden: string[]; right: ReactNode }) {
  const path = usePathname();
  // a menu counts as open only on the page it was opened on, so navigating closes it without an effect
  const [openAt, setOpenAt] = useState<{ id: Exclude<MenuId, null>; at: string } | null>(null);
  const [mobileAt, setMobileAt] = useState<string | null>(null);
  const open: MenuId = openAt && openAt.at === path ? openAt.id : null;
  const mobile = mobileAt === path;
  const setOpen = (id: MenuId) => setOpenAt(id ? { id, at: path } : null);
  const setMobile = (v: boolean) => setMobileAt(v ? path : null);
  const bar = useRef<HTMLElement>(null);
  const allowed = (i: NavItem) => (!i.perm || perms.includes(i.perm)) && !hidden.includes(moduleForPath('/' + i.slug)?.id ?? '');
  const is = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const sections = [
    { id: 'labour', label: DIVISIONS[0].label, icon: 'candidates', pages: LABOUR_PAGES.filter(allowed) },
    { id: 'domestic', label: DIVISIONS[1].label, icon: 'domestic', pages: DOMESTIC_PAGES.filter(allowed) },
    { id: 'corporate', label: DIVISIONS[2].label, icon: 'corporate', pages: CORPORATE_PAGES.filter(allowed) },
  ];
  const mgmt = MANAGEMENT.filter(allowed);
  const here = path.startsWith('/domestic') ? 'domestic' : path.startsWith('/corporate') ? 'corporate' : LABOUR_PAGES.some(p => is(hrefOf(p))) ? 'labour' : '';
  const strip = sections.find(s => s.id === here);
  const inRec = !!here, inMgmt = MANAGEMENT.some(m => is(hrefOf(m)));
  const current = (p: NavItem, pages: NavItem[]) => path === hrefOf(p) || (is(hrefOf(p)) && !pages.some(q => q !== p && q.slug.startsWith(p.slug + '/') && is(hrefOf(q))));

  useEffect(() => {
    const away = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setOpenAt(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpenAt(null); setMobileAt(null); } };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);
  const toggle = (id: Exclude<MenuId, null>) => setOpen(open === id ? null : id);

  return (
    <>
      <header className="topbar" ref={bar}>
        <Link href="/" className="topbrand" aria-label="Leads Global Manpower — dashboard">
          <span className="logo"><Icon name="agencies" size={20} /></span>
          <span><strong>LEADS GLOBAL</strong><small>MANPOWER · QATAR</small></span>
        </Link>
        <button className="menu-btn" type="button" onClick={() => setMobile(!mobile)} aria-expanded={mobile} aria-label="Menu"><Icon name="menu" /></button>
        <nav className={`topnav ${mobile ? 'open' : ''}`} aria-label="Main navigation">
          <Link href="/" className={`navlink ${path === '/' ? 'active' : ''}`}><Icon name="dashboard" size={16} /> Dashboard</Link>
          <div className="navmenu">
            <button type="button" className={`navlink ${inRec || open === 'rec' ? 'active' : ''}`} aria-expanded={open === 'rec'} onClick={() => toggle('rec')}><Icon name="recruitment" size={16} /> Recruitment <Icon name="chevron" size={13} className="caret" /></button>
            {(open === 'rec' || mobile) && (
              <div className="mega mega-3">
                {sections.map(sec => (
                  <div key={sec.id} className="mega-col">
                    <div className="mega-title"><Icon name={sec.icon} size={16} /> {sec.label}</div>
                    {sec.pages.map(p => <Link key={p.slug} href={hrefOf(p)} className={current(p, sec.pages) ? 'active' : ''}>{p.label}</Link>)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="navmenu">
            <button type="button" className={`navlink ${inMgmt || open === 'mgmt' ? 'active' : ''}`} aria-expanded={open === 'mgmt'} onClick={() => toggle('mgmt')}><Icon name="reports" size={16} /> Management <Icon name="chevron" size={13} className="caret" /></button>
            {(open === 'mgmt' || mobile) && (
              <div className="mega mega-2">
                <div className="mega-col mega-wide">
                  <div className="mega-title">Management</div>
                  <div className="mega-grid">{mgmt.map(m => <Link key={m.slug} href={hrefOf(m)} className={is(hrefOf(m)) ? 'active' : ''}><Icon name={m.slug} size={16} /> {m.label}</Link>)}</div>
                </div>
              </div>
            )}
          </div>
        </nav>
        <div className="topright">{right}</div>
      </header>
      {strip && strip.pages.length > 0 && (
        <div className="strip" aria-label={`${strip.label} pages`}>
          <span className="strip-label"><Icon name={strip.icon} size={15} /> {strip.label}</span>
          {strip.pages.map(p => <Link key={p.slug} href={hrefOf(p)} className={current(p, strip.pages) ? 'active' : ''}>{p.label}</Link>)}
        </div>
      )}
    </>
  );
}

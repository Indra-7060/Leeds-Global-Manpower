'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { moduleForPath } from '@/lib/access-config';
import { CORPORATE_PAGES, DIVISIONS, DOMESTIC_PAGES, LABOUR_PAGES, MANAGEMENT, hrefOf, type NavItem } from '@/lib/nav';

/** `perms` lists the permissions the signed-in user has (computed on the server). The server still re-checks every page. */
export default function Sidebar({ perms, hidden }: { perms: string[]; hidden: string[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const is = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const allowed = (i: NavItem) => (!i.perm || perms.includes(i.perm)) && !hidden.includes(moduleForPath('/' + i.slug)?.id ?? '');
  const active = path.startsWith('/domestic') ? 'domestic' : path.startsWith('/corporate') ? 'corporate' : 'labour';
  const inLabour = LABOUR_PAGES.some(p => is(hrefOf(p)));
  const group = (title: string, pages: NavItem[]) => (
    <>
      <div className="v6-section">{title}</div>
      {pages.filter(allowed).map(p => <Link key={p.slug} href={hrefOf(p)} className={`v6-sub ${path === hrefOf(p) || (p.slug.indexOf('/') < 0 && is(hrefOf(p)) && !pages.some(q => q.slug.startsWith(p.slug + '/') && is(hrefOf(q)))) ? 'active' : ''}`}>· {p.label}{!p.built && <span className="soon">soon</span>}</Link>)}
    </>
  );
  return (
    <nav id="nav" aria-label="Main navigation">
      <Link href="/" className={is('/') ? 'active' : ''}>◫ &nbsp; Dashboard</Link>
      <button className="v6-group" type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}>♧ &nbsp; Recruitment <span>{open ? '▾' : '▸'}</span></button>
      {open && DIVISIONS.map(d => <Link key={d.id} href={d.href} className={`v6-sub ${active === d.id && (inLabour || d.id !== 'labour' || path === '/') ? 'active' : ''}`}>{d.icon} &nbsp; {d.label}</Link>)}
      {open && active === 'labour' && group('Blue-Collar Modules', LABOUR_PAGES)}
      {open && active === 'domestic' && group('Domestic Workers', DOMESTIC_PAGES)}
      {open && active === 'corporate' && group('Corporate Recruitment', CORPORATE_PAGES)}
      <div className="v6-section">Management</div>
      {MANAGEMENT.filter(allowed).map(m => <Link key={m.slug} href={hrefOf(m)} className={is(hrefOf(m)) ? 'active' : ''}>{m.icon} &nbsp; {m.label}{!m.built && <span className="soon">soon</span>}</Link>)}
    </nav>
  );
}

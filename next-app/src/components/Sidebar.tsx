'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { DIVISIONS, LABOUR_PAGES, MANAGEMENT, hrefOf } from '@/lib/nav';

export default function Sidebar({ canFinance }: { canFinance: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const is = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const inLabour = LABOUR_PAGES.some(p => is(hrefOf(p)));
  const active = path.startsWith('/domestic') ? 'domestic' : path.startsWith('/corporate') ? 'corporate' : 'labour';
  return (
    <nav id="nav" aria-label="Main navigation">
      <Link href="/" className={is('/') ? 'active' : ''}>◫ &nbsp; Dashboard</Link>
      <button className="v6-group" type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}>♧ &nbsp; Recruitment <span>{open ? '▾' : '▸'}</span></button>
      {open && DIVISIONS.map(d => <Link key={d.id} href={d.href} className={`v6-sub ${active === d.id && (inLabour || d.id !== 'labour' || path === '/') ? 'active' : ''}`}>{d.icon} &nbsp; {d.label}</Link>)}
      {open && active === 'labour' && (
        <>
          <div className="v6-section">Blue-Collar Modules</div>
          {LABOUR_PAGES.map(p => <Link key={p.slug} href={hrefOf(p)} className={`v6-sub ${is(hrefOf(p)) ? 'active' : ''}`}>· {p.label}{!p.built && <span className="soon">soon</span>}</Link>)}
        </>
      )}
      <div className="v6-section">Management</div>
      {MANAGEMENT.filter(m => m.slug !== 'finance' || canFinance).map(m => <Link key={m.slug} href={hrefOf(m)} className={is(hrefOf(m)) ? 'active' : ''}>{m.icon} &nbsp; {m.label}{!m.built && <span className="soon">soon</span>}</Link>)}
    </nav>
  );
}

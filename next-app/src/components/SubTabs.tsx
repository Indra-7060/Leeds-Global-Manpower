'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Tabs for one division (each division has its own tabs — V8 §2). The tab list is chosen by the page; finance tabs are filtered server-side. */
export default function SubTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return <div className="tabs">{tabs.map(t => <Link key={t.href} href={t.href} className={`tab ${path === t.href ? 'selected' : ''}`}>{t.label}</Link>)}</div>;
}

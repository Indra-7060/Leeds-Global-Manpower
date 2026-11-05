import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/dal';
import { ALL_NAV } from '@/lib/nav';
import { can } from '@/lib/config';
import { Heading, Notice, Panel } from '@/components/ui';

/** Placeholder for V6 modules that are planned for the next build stages. */
export default async function SoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireUser();
  const { slug } = await params;
  const item = ALL_NAV.find(i => i.slug === slug);
  if (!item || item.built) notFound();
  if (item.perm && !can(user.role, item.perm)) notFound();
  return (
    <>
      <Heading title={item.label} desc="This V6 module is planned for the next build stage." />
      <Panel title="Not built yet">
        <p>The database tables for <b>{item.label}</b> already exist; the screens and server logic are the next stage. Everything in <Link href="/clients">Client CRM</Link>, <Link href="/orders">Manpower Orders</Link> and <Link href="/candidates">Candidates & CVs</Link> already works end to end.</p>
      </Panel>
      <Notice>Nothing in this module is simulated — it simply is not built yet.</Notice>
    </>
  );
}

import Link from 'next/link';
import { requireUser } from '@/lib/auth/dal';
import { Heading, Notice, Panel } from '@/components/ui';

interface Item { name: string; state: 'Working' | 'Partly' | 'Not connected'; what: string; needs: string; href?: string }
const ITEMS: Item[] = [
  { name: 'In-app reminders and alerts', state: 'Working', what: 'Reminders are worked out from the records (QVC, tickets, driver details, warranty and guarantee dates, contract expiry at 90/30/7 days, overdue placement fees) and shown on Tasks & Alerts and the dashboard.', needs: 'Nothing — but they only appear on screen; nothing is sent to anyone.', href: '/tasks' },
  { name: 'Staff tasks with owners, due dates and escalation flag', state: 'Working', what: 'Managers assign tasks; staff complete their own.', needs: 'Nothing.', href: '/tasks' },
  { name: 'Automatic screen refresh', state: 'Working', what: 'Open screens re-read the database about once a minute (paused while a form is open), so other people’s changes appear without pressing refresh.', needs: 'Nothing. Instant push updates are not built.' },
  { name: 'Excel import / export', state: 'Partly', what: 'Real .xlsx export for every report; Excel/CSV import with preview and duplicate checks for candidates, orders and finance.', needs: 'Import for sponsors, vacancies, placements and contracts is not built.', href: '/import-center' },
  { name: 'CV intake', state: 'Partly', what: 'Upload CV files and record e-mail/phone details by hand.', needs: 'Reading a mailbox or WeTransfer links automatically needs mailbox access and a document-reading service. The CV file itself is not stored.', href: '/cv-inbox' },
  { name: 'Invoices, receipts and credit notes', state: 'Partly', what: 'Receipt and invoice numbers are issued and recorded.', needs: 'Branded PDF documents need the client’s templates, VAT/tax rules and numbering.' },
  { name: 'E-mail reminders and notices', state: 'Not connected', what: 'No e-mail is sent.', needs: 'An e-mail account/provider (SMTP), message templates, and a server that stays switched on to run the schedule.' },
  { name: 'WhatsApp messages', state: 'Not connected', what: 'No WhatsApp message is sent.', needs: 'A WhatsApp Business provider account (paid), approved message templates and customer consent.' },
  { name: 'Virus scanning of uploaded files', state: 'Not connected', what: 'Uploads are checked for file type, size and content signature only.', needs: 'Install a scanner such as ClamAV on the server.' },
  { name: 'Backups', state: 'Not connected', what: 'Only a manual database export (phpMyAdmin / mysqldump) and a JSON copy are available. Contract files and the encryption key are not included in either.', needs: 'A destination (client cloud storage), a schedule and restore tests. Back up the storage folder and DATA_KEY too.' },
  { name: 'Sign-in with a second factor (MFA)', state: 'Not connected', what: 'Password login only.', needs: 'Choose an authenticator app (free) or SMS/e-mail codes (paid).' },
];
const cls = { Working: 'green', Partly: 'orange', 'Not connected': 'grey' } as const;

export default async function AutomationsPage() {
  await requireUser();
  return (
    <>
      <Heading title="Automations & Integrations" desc="What runs by itself today, and what still needs an outside service" />
      <Panel title="Status">
        <div className="scroll-x"><table><thead><tr><th>Capability</th><th>Status</th><th>What it does now</th><th>What it still needs</th></tr></thead><tbody>
          {ITEMS.map(i => <tr key={i.name}><td><b>{i.href ? <Link href={i.href}>{i.name}</Link> : i.name}</b></td><td><span className={`pill ${cls[i.state]}`}>{i.state}</span></td><td>{i.what}</td><td>{i.needs}</td></tr>)}
        </tbody></table></div>
      </Panel>
      <Notice>“Not connected” means the feature is not built or not switched on — it needs an outside account, a paid service or a server decision. See the V8 status document (docs/08_V8_Gap_Analysis_and_Status.md) for the full list.</Notice>
    </>
  );
}

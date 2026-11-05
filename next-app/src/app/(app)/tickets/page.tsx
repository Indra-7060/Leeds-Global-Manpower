import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { buildLookups } from '@/lib/lookups';
import { stepRank } from '@/lib/domain/metrics';
import { C } from '@/lib/config';
import { Badge, Flow, Heading, Notice, Panel } from '@/components/ui';
import DataTable, { type TableRow } from '@/components/DataTable';
import EntityForm from '@/components/EntityForm';
import { AdvanceButton, DeleteButton } from '@/components/RowButtons';

export default async function TicketsPage() {
  const { ws } = await requireUser();
  const s = await loadState(ws);
  const cand = (id: string) => s.candidates.find(c => c.id === id) ?? {};
  const rows: TableRow[] = s.tickets.map(t => {
    const c = cand(t.candidate_id), next = C.ticketSteps[stepRank(t.step) + 1];
    return {
      key: String(t.id), search: `${t.candidate_id} ${c.name} ${c.client} ${t.flight} ${t.driver_name}`, filters: { ticket_by: t.ticket_by || 'Not confirmed', step: t.step, client: c.client ?? '' },
      cells: [c.client, `${t.candidate_id} · ${c.name ?? '?'}`, t.ticket_by || 'Not confirmed', [t.flight, c.flight_date].filter(Boolean).join(' · ') || 'Pending', t.driver_name ? `${t.driver_name} ${t.driver_phone}` : 'Not provided', <Badge key="b" text={t.step} />],
      actions: <>
        {next && <AdvanceButton entity="tickets" id={t.id} next={next} />}
        <EntityForm entity="tickets" id={t.id} label="Edit" cls="secondary small" values={{ ...t, flight_date: c.flight_date ?? '' }} lookups={buildLookups(s, { keepTravelCandidate: t.candidate_id })} />
        <DeleteButton entity="tickets" id={t.id} what={`Travel record for ${t.candidate_id}`} />
      </>,
    };
  });
  const uniq = (k: string) => [...new Set(rows.map(r => r.filters[k]))].filter(Boolean).sort();
  return (
    <>
      <Heading title="Tickets & Arrival Coordination" desc="Coordinate ticket payer, booking reminders, arrival notice and pickup confirmation" />
      <Panel title="Flight Coordination" actions={<EntityForm entity="tickets" label="+ Add Travel Record" lookups={buildLookups(s)} />}>
        <DataTable columns={['Client', 'Candidate', 'Ticket By', 'Flight', 'Pickup Driver', 'Status']} rows={rows}
          filters={[{ key: 'ticket_by', label: 'Ticket by', values: uniq('ticket_by') }, { key: 'step', label: 'Statuses', values: [...C.ticketSteps] }, { key: 'client', label: 'Clients', values: uniq('client') }]} empty="No travel records yet. Add one for a candidate whose visa is printed." />
      </Panel>
      <Panel title="Travel Checklist"><Flow items={['Visa Printed', 'Confirm Ticket Responsibility', 'Request Booking', 'Share Flight Details', 'Send Arrival Notice', 'Driver Name & Phone', 'Verify Qatar Arrival', 'Confirm Joining']} /></Panel>
      <Notice>Reminders for missing ticket responsibility, ticket dates and driver details appear on the Dashboard. Ticket copies and arrival evidence need file storage and are not available yet.</Notice>
    </>
  );
}

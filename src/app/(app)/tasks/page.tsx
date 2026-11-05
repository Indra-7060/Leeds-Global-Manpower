import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import { computeAlerts } from '@/lib/domain/alerts';
import * as V from '@/lib/domain/v8';
import { C, can } from '@/lib/config';
import { dateToISO, diffDays, todayISO } from '@/lib/util';
import { Badge, Cards, Heading, Metric, Notice, Panel, Table } from '@/components/ui';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';
import { TaskToggle } from '@/components/V8Controls';

export default async function TasksPage() {
  const { user, ws } = await requireUser();
  const today = todayISO(), assign = can(user.role, 'tasks.assign'), fin = can(user.role, 'finance.view');
  const lookups = await v8Lookups(ws, user.role);
  const tasks = await prisma.task.findMany({ where: { workspace: ws, ...(assign ? {} : { OR: [{ assigneeId: user.userId }, { createdById: user.userId }] }) }, include: { assignee: true }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }] });
  const st = tasks.map(t => ({ t, state: V.taskState({ status: t.status, dueDate: dateToISO(t.dueDate) }, today) }));
  const open = st.filter(x => x.t.status === 'Open');

  // ── automatic reminders, computed from the records (nothing is sent anywhere in this build) ──
  const s = await loadState(ws);
  const rem: { when: string; what: string; owner: string; level: string }[] = computeAlerts(s).map(a => ({ when: 'Now', what: `${a.action} (${a.count})`, owner: a.assigned, level: 'Pending' }));
  if (can(user.role, 'contracts.view')) {
    for (const c of await prisma.contract.findMany({ where: { workspace: ws, expiryDate: { not: null }, archivedAt: null }, include: { client: true, domesticCase: true } })) {
      const band = V.expiryBand(dateToISO(c.expiryDate), today); if (band) rem.push({ when: dateToISO(c.expiryDate), what: `Contract ${c.code} (${c.client?.name ?? c.domesticCase?.customer}) — ${band.toLowerCase()}`, owner: 'Document controller', level: band });
    }
  }
  for (const c of await prisma.domesticCase.findMany({ where: { workspace: ws, handoverDate: { not: null } } })) {
    const w = V.warrantyWindow(dateToISO(c.handoverDate), today); if (w.state === 'Expiring soon') rem.push({ when: w.end, what: `Domestic guarantee for ${c.code} ${c.customer} ends in ${w.daysLeft} day(s)`, owner: 'Domestic case manager', level: 'Within 30 days' });
  }
  if (fin) {
    for (const f of await prisma.placementFee.findMany({ where: { workspace: ws }, include: { payments: true, placement: { include: { vacancy: { include: { client: true } } } } } })) {
      const x = V.placementFeeSummary({ feeAmount: Number(f.feeAmount), creditNote: Number(f.creditNote), joining: dateToISO(f.placement.joiningDate), dueMonths: f.dueMonths, invoiceDate: dateToISO(f.invoiceDate), paid: f.payments.reduce((a, p) => a + Number(p.amount), 0), today });
      if (/Overdue|overdue|Due today/.test(x.status)) rem.push({ when: x.due, what: `Placement fee ${f.placement.code} (${f.placement.vacancy.client.name}) is ${x.status.toLowerCase()} — QAR ${x.outstanding} outstanding`, owner: 'Management only', level: 'Overdue' });
    }
  }
  rem.sort((a, b) => a.when.localeCompare(b.when));
  return (
    <>
      <Heading title="Tasks & Alerts" desc="Staff tasks with owners and due dates, and reminders computed from the records" actions={<EntityForm entity="tasks" label="+ New Task" lookups={lookups} values={{ assignee_id: String(user.userId) }} />} />
      <Cards><Metric label="Open tasks" value={open.length} sub={assign ? 'All staff' : 'Yours'} /><Metric label="Overdue" value={st.filter(x => x.state === 'Overdue' || x.state === 'Escalate').length} sub="Past due date" />
        <Metric label="Needs escalation" value={st.filter(x => x.state === 'Escalate').length} sub={`${C.v8.taskEscalateAfterDays}+ days late`} /><Metric label="Due today" value={st.filter(x => x.state === 'Due today').length} sub="Today" /></Cards>
      <Panel title={assign ? 'All Tasks' : 'My Tasks'}>
        <Table head={['Task', 'Title', 'Type', 'Assigned to', 'Due', 'Priority', 'State', '']}
          rows={st.map(({ t, state }) => [t.code, <>{t.title}{t.linkedCode && <div className="muted">{t.linkedCode}</div>}</>, t.kind, t.assignee?.name ?? '—', dateToISO(t.dueDate) ? `${dateToISO(t.dueDate)}${t.status === 'Open' && state !== 'Upcoming' && state !== 'No due date' ? ` (${diffDays(dateToISO(t.dueDate), today)} d late)` : ''}` : '—', t.priority,
            <Badge key="s" text={state === 'Escalate' ? 'Overdue — escalate' : state} />,
            <div key="a" className="table-actions"><TaskToggle id={t.id} done={t.status === 'Done'} /><EntityForm entity="tasks" id={t.id} label="Edit" cls="secondary small" values={{ title: t.title, kind: t.kind, assignee_id: String(t.assigneeId ?? ''), due_date: dateToISO(t.dueDate), priority: t.priority, linked_code: t.linkedCode, detail: t.detail }} lookups={lookups} />{assign && <DeleteButton entity="tasks" id={t.id} what={t.code} />}</div>])}
          empty="No tasks yet." />
      </Panel>
      <Panel title="Reminders from the records"><Table head={['Date', 'Reminder', 'Owner role', 'Level']} rows={rem.map(r => [r.when, r.what, r.owner, <Badge key="b" text={r.level} />])} empty="Nothing needs attention." /></Panel>
      <Notice>Reminders are shown here and on the dashboard. <b>E-mail and WhatsApp sending is not connected</b> — that needs an approved provider, message templates and consent (see the remaining-requirements document). Staff can only see and complete their own tasks; the Managing Director and Admin Manager can assign and see all.</Notice>
    </>
  );
}

import { requireUser } from '@/lib/auth/dal';
import { v8Lookups } from '@/lib/repo/lookups-v8';
import { prisma } from '@/lib/db';
import * as V from '@/lib/domain/v8';
import { C, can } from '@/lib/config';
import { dateToISO, money, todayISO } from '@/lib/util';
import { Badge, Heading, Notice, Panel, Table } from '@/components/ui';
import EntityForm from '@/components/EntityForm';
import { DeleteButton } from '@/components/RowButtons';
import { RefundCalc, RefundDecision } from '@/components/V8Controls';

export default async function DomesticWarranty() {
  const { user, ws } = await requireUser();
  const fin = can(user.role, 'finance.view'), isMd = can(user.role, 'refund.approve'), today = todayISO(), rule = C.v8.refundRule;
  const lookups = await v8Lookups(ws, user.role);
  const cases = await prisma.domesticCase.findMany({ where: { workspace: ws, handoverDate: { not: null } }, orderBy: { handoverDate: 'asc' } });
  const claims = fin ? await prisma.refundClaim.findMany({ where: { workspace: ws }, include: { domesticCase: true }, orderBy: { code: 'desc' } }) : [];
  return (
    <>
      <Heading title="9-Month Guarantee & Refunds" desc="Guarantee window per sponsor case, and manual refund review — no automatic payout" actions={fin ? <EntityForm entity="refunds" label="+ Refund Claim" lookups={lookups} /> : undefined} />
      <Notice><b>Legal rule status: {rule.effective}.</b> The estimate below follows the rule as written in the client’s V8 package ({rule.source}, version {rule.version}): full fee less government fees in the first {rule.fullRefundMonths} months, then {rule.deductionPerMonth * 100}% of the fee per additional month up to month {rule.totalMonths}, plus government fees. Reviewer: {rule.reviewer}. <b>It must be verified with a local legal / compliance reviewer before it is relied on.</b> Eligibility, deductions and the refund itself are always decided manually.</Notice>
      <Panel title="Guarantee Windows">
        <Table head={['Case', 'Sponsor', 'Handover', 'Guarantee ends', 'Days left', 'State']}
          rows={cases.map(c => { const w = V.warrantyWindow(dateToISO(c.handoverDate), today); return [c.code, c.customer || '—', w.start, w.end, w.daysLeft ?? '—', <Badge key="s" text={w.state} />]; })}
          empty="No handover dates recorded yet — add a handover date on the sponsor case to start its nine-month window." />
      </Panel>
      {fin && (
        <>
          <Panel title="Refund Estimate (calculator)"><RefundCalc /></Panel>
          <Panel title="Refund Claims">
            <Table head={['Claim', 'Case', 'Reason', 'Months', 'Estimate', 'Status', 'Decision', '']}
              rows={claims.map(r => [r.code, `${r.domesticCase.code} · ${r.domesticCase.customer}`, r.reason, r.monthsServed, r.estimate == null ? 'Review required' : money(Number(r.estimate)), <Badge key="s" text={r.status} />,
                r.decidedAt ? `${dateToISO(r.decidedAt)} — ${r.decisionNote}` : '—',
                r.status === 'Pending review' ? <div key="a" className="table-actions">{isMd && <RefundDecision id={r.id} code={r.code} />}
                  <EntityForm entity="refunds" id={r.id} label="Edit" cls="secondary small" values={{ case_id: String(r.caseId), months_served: r.monthsServed, reason: r.reason, evidence: r.evidence, fee_paid: Number(r.feePaid), gov_fees: Number(r.govFees) }} lookups={lookups} /><DeleteButton entity="refunds" id={r.id} what={r.code} /></div> : '']) }
              empty="No refund claims." />
            {!isMd && <p className="muted">Only the Managing Director can approve or reject a refund claim.</p>}
          </Panel>
        </>
      )}
      {!fin && <Notice>Refund claims and fee amounts are visible to the Managing Director and Admin Manager only.</Notice>}
    </>
  );
}

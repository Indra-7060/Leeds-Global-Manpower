import { requireUser } from '@/lib/auth/dal';
import { Heading, Muted, Panel } from '@/components/ui';
import FeeCalculator from './fee-calculator';

export default async function CorporatePage() {
  await requireUser();
  return (
    <>
      <Heading title="Local Corporate Recruitment" desc="Planned division — not yet operational" />
      <Panel title="Launch Status">
        <span className="pill grey">Not Started</span>
        <p>Future workflow: client vacancy → Qatar-local candidate sourcing → shortlist → interview → offer → joining → negotiated placement fee.</p>
        <Muted>No vacancy or placement records are kept until the division starts and its data model is defined.</Muted>
      </Panel>
      <Panel title="Illustrative Client Fee Calculator"><FeeCalculator /></Panel>
    </>
  );
}

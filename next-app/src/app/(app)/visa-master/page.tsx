import { requireUser } from '@/lib/auth/dal';
import { loadState } from '@/lib/repo/state';
import { masterReport } from '@/lib/domain/metrics';
import { uniqSorted } from '@/lib/util';
import { Cards, Heading, Metric, Notice, Panel, Table } from '@/components/ui';
import DownloadButton from '@/components/DownloadButton';

const B = ({ v }: { v: number }) => <b>{v}</b>;

export default async function MasterReportPage({ searchParams }: { searchParams: Promise<{ country?: string; q?: string }> }) {
  const { ws } = await requireUser();
  const { country = 'All', q = '' } = await searchParams;
  const s = await loadState(ws);
  const m = masterReport(s, { country, query: q }), t = m.total;
  const countries = uniqSorted([...s.orders.map(o => o.country), ...s.candidates.map(c => c.country)]);
  const rem = (n: number) => (n < 0 ? <span className="pill red" title="More candidates than ordered quantity">{n}</span> : n);
  return (
    <>
      <Heading title="Master Recruitment Report" desc="All clients visa summary — company-wise status in one page, calculated from orders and candidate records" />
      <form className="panel" method="get" style={{ marginTop: 18 }}>
        <div className="row">
          <div><label htmlFor="vmCountry">Country</label><select id="vmCountry" name="country" className="input" style={{ width: 'auto' }} defaultValue={country}><option>All</option>{countries.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="vmQuery">Client</label><input id="vmQuery" name="q" className="input" style={{ width: 240 }} type="search" placeholder="Search company" defaultValue={q} /></div>
          <div style={{ alignSelf: 'flex-end' }} className="row"><button className="btn" type="submit">Apply</button>
            <DownloadButton url={`/api/export?report=${encodeURIComponent('Master Recruitment Report')}&country=${encodeURIComponent(country)}&client=${encodeURIComponent(q || 'All')}`} label="Export CSV for Excel" /></div>
        </div>
      </form>
      <Cards cols={3}><Metric label="Total Demand" value={t.demand} sub="Selected clients" /><Metric label="Visa Applied" value={t.applied} sub="Current stage" /><Metric label="QVC" value={t.qvc} sub="Current stage" />
        <Metric label="RTP" value={t.rtp} sub="Current stage" /><Metric label="Visa Printed" value={t.printed} sub="Current stage" /><Metric label="Deployed" value={t.deployed} sub="Arrived / joined / warranty" /></Cards>
      <Panel title="Company-wise Consolidated Status">
        <Table head={['Company', 'Country', 'Order', 'Applied', 'QVC', 'RTP', 'Printed', 'Deployed', 'Remaining']}
          rows={[...m.rows.map(r => [r.company, r.country, r.demand, r.applied, r.qvc, r.rtp, r.printed, r.deployed, rem(r.remaining)]),
            ...(m.rows.length ? [[<b key="t">TOTAL</b>, '', <B key="a" v={t.demand} />, <B key="b" v={t.applied} />, <B key="c" v={t.qvc} />, <B key="d" v={t.rtp} />, <B key="e" v={t.printed} />, <B key="f" v={t.deployed} />, <B key="g" v={t.remaining} />]] : [])]}
          empty="No orders or candidates match. Add orders/candidates or import them." />
      </Panel>
      <Notice>Calculated from live records. Demand = sum of order quantities for the client and country; each candidate is counted once, in their current stage; Remaining = Demand − (Applied + QVC + RTP + Printed + Deployed). Candidates earlier than Visa Applied therefore still count as Remaining.</Notice>
    </>
  );
}

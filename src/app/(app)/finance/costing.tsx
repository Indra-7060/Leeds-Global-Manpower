'use client';
import { useState } from 'react';
import { costing, costingDefaults } from '@/lib/domain/metrics';
import { money } from '@/lib/util';

/** V6 costing: revenue = qty × rev; cost = qty × (client charges + [investment if additional] + partner + other). */
export default function CostingCalculator() {
  const nep = costingDefaults('Nepal');
  const [v, setV] = useState({ country: 'Nepal', qty: '100', revenue: String(nep.revenue), client: String(nep.client), investment: String(nep.investment), treatment: 'extra', partner: '0', other: '0' });
  const set = (k: string, val: string) => setV(p => ({ ...p, [k]: val }));
  const setCountry = (c: string) => { const d = costingDefaults(c); setV(p => ({ ...p, country: c, revenue: String(d.revenue), client: String(d.client), investment: String(d.investment) })); };
  const r = costing({ qty: Number(v.qty), revenue: Number(v.revenue), client: Number(v.client), investment: Number(v.investment), investmentTreatment: v.treatment, partner: Number(v.partner), other: Number(v.other) });
  const num = (id: string, label: string, k: keyof typeof v) => <div><label htmlFor={id}>{label}</label><input className="input" id={id} type="number" min={0} value={v[k]} onChange={e => set(k, e.target.value)} /></div>;
  return (
    <>
      <p className="muted">Change assumptions to estimate projected costs. These figures are projections, not actual transactions.</p>
      <div className="formgrid">
        <div><label htmlFor="costCountry">Country</label><select className="input" id="costCountry" value={v.country} onChange={e => setCountry(e.target.value)}><option>Nepal</option><option>Bangladesh</option></select></div>
        {num('costQty', 'Candidate quantity', 'qty')}{num('costRevenue', 'Agency revenue per candidate (QAR)', 'revenue')}{num('costClient', 'Client QVC / visa charges per candidate (QAR)', 'client')}
        {num('costInvestment', 'Visa investment per candidate (QAR)', 'investment')}
        <div><label htmlFor="costIncluded">Investment treatment</label><select className="input" id="costIncluded" value={v.treatment} onChange={e => set('treatment', e.target.value)}><option value="extra">Additional expense</option><option value="included">Already included in client charges</option></select></div>
        {num('costPartner', 'Partner payment per candidate (QAR)', 'partner')}{num('costOther', 'Other expenses per candidate (QAR)', 'other')}
      </div>
      <div className="cards" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="card"><div className="muted">Projected Revenue</div><div className="num" id="costRevenueResult">{money(r.revenue)}</div><div className="muted">Not yet earned</div></div>
        <div className="card"><div className="muted">Projected Cost</div><div className="num" id="costExpenseResult">{money(r.cost)}</div><div className="muted">Avoids double-counting</div></div>
        <div className="card"><div className="muted">Projected Profit</div><div className="num" id="costProfitResult">{money(r.profit)}</div><div className="muted">Before other unentered costs</div></div>
      </div>
    </>
  );
}

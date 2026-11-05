'use client';
import { useState } from 'react';
import { money } from '@/lib/util';

/** V6 corporate fee calculator: fee = candidate's basic monthly salary × negotiated rate (100% or 50%). */
export default function FeeCalculator() {
  const [salary, setSalary] = useState('6000');
  const [rate, setRate] = useState('1');
  const s = Math.max(0, Number(salary) || 0);
  return (
    <>
      <div className="formgrid">
        <div><label htmlFor="salary">Candidate basic monthly salary (QAR)</label><input id="salary" className="input" type="number" min={0} value={salary} onChange={e => setSalary(e.target.value)} /></div>
        <div><label htmlFor="rate">Negotiated fee</label>
          <select id="rate" className="input" value={rate} onChange={e => setRate(e.target.value)}><option value="1">One month&apos;s basic (100%)</option><option value="0.5">Half month&apos;s basic (50%)</option></select></div>
      </div>
      <div className="divider" />
      <div className="muted">Sample client placement fee</div>
      <div className="metric" id="feeResult">{money(s * Number(rate))}</div>
      <p className="muted">Invoice milestone, payment terms and any warranty are negotiated separately with each client.</p>
    </>
  );
}

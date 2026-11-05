import { describe, expect, it } from 'vitest';
import { validateInput } from '@/lib/forms';

const base = { client: 'Demo Facilities Co.', country: 'nepal', trade: 'Welder' };

describe('server-side form validation', () => {
  it('orders: quantity must be a whole number >= 1', () => {
    for (const qty of ['abc', '2.5', '0', '-3', '']) {
      const r = validateInput('orders', { ...base, qty });
      expect(r.errors.qty, `qty "${qty}"`).toBeTruthy();
    }
    const ok = validateInput('orders', { ...base, qty: '25' });
    expect(ok.errors).toEqual({}); expect(ok.clean.qty).toBe(25);
  });
  it('a blank dropdown takes its default, but typed data is never invented', () => {
    const r = validateInput('orders', { ...base, qty: '5' });
    expect(r.clean.status).toBe('New Order');
    const blankQty = validateInput('orders', { client: 'X', country: 'Nepal', trade: 'T', qty: '' });
    expect(blankQty.errors.qty).toMatch(/required/); // V6's pre-filled 50 must NOT leak into data
    expect(validateInput('orders', { client: 'X', trade: 'T', qty: '3', country: '' }).errors.country).toMatch(/required/);
  });
  it('candidates: required fields, bad dates and bad stages are rejected; stage ignored when editing', () => {
    const e = validateInput('candidates', { name: '', client: '', country: '', trade: '' });
    expect(Object.keys(e.errors).sort()).toEqual(['client', 'country', 'name', 'trade']);
    expect(validateInput('candidates', { name: 'A', client: 'C', country: 'Nepal', trade: 'T', qvc_date: '31/02/2026' }).errors.qvc_date).toMatch(/valid date/);
    expect(validateInput('candidates', { name: 'A', client: 'C', country: 'Nepal', trade: 'T', status: 'Banana' }).errors.status).toMatch(/not an allowed/);
    const ed = validateInput('candidates', { name: 'A', client: 'C', country: 'Nepal', trade: 'T', status: 'Banana' }, { editing: true });
    expect(ed.errors.status).toBeUndefined(); expect('status' in ed.clean).toBe(false);
  });
  it('dates are normalised to ISO; stage names are canonicalised', () => {
    const r = validateInput('candidates', { name: 'A', client: 'C', country: 'Nepal', trade: 'T', qvc_date: '15/10/2026', status: 'qvc' });
    expect(r.errors).toEqual({}); expect(r.clean.qvc_date).toBe('2026-10-15'); expect(r.clean.status).toBe('QVC');
  });
  it('clients: name required, stage must be allowed, overlong text rejected', () => {
    expect(validateInput('clients', { name: '', stage: 'Active' }).errors.name).toBeTruthy();
    expect(validateInput('clients', { name: 'A', stage: 'Nope' }).errors.stage).toBeTruthy();
    expect(validateInput('clients', { name: 'x'.repeat(201), stage: 'Active' }).errors.name).toMatch(/too long/);
  });
});

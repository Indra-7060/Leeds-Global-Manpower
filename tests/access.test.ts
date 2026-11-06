import { describe, expect, it } from 'vitest';
import { MODULES, buildMatrix, ceiling, moduleForPath, modulesForEntity, resolve, rank } from '@/lib/access-config';

describe('level-wise access (pure rules)', () => {
  const mod = (id: string) => MODULES.find(m => m.id === id)!;
  it('the Managing Director is always full, whatever is stored', () => {
    expect(resolve('md', mod('finance'), 'none')).toBe('full');
    expect(Object.values(buildMatrix('md', { orders: 'none' })).every(l => l === 'full')).toBe(true);
  });
  it('standard levels: staff operate the pipeline but never see money or contracts; managers have everything', () => {
    const staff = buildMatrix('staff'), nitija = buildMatrix('nitija');
    expect(staff.orders).toBe('edit'); expect(staff.reports).toBe('view');
    for (const id of ['finance', 'domestic_payments', 'corporate_fees', 'service_fees', 'contracts']) expect(staff[id], id).toBe('none');
    expect(Object.values(nitija).every(l => l === 'full')).toBe(true);
  });
  it('a stored level can lower access but can never lift staff above the hard ceiling on money modules', () => {
    expect(resolve('staff', mod('orders'), 'view')).toBe('view');
    expect(resolve('staff', mod('finance'), 'full')).toBe('none');   // tampered / forced value is clamped
    expect(resolve('staff', mod('contracts'), 'edit')).toBe('none');
    expect(resolve('nitija', mod('finance'), 'view')).toBe('view');
    expect(ceiling('staff', mod('finance'))).toBe('none'); expect(ceiling('nitija', mod('finance'))).toBe('full');
  });
  it('unknown stored values fall back to the default', () => expect(resolve('staff', mod('orders'), 'banana' as never)).toBe('edit'));
  it('every screen resolves to the right module (longest path wins)', () => {
    expect(moduleForPath('/domestic')?.id).toBe('domestic');
    expect(moduleForPath('/domestic/warranty')?.id).toBe('domestic');
    expect(moduleForPath('/domestic/payments')?.id).toBe('domestic_payments');
    expect(moduleForPath('/corporate/fees')?.id).toBe('corporate_fees');
    expect(moduleForPath('/corporate/candidates')?.id).toBe('corporate');
    expect(moduleForPath('/visas')?.id).toBe('candidates');
    expect(moduleForPath('/visa-master')?.id).toBe('reports');
    expect(moduleForPath('/contracts/')?.id).toBe('contracts');
    for (const open of ['/', '/settings', '/automations']) expect(moduleForPath(open)).toBeNull();
  });
  it('every record type belongs to a module; clients are also editable from Corporate', () => {
    const all = ['clients', 'orders', 'candidates', 'visits', 'demands', 'allocations', 'interviews', 'tickets', 'warranties', 'domestic', 'finance', 'credentials', 'domAccount', 'domPayments', 'refunds', 'vacancies', 'placements', 'placementFees', 'placePayments', 'serviceTerms', 'serviceInvoices', 'servicePayments', 'fundAllocations', 'contracts', 'tasks', 'interviewEntries', 'agencyRecords'];
    for (const e of all) expect(modulesForEntity(e).length, e).toBeGreaterThan(0);
    expect(modulesForEntity('clients')).toContain('corporate');
  });
  it('levels are ordered none < view < edit < full', () => expect(['none', 'view', 'edit', 'full'].map(l => rank(l as never))).toEqual([0, 1, 2, 3]));
});

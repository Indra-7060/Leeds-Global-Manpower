import { afterEach, describe, expect, it } from 'vitest';
import { poolConfig } from '@/lib/db-config';

const set = (url: string) => { process.env.DATABASE_URL = url; return poolConfig(); };
afterEach(() => { delete process.env.DB_POOL; });

describe('database connection settings', () => {
  it('local XAMPP URL: no TLS, empty password', () => {
    const c = set('mysql://root:@localhost:3306/leeds_global_manpower');
    expect(c).toMatchObject({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'leeds_global_manpower' }); expect('ssl' in c).toBe(false);
  });
  it('hosted URL with sslaccept=strict turns TLS on and keeps certificate checks', () => {
    const c = set('mysql://abc.root:p%40ss@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/db?sslaccept=strict');
    expect(c).toMatchObject({ host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000, user: 'abc.root', password: 'p@ss', database: 'db' });
    expect((c as { ssl: { rejectUnauthorized: boolean } }).ssl.rejectUnauthorized).toBe(true);
  });
  it('ssl=true works too; accept_invalid_certs skips certificate checks', () => {
    expect('ssl' in set('mysql://u:p@h:3306/d?ssl=true')).toBe(true);
    expect((set('mysql://u:p@h:3306/d?sslaccept=accept_invalid_certs') as { ssl: { rejectUnauthorized: boolean } }).ssl.rejectUnauthorized).toBe(false);
  });
  it('uses generous connect timeouts for distant hosted databases', () => { const c = set('mysql://u:p@h:3306/d'); expect(c.connectTimeout).toBeGreaterThanOrEqual(10000); expect(c.acquireTimeout).toBeGreaterThan(c.connectTimeout); expect(c.minimumIdle).toBe(0); });
  it('pool size can be set', () => { process.env.DB_POOL = '7'; expect(set('mysql://u:p@h/d').connectionLimit).toBe(7); expect(poolConfig(3).connectionLimit).toBe(3); });
  it('refuses to run without DATABASE_URL', () => { delete process.env.DATABASE_URL; expect(() => poolConfig()).toThrow(/DATABASE_URL/); });
});

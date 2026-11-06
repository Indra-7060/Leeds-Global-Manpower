/**
 * Database connection settings parsed from DATABASE_URL (mysql://user:pass@host:port/database[?ssl=true]).
 * Shared by the app (src/lib/db.ts) and the command-line scripts (seed, set-password) so they all use TLS the same way.
 * No 'server-only' import on purpose: the scripts run outside Next.js.
 */
const wantsTls = (u: URL) => ['ssl', 'tls'].some(k => ['true', '1', 'required'].includes((u.searchParams.get(k) ?? '').toLowerCase())) || !!u.searchParams.get('sslaccept') || /require|verify/i.test(u.searchParams.get('sslmode') ?? '');

export function poolConfig(connectionLimit?: number) {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set the database name.');
  const u = new URL(raw);
  return {
    host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    // serverless hosts open many short-lived instances: keep each pool small (override with DB_POOL)
    connectionLimit: connectionLimit ?? (Number(process.env.DB_POOL) || (process.env.VERCEL ? 2 : 5)),
    // the driver default is 1 s to connect, which is too short for an encrypted connection to a distant hosted database (e.g. Vercel in the US -> TiDB in Singapore)
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 20000, acquireTimeout: 30000,
    minimumIdle: 0, // open connections on demand: idle connections of a frozen serverless instance die silently
    // hosted MySQL needs TLS: add ?ssl=true (or ?sslaccept=strict) to DATABASE_URL; ?sslaccept=accept_invalid_certs skips certificate checks
    ...(wantsTls(u) ? { ssl: { rejectUnauthorized: u.searchParams.get('sslaccept') !== 'accept_invalid_certs' }, allowPublicKeyRetrieval: true } : {}),
  };
}

'use client';

/** Shown when a page fails to load — most often because MySQL (XAMPP) is not running or DATABASE_URL is wrong. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login-wrap">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
        <p className="muted" style={{ marginTop: 0 }}>The page could not be loaded. The most common cause is that the database is not reachable.</p>
        <ul className="list-plain">
          <li>Open the XAMPP Control Panel and check that <b>MySQL</b> is running (green).</li>
          <li>Check <span className="mono">DATABASE_URL</span> in the <span className="mono">.env</span> file (user, password, database name).</li>
          <li>Run <span className="mono">npm run db:migrate</span> once if the tables have not been created yet.</li>
        </ul>
        {process.env.NODE_ENV !== 'production' && <pre className="mono" style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 10, borderRadius: 8 }}>{error.message}</pre>}
        {error.digest && <p className="muted">Reference: {error.digest}</p>}
        <button className="btn" type="button" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import LoginForm from './login-form';
import Icon from '@/components/icons';

export const metadata = { title: 'Sign in · Leads Global ERP' };

const POINTS: [string, string][] = [
  ['recruitment', 'One place for orders, candidates, visas and deployment'],
  ['money', 'Private finance visible only to management'],
  ['contracts', 'Encrypted contract library with every version kept'],
  ['tasks', 'Tasks, reminders and approvals with a full audit trail'],
];

export default async function LoginPage() {
  if (await readSession()) redirect('/'); // already signed in
  return (
    <div className="login-split">
      <section className="login-art">
        <div className="brand" style={{ color: '#fff', margin: 0, padding: 0 }}>
          <div className="logo" style={{ background: 'rgba(255,255,255,.16)', boxShadow: 'none' }}><Icon name="agencies" size={22} /></div>
          <div><strong style={{ color: '#fff' }}>LEADS GLOBAL</strong><small style={{ color: 'rgba(255,255,255,.7)' }}>MANPOWER · QATAR</small></div>
        </div>
        <div>
          <h2>Recruitment operations, from order to arrival.</h2>
          <p>Blue-collar, domestic and corporate recruitment on one secure platform.</p>
          <ul>{POINTS.map(([ic, text]) => <li key={text}><span><Icon name={ic} size={16} /></span>{text}</li>)}</ul>
        </div>
        <small style={{ color: 'rgba(255,255,255,.6)', position: 'relative', zIndex: 1 }}>Recruitment Operations Platform</small>
      </section>
      <main className="login-wrap">
        <div className="login-card">
          <div className="eyebrow">Welcome back</div>
          <h1 style={{ fontSize: 26, margin: '6px 0 6px', letterSpacing: '-.02em' }}>Sign in</h1>
          <p className="muted" style={{ marginTop: 0 }}>Use the account created for you by the Managing Director.</p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}

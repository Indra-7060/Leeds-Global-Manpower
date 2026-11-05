import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import LoginForm from './login-form';

export const metadata = { title: 'Sign in · Leads Global ERP' };

export default async function LoginPage() {
  if (await readSession()) redirect('/'); // already signed in
  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ color: '#102b48', marginBottom: 18 }}>
          <div className="logo" style={{ background: '#102b48', color: '#fff' }}>◎</div>
          <div><strong>LEADS GLOBAL</strong><small style={{ color: '#63809b' }}>MANPOWER · ERP</small></div>
        </div>
        <h1 style={{ fontSize: 22, margin: '0 0 6px' }}>Sign in</h1>
        <p className="muted" style={{ marginTop: 0 }}>Use the account created for you by the Managing Director.</p>
        <LoginForm />
      </div>
    </main>
  );
}

'use client';
import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} noValidate>
      {state.error && <div className="notice" style={{ background: '#feeaea', color: '#8f2a2a', borderColor: '#f0c4c4', marginTop: 0 }} role="alert">{state.error}</div>}
      <div className="field" style={{ margin: '14px 0' }}>
        <label htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field" style={{ margin: '14px 0' }}>
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

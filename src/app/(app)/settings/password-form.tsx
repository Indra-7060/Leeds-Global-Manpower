'use client';
import { useActionState, useEffect, useRef } from 'react';
import { changePasswordAction, type FormState } from '@/app/actions';
import { useToast } from '@/components/Toaster';

export default function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  const toast = useToast(); const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { toast('Password changed', 'ok'); ref.current?.reset(); } }, [state, toast]);
  const f = (name: string, label: string) => (
    <div className={`field ${state.errors?.[name] ? 'err' : ''}`}><label htmlFor={`pw_${name}`}>{label}</label><input className="input" id={`pw_${name}`} name={name} type="password" autoComplete={name === 'current' ? 'current-password' : 'new-password'} />{state.errors?.[name] && <div className="errmsg">{state.errors[name]}</div>}</div>
  );
  return (
    <form ref={ref} action={action} noValidate style={{ maxWidth: 420 }}>
      {state.errors?._ && <div className="notice" role="alert">{state.errors._}</div>}
      {f('current', 'Current password')}{f('next', 'New password (at least 10 characters)')}{f('again', 'Repeat new password')}
      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 10 }}>{pending ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

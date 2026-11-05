'use client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { createUserAction, resetUserPasswordAction, setUserActiveAction, type FormState } from '@/app/actions';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toaster';

interface U { id: number; email: string; name: string; role: string; active: boolean }

function ResetPassword({ u }: { u: U }) {
  const [open, setOpen] = useState(false); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [pending, start] = useTransition(); const toast = useToast();
  const run = () => start(async () => { const r = await resetUserPasswordAction(u.id, pw); if (!r.ok) { setErr(r.errors?.password ?? r.errors?._ ?? 'Failed'); return; } setOpen(false); setPw(''); setErr(''); toast(`Password reset for ${u.email}`, 'ok'); });
  return (
    <>
      <button className="btn secondary small" type="button" onClick={() => setOpen(true)}>Reset password</button>
      {open && (
        <Modal title={`Reset password — ${u.email}`} narrow onClose={() => setOpen(false)} footer={<><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn" type="button" onClick={run} disabled={pending}>Set password</button></>}>
          <label htmlFor={`rp_${u.id}`}>New password (at least 10 characters)</label><input id={`rp_${u.id}`} className="input" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
          {err && <div className="errmsg" style={{ color: '#b34141', fontSize: 12, marginTop: 6 }}>{err}</div>}
        </Modal>)}
    </>
  );
}

function ToggleActive({ u, me }: { u: U; me: boolean }) {
  const [pending, start] = useTransition(); const toast = useToast();
  return <button className={`btn small ${u.active ? 'danger' : 'secondary'}`} type="button" disabled={pending || me} title={me ? 'You cannot disable your own account' : ''}
    onClick={() => start(async () => { const r = await setUserActiveAction(u.id, !u.active); toast(r.ok ? (u.active ? 'User disabled' : 'User enabled') : (r.errors?._ ?? 'Failed'), r.ok ? 'ok' : 'err'); })}>{u.active ? 'Disable' : 'Enable'}</button>;
}

export default function UsersAdmin({ users, meId, roles }: { users: U[]; meId: number; roles: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUserAction, {});
  const toast = useToast(); const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { toast('User created', 'ok'); ref.current?.reset(); } }, [state, toast]);
  const e = (k: string) => state.errors?.[k];
  const keep = state.values ?? {};
  return (
    <>
      <div className="scroll-x"><table><thead><tr><th>Name</th><th>E-mail</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>
        {users.map(u => (<tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{roles.find(r => r.id === u.role)?.label ?? u.role}</td><td><span className={`pill ${u.active ? 'green' : 'grey'}`}>{u.active ? 'Active' : 'Disabled'}</span></td>
          <td><div className="table-actions"><ResetPassword u={u} /><ToggleActive u={u} me={u.id === meId} /></div></td></tr>))}</tbody></table></div>
      <div className="divider" /><b style={{ fontSize: 13 }}>Add a user</b>
      <form ref={ref} action={action} noValidate style={{ marginTop: 10 }}>
        {state.errors?._ && <div className="notice" role="alert">{state.errors._}</div>}
        <div className="formgrid" key={state.nonce ?? 0}>
          <div className={`field ${e('name') ? 'err' : ''}`}><label htmlFor="nu_name">Name</label><input className="input" id="nu_name" name="name" defaultValue={keep.name ?? ''} />{e('name') && <div className="errmsg">{e('name')}</div>}</div>
          <div className={`field ${e('email') ? 'err' : ''}`}><label htmlFor="nu_email">E-mail</label><input className="input" id="nu_email" name="email" type="email" defaultValue={keep.email ?? ''} />{e('email') && <div className="errmsg">{e('email')}</div>}</div>
          <div className={`field ${e('role') ? 'err' : ''}`}><label htmlFor="nu_role">Role</label><select className="input" id="nu_role" name="role" defaultValue={keep.role ?? 'staff'}>{roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select>{e('role') && <div className="errmsg">{e('role')}</div>}</div>
          <div className={`field ${e('password') ? 'err' : ''}`}><label htmlFor="nu_password">Temporary password (10+ characters)</label><input className="input" id="nu_password" name="password" type="password" autoComplete="new-password" />{e('password') && <div className="errmsg">{e('password')}</div>}</div>
        </div>
        <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }}>{pending ? 'Creating…' : 'Create user'}</button>
      </form>
    </>
  );
}

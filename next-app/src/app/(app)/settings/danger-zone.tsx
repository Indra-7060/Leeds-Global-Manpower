'use client';
import { useState, useTransition } from 'react';
import { clearWorkspaceAction, resetDemoAction } from '@/app/actions';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toaster';

export default function DangerZone({ ws, canReset }: { ws: 'demo' | 'live'; canReset: boolean }) {
  const [open, setOpen] = useState<'reset' | 'clear' | null>(null); const [typed, setTyped] = useState(''); const [err, setErr] = useState('');
  const [pending, start] = useTransition(); const toast = useToast();
  if (!canReset) return <p className="muted">Reset and clear are limited to the Managing Director or Admin Manager.</p>;
  const close = () => { setOpen(null); setTyped(''); setErr(''); };
  const reset = () => start(async () => { const r = await resetDemoAction(); close(); toast(r.ok ? 'Demo data reset to the original sample' : (r.errors?._ ?? 'Failed'), r.ok ? 'ok' : 'err'); });
  const clear = () => start(async () => { const r = await clearWorkspaceAction(typed); if (!r.ok) { setErr(r.errors?._ ?? 'Failed'); return; } close(); toast(`${ws.toUpperCase()} workspace cleared`, 'ok'); });
  return (
    <>
      <div className="row">
        {ws === 'demo' && <button className="btn secondary" type="button" onClick={() => setOpen('reset')}>Reset demo data to original sample</button>}
        <button className="btn danger" type="button" onClick={() => setOpen('clear')}>Clear this workspace…</button>
      </div>
      {open === 'reset' && (
        <Modal title="Reset demo data?" narrow onClose={close} footer={<><button className="btn secondary" type="button" onClick={close}>Cancel</button><button className="btn danger" type="button" onClick={reset} disabled={pending}>Reset</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>Your changes to the DEMO workspace are discarded and the original fictional sample is restored. The LIVE workspace is not touched.</p>
        </Modal>)}
      {open === 'clear' && (
        <Modal title="Clear this workspace" narrow onClose={close} footer={<><button className="btn secondary" type="button" onClick={close}>Cancel</button><button className="btn danger" type="button" onClick={clear} disabled={pending}>Delete everything</button></>}>
          <p style={{ marginTop: 0 }}>This permanently deletes <b>every record</b> in the {ws.toUpperCase()} workspace (users are kept). Export or back up first if you may need it.</p>
          <label htmlFor="clearTyped">Type DELETE to confirm</label><input id="clearTyped" className="input" autoComplete="off" value={typed} onChange={e => setTyped(e.target.value)} />
          {err && <div className="errmsg" style={{ color: '#b34141', fontSize: 12, marginTop: 6 }}>{err}</div>}
        </Modal>)}
    </>
  );
}

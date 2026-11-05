'use client';
import { useState, useTransition } from 'react';
import { switchWorkspace } from '@/app/actions';
import type { Workspace } from '@/lib/config';
import Modal from './Modal';
import { useToast } from './Toaster';

/** The DEMO / LIVE pill in the header. Managing Director / Admin Manager can switch; everyone else just sees it. */
export default function WorkspaceSwitch({ ws, canSwitch }: { ws: Workspace; canSwitch: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const target: Workspace = ws === 'demo' ? 'live' : 'demo';
  const run = () => start(async () => { const r = await switchWorkspace(target); setOpen(false); toast(r.message ?? 'Done', 'ok'); });
  return (
    <>
      <button type="button" className={`mode-pill ${ws === 'demo' ? 'mode-demo' : 'mode-live'}`} onClick={() => canSwitch && setOpen(true)} style={{ cursor: canSwitch ? 'pointer' : 'default' }}
        title={canSwitch ? 'Switch workspace' : 'Current workspace'}>{ws === 'demo' ? 'DEMO DATA' : 'LIVE DATA'}</button>
      {open && (
        <Modal title={`Switch to ${target.toUpperCase()} workspace?`} narrow onClose={() => setOpen(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn" type="button" onClick={run} disabled={pending}>Switch</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{target === 'live'
            ? 'The LIVE workspace holds real business records and is completely separate from the demo data.'
            : 'You will see the fictional demo data. Your LIVE records are kept untouched.'}</p>
        </Modal>
      )}
    </>
  );
}

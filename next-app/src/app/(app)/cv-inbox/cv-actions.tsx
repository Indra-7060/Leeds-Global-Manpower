'use client';
import { useState, useTransition } from 'react';
import { deleteCvAction, setCvStatusAction } from '@/app/actions';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toaster';

export function CvStatus({ id, status, label }: { id: number; status: string; label: string }) {
  const [pending, start] = useTransition(); const toast = useToast();
  return <button className="btn secondary small" type="button" disabled={pending} onClick={() => start(async () => { const r = await setCvStatusAction(id, status); toast(r.ok ? `Marked ${status}` : (r.errors?._ ?? 'Failed'), r.ok ? 'ok' : 'err'); })}>{label}</button>;
}

export function CvDelete({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const toast = useToast();
  return (
    <>
      <button className="btn danger small" type="button" onClick={() => setOpen(true)}>Delete</button>
      {open && (
        <Modal title="Delete intake record?" narrow onClose={() => setOpen(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn danger" type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteCvAction(id); setOpen(false); toast(r.ok ? 'Deleted' : (r.errors?._ ?? 'Failed'), r.ok ? 'ok' : 'err'); })}>Delete</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>Only the log entry for {name} is removed (the file itself was never stored).</p>
        </Modal>
      )}
    </>
  );
}

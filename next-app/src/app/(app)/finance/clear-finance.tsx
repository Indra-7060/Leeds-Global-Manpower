'use client';
import { useState, useTransition } from 'react';
import { clearFinanceAction } from '@/app/actions';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toaster';

export default function ClearFinanceButton({ count, demo }: { count: number; demo: boolean }) {
  const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const toast = useToast();
  const run = () => start(async () => { const r = await clearFinanceAction(); setOpen(false); toast(r.ok ? 'Finance entries cleared' : (r.errors?._ ?? 'Could not clear'), r.ok ? 'ok' : 'err'); });
  return (
    <>
      <button className="btn danger" type="button" onClick={() => setOpen(true)} disabled={!count}>{demo ? 'Reset Demo Entries…' : 'Clear all entries…'}</button>
      {open && (
        <Modal title="Clear ALL finance entries?" narrow onClose={() => setOpen(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn danger" type="button" onClick={run} disabled={pending}>Delete all {count}</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>All {count} finance entries (every division) in this workspace will be permanently deleted. Export a CSV first if you need them.</p>
        </Modal>
      )}
    </>
  );
}

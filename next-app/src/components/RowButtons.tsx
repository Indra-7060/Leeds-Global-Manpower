'use client';
import { useState, useTransition } from 'react';
import { advanceStep, deleteEntity, moveStage, undoStage, type Entity, type FormState } from '@/app/actions';
import Modal from './Modal';
import { useToast } from './Toaster';

/** Delete with an in-app confirmation. */
export function DeleteButton({ entity, id, what }: { entity: Entity; id: number; what: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = () => start(async () => {
    const r: FormState = await deleteEntity(entity, id);
    setOpen(false); toast(r.ok ? 'Deleted' : (r.errors?._ ?? 'Could not delete'), r.ok ? 'ok' : 'err');
  });
  return (
    <>
      <button className="btn danger small" type="button" onClick={() => setOpen(true)}>Delete</button>
      {open && (
        <Modal title="Delete record?" narrow onClose={() => setOpen(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn danger" type="button" onClick={run} disabled={pending}>{pending ? 'Deleting…' : 'Delete'}</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{what} will be permanently removed from this workspace.</p>
        </Modal>
      )}
    </>
  );
}

/** Stage buttons for one candidate: Next / Skip optional / Reject / Undo. Rules are re-checked on the server. */
export function StageButton({ id, to, kind, label, name }: { id: number; to: string; kind: 'next' | 'skip' | 'reject'; label: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = () => start(async () => { const r = await moveStage(id, to); setConfirm(false); toast(r.ok ? `${name} → ${to}` : (r.errors?._ ?? 'Not allowed'), r.ok ? 'ok' : 'err'); });
  const text = kind === 'next' ? 'Next Stage →' : kind === 'skip' ? `Skip → ${to}` : 'Reject';
  const cls = kind === 'reject' ? 'danger small' : kind === 'next' ? 'small' : 'secondary small';
  return (
    <>
      <button className={`btn ${cls}`} type="button" title={label} disabled={pending} onClick={() => (kind === 'reject' ? setConfirm(true) : run())}>{text}</button>
      {confirm && (
        <Modal title="Reject candidate?" narrow onClose={() => setConfirm(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setConfirm(false)}>Cancel</button><button className="btn danger" type="button" onClick={run} disabled={pending}>Reject</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{name} will be marked Rejected. The Managing Director or Admin Manager can undo this.</p>
        </Modal>
      )}
    </>
  );
}

export function UndoButton({ id, name, prev }: { id: number; name: string; prev: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = () => start(async () => { const r = await undoStage(id); setOpen(false); toast(r.ok ? `${name} returned to ${prev}` : (r.errors?._ ?? 'Could not undo'), r.ok ? 'ok' : 'err'); });
  return (
    <>
      <button className="btn ghost small" type="button" onClick={() => setOpen(true)} title="Return to the previous stage (logged)">Undo</button>
      {open && (
        <Modal title="Return to previous stage?" narrow onClose={() => setOpen(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn" type="button" onClick={run} disabled={pending}>Return to {prev}</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{name} goes back to {prev}. The correction is recorded in the activity log.</p>
        </Modal>
      )}
    </>
  );
}

/** "Next →" for travel records, warranty cases and domestic cases. */
export function AdvanceButton({ entity, id, next }: { entity: 'tickets' | 'warranties' | 'domestic'; id: number; next: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = () => start(async () => { const r = await advanceStep(entity, id); toast(r.ok ? `Moved to ${next}` : (r.errors?._ ?? 'Could not move'), r.ok ? 'ok' : 'err'); });
  return <button className="btn small" type="button" title={next} disabled={pending} onClick={run}>Next →</button>;
}

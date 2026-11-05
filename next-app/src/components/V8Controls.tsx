'use client';
import { useRef, useState, useTransition } from 'react';
import { decideAllocationAction, decideRefundAction, setTaskStatusAction } from '@/app/actions';
import { refundEstimate } from '@/lib/domain/v8';
import { C } from '@/lib/config';
import { money } from '@/lib/util';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { useToast } from './Toaster';

/** Approve / Reject a refund claim (Managing Director only — re-checked on the server). Deciding never pays anything. */
export function RefundDecision({ id, code }: { id: number; code: string }) {
  const [open, setOpen] = useState<'Approved' | 'Rejected' | null>(null);
  const [note, setNote] = useState(''); const [pending, start] = useTransition(); const toast = useToast();
  const run = () => start(async () => { const r = await decideRefundAction(id, open!, note); toast(r.ok ? (r.message ?? 'Done') : (r.errors?._ ?? 'Not allowed'), r.ok ? 'ok' : 'err'); if (r.ok) setOpen(null); });
  return (
    <>
      <button className="btn small" type="button" onClick={() => setOpen('Approved')}>Approve</button>
      <button className="btn danger small" type="button" onClick={() => setOpen('Rejected')}>Reject</button>
      {open && (
        <Modal title={`${open === 'Approved' ? 'Approve' : 'Reject'} refund claim ${code}`} narrow onClose={() => setOpen(null)}
          footer={<><button className="btn secondary" type="button" onClick={() => setOpen(null)}>Cancel</button><button className="btn" type="button" onClick={run} disabled={pending || !note.trim()}>{pending ? 'Saving…' : open}</button></>}>
          <p style={{ marginTop: 0, fontSize: 13 }}>This records your decision only. <b>No money is paid automatically</b> — record any actual refund payment separately as “Refund paid”.</p>
          <label htmlFor="rf_note" style={{ display: 'block', fontWeight: 600, fontSize: 12 }}>Decision note (required)</label>
          <textarea id="rf_note" className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} />
        </Modal>
      )}
    </>
  );
}

export function AllocationDecision({ id }: { id: number }) {
  const [pending, start] = useTransition(); const toast = useToast();
  const run = (d: 'Approved' | 'Rejected') => start(async () => { const r = await decideAllocationAction(id, d); toast(r.ok ? (r.message ?? 'Done') : (r.errors?._ ?? 'Not allowed'), r.ok ? 'ok' : 'err'); });
  return <><button className="btn small" type="button" disabled={pending} onClick={() => run('Approved')}>Approve</button><button className="btn danger small" type="button" disabled={pending} onClick={() => run('Rejected')}>Reject</button></>;
}

export function TaskToggle({ id, done }: { id: number; done: boolean }) {
  const [pending, start] = useTransition(); const toast = useToast();
  const run = () => start(async () => { const r = await setTaskStatusAction(id, done ? 'Open' : 'Done'); toast(r.ok ? (r.message ?? 'Done') : (r.errors?._ ?? 'Not allowed'), r.ok ? 'ok' : 'err'); });
  return <button className={`btn small ${done ? 'secondary' : ''}`} type="button" disabled={pending} onClick={run}>{done ? 'Reopen' : 'Mark done'}</button>;
}

/** Upload a NEW version of a contract. The file is sent to /api/contracts/upload (type, size and content are re-checked there). */
export function ContractUpload({ contractId, code }: { contractId: number; code: string }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null); const noteRef = useRef<HTMLInputElement>(null); const toast = useToast(); const router = useRouter();
  const send = async () => {
    const f = fileRef.current?.files?.[0]; if (!f) { setErr('Choose a file.'); return; }
    setBusy(true); setErr('');
    const fd = new FormData(); fd.set('contractId', String(contractId)); fd.set('file', f); fd.set('note', noteRef.current?.value ?? '');
    try {
      const res = await fetch('/api/contracts/upload', { method: 'POST', body: fd }); const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.error ?? 'Upload failed.'); } else { toast(`Saved ${j.version}`, 'ok'); setOpen(false); router.refresh(); }
    } catch { setErr('Upload failed — check your connection.'); }
    setBusy(false);
  };
  return (
    <>
      <button className="btn secondary small" type="button" onClick={() => { setOpen(true); setErr(''); }}>Upload file</button>
      {open && (
        <Modal title={`Upload a file to ${code}`} narrow onClose={() => setOpen(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn" type="button" onClick={send} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button></>}>
          <p style={{ marginTop: 0, fontSize: 13 }}>Each upload becomes a <b>new version</b>; earlier files are kept and can always be downloaded. Allowed: {C.v8.uploadExtensions.join(', ')} (max {C.v8.uploadMaxMB} MB). Files are stored encrypted.</p>
          {err && <div className="notice" role="alert" style={{ background: '#feeaea', color: '#8f2a2a', borderColor: '#f0c4c4' }}>{err}</div>}
          <div className="field"><label htmlFor="ct_file">File</label><input id="ct_file" ref={fileRef} className="input" type="file" accept={C.v8.uploadExtensions.map(e => '.' + e).join(',')} /></div>
          <div className="field"><label htmlFor="ct_note">Version note (optional)</label><input id="ct_note" ref={noteRef} className="input" type="text" maxLength={300} placeholder="e.g. signed copy / amendment 1" /></div>
        </Modal>
      )}
    </>
  );
}

/** Quick refund estimate before opening a claim. Pure calculation — the same function the server uses. */
export function RefundCalc() {
  const [v, setV] = useState({ fee: '12000', gov: '500', months: '2', reason: C.v8.refundReasons[1] });
  const r = refundEstimate({ fee: Number(v.fee), govFees: Number(v.gov), monthsServed: Number(v.months), reason: v.reason });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV(p => ({ ...p, [k]: e.target.value }));
  return (
    <div>
      <div className="formgrid">
        <div className="field"><label htmlFor="rc_fee">Recruitment fee paid (QAR)</label><input id="rc_fee" className="input" type="number" min={0} value={v.fee} onChange={set('fee')} /></div>
        <div className="field"><label htmlFor="rc_gov">Applicable government fees (QAR)</label><input id="rc_gov" className="input" type="number" min={0} value={v.gov} onChange={set('gov')} /></div>
        <div className="field"><label htmlFor="rc_m">Completed months of service (0–{C.v8.refundRule.totalMonths})</label><input id="rc_m" className="input" type="number" min={0} max={C.v8.refundRule.totalMonths} value={v.months} onChange={set('months')} /></div>
        <div className="field"><label htmlFor="rc_r">Reason</label><select id="rc_r" className="input" value={v.reason} onChange={set('reason')}>{C.v8.refundReasons.map(x => <option key={x}>{x}</option>)}</select></div>
      </div>
      <div className="divider" />
      <div className="muted">{r.stage}</div>
      <div className="metric">{r.estimate == null ? 'Review required' : money(r.estimate)}</div>
      <p className="muted">{r.note}</p>
    </div>
  );
}

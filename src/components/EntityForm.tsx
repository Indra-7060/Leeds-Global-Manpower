'use client';
import { useActionState, useCallback, useEffect, useId, useState } from 'react';
import { saveEntity, type Entity, type FormState } from '@/app/actions';
import { specs, defaultsFor, type Field } from '@/lib/forms';
import Modal from './Modal';
import { useToast } from './Toaster';

export interface LookupOption { value: string; label: string }
export type Lookups = Record<string, LookupOption[]>;

function FieldInput({ f, value, lookups, error, scope }: { f: Field; value: unknown; lookups: Lookups; error?: string; scope: string }) {
  const id = `${scope}_${f.key}`, v = value == null ? '' : String(value);
  let input;
  if (f.type === 'select') {
    input = <select className="input" id={id} name={f.key} defaultValue={v}>{!f.required && <option value="">—</option>}{f.options!.map(o => <option key={o} value={o}>{f.labels?.[o] ?? o}</option>)}</select>;
  } else if (f.type === 'lookup') {
    input = <select className="input" id={id} name={f.key} defaultValue={v}><option value="">{f.required ? '— select —' : '— none —'}</option>{(lookups[f.lookup!] ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
  } else if (f.type === 'textarea') {
    input = <textarea className="input" id={id} name={f.key} rows={3} defaultValue={v} />;
  } else {
    const type = f.type === 'int' || f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
    const list = f.suggest ? `${id}_dl` : undefined;
    input = (
      <>
        <input className="input" id={id} name={f.key} type={type} defaultValue={v} list={list} placeholder={f.placeholder} autoComplete="off"
          {...(f.type === 'int' ? { step: 1, min: f.min } : f.type === 'number' ? { step: 0.01, min: f.min } : {})} />
        {list && <datalist id={list}>{(lookups[f.suggest!] ?? []).map(o => <option key={o.value} value={o.value} />)}</datalist>}
      </>
    );
  }
  return (
    <div className={`field ${f.full ? 'full' : ''} ${error ? 'err' : ''}`}>
      <label htmlFor={id}>{f.label}{f.required && <span className="req"> *</span>}</label>
      {input}
      {f.help && <div className="help">{f.help}</div>}
      {error && <div className="errmsg">{error}</div>}
    </div>
  );
}

function FormModal({ entity, id, values, lookups, title, hidden, onClose }: { entity: Entity; id?: number; values?: Record<string, unknown>; lookups: Lookups; title?: string; hidden?: Record<string, string>; onClose: () => void }) {
  const scope = useId().replace(/:/g, '');
  const spec = specs[entity];
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntity.bind(null, entity, id ?? null), {});
  const base = id ? (values ?? {}) : { ...defaultsFor(entity), ...(values ?? {}) };
  const init = state.values ?? base; // after a failed save, keep what the user typed
  const toast = useToast();
  useEffect(() => { if (state.ok) { toast(state.message ?? 'Saved', 'ok'); onClose(); } }, [state, onClose, toast]);
  const fields = spec.fields.filter(f => !(id && f.createOnly));
  return (
    <Modal title={title ?? `${id ? 'Edit' : 'Add'} ${spec.label.toLowerCase()}`} onClose={onClose}
      footer={<><button className="btn secondary" type="button" onClick={onClose}>Cancel</button><button className="btn" type="submit" form={`${scope}_form`} disabled={pending}>{pending ? 'Saving…' : id ? 'Save changes' : 'Save'}</button></>}>
      <form id={`${scope}_form`} action={action} noValidate>
        {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {state.errors?._ && <div className="notice" role="alert" style={{ background: '#feeaea', color: '#8f2a2a', borderColor: '#f0c4c4', marginTop: 0 }}>{state.errors._}</div>}
        <div className="formgrid" key={state.nonce ?? 0}>{fields.map(f => <FieldInput key={f.key} f={f} value={init[f.key]} lookups={lookups} error={state.errors?.[f.key]} scope={scope} />)}</div>
      </form>
    </Modal>
  );
}

/** Button that opens an add/edit dialog for one record type. Validation happens on the server (saveEntity). */
export default function EntityForm({ entity, id, values, lookups, label, cls = '', title, hidden }: {
  entity: Entity; id?: number; values?: Record<string, unknown>; lookups: Lookups; label: string; cls?: string; title?: string; hidden?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button className={`btn ${cls}`} type="button" onClick={() => setOpen(true)}>{label}</button>
      {open && <FormModal entity={entity} id={id} values={values} lookups={lookups} title={title} hidden={hidden} onClose={close} />}
    </>
  );
}

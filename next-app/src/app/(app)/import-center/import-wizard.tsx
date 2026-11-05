'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Modal from '@/components/Modal';
import { downloadFrom } from '@/components/download';
import { useToast } from '@/components/Toaster';

type Target = 'candidates' | 'orders' | 'finance';
interface Parsed { fileName: string; columns: string[]; preview: string[][]; rowCount: number; sheetNames: string[]; sheetIndex: number; truncated: boolean; mapping: Record<string, string>; fields: string[]; required: string[] }
interface Analysis { total: number; valid: number; duplicates: number; invalid: number; newClients: string[]; warnings: number; problems: { row: number; kind: string; reason: string }[] }
const LABEL: Record<Target, string> = { candidates: 'Candidates / Visa Status', orders: 'Manpower Orders', finance: 'Private Finance' };
const nice = (f: string) => f.replace(/_/g, ' ');

export default function ImportWizard({ canFinance }: { canFinance: boolean }) {
  const router = useRouter(); const toast = useToast();
  const [file, setFile] = useState<File | null>(null); const [target, setTarget] = useState<Target>('candidates');
  const [parsed, setParsed] = useState<Parsed | null>(null); const [mapping, setMapping] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<Analysis | null>(null); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);

  const body = (f: File, mode: string, t: Target, sheet: number, map: Record<string, string>) => {
    const fd = new FormData(); fd.append('file', f); fd.append('mode', mode); fd.append('target', t); fd.append('sheet', String(sheet)); fd.append('mapping', JSON.stringify(map)); return fd;
  };
  async function call(f: File, mode: string, t: Target, sheet: number, map: Record<string, string>) {
    const res = await fetch('/api/import', { method: 'POST', body: body(f, mode, t, sheet, map) }); const j = await res.json().catch(() => ({ error: 'Unexpected response.' }));
    if (!res.ok) throw new Error(j.error ?? 'Request failed.'); return j;
  }
  async function parse(f: File, t: Target, sheet = 0) {
    setBusy(true); setAnalysis(null);
    try {
      const j: Parsed = await call(f, 'parse', t, sheet, {});
      setParsed(j); setMapping(j.mapping);
      setMessage(`Loaded ${j.rowCount} rows from ${j.fileName}${j.truncated ? ' (only the first 20,000 rows are read)' : ''}. Check the column mapping, then validate.`);
    } catch (e) { setParsed(null); setMessage(''); toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  const missing = parsed ? parsed.required.filter(f => mapping[f] === '' || mapping[f] == null) : [];

  async function validate() {
    if (!file || !parsed) return;
    if (missing.length) { toast('Map the required columns first: ' + missing.map(nice).join(', '), 'err'); return; }
    setBusy(true);
    try { setAnalysis(await call(file, 'analyse', target, parsed.sheetIndex, mapping)); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function commit() {
    if (!file || !parsed) return;
    setBusy(true);
    try {
      const r = await call(file, 'commit', target, parsed.sheetIndex, mapping);
      const m = `Imported ${r.added} record(s); skipped ${r.duplicates} duplicate(s) and ${r.invalid} rejected row(s)${r.newClients ? `; added ${r.newClients} new client(s) as Prospect` : ''}.`;
      setMessage(m); toast(m, 'ok'); setAnalysis(null); setConfirm(false); router.refresh();
    } catch (e) { toast((e as Error).message, 'err'); setConfirm(false); } finally { setBusy(false); }
  }

  return (
    <>
      <section className="panel"><h3>Step 1 — Select the Excel file</h3>
        <input className="input" style={{ maxWidth: 420 }} type="file" accept=".xlsx,.csv,.tsv,.txt" aria-label="Choose file"
          onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) parse(f, target); else { setParsed(null); setAnalysis(null); } }} />
        {parsed && parsed.sheetNames.length > 1 && (
          <p><label htmlFor="impSheet">Worksheet</label><select id="impSheet" className="input" style={{ maxWidth: 260 }} value={parsed.sheetIndex} onChange={e => file && parse(file, target, Number(e.target.value))}>
            {parsed.sheetNames.map((n, i) => <option key={n + i} value={i}>{n}</option>)}</select></p>)}
        <p className="muted" id="impMessage">{message}</p>
      </section>

      <section className="panel"><h3>Step 2 — Choose destination</h3>
        <div className="tabs">{(Object.keys(LABEL) as Target[]).filter(t => t !== 'finance' || canFinance).map(t => (
          <button key={t} type="button" className={`tab ${target === t ? 'selected' : ''}`} onClick={() => { setTarget(t); setAnalysis(null); if (file) parse(file, t, parsed?.sheetIndex ?? 0); }}>{LABEL[t]}</button>))}</div>
      </section>

      {parsed && (
        <>
          <section className="panel"><h3>Step 3 — Match Excel columns</h3>
            <div className="formgrid">{parsed.fields.map(f => (
              <div key={f}><label htmlFor={`map_${f}`}>{nice(f).toUpperCase()}{parsed.required.includes(f) && <span className="req"> *</span>}</label>
                <select className="input" id={`map_${f}`} value={mapping[f] ?? ''} onChange={e => { setMapping(m => ({ ...m, [f]: e.target.value })); setAnalysis(null); }}>
                  <option value="">-- Not mapped --</option>{parsed.columns.map((c, i) => <option key={i} value={String(i)}>{c}</option>)}</select></div>))}</div>
            <p className="muted">{parsed.rowCount} rows found. <span className="req">*</span> = required. {missing.length ? <b>Still to map: {missing.map(nice).join(', ')}.</b> : 'All required columns are mapped.'}</p>
            <button className="btn" type="button" onClick={validate} disabled={busy}>{busy ? 'Working…' : `Validate ${parsed.rowCount} rows`}</button>
          </section>

          <section className="panel"><h3>Step 4 — Preview first five source rows</h3>
            <div className="scroll-x"><table><thead><tr>{parsed.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{parsed.preview.map((r, i) => <tr key={i}>{parsed.columns.map((_, k) => <td key={k}>{r[k] ?? ''}</td>)}</tr>)}</tbody></table></div>
          </section>
        </>
      )}

      {analysis && parsed && (
        <section className="panel" id="impResult"><h3>Step 5 — Validation result (nothing has been imported yet)</h3>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', margin: '0 0 14px' }}>
            {[['Ready to import', analysis.valid, 'Passed all checks'], ['Duplicates', analysis.duplicates, 'Will be skipped'], ['Rejected', analysis.invalid, 'Need fixing'], ['Rows read', analysis.total, parsed.fileName]].map(([l, n, s]) => (
              <div className="card" key={String(l)}><div className="muted">{l}</div><div className="num">{n}</div><div className="muted">{s}</div></div>))}
          </div>
          {analysis.problems.length ? <div className="scroll-x"><table><thead><tr><th>Data row</th><th>Result</th><th>Reason</th></tr></thead><tbody>{analysis.problems.map(p => <tr key={p.row + p.kind}><td>{p.row}</td><td><span className={`pill ${p.kind === 'Rejected' ? 'red' : 'orange'}`}>{p.kind}</span></td><td>{p.reason}</td></tr>)}</tbody></table></div> : <p className="muted">No problems found.</p>}
          {analysis.problems.length >= 100 && <p className="muted">Showing the first 100 problems. Download the full list below.</p>}
          {analysis.newClients.length > 0 && <p className="muted">{analysis.newClients.length} client name(s) not in the register will be added as Prospect: {analysis.newClients.slice(0, 6).join(', ')}{analysis.newClients.length > 6 ? '…' : ''}</p>}
          {analysis.warnings > 0 && <p className="muted">{analysis.warnings} valid row(s) carry warnings (e.g. unknown category, new client) — they will still import.</p>}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" type="button" disabled={!analysis.valid || busy} onClick={() => setConfirm(true)}>Import {analysis.valid} valid row(s)</button>
            {(analysis.invalid > 0 || analysis.duplicates > 0) && <button className="btn secondary" type="button" onClick={() => file && downloadFrom('/api/import', toast, { method: 'POST', body: body(file, 'problems', target, parsed.sheetIndex, mapping) })}>Download rejected / duplicate rows (CSV)</button>}
          </div>
        </section>
      )}

      {confirm && analysis && (
        <Modal title="Import rows?" narrow onClose={() => setConfirm(false)}
          footer={<><button className="btn secondary" type="button" onClick={() => setConfirm(false)}>Cancel</button><button className="btn" type="button" onClick={commit} disabled={busy}>{busy ? 'Importing…' : 'Import'}</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>Import {analysis.valid} validated row(s) into this workspace? {analysis.duplicates} duplicate(s) and {analysis.invalid} rejected row(s) will be skipped.</p>
        </Modal>
      )}
    </>
  );
}

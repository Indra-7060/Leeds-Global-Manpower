'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useToast } from '@/components/Toaster';

export default function CvUpload({ clients, countries, sources }: { clients: string[]; countries: string[]; sources: string[] }) {
  const router = useRouter(); const toast = useToast(); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); fd.delete('files');
    for (const f of Array.from(input.current?.files ?? [])) fd.append('files', f);
    if (!fd.getAll('files').length) { toast('Choose at least one file.', 'err'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/cv', { method: 'POST', body: fd }); const j = await res.json();
      if (!res.ok) { toast(j.error ?? 'Upload failed.', 'err'); return; }
      const text = `Added ${j.added} file record(s)${j.skipped ? `, skipped ${j.skipped} already received` : ''}${j.errors.length ? '. Problems: ' + j.errors.join(' | ') : ''}. Files themselves are NOT stored.`;
      setMsg(text); toast(text, j.errors.length ? 'err' : 'ok'); if (input.current) input.current.value = ''; router.refresh();
    } catch { toast('Upload failed — check your connection.', 'err'); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit}>
      <div className="formgrid">
        <div><label htmlFor="cvSource">Source</label><select className="input" id="cvSource" name="source">{sources.map(x => <option key={x}>{x}</option>)}</select></div>
        <div><label htmlFor="cvClient">Client</label><input className="input" id="cvClient" name="client" list="cvClients" placeholder="e.g. a registered client" /><datalist id="cvClients">{clients.map(x => <option key={x} value={x} />)}</datalist></div>
        <div><label htmlFor="cvAgency">Overseas agency</label><input className="input" id="cvAgency" name="agency" placeholder="e.g. an overseas agency" /></div>
        <div><label htmlFor="cvCountry">Country</label><input className="input" id="cvCountry" name="country" list="cvCountries" defaultValue="Nepal" /><datalist id="cvCountries">{countries.map(x => <option key={x} value={x} />)}</datalist></div>
      </div>
      <p><input ref={input} className="input" id="cvFiles" type="file" multiple accept=".txt,.csv,.eml,.docx,.pdf,.zip,.rar,.7z" aria-label="Choose CV files" /></p>
      <p><button className="btn" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload and record'}</button></p>
      {msg && <p className="muted" id="cvMessage">{msg}</p>}
      <p className="muted">Text extraction: TXT, EML, CSV and DOCX (first e-mail and phone number found). PDFs and ZIP/RAR packages are listed for review; PDF parsing, OCR and archive extraction need a backend service. Up to 20 files, 10 MB each.</p>
    </form>
  );
}

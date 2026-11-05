'use client';
import { useState } from 'react';
import { downloadFrom } from './download';
import { useToast } from './Toaster';

/** Button that downloads a file from a server URL (CSV export, JSON export, …). */
export default function DownloadButton({ url, label, cls = 'secondary' }: { url: string; label: string; cls?: string }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  return <button className={`btn ${cls}`} type="button" disabled={busy} onClick={async () => { setBusy(true); await downloadFrom(url, toast); setBusy(false); }}>{label}</button>;
}

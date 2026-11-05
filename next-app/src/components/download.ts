/** Downloads a server-generated file. Errors (no rows, not allowed, signed out) come back as JSON and are shown as a message. */
export async function downloadFrom(url: string, toast: (msg: string, kind?: 'ok' | 'err' | '') => void, init?: RequestInit): Promise<boolean> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast(j.error ?? 'Download failed.', 'err'); return false; }
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'export.csv';
    const blob = await res.blob(), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    const rows = res.headers.get('X-Row-Count'); toast(`Downloaded ${name}${rows ? ` (${rows} rows)` : ''}`, 'ok');
    return true;
  } catch { toast('Download failed — check your connection.', 'err'); return false; }
}

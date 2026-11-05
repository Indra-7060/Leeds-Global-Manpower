/* CV INTAKE — records file metadata and extracts e-mail/phone from TXT, EML, CSV and DOCX (as V6 did).
   Files themselves are NOT stored (no secure storage offline). PDF/archives are listed for manual handling. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const ALLOWED = ['txt', 'csv', 'eml', 'docx', 'pdf', 'zip', 'rar', '7z'];
  const unesc = s => s.replace(/&(lt|gt|amp|quot|apos);/g, (m, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e]));

  async function process(file, meta) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED.includes(ext)) throw new Error(`Unsupported file type ".${ext}". Allowed: ${ALLOWED.join(', ')}.`);
    const item = { filename: file.name, size: file.size || 0, type: ext, received: new Date().toISOString(), source: meta.source || 'Direct upload', client: meta.client || '', agency: meta.agency || '', country: meta.country || '',
      status: 'Needs review', note: '', extracted_email: '', extracted_phone: '', preview: '' };
    try {
      let text = '';
      if (['txt', 'csv', 'eml'].includes(ext)) text = (await file.text()).slice(0, 150000);
      else if (ext === 'docx') { const xml = await LGM.Xlsx.readEntry(await file.arrayBuffer(), 'word/document.xml'); text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => unesc(m[1])).join(' '); }
      else if (ext === 'pdf') item.note = 'PDF received — text extraction needs a backend service';
      else item.note = 'Archive received — extract the files, then upload them';
      if (text) {
        const e = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i), p = text.match(/(?:\+?\d[\d ()-]{7,}\d)/);
        item.extracted_email = e ? e[0] : ''; item.extracted_phone = p ? p[0] : ''; item.preview = text.replace(/\s+/g, ' ').slice(0, 500); item.note = 'Text extracted — review required';
      }
    } catch (err) { item.note = 'Read failed: ' + String(err.message).slice(0, 80); }
    return item;
  }
  LGM.CvIntake = { process, ALLOWED };
})(typeof window !== 'undefined' ? window : globalThis);

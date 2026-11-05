/** CV intake extraction — TXT / EML / CSV / DOCX: first e-mail and phone number. PDF and archives are logged for manual handling. */
import JSZip from 'jszip';

export const CV_ALLOWED = ['txt', 'csv', 'eml', 'docx', 'pdf', 'zip', 'rar', '7z'];
export const MAX_CV_BYTES = 10 * 1024 * 1024;
const unesc = (s: string) => s.replace(/&(lt|gt|amp|quot|apos);/g, (_m, e: string) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" } as Record<string, string>)[e]);

export interface CvExtract { type: string; note: string; extractedEmail: string; extractedPhone: string; preview: string }

export async function extractCv(fileName: string, data: Buffer): Promise<CvExtract> {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (!CV_ALLOWED.includes(ext)) throw new Error(`Unsupported file type ".${ext}". Allowed: ${CV_ALLOWED.join(', ')}.`);
  if (data.length > MAX_CV_BYTES) throw new Error('File is larger than 10 MB.');
  const out: CvExtract = { type: ext, note: '', extractedEmail: '', extractedPhone: '', preview: '' };
  let text = '';
  try {
    if (['txt', 'csv', 'eml'].includes(ext)) text = data.toString('utf8').slice(0, 150000);
    else if (ext === 'docx') {
      const xml = await (await JSZip.loadAsync(data)).file('word/document.xml')?.async('string');
      if (!xml) throw new Error('word/document.xml not found');
      text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => unesc(m[1])).join(' ');
    } else if (ext === 'pdf') out.note = 'PDF received — text extraction needs a backend service';
    else out.note = 'Archive received — extract the files, then upload them';
  } catch (e) { out.note = 'Read failed: ' + String((e as Error).message).slice(0, 80); }
  if (text) {
    const e = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i), p = text.match(/(?:\+?\d[\d ()-]{7,}\d)/);
    out.extractedEmail = e ? e[0] : ''; out.extractedPhone = p ? p[0] : ''; out.preview = text.replace(/\s+/g, ' ').slice(0, 500); out.note = 'Text extracted — review required';
  }
  return out;
}

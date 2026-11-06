import 'server-only';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { C, can } from '@/lib/config';
import { decryptBuffer, encryptBuffer, sha256 } from '@/lib/crypto';
import { audit } from './mutations-v8';
import { fail, log, type Actor, type Result } from './mutations';

/**
 * Contract files. Rules (V8 §3): a new upload is always a NEW version (the original is never overwritten); files are stored
 * ENCRYPTED (AES-256-GCM) outside the web root; every download/ZIP is written to the audit log; the SHA-256 of the exact
 * original bytes is kept and re-checked on download, so “download the exact original” can be proven.
 * Storage folder: STORAGE_DIR (default ./storage). Back this folder up together with the database and DATA_KEY.
 */
const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'storage'));

/** Where the (already encrypted) bytes live: 'disk' = STORAGE_DIR folder (local / own server), 'db' = the MySQL table stored_files (default on Vercel). */
export const storageDriver = (): 'disk' | 'db' => (process.env.STORAGE_DRIVER === 'db' || process.env.STORAGE_DRIVER === 'disk' ? process.env.STORAGE_DRIVER : process.env.VERCEL ? 'db' : 'disk');
/** Vercel rejects request bodies above ~4.5 MB, so the practical upload limit there is 4 MB. */
export const uploadLimitMB = () => (process.env.VERCEL ? Math.min(C.v8.uploadMaxMB, 4) : C.v8.uploadMaxMB);

async function putFile(key: string, data: Buffer) {
  if (storageDriver() === 'db') { await prisma.storedFile.create({ data: { key, data: new Uint8Array(data), size: data.length } }); return; } // unique key: an existing file is never overwritten
  const full = path.join(/*turbopackIgnore: true*/ root(), key); await mkdir(path.dirname(full), { recursive: true }); await writeFile(full, data, { flag: 'wx' });
}
async function getFile(key: string): Promise<Buffer> {
  if (storageDriver() === 'db') { const f = await prisma.storedFile.findUnique({ where: { key } }); if (!f) throw new Error('missing'); return Buffer.from(f.data); }
  return readFile(path.join(/*turbopackIgnore: true*/ root(), key));
}
const NO_VIEW = 'Contracts are available to the Managing Director and Admin Manager.';

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  pdf: b => b.subarray(0, 4).toString('latin1') === '%PDF',
  docx: b => b[0] === 0x50 && b[1] === 0x4b, xlsx: b => b[0] === 0x50 && b[1] === 0x4b,
  doc: b => b[0] === 0xd0 && b[1] === 0xcf,
  jpg: b => b[0] === 0xff && b[1] === 0xd8, jpeg: b => b[0] === 0xff && b[1] === 0xd8,
  png: b => b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG',
};
const MIME: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
export const safeName = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').slice(0, 150) || 'file';

/** Placeholder for a virus scanner (e.g. ClamAV). Currently NO scanning is performed — see docs. Returning ok:false blocks the upload. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function scan(_buf: Buffer): Promise<{ ok: boolean; engine: string }> { return { ok: true, engine: 'none (not installed)' }; }

export async function addContractVersion(a: Actor, contractId: number, file: { name: string; buf: Buffer }, note: string): Promise<Result> {
  if (!can(a.role, 'contracts.manage')) return fail({ _: 'Contracts are managed by the Managing Director and Admin Manager.' });
  const name = safeName(file.name), ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!C.v8.uploadExtensions.includes(ext)) return fail({ _: `File type .${ext || '?'} is not allowed. Allowed: ${C.v8.uploadExtensions.join(', ')}.` });
  if (!file.buf.length) return fail({ _: 'The file is empty.' });
  if (file.buf.length > uploadLimitMB() * 1024 * 1024) return fail({ _: `File is larger than ${uploadLimitMB()} MB.` });
  if (!MAGIC[ext]?.(file.buf)) return fail({ _: `The content of “${name}” does not look like a real .${ext} file.` });
  const s = await scan(file.buf); if (!s.ok) return fail({ _: 'The file was blocked by the virus scan.' });
  const c = await prisma.contract.findFirst({ where: { id: contractId, workspace: a.workspace }, include: { versions: { select: { version: true } } } });
  if (!c) return fail({ _: 'Contract not found.' });
  const version = (c.versions.reduce((m, v) => Math.max(m, v.version), 0)) + 1;
  const storageKey = `${a.workspace}/${c.code}/v${version}-${randomUUID()}.bin`;
  await putFile(storageKey, encryptBuffer(file.buf)); // never overwrites an existing file
  try {
    await prisma.$transaction(async tx => {
      await tx.contractVersion.create({ data: { workspace: a.workspace, contractId: c.id, version, filename: name, mime: MIME[ext], size: file.buf.length, sha256: sha256(file.buf), storageKey, note: note.slice(0, 300), uploadedById: a.userId } });
      await log(tx, a, 'contracts', c.code, '', `Uploaded ${c.code} version ${version}: ${name} (${file.buf.length} bytes)`);
    });
  } catch { return fail({ _: 'Could not save this version (another upload may have run at the same moment). Please try again.' }); }
  return { ok: true, code: `${c.code} v${version}` };
}

/** Decrypts one stored version. Verifies the checksum, then writes the download to the audit log. */
export async function readContractVersion(a: Actor, versionId: number): Promise<{ ok: true; buf: Buffer; filename: string; mime: string } | { ok: false; error: string; status: number }> {
  if (!can(a.role, 'contracts.view')) return { ok: false, error: NO_VIEW, status: 403 };
  const v = await prisma.contractVersion.findFirst({ where: { id: versionId, workspace: a.workspace }, include: { contract: true } });
  if (!v) return { ok: false, error: 'File not found.', status: 404 };
  let buf: Buffer;
  try { buf = decryptBuffer(await getFile(v.storageKey)); } catch { return { ok: false, error: 'The stored file could not be read or decrypted (missing file or wrong DATA_KEY).', status: 500 }; }
  if (sha256(buf) !== v.sha256) return { ok: false, error: 'Integrity check failed — the stored file no longer matches its original checksum.', status: 500 };
  await audit(a, 'contracts', v.contract.code, `Downloaded ${v.contract.code} version ${v.version} (${v.filename})`);
  return { ok: true, buf, filename: v.filename, mime: v.mime || 'application/octet-stream' };
}

/** ZIP of every version of every contract for one company, one sponsor, or one division. */
export async function zipContracts(a: Actor, scope: { clientId?: number; caseId?: number; division?: string }): Promise<{ ok: true; buf: Buffer; name: string; files: number } | { ok: false; error: string; status: number }> {
  if (!can(a.role, 'contracts.view')) return { ok: false, error: NO_VIEW, status: 403 };
  const where = { workspace: a.workspace, ...(scope.clientId ? { clientId: scope.clientId } : {}), ...(scope.caseId ? { domesticCaseId: scope.caseId } : {}), ...(scope.division ? { division: scope.division } : {}) };
  const contracts = await prisma.contract.findMany({ where, include: { versions: { orderBy: { version: 'asc' } }, client: true, domesticCase: true }, orderBy: { code: 'asc' } });
  const zip = new JSZip(); let files = 0;
  for (const c of contracts) {
    const folder = zip.folder(safeName(`${c.code}_${c.title}`))!;
    for (const v of c.versions) {
      try {
        const buf = decryptBuffer(await getFile(v.storageKey));
        if (sha256(buf) !== v.sha256) return { ok: false, error: `Integrity check failed for ${c.code} version ${v.version}.`, status: 500 };
        folder.file(`v${v.version}_${safeName(v.filename)}`, buf); files++;
      } catch { return { ok: false, error: `Could not read ${c.code} version ${v.version}.`, status: 500 }; }
    }
  }
  if (!files) return { ok: false, error: 'No uploaded contract files match.', status: 404 };
  const label = scope.clientId ? contracts[0]?.client?.name : scope.caseId ? contracts[0]?.domesticCase?.customer : scope.division ?? 'all';
  await audit(a, 'contracts', '', `Bulk ZIP download of ${files} contract file(s) — ${label ?? 'selection'}`);
  return { ok: true, buf: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), name: safeName(`LGM_Contracts_${label ?? 'selection'}`) + '.zip', files };
}

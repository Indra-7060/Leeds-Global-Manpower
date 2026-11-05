import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

/**
 * Encryption at rest for sensitive values (sponsor QID) and uploaded contract files: AES-256-GCM.
 * Key: DATA_KEY (base64, 32 bytes) if set, otherwise derived from SESSION_SECRET. Set DATA_KEY in production and BACK IT UP —
 * without it encrypted files and QIDs cannot be read again.
 */
let cached: Buffer | null = null;
function key(): Buffer {
  if (cached) return cached;
  const k = process.env.DATA_KEY;
  if (k) { const b = Buffer.from(k, 'base64'); if (b.length !== 32) throw new Error('DATA_KEY must be 32 bytes, base64-encoded.'); return (cached = b); }
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Set DATA_KEY (or SESSION_SECRET) to enable encryption.');
  return (cached = scryptSync(secret, 'lgm-erp-data-key', 32));
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]); // iv(12) | tag(16) | ciphertext
}
export function decryptBuffer(blob: Buffer): Buffer {
  const d = createDecipheriv('aes-256-gcm', key(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}
export const encryptText = (s: string) => encryptBuffer(Buffer.from(s, 'utf8')).toString('base64');
export const decryptText = (b64: string) => decryptBuffer(Buffer.from(b64, 'base64')).toString('utf8');
export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
/** Show only the last characters of a sensitive reference. */
export const mask = (last: string) => (last ? '••••••' + last : '—');

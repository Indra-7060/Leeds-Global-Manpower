import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { apiUser } from '@/lib/auth/dal';
import { accessError } from '@/lib/repo/access';
import { addContractVersion } from '@/lib/repo/contracts';

export const runtime = 'nodejs';

/** POST multipart: contractId, file, note. Always creates a NEW version; never overwrites an earlier file. */
export async function POST(req: NextRequest) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  { const denied = await accessError(ctx.user.role, { module: 'contracts' }, 'edit'); if (denied) return NextResponse.json({ error: denied }, { status: 403 }); }
  const form = await req.formData();
  const file = form.get('file'), contractId = Number(form.get('contractId'));
  if (!(file instanceof File) || !Number.isInteger(contractId)) return NextResponse.json({ error: 'Choose a contract and a file.' }, { status: 400 });
  const res = await addContractVersion({ workspace: ctx.ws, role: ctx.user.role, userId: ctx.user.userId }, contractId, { name: file.name, buf: Buffer.from(await file.arrayBuffer()) }, String(form.get('note') ?? ''));
  if (!res.ok) return NextResponse.json({ error: res.errors._ ?? Object.values(res.errors)[0] ?? 'Upload failed.' }, { status: 400 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, version: res.code });
}

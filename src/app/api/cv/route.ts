import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { apiUser } from '@/lib/auth/dal';
import { accessError } from '@/lib/repo/access';
import { extractCv } from '@/lib/io/cv';
import { addCvItems, type CvItemInput } from '@/lib/repo/mutations-3';

export const runtime = 'nodejs';

/** POST multipart: files[] + source, client, agency, country. Records file details and extracts the first e-mail/phone. Files themselves are NOT stored. */
export async function POST(req: NextRequest) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  { const denied = await accessError(ctx.user.role, { module: 'cv_inbox' }, 'edit'); if (denied) return NextResponse.json({ error: denied }, { status: 403 }); }
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'Choose at least one file.' }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: 'Upload at most 20 files at a time.' }, { status: 400 });
  const meta = { source: String(form.get('source') ?? ''), client: String(form.get('client') ?? '').slice(0, 190), agency: String(form.get('agency') ?? '').slice(0, 190), country: String(form.get('country') ?? '').slice(0, 60) };
  const items: CvItemInput[] = []; const errors: string[] = [];
  for (const f of files) {
    try { const x = await extractCv(f.name, Buffer.from(await f.arrayBuffer())); items.push({ filename: f.name.slice(0, 250), size: f.size, ...meta, ...x }); }
    catch (e) { errors.push(`${f.name}: ${(e as Error).message}`); }
  }
  const { added, skipped } = items.length ? await addCvItems({ workspace: ctx.ws, role: ctx.user.role, userId: ctx.user.userId }, items) : { added: 0, skipped: 0 };
  revalidatePath('/', 'layout');
  return NextResponse.json({ added, skipped, errors });
}

// Copies the three static (no-server) deliverables into public/offline/ so Vercel serves them next to the Next.js app.
// The folders at the repo root stay the single source of truth; public/offline is generated (git-ignored).
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'public', 'offline');
const map = { Leads_Global_ERP_Final: 'final', Reusable_ERP_Master_Template: 'template', ERP_Analysis_And_Documentation: 'docs' };

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [src, dest] of Object.entries(map)) {
  if (!existsSync(join(root, src))) { console.warn('sync-offline: missing folder', src); continue; }
  cpSync(join(root, src), join(out, dest), { recursive: true, filter: p => !/[\\/](node_modules|source_copies|pdf_source)([\\/]|$)/.test(p) });
}
console.log('sync-offline: copied to public/offline');

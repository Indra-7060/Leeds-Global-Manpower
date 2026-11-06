# 09 — Deploying to Vercel

The app is a normal Next.js project at the repository root. It is ready to deploy as long as the database and settings below are in place. **Your XAMPP database cannot be used from Vercel** — it only exists on your PC.

## What was changed to make it Vercel-ready
* **Contract files** are now stored (still AES-256-GCM encrypted) in the MySQL table `stored_files` when running on Vercel, because Vercel has no persistent disk. Locally they still go to `./storage`. Switch with `STORAGE_DRIVER=db|disk`.
* **Database connection** supports TLS (`?ssl=true` on `DATABASE_URL`) and uses a small pool (2 connections per instance) on Vercel.
* **Upload limit** on Vercel is **4 MB per file** (Vercel refuses request bodies above ~4.5 MB). The same limit applies to CV uploads and Excel imports.
* The production build was run in Vercel mode without warnings; the production server starts and redirects signed-out visitors to the login page.

## Steps

### 1. Create a hosted MySQL-compatible database
Use any provider that gives you a MySQL (or MariaDB) database with TLS and a connection string. Choose a region close to the Vercel region. Backups: enable the provider's automatic backups — they now also cover the contract files, because those live in the database.
Connection string format: `mysql://USER:PASSWORD@HOST:3306/DATABASE?ssl=true`

### 2. Create the tables and the first users (from your PC, once)
In the project folder, with PowerShell (use your own values):

```powershell
$env:DATABASE_URL = "mysql://USER:PASSWORD@HOST:3306/DATABASE?ssl=true"
npm run db:migrate
$env:SEED_PASSWORD = "A-long-password-only-you-know"
npm run db:seed
```
* `db:migrate` creates all 35 tables.
* `db:seed` creates the three accounts (`md@lgm.local`, `nitija@lgm.local`, `staff@lgm.local`) with the password you chose, and fills the **DEMO** workspace with fictional data. The **LIVE** workspace stays empty. **Do not use `DemoPass-2026` on the live site.**
* Later schema changes: run `npm run db:migrate` against the hosted database before deploying the new code.

### 3. Put the code on Vercel
1. Vercel → **Add New → Project** → import `Indra-7060/Leeds-Global-Manpower` from GitHub. Framework: **Next.js** (detected). Root directory: the repository root. Build/install commands: defaults (`postinstall` runs `prisma generate`).
2. **Environment Variables** (Production):

| Name | Value |
|---|---|
| `DATABASE_URL` | the hosted connection string, ending in `?ssl=true` |
| `SESSION_SECRET` | a random string of at least 32 characters (signs login cookies) |
| `DATA_KEY` | 32 random bytes, base64 — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Back it up.** If it is lost or changed, sponsor QIDs and contract files can no longer be read. |

3. Deploy, open the site, sign in as the Managing Director.

### 4. After the first deploy
* Settings → Users: change/create real accounts and passwords; disable or remove the three seed accounts you do not use.
* Switch to the **LIVE** workspace (button at the top) before entering real data. The DEMO workspace is for showing the client.
* Settings → Roles & Access: review the standard levels with the client.

## Limits to tell the client
* Files above 4 MB cannot be uploaded on Vercel (contracts, CVs, Excel imports). Larger files need direct-to-storage uploads (a further change).
* Large imports/exports run inside one request; very large files may hit your Vercel plan's function time limit.
* Not built: MFA, e-mail/WhatsApp sending, virus scanning, scheduled backups beyond the database provider's own, PDF documents. See `08_V8_Gap_Analysis_and_Status.md` and the Automations screen.
* Never reuse the demo passwords or commit `.env`.

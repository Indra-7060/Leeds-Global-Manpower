# Leads Global ERP — Next.js + MySQL (XAMPP)

Rebuild of the V6 dashboard as a real web application: **Next.js 16** (App Router, TypeScript), **Prisma 7** on **MySQL/MariaDB (XAMPP)**, real login with roles enforced on the server. The earlier static prototype (now in `static-prototype/`) is unchanged and remains the reference for behaviour.

## V8 update (client developer package)
The client’s V8 package is now partly built: three independent divisions with their own tabs (Domestic sponsors, payments, 9-month guarantee & manual refund review · Corporate vacancies, candidates and placement fees with due dates · optional Blue-Collar service charge), an encrypted **Contract Library** (versions, exact-original download, ZIP), **Tasks & Alerts**, MD-approved agency-deposit allocation, interview attendance, a **Management Overview**, and real **.xlsx** export. See `docs/08_V8_Gap_Analysis_and_Status.md` for what is built, what is not (MFA, WhatsApp/e-mail, virus scan, off-site backups, PostgreSQL, PDF documents) and the assumptions to confirm.

The Managing Director can set **level-wise access** per role and module in Settings → Roles & Access (see docs/08, section 7).

After pulling this update run `npm run db:migrate` (adds 13 tables, nothing is dropped) and `npm run db:seed` (re-creates the DEMO data with V8 samples). Optional `.env` values: `DATA_KEY` (base64, 32 bytes — encrypts QIDs and contract files; **back it up**) and `STORAGE_DIR` (contract files, default `./storage`).

## Status — stages 1–3 (V6 scope)
| Area | What works |
|---|---|
| Login & users | Real login, signed-cookie sessions, 3 roles checked **on the server**, change own password; the Managing Director can add/disable users and reset passwords |
| Workspaces | DEMO and LIVE are separated in the database; MD/Admin Manager can switch, reset the demo data, or clear a workspace (typed confirmation) |
| Sales & orders | Dashboard · Client CRM · Visits & Follow-ups · Demand Letters · Manpower Orders · Overseas Agencies |
| Recruitment pipeline | Candidates (stage workflow, duplicates, undo) · Interviews · Visa/QVC/RTP · Deployment (derived checklist) · Tickets & Arrival · Warranty (auto expiry) · Domestic Workers · Corporate fee calculator |
| Data in / out | Excel/CSV Import Center (validate → review → import) · CV Intake · Reports & Excel toolbar + CSV exports · Master Recruitment Report · Reports & Alerts + audit log · keyword report (not AI) |
| Money & secrets | Private Finance (restricted to MD/Admin Manager **on the server**) · Credentials Register (descriptions only; passwords refused) |
| Settings | Workspace counts, JSON export, data-quality checks, users, configuration in force |

**Not built:** real AI, e-mail/WhatsApp reminders, mailbox/WeTransfer capture, PDF parsing/OCR, secure file storage for CVs and passports, native XLSX/PDF export, the arrival-triggered agency charge and approval workflow (V6 gives the rules only as text), password-reset by e-mail.

**Verified against the real database (`leeds_global_manpower` on XAMPP):** migration, seed, login, all CRUD and workflows through the browser UI, imports with real CSV/XLSX files, exports, server-side permissions, and DEMO/LIVE isolation.

## Testing
* `npm test` — 56 unit tests (business rules, V8 fee/refund/due-date rules, validation, import analysis, real `.xlsx` and `.docx` files). No database needed.
* `npm run test:v8` — about 75 V8 checks against the real database (finance wall, encrypted QID, refund approval without payout, placement-fee rules, service-charge trigger, deposit allocation, contract versions/ZIP/tamper detection, tasks, attendance).
* `npm run test:db` — 76 integration checks against the real database (DEMO workspace; cleans up after itself): permissions enforced inside the server functions, LIVE cannot touch DEMO, duplicates, lifecycle rules, integrity, import commit, finance restriction, users, workspace tools.
* `npm run typecheck` · `npx eslint src prisma tests`

## Backups
The JSON export in Settings is a readable copy, **not** a backup. Back up the database itself: phpMyAdmin → `leeds_global_manpower` → Export, or run `C:\xampp\mysql\bin\mysqldump.exe -u root leeds_global_manpower > backup.sql` regularly and keep copies off this computer.

## Setup (XAMPP)
1. Start **MySQL** in the XAMPP Control Panel.
2. In phpMyAdmin (http://localhost/phpmyadmin) create an empty database, e.g. `leeds_global_manpower` (collation `utf8mb4_unicode_ci`).
3. Edit `.env`: `DATABASE_URL="mysql://root:@localhost:3306/<database>"` (XAMPP's `root` user has an empty password by default) and set `SESSION_SECRET` to a long random string.
4. `npm run db:migrate` — creates the 31 tables.
5. `npm run db:seed` — creates three accounts and the fictional DEMO workspace. **The generated password is printed once.**
6. `npm run dev` → http://localhost:3000 (XAMPP's Apache on port 80 is not used).

Change a password: `npm run user:password -- md@lgm.local "NewPassword123"` (or use Settings → My Account).

Accounts: `md@lgm.local` (Managing Director), `nitija@lgm.local` (Admin Manager), `staff@lgm.local` (Operations Staff).

## Commands
`npm run dev` · `npm run build` · `npm test` · `npm run test:db` · `npm run db:seed` (resets the DEMO data; LIVE is never touched) · `npm run db:studio`

## Layout
```
prisma/schema.prisma        31 tables (workspace column on every business table) · migrations/ · seed.ts
src/lib/config.ts           every list/stage/default (assumptions tagged OQ-n — change here when the client confirms)
src/lib/forms.ts            form definitions + server-side validation
src/lib/domain/             pure business logic: lifecycle, rules, metrics, alerts, reports, importer (unit-tested)
src/lib/io/                 csv, readTable (CSV/XLSX), CV extraction
src/lib/repo/               database access: state (read) · mutations*.ts (validated writes + audit) · import · seed
src/lib/auth/               signed-cookie sessions + server-side permission checks
src/app/(app)/              pages · src/app/api/ import, export, cv, backup · src/components/ UI
tests/                      unit tests (vitest) + db-integration.ts
```

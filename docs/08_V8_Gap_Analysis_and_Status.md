# 08 — V8 Developer Package: what was asked, what is built, what is not

Source: `Leads_Global_ERP_V8_Developer_Package.zip` → `DEVELOPER_REQUIREMENTS.md`, `START_HERE.txt`, `index.html` (design prototype “based on V7”).
App: `next-app/` (Next.js + Prisma + MySQL on XAMPP). All demo data is fictional. Nothing here is legal, tax or accounting advice.

**Honest summary.** The V8 text is a much larger scope than V6 (the client’s own text says the INR 15,000 quote “is not proof this extensive scope is feasible”). This build delivers the parts that fit the current stack and can be proven with tests: the three independent divisions, optional blue-collar service charge, corporate placement fees with due dates, domestic sponsor payments and the 9-month guarantee/refund *estimate* with manual approval, the encrypted Contract Library, staff tasks, MD-approved deposit allocation, real `.xlsx` export and the MD overview. Items that need outside services or a different platform (MFA, WhatsApp/e-mail, virus scanning, off-site encrypted backups, PostgreSQL, PDF documents, background jobs) are **not built** and are listed in section 4.

## 1. Status against the V8 requirements

Legend: **Built** = works and is covered by an automated test · **Partly** = works with a stated limit · **Not built** = absent · **Differs** = deliberately different from V8 text.

### §1 Three independent divisions
| V8 requirement | Status | Where / note |
|---|---|---|
| Blue-Collar workflow (CRM, visits, orders, agencies, CVs, interviews, visa/QVC/RTP, tickets, arrival, joining, 3-month warranty) | **Built** (V6 workflow, unchanged) | all V6 modules |
| Offer letters as documents | **Partly** | stage “Offer Accepted” exists; no offer-letter document record |
| Optional service charge (USD 150–300 per deployed worker, or flat per order; currency, taxable flag, trigger, invoicing, collections; off by default) | **Built** | `/service-fees`. Invoice only after workers reached the agreed trigger; receipts capped at the invoice; taxes are only flagged, not calculated |
| Client-paid fees separate from agency-paid revenue/costs | **Partly** | separate tables/pages; agency revenue/costs are still plain ledger entries (no candidate-level costing) |
| Domestic: individual sponsor, never a company | **Built** | sponsor form has no company/CR/PO fields (test-checked); type = Qatari citizen / eligible resident |
| Domestic: QID stored securely | **Built** | AES-256-GCM encrypted, shown masked (`••••••5678`) |
| Domestic: worker categories, selection, contract, visa, arrival, handover | **Built** | category list is configurable; status workflow from V6 |
| Domestic: advance + deployment balance, receipts, outstanding, QIIB, separate domestic ledger | **Built** | `/domestic/payments`; receipt numbers `RC-…`; QIIB default account |
| Domestic: 9-month warranty window and refund *estimation* with reason, evidence, manual approval, no auto-payout | **Built** | `/domestic/warranty`; approval is MD only; approving creates **no** payment |
| Legal rule versioning / source / reviewer | **Partly** | one configured rule (`C.v8.refundRule`: version, source, effective = UNVERIFIED, reviewer = PENDING) shown on screen; no history of older rule versions |
| Arrival/handover evidence | **Partly** | free-text note on the case; files can be filed in the Contract Library |
| Corporate: company clients, local or overseas, job orders, candidates, interviews, offer, joining | **Built** | `/corporate`, `/corporate/candidates` |
| Corporate: fee = 0.5 × basic, 1.0 × basic or custom; due 1 or 3 calendar months after confirmed joining; invoice/due/accrued/cash kept apart; partial collections; credit notes; overdue | **Built** | `/corporate/fees` |
| Corporate: other contractual milestones, replacement/cancellation workflow, branded invoices | **Partly / Not built** | milestone is a note; cancellation = credit note; invoice = number + date only (no PDF) |

### §2 Navigation and reports
| Requirement | Status | Note |
|---|---|---|
| One collapsible Recruitment parent → three divisions, each with own tabs | **Built** | sidebar + division tabs |
| Import Excel | **Partly** | engine (xlsx/csv, mapping, preview, duplicates) exists for candidates, orders, finance. **Not** available for sponsors, vacancies, placements, contracts, tasks |
| Export Excel (.xlsx), summary + detail sheets | **Built** | every report; default is `.xlsx`, `&format=csv` still works |
| Print / PDF | **Not built** | |
| Master report with current-status counts (no double counting) | **Built** (V6) | Master Recruitment Report |
| Reports list (interviews, attendance, selections, QVC, visas, tickets, orders, agencies, sponsor balances, warranty, corporate invoices, contract expiry, finance) | **Built** | 14 new database reports + the V6 reports |
| Filters: division, company, order, agency, country, trade, stage, **date range, owner** | **Partly** | client, country, stage, division only; no date-range/owner filter |
| Large files in background, retries | **Not built** | imports/exports run in the request |

### §3 Contracts & documents
| Requirement | Status | Note |
|---|---|---|
| Library by company (Blue-Collar, Corporate) and by sponsor (Domestic) | **Built** | `/contracts`, also linked from each division |
| Metadata: type, signed/effective/expiry, linked order, billing and warranty terms | **Built** | |
| Never overwrite — new version | **Built** | test-checked; storage refuses to overwrite a file |
| View/download the **exact original** any time; bulk ZIP by company/sponsor/division | **Built** | SHA-256 is recorded and verified on every download; tampering is detected |
| 90/30/7-day expiry alerts | **Built** | shown in the library, Tasks & Alerts and the overview (no e-mail/WhatsApp) |
| Encryption of stored files | **Built** | AES-256-GCM; key `DATA_KEY` (back it up!) |
| Audit of downloads | **Built** | every download/ZIP/export is in the activity log |
| Virus scanning | **Not built** | hook exists (`scan()` in `repo/contracts.ts`); extension, size and file-signature checks are done |
| Backups | **Not built** | see §4 |
| Passport/CV documents as controlled files | **Not built** | the CV Intake Center still records details only (it does not keep the file) |
| Who can see contracts | **Assumption V8-Q1** | MD + Nitija only (contracts hold billing terms) |

### §4 Workflow automation
| Requirement | Status | Note |
|---|---|---|
| Staff tasks: owner, deadline, escalation | **Built** | `/tasks`; staff see/complete their own; “escalate” flag after 3 days late (V8-Q6) |
| Reminders for QVC, interview, expiry, ticket, arrival, warranty, receivables | **Partly** | computed and shown in-app; contract/guarantee/placement-fee reminders added. No passport/visa expiry (no such fields yet) |
| WhatsApp / e-mail via approved providers | **Not built** | needs a provider, templates, consent and a paid account |
| Interview sheets, attendance, client decisions | **Built** | Interviews page → “Attendance & Client Decision” + report |
| Duplicate detection on normalised passport + nationality | **Partly** | V6 rule (passport, else name+client) retained |
| Branded invoices, receipts, credit notes, refund PDFs | **Not built** | numbers are issued, documents are not generated |
| Audit trail (changes, uploads, downloads, exports, approvals) | **Built** | |
| Reversible entries, no silent deletion | **Partly** | deletes are confirmed and logged (with amount); approved allocations and decided refund claims cannot be deleted; no reversing-entry ledger |
| Daily encrypted off-site backups + restore tests | **Not built** | manual JSON backup exists (database only) |

### §5 Finance — strict management access
| Requirement | Status | Note |
|---|---|---|
| Only MD + Nitija see/handle finance, fees, commission, costing, balances, exports | **Built** | enforced in the server write functions, in pages (redirect), in the export route (403) and in downloads — test-checked as staff through page, API, Excel and URL. Money tables are never queried for staff |
| MFA, least privilege | **Not built** (least privilege **Built**) | MFA needs an authenticator-app/e-mail step |
| Two ledgers (QIIB mostly / cash mostly) | **Built** | V6 ledger + domestic receipts ledger; **reconciled transfers** not built |
| Agency deposits stay UNALLOCATED until the MD approves explicit allocations; no automatic allocation | **Built** | Finance → “Agency Deposits & Allocations”; only the MD can approve |
| Agency-wise balances by client/order/country/candidate | **Partly** | allocation per order/candidate + “Agency Deposits” report |
| Projected vs realised revenue/costs | **Not built** | the V6 costing calculator remains a what-if tool |
| Nepal QAR 1,500 only on verified arrival | **Not built** | still a text rule (open question) |
| Bangladesh visa/QVC costs, visa investments, service charges, partner commissions separately | **Partly** | ledger categories exist; no per-candidate costing |
| Corporate fee/due-date automation without recording “due” as cash | **Built** | |

### §6 MD dashboard
**Built** — Dashboard → “Management Overview”: tasks overdue, contracts expiring, joined this month, open warranty, sponsors, vacancies, orders, flight pending (each tile links to the records); finance widgets (cash and QIIB movement, receivables, unallocated deposits, placement and service balances, pending refund/allocation approvals) only for MD/Nitija. **Not built:** division profitability; separate staff dashboards beyond what they may see.

### §7 Excel import/export — see §2.

### §8 Technical and security
| Requirement | Status | Note |
|---|---|---|
| PostgreSQL | **Differs** | MySQL/MariaDB on XAMPP as instructed. Prisma makes a later move possible (change provider, regenerate migrations, test) but it is not done |
| Login + MFA | login **Built**, MFA **Not built** | |
| Backend role authorisation, division isolation | **Built** | divisions share one login; isolation is by permission, not separate databases |
| TLS | deployment task | add when hosted |
| Encrypted sensitive data | **Partly** | QID and contract files encrypted. **Candidate passport numbers are stored in clear text** (needed for duplicate detection) — decide with the client |
| File storage under a client-controlled account | **Partly** | files are in `STORAGE_DIR` on the machine running the app; move to the client’s cloud bucket when hosted |
| Retention/deletion policy, disaster recovery | **Not built** | |
| No finance/passport/QID in browser localStorage | **Built** | nothing is stored in the browser |
| Money rules configurable, not hard-coded | **Built** | `src/lib/config.ts` → `C.v8` |

## 2. The twelve demonstration acceptance tests (V8 §9)

| # | Test | Result |
|---|---|---|
| 1 | 100-worker Nepal order, correct visa-stage counts without double counting | V6 logic (unit-tested, 56 tests); demo order has 100 for Nepal |
| 2 | Import real-format XLSX with mapping/preview/duplicates; export filtered QVC Pending as XLSX | import: V6 tests; export: real `.xlsx` verified by reading it back (`tests/xlsx.test.ts`) |
| 3 | Interview attendance; export selected/rejected | **Pass** (`tests/db-v8.ts`, report “Interview Attendance”) |
| 4 | Confirm joining; flight/deployment report with client/country filters | V6 reports (unchanged) |
| 5 | Individual domestic sponsor (no company/CR), advance + deployment balance, receipt | **Pass** |
| 6 | 9-month refund estimate with reason, evidence, manual approval, no auto-payout | **Pass** (approving leaves the payment count unchanged) |
| 7 | Corporate placement (local/overseas), 0.5/1 month fee, due 1/3 months after verified joining; unpaid/partial/paid | **Pass** |
| 8 | Optional blue-collar USD service fee per worker or per order, invoice only on agreed trigger | **Pass** |
| 9 | Upload contract under client/sponsor, download exact original, new version, bulk ZIP, access restriction | **Pass** (byte-for-byte compare, tamper detection, staff blocked) |
| 10 | Staff cannot reach finance via page, API, Excel or URL; MD/Nitija can; sensitive downloads logged | **Pass** (server tests + browser as Operations Staff) |
| 11 | Reminders, task assignment, dashboard drill-downs, **backup restore** | reminders/tasks/drill-downs **Pass**; **backup restore not built** |
| 12 | Source code, schema, admin credentials, deployment instructions, data export, handover | source on GitHub, `prisma/schema.prisma` + migrations, README; deployment guide and credential handover still to do |

## 3. Assumptions I had to make (please confirm — each is one line in `src/lib/config.ts`)

| ID | Assumption |
|---|---|
| V8-Q1 | Contracts (view/download/upload) are limited to MD + Nitija because they hold billing terms. |
| V8-Q2 | Refund claims can be opened by MD/Nitija; **only the MD** approves or rejects. Allocation approval is MD only (V8 says “MD”). |
| V8-Q3 | The 9-month guarantee is counted from the **handover** date (not the arrival date). |
| V8-Q4 | A service-charge “trigger” is reached when a candidate is at/after: Visa printed → *Visa Printed*; Verified arrival → *Arrived*; Confirmed joining → *Joined*. “Order confirmed” needs no candidates. |
| V8-Q5 | A fixed **per-order** service charge can be invoiced once, after any worker reaches the trigger. |
| V8-Q6 | A task is flagged “escalate” when 3 days past due. Staff may only assign tasks to themselves. |
| V8-Q7 | The refund formula is the one written in V8: full fee less government fees in months 0–2; then 15% of the fee per month beyond month 3, up to month 9; plus government fees; reasons marked “Other / disputed” give no number. **Not legally verified.** |

## 4. What still needs a decision or an outside service

1. **MFA** — pick authenticator app (free) or SMS/e-mail (paid).
2. **WhatsApp / e-mail** — needs an approved provider account, templates and consent.
3. **Off-site encrypted backups and restore tests** — needs a destination (client cloud bucket) and a schedule; the files folder and `DATA_KEY` must be part of it.
4. **Virus scanning** — install ClamAV (or a cloud scanner) and implement `scan()`.
5. **PostgreSQL** — confirm whether it is really required, or whether MySQL/MariaDB is acceptable.
6. **Branded invoices, receipts, credit notes, PDF/print** — needs the client’s templates, VAT rules and numbering.
7. **Import for the new modules** (sponsors, vacancies, placements, contracts, tasks) and import **rollback**.
8. **Date-range and owner filters**, background jobs for large files.
9. **Legal review** of the domestic refund rule and price caps before the domestic division goes live.
10. **Candidate passport encryption** vs duplicate detection; retention policy.
11. **Per-candidate costing and profitability**, Nepal QAR 1,500 arrival charge automation, partner commissions, transfer reconciliation.
12. **Written, itemised scope and price** (V8 §10) — this build should be compared against it before any payment milestone.

## 5. Technical notes

* New tables (migration `20261106000000_v8_modules`, additive — no existing table or data was dropped): `domestic_accounts`, `receivable_payments`, `refund_claims`, `corporate_vacancies`, `corporate_placements`, `placement_fees`, `service_fee_terms`, `service_fee_invoices`, `finance_allocations`, `contracts`, `contract_versions`, `tasks`, `interview_entries`; `domestic_cases` gained the sponsor profile columns.
* Money lives only in tables read through code that checks `finance.view`; pages for staff never query them.
* New environment values (optional in development): `DATA_KEY` (base64, 32 bytes — encrypts QIDs and files; falls back to a key derived from `SESSION_SECRET`), `STORAGE_DIR` (default `./storage`, git-ignored).
* Tests: `npm test` (56 unit tests incl. business rules and the XLSX writer), `npm run test:db` (V6 rules against MySQL), `npm run test:v8` (V8 rules against MySQL — about 75 checks), plus browser checks as MD and as Operations Staff.

## 6. Follow-up fixes after the side-by-side review with the client's file

| Gap found | Fix |
|---|---|
| Corporate companies had to be added under Client CRM and then appeared in the Blue-Collar client list | Every company now has a **Division** (Blue-Collar / Corporate / Both). Corporate Recruitment has its own **Corporate Companies** list with “+ New Company”. Corporate-only companies are hidden from Client CRM and from blue-collar forms; blue-collar orders and service charges refuse them, corporate vacancies refuse Blue-Collar-only companies (checked on the server). |
| Contracts could not be removed | **Archive / Restore** (Managing Director and Admin Manager). Archived contracts leave the active list, alerts and the expiry report; nothing is deleted and every file stays downloadable under “Archived”. |
| Overseas agencies existed only as typed names | **Agency Register** (name, country, contact, phone, e-mail). Allocations may still use any name; a registered agency cannot be deleted while allocations, candidates or orders use it. |
| Domestic worker categories and corporate job categories could only be changed in the code | **Settings → Editable lists**: add your own choices (and remove them again); standard choices stay. The forms accept the list as suggestions or free text. |
| No “Automations & Integrations” screen | New **Automations** screen listing what works, what is partly done, and what needs an outside service (e-mail, WhatsApp, virus scan, backups, MFA). |
| Screens only changed when you pressed refresh | Open screens re-read the data about once a minute (paused while a form is open). |
| Finance report buttons were shown to Operations Staff (the server already refused the download) | Hidden for users who may not download them. |

New migration `20261107000000_v8_segments_agencies` (additive): `clients.segment`, `contracts.archivedAt`, tables `agencies` and `list_items`. Demo data gains one Corporate-only company, two “Both” companies and three registered agencies.

## 7. Level-wise authorization (roles × modules)

Every screen belongs to a **module**; each role has one **level** per module: *No access* (menu item hidden, page/downloads/actions refused), *View only* (add/edit/delete buttons hidden and refused), *View + add/edit*, *Full (incl. delete)*. The Managing Director edits the matrix in **Settings → Roles & Access**; other roles see **My access**. Changes are saved at once and written to the audit log.

* Standard levels: Managing Director and Admin Manager = full everywhere; Operations Staff = view + add/edit on the operating modules, view-only on Reports, **no access** to Private Finance, Sponsor Payments & Refunds, Placement Fees, Service Charges and the Contract Library.
* Hard limits that the matrix cannot override: Operations Staff can never be given money or contract modules (V8 §5), and the Managing Director always keeps full access.
* Enforced on the server: one check in the app layout for every screen, plus checks in every write action (add/edit need *edit*, delete needs *full*, stage moves, approvals, archive), the import, CV, export and contract APIs. Hiding the buttons is only a convenience.
* Existing rules still apply on top (for example only the Managing Director approves refunds and deposit allocations).
* Staff previously could delete records; with the standard levels they can add/edit but not delete — raise a module to *Full* if the client wants staff to delete.
* Tests: `tests/access.test.ts` (rules) and the “roles & access” block of `npm run test:v8`.

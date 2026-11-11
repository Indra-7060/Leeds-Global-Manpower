# V6 vs V8.7 — Complete Comparison

**Inspected sources (read in full, not from screenshots)**

| Version | File | Size | Notes |
|---|---|---|---|
| V6 | `Leads_Global_ERP_V6_Recruitment_Reports_Demo/Leads_Global_ERP_V6/index.html` (+ `START_HERE.txt`) | 66 KB, 118 lines | one HTML file; labelled "V5/V6 DEMO" in its own header |
| V8.7 | `Leads_Global_ERP_V8_7_Domestic_Section_Warranty (1).zip` → `index.html`, `README.txt`, `DEVELOPER_REQUIREMENTS.md` | 30 KB, 49 lines | one HTML file; header text still says "Editable demonstration V8.6" |

Read-only copies used for this analysis are in `source_copies/` (the originals in *Downloads* were not modified).

> **Important finding about "our developed V6".** The V6 file in Downloads is a **client-style demonstration**, not a working application: almost every number and table is hard-coded (see §2). The only genuinely working V6 parts are the finance cashbook, the candidate "Next Stage" demo button, the sample-order form, the CSV/XLSX import centre, the CV intake list and the keyword report. Our earlier work (the static prototype and the Next.js + MySQL application) went well beyond this file. This report compares the **files** as instructed; where our later builds differ, that is stated separately in §8.

**Classification key** — EW = Existing and working · MV6 = Missing in V6 · NEW = Newly added in V8.7 · CH = Changed in V8.7 · INC = Present but incorrectly implemented · IMP = Needs improvement · CLR = Requires client clarification.

---

## 1. Structural summary

| | V6 | V8.7 |
|---|---|---|
| Purpose | Management-style demo with sample data | Editable data-entry prototype |
| Data | Hard-coded arrays; `orders`(4) and `candidates`(4) in memory; finance in `localStorage lgm_v4_finance_demo`; import data in `lgm_v5_trial_records` | Everything in one `localStorage` key `lgm_erp_v84`, 11 tables: `clients, orders, agencies, allocations, candidates, accounts, documents, interviews, tickets, updates, warranties` |
| Divisions | `labour / domestic / corporate` — one static page each (`render`, L13/L22/L23) | `Blue-Collar / Domestic / Corporate` — every record carries `division`; lists, dropdowns and counts are filtered by it (`inDiv`, `filtered`, `clientOptions`) |
| Records link by | free-text names | free-text names (client name, candidate name, agency name) — **not IDs** |
| Roles | "Demo role" dropdown (`changeRole`, UI only) | none |
| Reports | keyword filter, quick CSV chips, visa summary (hard-coded rows) | per-table CSV export only |

## 2. A. Dashboard structure

| Item | V6 | V8.7 | Class |
|---|---|---|---|
| Layout | navy sidebar (258 px) + white header + content; header carries the "Demo role" selector | navy header (with **Backup All Data** button) + navy sidebar (235 px) + content | CH |
| Sidebar | `v6RenderNav`: Dashboard, collapsible **Recruitment** → 3 divisions, Blue-Collar module list (11), Management (7) | `nav()`: Main Dashboard, 3 division buttons, Daily Data Entry, Clients/Sponsors, Orders, Agencies+Allocations (Blue-Collar only), Candidates & CVs, Daily Updates, Interviews, Tickets & Deployment, Warranty (renamed "Domestic Warranty (9 months)" in Domestic), Documents, Accounts | CH |
| Dashboard overview | tabs per division, **hard-coded** cards (`'18'`, `'1,240'`, `'324'`, `'186'`, `'32'…`) and a hard-coded pipeline array (L13) | `dashboard()` — counts computed from stored data (clients, orders, candidates, interview records, tickets, documents) + a division table (orders, Interviewed, QVC Completed, RTP, Ticket Booked, Deployed) | NEW (real counters) / INC in V6 (static) |
| Division-wise views | one static page per division | Domestic gets its own home (`domesticHome`); Blue-Collar and Corporate jump straight to the clients list | CH · IMP (no Blue-Collar/Corporate home) |
| Tables | static `table(head, rows)` | generic `table(k, rows)` built from `schemas`, with Edit/Delete/Open/Download | NEW |
| Forms | none (one sample-order form, finance form with element ids) | `edit()`/`submitForm()` build every form from `schemas` / `fieldsFor` | NEW |
| Navigation flow | menu → static page | client → profile page with stage counters → add requirement/candidate/accounts/documents; saving a client offers "Add requirement now?" | NEW |

## 3. B. Modules

| Module | V6 | V8.7 | Class / notes |
|---|---|---|---|
| Main Dashboard | static | computed counts + division table | NEW |
| Blue-Collar | module list, mostly static | filtered by `division==='Blue-Collar'`; agencies/allocations/ledger only here | NEW |
| Domestic | static case table (`DW-001…`) + workflow flow | landing page, warranty section, counts, register, worker requirement form, 9-month warranty | NEW |
| Corporate | "Future Division" text + fee calculator (`calc()`) | corporate order fields (vacancies, salary, package, fee basis, milestone), candidate `joiningDate`/`salary`; **no fee calculation** | CH · IMP · CLR |
| Clients / Sponsors | static register; "Sample Sales Visit" read-only | CRUD, `qid` for sponsors, profile page | NEW |
| Orders | in-memory `orders`; `addOrder()` (client, trade, qty, country) | full CRUD, three field sets (blue / domestic / corporate), required fields | NEW |
| Overseas Agencies | static table | CRUD (global, not division-scoped) | NEW · CLR (hidden for Domestic/Corporate) |
| Agency Allocations | static rows in agency page | CRUD with fee per deployed worker | NEW |
| Candidates & CVs | 4 in-memory rows + `advance(i)` "Next Stage" | CRUD, 23 fields, stage filter, drill-down from profile counters | NEW |
| Daily Data Entry | – | tile page + `updates` records; saving an update sets the candidate's current stage | NEW |
| Daily Updates | – | `updates` table (history of what was done) | NEW |
| Interviews | static events table | per-candidate interview records | CH |
| Tickets & Deployment | static coordination table + checklist | `tickets` records (flight, date, status) | CH |
| Accounts & Collections | **Private Finance** (cashbook, costing calculator) — working, restricted for "staff" (UI only) | `accounts` (invoice, payment received, expense, refund, deposit) + **agency receivables** ledger | CH — V6 finance (cashbook/costing/divisional accounts) is **not** in V8.7 → CLR |
| Documents & Uploads | CV intake *records* (files not stored) | file upload stored as base64 in `localStorage` (1 MB limit), download | NEW · INC (storage) |
| Warranty Management | static `WR-101/102` + 3-month labour note | generic warranty table; Domestic variant with 9-month calculation | NEW |
| Visits, Demand Letters, Visa Processing, All Clients Visa Summary, Credentials Register, Excel Import Centre, CV Intake, AI Reports | present (static or working demo) | **absent** | **Removed in V8.7 → CLR** (V8.7 is a data-entry prototype; the client may have narrowed scope) |

## 4. C. Business workflow

| Step | V6 | V8.7 |
|---|---|---|
| Client registration | static | `clients` form; saving offers to add a requirement (`submitForm`, L40) |
| Manpower requirements | `addOrder()` | `orders` (division-specific field sets: `domesticOrderFields`, `corporateOrderFields`) |
| Agency allocation | static | `allocations` (client + order + agency + qty + fee per deployed worker) |
| Candidate registration | 4 rows, no form | `candidates` form |
| Recruitment stages | 14 statuses (`CV Submitted … Warranty`) | **17 stages** (`CV Received, Interview Scheduled, Interviewed, Selected, Offer Issued, QVC Pending, QVC Completed, RTP, Visa Applied, Visa Printed, Ticket Pending, Ticket Booked, Arrived, Deployed, Handed Over, Joined, Rejected`) — **one list for all divisions** → CLR |
| Interview updates | static | `interviews` records **and** stage change via `updates` (two places; not linked) → IMP |
| QVC / medical | stage names only | stage + `qvcDate` field; **the date is not set by the stage change** → IMP |
| RTP, visa | stage names | stages + `rtpDate`/`visaDate` (manual) |
| Ticket booking / arrival | static | `tickets` records + stages `Ticket Booked/Arrived` + `ticketDate/flight/arrivalDate` fields (three overlapping places) → IMP |
| Deployment | static | `deploymentDate` = "Verified deployment date" drives agency earnings; stage `Deployed` is separate → **INC/CLR** (see §6) |
| Sponsor handover | – | `Handed Over` stage + `handoverDate` field; **not linked to warranty** → IMP |
| Daily follow-ups | – | `updates.nextAction/dueDate` stored but **no list of due follow-ups** → IMP |
| Accounts & payments | cashbook | `accounts`; ledger matches payments by client + agency only |
| Domestic warranty / complaints | static | warranty register, claim fields |

## 5. D. Data and functionality

| Aspect | V6 | V8.7 | Class |
|---|---|---|---|
| Form fields | few | 11 schemas, up to 23 fields (`schemas`, `domesticWarrantyFields`, `domesticOrderFields`, `corporateOrderFields`) | NEW |
| Required fields | finance (date, party, amount > 0), sample order | orders (client, nationality, trade, quantity), domestic quantity ≥ 1, domestic warranty (sponsor, worker, start, months ≥ 1), updates (client, candidate, date, stage) — **none for clients, candidates, agencies, accounts** | NEW · IMP |
| Dropdown options | statuses, payer lists inline | `options(type)`: division, stage, client (same division), agency, order (same division), candidate, payer, kind | NEW |
| Status values | 14 | 17 stages; claim status "Active/Open/Resolved/Expired" is only a **label** (free text) | CH · IMP |
| Calculations | costing calculator; fee calculator; visa summary totals | agency earned = deployed × fee; outstanding = earned − payments; warranty end; days remaining | NEW |
| Dashboard counters | hard-coded | computed from **current stage** only (no history) | NEW · IMP |
| Filtering / search | visa summary search only | client filter, stage filter, global text search (`JSON.stringify(r)` contains) | NEW |
| CSV import | V5 import centre: mapping UI, XLSX/CSV/TSV parse, dedupe keys, import log | `importCSV`: header check only, no validation, no duplicate check, division forced to the current one, "review for duplicates" | **V8.7 is weaker** → INC/IMP |
| CSV export | per report + finance | per table (`exportCSV`) | EW |
| JSON backup | `v5Backup` (partial: v5 store, finance, orders, candidates) — **no restore** | `backup()` + `restorePrompt()` (structure check, confirm, replace all) | NEW |
| Document uploads | CV intake metadata | base64 in `localStorage`, ≤ 1 MB | NEW · INC |
| Record relationships | none | by free-text names: renaming or deleting a client orphans orders/candidates; two candidates with the same name collide when an update is applied (`c.name===r.candidate`) | INC |
| Delete safety | – | `del()` has no reference check (confirm dialog only) | INC |
| Duplicate handling | import duplicate keys in V5 (`pp:`/`name:`) | none | MV6→IMP |
| Security | UI-only role switch | none (explicitly "not a secure multi-user ERP") | CLR |

## 6. E. Domestic warranty — detailed verification of V8.7

| Requirement | Where in V8.7 | Result |
|---|---|---|
| Domestic has its own landing page | `setDiv('Domestic')` → `domesticHome()` (L26, L33) | **EW** |
| Nine-month warranty prominently displayed | notice block "DOMESTIC WORKER WARRANTY — 9 MONTHS", sidebar item "🛡 Domestic Warranty (9 months)", default `months:'9'` | **EW** |
| Active warranty count | `active = w.filter(r=>r.end && r.end>=today)` | **EW** — but a *resolved* claim still counts as active; records without an end date count in neither list → IMP |
| Expired warranty count | `expired = end < today` | EW (stored `status` is not updated to "Expired") → IMP |
| Open complaint count | `claims = w.filter(r=>r.reason && r.status!=='Resolved')` | EW, but counts *expired* records with a reason as "open" → IMP |
| Sponsor warranty register | `table('warranties', w)` on the home page; "🛡 Sponsor Warranty" button on the client profile | **EW** |
| Worker-wise records | one record per worker (`candidate` field) | EW — `candidate` is a **name**, not linked to the candidate record |
| Automatic expiry calculation | `submitForm` (L40): `end = start + months`, day clamped to month end (e.g. 31 Aug + 9 → 31 May; 31 May + 9 months → 28/29 Feb) | **EW** — the field is read as "automatically calculated" but is still an editable input and is overwritten on save |
| Remaining days | `table()` (`Math.ceil((end−now)/86400000)`, "Expired" when ≤ 0) | EW — uses the browser's *current time* against UTC midnight, so the value can differ by one day depending on the time of day → IMP |
| Replacement tracking | `replacementCandidate` (name only), `claimType` free text | present, no validation, no link to the replacement worker record → IMP |
| Refund tracking | `refundAmount`, `resolutionDate` | present, no validation (negative amounts allowed), **not linked to Accounts** → IMP |
| Claim status management | free-text `status` | no controlled list, no history → IMP |
| **Start date rule** | field label "Warranty start / sponsor handover date"; README: "defaults to 9 calendar months after **verified sponsor handover**" | The start date is **typed manually**. The candidate form has a separate `handoverDate` and a separate `warrantyEnd` that are **not connected** to the warranty record. So the warranty is calculated from *whatever date the user enters*, which is meant to be the verified handover date. **→ CLR**: confirm whether the start must always equal the verified handover date, or may be a separately configured date. The new build keeps the field editable, pre-fills it from the candidate's recorded handover date, and flags any difference. |

## 7. Consolidated difference register

| # | Area | Difference | Source (V6 / V8.7) | Class |
|---|---|---|---|---|
| 1 | Data | V6 numbers are static; V8.7 counts are computed | `render` L13 / `dashboard` L30 | NEW |
| 2 | Data | V6 has no persisted business records except finance & imports | `lgm_v4_finance_demo`, `lgm_v5_trial_records` | MV6 |
| 3 | Divisions | V6 has two operating + one "future" division; V8.7 treats all three as operating | `v6Divisions` / `divisions` | CH |
| 4 | Stages | 14 (V6) vs 17 (V8.7); names changed (`Pre-Medical/QVC` → `QVC Pending/Completed`, `Client Review` removed, `Ticket Pending/Booked`, `Deployed`, `Handed Over`, `Rejected` added, `Warranty` removed) | `statuses` / `stages` | CH · CLR |
| 5 | Stages | One stage list for every division | `stages` | CLR (the client's workflows differ by division) |
| 6 | Modules removed | Visits, Demand Letters, Visa Processing, Visa Summary, Credentials, Import Centre, CV Intake, AI Reports, Private Finance | `menu` | CLR |
| 7 | Modules added | Daily Data Entry, Daily Updates, Accounts, Documents, Allocations | `nav()` | NEW |
| 8 | Linking | Names instead of IDs | all schemas | INC |
| 9 | Dashboard | Counters use *current stage* only; V8.7 itself warns history is needed | `profile()` note | IMP |
| 10 | Agency money | Earned = candidates with a `deploymentDate`, unrelated to the `Deployed` stage | `agentLedger`, `profile` | INC · CLR |
| 11 | Agency money | Payments matched by client + agency (not by allocation) | `agentLedger` | IMP |
| 12 | Corporate | Fee basis / milestone are free text; no calculation | `corporateOrderFields` | IMP · CLR |
| 13 | Domestic | Warranty not linked to handover, candidates or accounts | §6 | IMP |
| 14 | Import | V8.7 import has no validation or duplicate check | `importCSV` | INC |
| 15 | Documents | 1 MB base64 in localStorage | `submitForm` | INC |
| 16 | Delete | No reference check | `del` | INC |
| 17 | Security | none in either (V6: UI-only role switch) | – | CLR |
| 18 | V8 developer package | Contract library, tasks/alerts, finance restrictions, service charges, role matrix from the earlier V8 package are **not** in V8.7 | package vs V8.7 | CLR |

## 8. How our earlier developed builds relate (for completeness)

* The **static prototype** and the **Next.js + MySQL application** (this session) already include: real records, division tabs, sponsor/placement/service-charge modules, contract library, tasks, finance restrictions, XLSX export, role matrix, and Vercel deployment. They follow the **V6/V8-package** scope and are *not* a re-implementation of the V8.7 data-entry workflow (daily updates, per-division order forms, agency allocation ledger).
* The new **Leads_Global_ERP_Final** (this task) is a separate offline, browser-only build that follows **V8.7** and is built on the reusable core.

## 9. Items that need client clarification (nothing below was invented)

1. **Stage lists per division.** V8.7 has one list. The new build defines a *subset per division* (§ in the documentation) using only V8.7 stage names — please confirm or edit `project/config.js → stages`.
2. **Meaning of "verified deployment".** V8.7 pays agencies when `deploymentDate` is filled. The new build fills it when a daily update moves a candidate to *Deployed* (the update date is the verified date) and counts only candidates with that date.
3. **Warranty start date.** Must it always equal the verified handover date? (§6)
4. **Open complaint** definition and the allowed **claim status** values.
5. **Corporate placement fee**: basis options (0.5 / 1 month / custom) and due months are taken from V8.7 field labels; confirm the exact trigger (joining date vs invoice) and VAT treatment.
6. **Domestic and Corporate and overseas agencies.** V8.7 hides agencies/allocations outside Blue-Collar although candidates in every division have an `agency` field.
7. **Removed V6 modules** (visits, demand letters, credentials, CV intake, finance/costing): out of scope for V8.7 or still required?
8. **Finance rules** from V6 (Cash for Blue-Collar, QIIB for Domestic, MD approval of allocations) are not in V8.7.
9. **Roles and security** for the production system.
10. **Warranty for Blue-Collar** (V6 shows an "illustrative 3-month" labour warranty; V8.7's generic warranty form has manual dates).

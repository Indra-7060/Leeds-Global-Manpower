# 1. Technical Analysis of the Original V6

**Reference:** `Leads_Global_ERP_V6_Recruitment_Reports_Demo.zip` → `Leads_Global_ERP_V6\index.html` (65,985 bytes) + `START_HERE.txt`
**Original is untouched.** All new work lives in `LGM_ERP_V6_Developed\`.
**Method:** every line of the file was read; behaviour was then *executed* (the original's own scripts were run in a Node `vm` sandbox with DOM stubs, script: `tools/probe_v6.js`, output: `docs/01a_V6_probe_output.txt`) so that conclusions do not rest on the UI alone.

---

## 1.1 What V6 physically is

| Fact | Detail |
|---|---|
| Files | 1 HTML file. No separate CSS/JS, no images, no libraries, no backend |
| Layers | **V4** base page (lines 2–39) → **V5** import/CV/report block (40–78) → **V6** layer (80–118) that *monkey-patches* `render()` to add the grouped navigation and the "Reports & Excel" toolbar |
| Rendering | Vanilla JS building HTML strings; whole page re-rendered on every change |
| Storage | `localStorage` only: `lgm_v4_finance_demo` (finance entries), `lgm_v5_trial_records` (imports + CV intake log). **Orders, candidates, and every other table are in-memory only and reset on reload** |
| Security | None. "Role" dropdown (`md`, `nitija`, `staff`) only hides Finance for `staff`. START_HERE.txt and the footer state this honestly |
| Self-description | "Offline browser prototype with illustrative data. Not a secure production ERP." |

**Conclusion: V6 is a UI/workflow prototype, not a working system.** It is a good *specification of intent* (screens, stage names, flows, a few calculations), but most modules are static HTML.

---

## 1.2 Module inventory — what is functional vs. static

Legend: **F** = functional logic exists · **P** = partial · **S** = static HTML / hard-coded sample

| # | Module (V6 nav) | Status | What actually works in V6 | What is static / missing |
|---|---|---|---|---|
| 1 | Dashboard (3 division tabs) | **S** | Tab switching | All counters hard-coded (Open Orders 18, CVs 1,240, Visa Pipeline 324, Ready to Fly 186…). Verified: dashboard shows 1,240 while the store holds 6 candidates |
| 2 | Client CRM | S | — | Table + one read-only "sample visit" form |
| 3 | Visits & Follow-ups | S | — | Static table + pipeline diagram |
| 4 | Demand Letters | S | — | Static table + "required fields" diagram |
| 5 | Manpower Orders | **P** | "+ Sample New Order" form → appends to in-memory array | No edit/delete; not saved; ID = `ORD-`+(1001+length) (collides after any removal); status always `New Order` |
| 6 | Overseas Agencies | S | — | Static allocation table |
| 7 | Candidates & CVs | **P** | "Next Stage →" moves status one step along 14-stage list | Not saved; no add/edit/delete; imported candidates never appear here |
| 8 | Interviews | S | — | Static table |
| 9 | Visa / QVC / RTP | S | — | Cards (175/92/66/84) and table hard-coded |
| 10 | Deployment | S | — | Cards and checklist hard-coded |
| 11 | Tickets & Arrival | S | — | Static table + checklist |
| 12 | Warranty | S | — | Static table |
| 13 | Domestic Workers | S | — | Static cases |
| 14 | Corporate (future) | **F** | Fee calculator: fee = basic salary × (100% or 50%) | Division explicitly "not yet operational" |
| 15 | Master Recruitment Report | **P** | Country filter, client search, totals row, "Remaining" column, CSV export | Source rows are 6 hard-coded arrays, unrelated to candidate data |
| 16 | Reports & Alerts | S | Open-link to Master report | 4 reports "Planned"; reminders are 3 static rows |
| 17 | Credentials Register | S | — | Placeholder (deliberately no secrets) |
| 18 | Private Finance | **F** | Add cashbook entry, division tabs, totals, CSV export, reset, **costing calculator** | No edit/delete; MD-approval, arrival-trigger, reversal rules are *text only* |
| 19 | Excel Import Center | **F/P** | CSV/TSV/XLSX read (own ZIP + `DecompressionStream`), column mapping with alias guess, duplicate skip, import history, JSON backup | See defects D-1…D-8 |
| 20 | CV Intake Center | **P** | File metadata log; TXT/EML/DOCX text → first e-mail + phone by regex | `extracted_name` is declared but never filled; PDF/ZIP not parsed; files not stored; no way to act on an intake row |
| 21 | AI Reports & Exports | **P** | Keyword router → CSV download. **Not AI** (V6 says so itself) | Keyword precedence quirks; no preview |
| V6 | "Reports & Excel" toolbar on every page | **P** | Client/Country/Stage filters + quick-report buttons + Import shortcut | 10 of 22 distinct quick-report buttons return nothing (see D-9) |

---

## 1.3 Data model as implemented / intended

### Entities and fields (taken from V6 tables, forms, import field lists)

| Entity | Fields seen in V6 | Source |
|---|---|---|
| **Order** | id (`ORD-1001`), client, country, trade, qty, status | orders array; import: + agency, order_id |
| **Candidate** | id (`BD-1001`, `NP-1003`), name, client, trade, country, status; import adds passport, agency, visa_number, qvc_date, flight_date, order_id | candidates array; `v5Fields.candidates` |
| **Finance entry** | date, division, direction, account, party, client, country, order, category, amount, ref, note | `addFinanceEntry` |
| **Client** | name, sector, stage (Active/Prospect), next action | CRM table |
| **Visit** | client, contact, date, outcome, next action (+ salesperson, notes, conversion "in production") | Visits table + CRM text |
| **Demand letter** | reference `DL-1001`, client, countries, trades, status; required: letter date, quantities, nationality, salary & benefits, signed letter, agency allocation | Demand page |
| **Agency allocation** | agency, country, order, allocated, CVs received, status | Agencies table |
| **Interview event** | client, method (Overseas Drive/Zoom/CV Selection), country, date, candidates, status | Interviews table |
| **Ticket/travel** | client, candidate, ticket by (Client/Agency), flight, pickup driver, status | Tickets table |
| **Warranty case** | `WR-101`, division, client, issue, status; start & expiry per candidate | Warranty table + notice |
| **Domestic case** | `DW-001`, worker origin, status, next action | Domestic table |
| **Credential record** | client, portal, record, access | Vault table |
| **CV intake item** | filename, size, type, received, source, client, agency, country, status, extracted_email/phone, preview | `v5CvUpload` |

### Relationships (all by **free-text name**, no keys)
Candidate→Client / Order / Agency are text. Nothing enforces that a client exists. `order_id` exists only as an import field.

### Candidate lifecycle (the only real state machine in V6)
```
CV Submitted → Client Review → Interview → Selected → Offer Accepted → Pre-Medical →
Visa Applied → QVC → RTP → Visa Printed → Deployment Ready → Arrived → Joined → Warranty
```
Only transition implemented: `advance()` = +1 along this list (stops at last). Notes in V6 text mark *Pre-Medical (if required)* and *QVC (if applicable)* as conditional ("country-specific exceptions") — but V6 cannot skip them.

### Order lifecycle
Diagram: Client Order → Country Allocation → Agency Sourcing → CV Review → Interviews → Selection → Offer → Visa → Deployment. Data uses `New Order`, `CV Review`, `Interview`, `Visa Processing`, `Deployment` — a **different vocabulary** from the diagram; nothing derives or changes it.

---

## 1.4 Calculations and rules that genuinely exist in V6

| Rule | Where | Formula |
|---|---|---|
| Master-report *Remaining* | visa-master | `Demand − (Applied + QVC + RTP + Printed + Deployed)`; note: "each candidate is counted in only one current stage" |
| Totals row | visa-master | column sums |
| Corporate fee | corporate | `salary × (1 or 0.5)` |
| Costing | finance | `Revenue = qty × rev/cand`; `Cost = qty × (client charges + [investment if "Additional expense"] + partner + other)`; `Profit = Rev − Cost`. Defaults: Bangladesh 2,500 / 4,000 / 300; otherwise 860 / 1,500 / 0 |
| Finance totals | finance | Σ incoming, Σ outgoing, net = in − out ("not accounting profit") |
| Default account | finance text | Blue-collar → Cash; Domestic → QIIB |
| Duplicate key | import | Candidate: passport, else name+client. Order: order_id+client+country+trade. Finance: date+ref+party+amount+direction. **Duplicates are skipped** |
| Stage sets | V6 report regexes | QVC Pending = `Visa Applied` or `QVC`; Flight Pending = `Visa Printed`/`Deployment Ready` and not Arrived/Joined; Arrived = Arrived or Joined |
| Role rule | everywhere | `staff` cannot see/import/export Finance |

**Business statements in text only (not implemented in V6):** Nepal candidate charge QAR 1,500 arises only on *verified Qatar arrival*; every manual advance allocation needs MD approval; agency advances stay unallocated liabilities; verified arrival creates the basis for an agency charge; labour warranty is an *illustrative* 3 months; domestic guarantee/refund rules "must be verified against current Qatar law"; corporate placement fee payment trigger "determined by the client agreement".

---

## 1.5 Defects and inconsistencies found (verified unless marked "code-read")

| ID | Severity | Finding |
|---|---|---|
| D-1 | High | **Imports are write-only.** Imported candidates/orders/finance go to `v5.*`; the Candidates, Orders and Finance pages read different arrays. Verified: after import `v5.candidates=1`, page `candidates=4`, imported name absent from the page |
| D-2 | High | **No validation on import.** Order qty `"abc"` accepted; candidate status `"Banana"` accepted; no date parsing; report regexes then silently mis-classify free-text status |
| D-3 | High | **Dashboard numbers are fiction.** Not computed from any record |
| D-4 | High | **Master report is static** (6 hard-coded rows); the Master CSV button exports those, while `v5ExportVisa` ("All Clients Visa Summary" on AI page) uses a *different column set* computed from candidates — two definitions of one report |
| D-5 | Medium | **Persistence:** orders/candidates edits lost on reload (verified: only `lgm_v5_trial_records` is written) |
| D-6 | Medium | **XSS:** Master-report search box and order/candidate fields are injected unescaped (verified: `<img onerror>` and `<b>` rendered live). Finance and import tables do escape |
| D-7 | Medium | **CSV defects:** page-button CSV (`exportVisaSummary`) does not quote fields (verified: company `Smith, Jones & Co` splits columns); no protection against spreadsheet formula injection (`=`,`+`,`@`) in any export |
| D-8 | Medium | **XLSX reader (code-read):** first sheet only; date cells arrive as Excel serial numbers (e.g. `45230`); `.tsv` handled by replacing tabs with commas (breaks quoted commas); cap 20,000 rows |
| D-9 | Medium | **Dead/wrong quick-report buttons (verified).** Return 0 rows by construction: *Candidate List, Agency Candidates, Agency Deployment, Warranty Cases, Domestic Worker Cases, Corporate Placements* (label is regex-matched against the *status* field), *QVC Completed, Rejected Candidates, Interview Attendance* (no such status/field exists). *Order Progress / Open Orders* export **candidate** rows, not orders. *Interview Schedule* searches candidate status instead of interview events |
| D-10 | Medium | Two different "Flight Pending" definitions: `v5FilteredCandidates` includes `RTP`; `v6ReportRows` does not |
| D-11 | Low | `Warranty` stage is excluded from the `arrived` count in `v5ExportVisa` → candidates vanish from totals after warranty starts |
| D-12 | Low | Master-report search re-renders the whole page on every keystroke and loses focus (code-read) |
| D-13 | Low | Dashboard Domestic "journey" has 6 steps; Domestic page workflow has 8; case statuses in sample (`Visa Processing`, `Handover`) match neither |
| D-14 | Low | Deployment and Tickets pages carry two overlapping checklists (6 vs 8 steps) |
| D-15 | Low | Backup exports JSON but there is **no restore** function |
| D-16 | Low | `<title>`/footer still say V5; V6 patches DOM text after render |
| D-17 | Info | `extracted_name` in CV intake never populated; PDFs not read |
| D-18 | Info | Finance page is in the Management group but role gating exists only in `render()`/import/export, not as a permission model |

---

## 1.6 Navigation and UX to preserve

* Left sidebar (dark navy `#102b48`, 258 px): Dashboard · **Recruitment** (collapsible) → *Blue-Collar / Domestic Workers / Corporate Recruitment*; under Blue-Collar the 11 modules; **Management** group: Master Recruitment Report, Reports & Alerts, Excel Import Center, CV Intake Center, AI Reports & Exports, Credentials Register, Private Finance.
* Header: company name, "Recruitment Operations Platform · Qatar", demo-role selector.
* Components: eyebrow + title + muted description, KPI cards (4-col → 2 → 1), white rounded panels, pill badges (green/orange/grey/red), flow chips with arrows, notices (amber), tabs.
* Every operational page starts with the V6 **"📊 Reports & Excel"** toolbar (Import Excel, Export Report, Client/Country/Stage filters, quick-report chips).
* Responsive breakpoints at 1100/800/760 px.

---

## 1.7 Verdict

V6 is a **clickable specification**. 3 modules have real logic (Finance, Import, Corporate calculator); everything else is illustrative. It must not be described as a production ERP. The development in this repository turns the **same screens, vocabulary, stages, fields and formulas** into a data-driven application (see docs 02–05), and the **production requirements** (backend, DB, authentication, permissions, secure file storage) are in `docs/06_Production_Requirements.md`.

---

## 1.8 Questions for the client (V6 is silent or contradictory — nothing below was invented as a rule)

Where a default was required for the software to function, it is isolated in `js/config/config.js`, marked **ASSUMPTION**, and listed in doc 06 so it can be confirmed or changed in one place.

| ID | Question |
|---|---|
| OQ-1 | Is **Rejected** a candidate status? From which stages? (V6 has a "Rejected Candidates" report but no such status.) What do **QVC Completed** and **Interview Attendance** mean in data terms? |
| OQ-2 | Which stages belong to the dashboard pipeline groups (CV Screening / Interviews & Selection / Visa Processing / Ready to Deploy)? |
| OQ-3 | When is an order **closed**? Does order status follow candidate progress automatically or is it set manually? |
| OQ-4 | Is *Visa Printed* part of "Ready to Fly"? (V6 has two conflicting Flight-Pending definitions: with and without RTP.) |
| OQ-5 | Does "Deployed" in the master report include candidates in **Warranty**? |
| OQ-6 | How is a candidate tied to an order — by `order_id`, or by client + country + trade? |
| OQ-7 | On duplicate candidates (same passport): skip (V6), update, or merge? |
| OQ-8 | Warranty: what starts the clock (arrival? joining?), exact labour period (3 months is "illustrative"), and the legally correct **domestic** guarantee/refund rules? |
| OQ-9 | Finance: should the QAR 1,500 Nepal charge, MD approval of advance allocations, reversals and reconciliation be automated? On what exact trigger? |
| OQ-10 | Domestic cases: customer, worker, contract, payment fields? Which workflow is right — 6-step (dashboard) or 8-step (page)? |
| OQ-11 | Corporate division: data model once it starts (vacancy, candidate, placement fee trigger)? |
| OQ-12 | Sales: how do visits/follow-ups convert to demand letters and orders? Follow-up scheduling rules? |
| OQ-13 | Demand letters: version history, scanned originals, approval chain, one-to-many link to orders? |
| OQ-14 | Agencies: allocation rules between agencies, separate agent portals, how to measure "CV quality"? |
| OQ-15 | Real user list and permission matrix (V6 only gates Finance). What can *Nitija* do that staff cannot? |
| OQ-16 | Passport/CV storage: retention, consent and data-protection requirements (Qatar PDPL)? |
| OQ-17 | Notifications: channel (e-mail, WhatsApp, in-app), recipients, schedule? |
| OQ-18 | Credentials register: approved secret-management product; who may reveal secrets? |
| OQ-19 | Real Excel layouts the staff use today (column names, multiple sheets, date formats) so mapping templates can be fixed. |
| OQ-20 | "AI Reports & Exports": keep the name (it is a keyword filter) or rename? Is a real AI assistant wanted at all? |
| OQ-21 | Formulas for the four "Planned" reports: Country-wise Recruitment, Agent Performance (incl. "CV quality"), Warranty Expiry (alert window), Demand & Sales Visits. |
| OQ-22 | Candidate ID prefixes for countries other than Bangladesh (`BD`) and Nepal (`NP`). |
| OQ-23 | Travel/deployment checklists: should completing a checklist step change the candidate stage? Who is responsible for each step? |
| OQ-24 | Currency: QAR only, or also BDT/NPR/INR/PHP/USD? |

# 2. Module-wise Functionality

Everything below is **implemented and tested** unless marked *not available*. Names, fields, stages and flows are V6's. Where V6 was silent, the default used is listed in doc 05 (Assumptions) and nothing was silently invented — see also doc 01 §1.8.

**How to read the status column:** ✅ working with real data · ➕ working, added to V6 (reason given) · ⛔ not available (needs a backend, or V6 gives no rule)

## 2.0 Cross-cutting behaviour (applies to every module)

| Capability | Behaviour |
|---|---|
| Registers | Every register table has **search**, **filters**, **Add / Edit / Delete** (with confirm dialog), record counts, empty-state messages |
| Validation | Same schema + rules for manual entry **and** import: required fields, whole numbers ≥ 1 for quantities, valid dates, allowed list values, unique client names, duplicate candidates |
| Stage control | Candidate stage changes only through the workflow buttons (see 2.7) — editing never changes the stage |
| Audit | Every add/edit/delete/stage change/import is written to an activity log (shown on *Reports & Alerts* and as *Recent Activity* on the Dashboard) |
| Persistence | Saved in the browser's `localStorage` on every change. Survives reload. (V6 lost orders/candidates on reload) |
| Workspaces | **DEMO** (fictional sample, seeded) and **LIVE** (starts empty) are stored under separate keys. Header pill + banner always show which one is active; export filenames carry `DEMO`/`LIVE` |
| Safety | All user text is HTML-escaped; CSV exports quote every value and neutralise `= + @ -` formula injection |
| Roles | Managing Director / Admin Manager (Nitija) / Operations Staff selector — **demonstration only, not authentication**. As in V6, only Finance is restricted for *Staff*; undo-stage, workspace switch, restore and reset are limited to MD/Nitija (assumption) |
| Reports toolbar | V6's "📊 Reports & Excel" bar is on every operational page: Import Excel, Export Report, Client/Country/Stage filters, quick-report chips. Shown on every page except Dashboard, Import, CV Intake, Credentials, Finance, Settings and Corporate (no data to report on) |

## 2.1 Dashboard — ✅
| Item | Source of the number |
|---|---|
| Open Orders | Orders whose stage is not *Closed* |
| CVs Received | All candidate records |
| Visa Pipeline | Candidates at Pre-Medical, Visa Applied, QVC, RTP |
| Ready to Fly | Candidates at Visa Printed or Deployment Ready |
| Pipeline bars | CV Screening (CV Submitted, Client Review) · Interviews & Selection (Interview, Selected, Offer Accepted) · Visa Processing · Ready to Deploy — mutually exclusive, share-of-total bars |
| Recent Activity | Last 7 entries of the activity log |
| Pending Actions ➕ | Top reminders (see 2.16) — V6 had none on the dashboard; added so alerts are visible |
| Domestic tab | Enquiries (cases), Profiles Shared (stage ≥ Worker Profiles), Visa Cases (Visa & Travel), Handovers (Arrival/Handover + Guarantee) |
| Corporate tab | V6 "future division" text + link |

## 2.2 Client CRM — ✅
Client register (name, sector, stage Active/Prospect, next action). Cards: Clients, Visits, Follow-ups (visits with outcome *Follow-up*), Orders Won (open orders). Row action **+ Order** pre-fills a new order for that client. **Rename** updates the name in every linked order/candidate/visit/demand. **Delete is blocked** while the client is used. ⛔ Salesperson targets / conversion analytics (V6: "production system will record…").

## 2.3 Sales Visits & Follow-ups — ✅
Visit register (client, contact, date, outcome, pipeline stage, next action, salesperson, notes). Outcome *Order Received* shows **Create order →**. V6's six-step sales pipeline is displayed. ⛔ Automated follow-up scheduling (OQ-12).

## 2.4 Demand Letters — ✅ (details) / ⛔ (documents)
Register with V6's required fields: client, linked order, letter date, countries, trades, trade-wise quantities, nationality, salary & benefits, signed (Y/N), agency allocation, status Received / Under Review / Approved. IDs `DL-1001…`. ⛔ Version history, scanned originals, approval chain (need file storage + backend; OQ-13).

## 2.5 Manpower Orders — ✅
Add / edit / delete orders (client, country, trade, quantity ≥ 1, stage, optional agency). IDs `ORD-1001…` — **never reused** after deletion (V6 re-used ids). Stage list: V6's data values + the flow diagram (New Order → … → Deployment) + *Closed*. Columns show **CVs linked** and **Deployed** per order, computed from candidates whose *Order* field is set. An order with linked candidates, allocations or demand letters **cannot be deleted**.

## 2.6 Overseas Agencies — ✅
Allocation register (agency, country, order, allocated qty, status). **CVs Received** = candidates with that agency and order. Warns if allocations exceed the order quantity. Status list = V6's "Agency Tasks" flow. ⛔ Separate agent portals (OQ-14).

## 2.7 Candidates & CVs — ✅
| Feature | Detail |
|---|---|
| Register | ID (`BD-1001`/`NP-…` style), name, passport, client, order, country, agency, trade, stage, visa no., QVC date, flight date |
| Duplicates | Blocked on **passport** (normalised) or, when there is no passport, **name + client** — V6's own rule, applied to manual entry and import |
| Stage buttons | **Next Stage →** (V6). **Skip →** over *Pre-Medical* / *QVC* (V6 notes "if required/applicable"). **Reject** only from CV Submitted / Client Review / Interview (assumption OQ-1). **Undo** returns one step (MD/Nitija) |
| Stage history | Each change stored with time and role; shown in the **View** dialog with the deployment checklist |
| Imported tag | Records created by import show "imported" and their source file/row |

## 2.8 Interviews & Selection — ✅
Interview events (client, method Overseas Drive / Zoom / CV Selection, country, date, candidate count, status Scheduled / Pending / Selected), plus live counts of candidates at Interview / Selected / Rejected. ⛔ Attendance (V6 defines no field; OQ-1).

## 2.9 Visa / QVC / RTP — ✅
Cards (Visa Applied, QVC, RTP, Visa Printed) are **current-stage counts**. Visa Tracking lists candidates from Offer Accepted to Visa Printed with V6's Action hints (Follow up / Track appointment / Plan ticket), visa number and QVC date, and the stage buttons. Candidate edit holds the visa details.

## 2.10 Deployment & Arrival — ✅
Cards: Ready to Fly, Tickets Pending, Arrival Notices, Arrivals Verified. A per-candidate **six-step checklist** (V6 steps) is *derived* from stage + travel record, so there is no second copy of the truth: visa printed · ticket requested · arrival notice · driver details · arrival verified · warranty started. Stage buttons here let staff mark *Arrived*, *Joined*, etc. ⛔ Automatic agency-charge on verified arrival (V6 gives it as text only; OQ-9).

## 2.11 Tickets & Arrival — ✅
Travel record per candidate (ticket by Client/Agency, flight details, flight date, pickup driver name & phone, status Pending → Request Booking → Flight Details Shared → Arrival Notice). One record per candidate. ⛔ Ticket copy / arrival-evidence upload (file storage).

## 2.12 Warranty & Replacements — ✅
Cases (division Labour/Domestic, client, candidate, issue, status following V6's 6-step workflow, start, expiry). **Labour expiry auto = start + 3 months** (V6 "illustrative"); **Domestic has no assumed period** — enter manually (V6: verify Qatar law; OQ-8). Expiry badge turns orange within 30 days, red when expired.

## 2.13 Domestic Workers — ✅ (tracking) / ⛔ (fees)
Cases (customer, worker origin, status = V6's 8-step workflow, next action) with **Next →**. Fees, payment timing, guarantees, refunds are *not calculated* (V6: "must be validated against Qatar law"; OQ-10).

## 2.14 Local Corporate — ✅ (calculator only)
Launch status **Not Started**; client fee calculator (basic salary × 100% or 50%). No data is kept: V6 says the division has not started (OQ-11).

## 2.15 Master Recruitment Report — ✅
Company-wise table **calculated from orders + candidates**: Order(demand), Applied, QVC, RTP, Printed, Deployed, **Remaining = Demand − Σ stages** (V6 formula), TOTAL row, 6 summary cards, country filter, client search (does not lose focus while typing), CSV export. Negative Remaining is flagged red (more candidates than ordered).

## 2.16 Reports & Alerts — ✅
* **Management Reports**: All Clients Visa Summary + the four reports V6 marked *Planned* — Country-wise Recruitment, Agent Performance, Warranty Expiry, Demand & Sales Visits — each with Preview and Export. (Formulas are assumptions, OQ-21.)
* **Reminders** (V6 had 3 static rows) are now rules over live data: confirm ticket responsibility · request ticket from client · ticket date missing · collect driver details · follow up QVC · sales follow-up · warranty expiring/expired · open warranty complaints · CV files awaiting review · candidates without an order.
* **Audit log**: latest 100 changes, exportable.
* ⛔ E-mail/WhatsApp/scheduled delivery of reminders (OQ-17).

## 2.17 Excel Import Center — ✅
1. Choose **.xlsx / .csv / .tsv** (worksheet picker for multi-sheet workbooks; Excel dates converted; `,` `;` tab delimiters detected).
2. Choose destination: **Candidates / Visa Status**, **Manpower Orders**, **Private Finance** (MD/Nitija only).
3. **Match columns** — auto-guessed with V6's alias lists; required columns marked ★ and enforced.
4. Preview first five source rows.
5. **Validate** — nothing is written yet. Result: *Ready / Duplicates / Rejected* with a per-row reason. Download the rejected + duplicate rows as a CSV to fix and re-import.
6. **Import** (confirm dialog). Rows land in the *same* registers the pages read; dashboards/reports update at once. Import history and a backup button are on the page.

Rules: candidate required = name, client, country, trade; status must be one of the lifecycle stages (blank → CV Submitted); orders need numeric quantity ≥ 1; finance needs valid date, direction, party, category, amount > 0 (unknown category → *Other* with the original kept in the note). Unknown countries are accepted (stored as typed). Re-importing a file adds nothing (duplicates skipped).

## 2.18 CV Intake Center — ✅ (log + extraction) / ⛔ (files)
Upload TXT, EML, CSV, DOCX, PDF, ZIP/RAR/7Z with source, client, agency, country. TXT/EML/CSV/DOCX: first e-mail and phone number extracted. PDF/archives are logged for manual handling. Row actions: **Create candidate** (opens a pre-filled form and marks the item *Candidate created*), **Reviewed**, **Ignore**, **Delete**. Same file twice is skipped. The files themselves are **not stored**. ⛔ Mailbox/WeTransfer automation, OCR, PDF parsing (backend).

## 2.19 AI Reports & Exports — ✅ (keyword filter, **not AI**)
Type a request or click a preset; the result opens as a preview **with an explanation of how it was understood** (report, client, country) and an Export button. Same precedence as V6 (finance → orders → QVC → RTP → flight → printed → arrived → joined → rejected → selected → warranty → domestic → all candidates), plus client/country detection. One-click exports and record counts. Finance requests are refused for Staff. Name kept from V6; see OQ-20.

## 2.20 Credentials Register — ✅ (descriptions only)
Register of *which* portal credentials exist (client, portal, description, "Authorized only"). The form **refuses text that looks like a password / OTP / PIN**. ⛔ Secret storage — requires an encrypted vault (doc 06).

## 2.21 Private Finance — ✅
Division tabs (Blue-Collar · Cash / Domestic · QIIB / Consolidated); cards Money Received, Money Paid, Net Cash Movement ("not accounting profit"), Transactions; inline entry form (V6 fields + categories); cashbook with search/filters/edit/delete; CSV export (MD/Nitija); clear-all with confirm; **costing calculator** with V6 defaults and formula; V6's accounting rules text. ⛔ Arrival-triggered QAR 1,500 charge, MD approval of advance allocations, reversals, reconciliation (V6 text only; OQ-9). *Staff* cannot see, import or export Finance.

## 2.22 Settings & Data — ➕ (V6 has no settings page)
Added because the requirements need it and V6's backup had no restore: **workspace switch**, **backup download / restore** (validated), **reset demo**, **clear workspace** (type DELETE), **data-quality checks** (unregistered clients with one-click add, candidates without order, orders without candidates, over-allocations, missing travel records, expired warranties), **read-only configuration** showing every assumption with its OQ id.

## 2.23 Not present in V6, therefore not built
Notifications beyond in-app reminders; user management / login; multi-currency; document storage; e-mail integration; any real AI. Listed in doc 05.

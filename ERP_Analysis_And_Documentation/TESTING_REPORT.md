# Testing Report

Date of run: 2026-11-11 · All data used in testing is fictional.

## Summary

| Suite | How it was run | Result |
|---|---|---|
| Leads Global ERP — business rules and data layer | `node tests/run.js` (Node v24.20.0, in-memory storage, same scripts the browser loads) | **93 / 93 passed** |
| Reusable template — framework, both example projects, blank starter | `node tests/run.js` in `Reusable_ERP_Master_Template` | **40 / 40 passed** |
| Browser tests (real UI: clicks, typing, file inputs) of Leads Global and both examples | Claude in-app browser (Chromium) on a local web address, see Part 2 | see Part 2 — every listed check passed |
| Opening from the file system (`file://`, no server) | headless Microsoft Edge on the real files | 4 / 4 pages rendered with no error |
| Storage-full and scale checks | scripted, see Part 3 | storage-full handled; scale limit found and documented |

**Honest scope statement.** "Passed" means the listed check was executed and gave the expected result in this environment. Items in Part 4 were **not** tested and must not be assumed to work.

---

## Part 1 — Automated tests

### 1.1 Leads Global ERP (93 / 93)

### A. Core data rules — 19 / 19

| Result | Test |
|---|---|
| PASS | IDs are sequential per table and prefixed |
| PASS | required field is rejected with a clear message |
| PASS | number, date and e-mail fields are validated |
| PASS | select values outside the allowed list are rejected |
| PASS | duplicate client name is blocked inside a division, allowed in another |
| PASS | duplicate passport is blocked; blank passport is not a duplicate |
| PASS | references must point to existing records |
| PASS | a record cannot reference a record of another division |
| PASS | division can never be changed after creation |
| PASS | delete is blocked while other records depend on the record |
| PASS | unused record can be deleted and the audit log records it |
| PASS | every create / update writes an audit entry |
| PASS | tracked fields keep a history (from → to) |
| PASS | failed batch leaves no half-written data |
| PASS | simulate() rolls everything back (import preview safety) |
| PASS | records survive reopening (storage adapter round trip) |
| PASS | when browser storage is full the save fails loudly, nothing is half-saved, and saving works again afterwards |
| PASS | the "ever reached" cache is never stale after a restore |
| PASS | unreadable stored data is refused, never silently overwritten |

### B. Blue-Collar workflow (daily update → stage → deployment → agency ledger) — 17 / 17

| Result | Test |
|---|---|
| PASS | stage list for Blue-Collar contains no Corporate/Domestic-only stage |
| PASS | a daily update changes the candidate stage and writes stage history |
| PASS | milestone date is filled from the update date, and never overwritten |
| PASS | Deployed update records the verified deployment date |
| PASS | a stage that does not belong to the division workflow is rejected |
| PASS | moving a candidate backwards, or out of Rejected, is allowed but warned; skipping stages is allowed silently |
| PASS | an update whose client does not match the candidate is rejected |
| PASS | follow-up due date before the update date is rejected; due date needs a follow-up text |
| PASS | a Domestic candidate cannot be updated from the Blue-Collar division |
| PASS | agency earned = verified-deployed workers × fee (and ONLY verified deployments) |
| PASS | payments linked to the allocation reduce the outstanding amount; unlinked ones are listed apart |
| PASS | deployments above the allocated quantity are flagged |
| PASS | an allocation must belong to the same client/agency as the payment |
| PASS | an agency can only be allocated once per order |
| PASS | "ever reached" keeps counting a candidate who has moved on; "current" does not |
| PASS | the latest update defines the open follow-up; older ones are superseded |
| PASS | order fulfilment counts verified deployments |

### C. Domestic warranty (9 months) — 16 / 16

| Result | Test |
|---|---|
| PASS | date arithmetic: calendar months with end-of-month clamp and leap years |
| PASS | sponsor handover update auto-creates a warranty: start = handover date, end = +9 months |
| PASS | the warranty runs from the verified sponsor handover date, not from any other date (arrival, ticket, today) |
| PASS | no warranty is created before the sponsor handover |
| PASS | warranty state: active / last day / expired are exact |
| PASS | editing start date or months recalculates the expiry automatically |
| PASS | a manually typed expiry date is ignored — expiry is always calculated |
| PASS | start differing from the recorded handover date is flagged for the client to confirm (not silently changed) |
| PASS | open complaint → resolved; counters follow |
| PASS | complaint date before the warranty start, or resolved before complaint, is rejected |
| PASS | replacement worker must be a different worker of the same sponsor |
| PASS | only one warranty per worker |
| PASS | refund amount without a refund claim type produces a warning |
| PASS | warranty belongs to Domestic workers only |
| PASS | Domestic workflow rejects Blue-Collar-only and Corporate-only stages |
| PASS | worker without a Domestic order field set uses Domestic fields (category list, no agency) |

### D. Corporate workflow and placement fees — 7 / 7

| Result | Test |
|---|---|
| PASS | Corporate stage list is Candidate → Interview → Selection → Offer → Joining (no visa/ticket stages) |
| PASS | Joined update records the joining date |
| PASS | fee basis: 1 month, 0.5 month and custom amount |
| PASS | custom fee amount is required when the basis is Custom |
| PASS | fee falls back to the order salary when the candidate has none; missing basis is reported |
| PASS | receivables: due = joining + invoice months; received reduces outstanding; overdue flagged |
| PASS | only Joined candidates appear in placement fees |

### E. Division isolation (no mixing) — 5 / 5

| Result | Test |
|---|---|
| PASS | each division has its own stage vocabulary and only its own fields |
| PASS | seeded dashboards count each division separately and add up to the global total |
| PASS | Blue-Collar agency ledger never includes Domestic or Corporate records |
| PASS | a candidate of one division cannot appear in another division's documents / interviews |
| PASS | Corporate has no ticket fields and Domestic warranty differs from the generic one |

### F. CSV import / export — 10 / 10

| Result | Test |
|---|---|
| PASS | template contains the field keys of the chosen division only |
| PASS | CSV parser handles quotes, commas, embedded newlines and BOM |
| PASS | preview classifies rows as new / duplicate / invalid with reasons, and writes nothing |
| PASS | commit adds only valid rows, atomically, with audit entry |
| PASS | linked columns accept the record name or id; unknown names are rejected |
| PASS | imported rows go to the chosen division only and respect its field set |
| PASS | day-first dates (DD/MM/YYYY) are converted; impossible dates rejected |
| PASS | file with no matching columns is refused; empty file is refused |
| PASS | export neutralises spreadsheet formula injection and round-trips through import |
| PASS | importing the app's own export gives duplicates, not double records |

### G. Backup / restore — 5 / 5

| Result | Test |
|---|---|
| PASS | backup → restore into an empty store reproduces every table, counters and history |
| PASS | a backup of another project is rejected and changes nothing |
| PASS | corrupt backups are rejected (not an object, missing data, duplicate ids, wrong list type) |
| PASS | dangling references in a backup are reported as warnings |
| PASS | restore replaces current data (does not merge) and is written to the audit log |

### H. Dashboard traceability (no static numbers) — 9 / 9

| Result | Test |
|---|---|
| PASS | every dashboard card value is a function of the data |
| PASS | every counter changes when the underlying data changes |
| PASS | overview totals equal independent counts of the raw tables |
| PASS | stage cards equal the number of candidates currently at that stage |
| PASS | agency totals equal an independent recomputation from candidates and accounts |
| PASS | seeded history proves the stage counters came from daily updates, not typed values |
| PASS | every alert is computed from data (none on an empty database) |
| PASS | every report returns rows consistent with its column keys |
| PASS | the counters left at 0 by the demo data react when their situation is created |

### I. Configuration sanity — 5 / 5

| Result | Test |
|---|---|
| PASS | every field of every division is well-formed (key, label, known type, refs exist) |
| PASS | no duplicate field keys inside one field set |
| PASS | every table column and filter points to a real field or computed column |
| PASS | every navigation item resolves to a table or report that exists |
| PASS | the core scripts contain no Leads Global / recruitment wording |

### 1.2 Reusable ERP Master Template (40 / 40)

### A. Core is generic — 3 / 3

| Result | Test |
|---|---|
| PASS | core files contain no Leads Global or recruitment-division wording |
| PASS | the Leads Global project's core copy is byte-identical to this template's core |
| PASS | no project-specific file is needed by the core (core loads with no project present) |

### B. Two example configurations are independent — 7 / 7

| Result | Test |
|---|---|
| PASS | different project ids, names, storage keys and currencies |
| PASS | different tables |
| PASS | different menus, dashboards and reports |
| PASS | different statuses / stages |
| PASS | one example has divisions (two pipelines), the other has none — same core handles both |
| PASS | field sets are different for the same scope concept (B2B vs B2C) |
| PASS | no table name or field of one example leaks into the other |

### C. Independent data — 5 / 5

| Result | Test |
|---|---|
| PASS | writing to one project never changes the other (separate stores, same process) |
| PASS | browser storage keys keep data apart (localStorage shim) |
| PASS | a backup of one project cannot be restored into the other, in either direction |
| PASS | each project's own backup round-trips |
| PASS | record ids are per project and per table (both start at 1) |

### D. Manpower Recruitment example — its own workflow — 7 / 7

| Result | Test |
|---|---|
| PASS | demo data loads through validation |
| PASS | interview Passed moves the candidate to Interviewed; Failed rejects; stages never move backwards |
| PASS | a future interview cannot already be Passed |
| PASS | placement marks the candidate Placed, fills the vacancy, and the fee = salary × 12 × % |
| PASS | a closed vacancy cannot receive a placement; a candidate can only be placed once |
| PASS | dashboard counters follow the data |
| PASS | delete protection: an employer with vacancies cannot be deleted |

### E. CRM / Lead Management example — its own workflow — 10 / 10

| Result | Test |
|---|---|
| PASS | demo data loads through validation and activities move the leads |
| PASS | pipelines are separate: a B2C lead cannot be moved to a B2B-only stage |
| PASS | Lost needs a reason; Won stamps the close date; reopening clears it |
| PASS | a won B2B deal needs a deal value |
| PASS | contact must work for the lead's company |
| PASS | pipeline value, weighted forecast, won value and win rate are exact |
| PASS | B2B and B2C counters never mix |
| PASS | next steps: only the latest activity of an open lead counts; overdue is flagged |
| PASS | CSV import works in a scoped example (rows go to the chosen pipeline) |
| PASS | CSV import works in the scope-less example |

### F. Blank starter + configuration sanity — 8 / 8

| Result | Test |
|---|---|
| PASS | the blank project boots, validates and round-trips |
| PASS | manpower: every field is well-formed and every ref / column / filter / nav target exists |
| PASS | manpower: every dashboard card is a function of the data |
| PASS | crm: every field is well-formed and every ref / column / filter / nav target exists |
| PASS | crm: every dashboard card is a function of the data |
| PASS | blank: every field is well-formed and every ref / column / filter / nav target exists |
| PASS | blank: every dashboard card is a function of the data |
| PASS | every report of both examples runs on seeded data and on empty data without error |

---

## Part 2 — Browser tests (executed in the real application)

Environment: Claude in-app browser (Chromium) at `http://127.0.0.1:3100/…` served by `tools/serve.js`; fictional demo data loaded with the app's own **Load fictional demo data** button. Checks were driven by real events (clicks, typing, file inputs) and read back from the page and the stored data.

| # | Test | Observed result |
|---|---|---|
| B1 | Empty first screen, then press *Load fictional demo data* | "Get started" panel shown; after loading, Main Dashboard shows 8 clients/sponsors, 9 orders, 18 candidates, 4 interviews, 3 tickets, 3 overdue follow-ups, 1 open warranty complaint, QAR 600 agency fee outstanding — identical to the Node calculation |
| B2 | Open the Domestic division dashboard | Workflow strip, Warranties active 3, Expiring in 30 days 1, Expired 1, Open complaints 1, handed over 4, refund amounts QAR 1,500, pipeline and warranty register present |
| B3 | **Daily update**: open *Daily update* on a candidate row | Form opens pre-filled (candidate, client, current stage, today's date). Setting stage *Interviewed* and saving: candidate stage became *Interviewed*; interview date filled from the update date; history shows stage and date events; message "…moved to Interviewed · interviewDate set to …" |
| B4 | **Documents**: save with nothing chosen / a `.exe` / a PDF | "Choose a file to upload." / "This file type is not allowed…" / PDF saved as DOC-0001 linked to the candidate and client; the file is stored in IndexedDB and was read back |
| B5 | **CSV import**: 4-row file (1 good, 1 duplicate of an existing client, 1 missing name, 1 bad e-mail) | Preview: 1 will be added, 1 duplicate skipped, 2 rejected, each with its reason. Confirm: exactly 1 client created (CL-0009) in the right division; audit entry "CSV import: 1 added, 0 failed" |
| B6 | **Delete protection** | Deleting a client with linked records is refused with the exact counts (1 order, 1 allocation, 4 candidates, 3 payments, 1 document, 1 interview, 1 ticket, 23 updates); the client remains. An unused client deletes normally |
| B7 | **Backup and restore** | Backup file contained 11 tables, 195 history events, 238 audit entries and 1 uploaded document. After deleting an interview and editing a client, restoring the file brought both back (4 interviews, original phone) and the document file was still retrievable. A backup from another project and a non-JSON file were both refused with a clear message; data unchanged |
| B8 | **Domestic warranty through the UI**: daily update *Handed Over* dated 2026-11-01 | Worker's handover date set; **warranty WR-0005 created automatically**: start 2026-11-01, 9 months, end 2027-08-01, status Active; "Warranties active" 3 → 4 and warranty count 4 → 5. In the warranty form the expiry field is read-only and recalculates live: start 31 May → 28 Feb 2027; 6 months → 30 Nov 2026. A complaint dated before the start is rejected inline. The stage drop-down for Domestic does not offer *Deployed* or *Joined* |
| B9 | **Dashboard traceability**: click every dashboard card that opens a list | 36 cards clicked; for 34 the number of records in the list equals the card. The other 2 are *sum* cards ("Workers required 19" = 6 + 10 + 3 over 3 orders; "Vacancies 6" = 2 + 3 + 1) which correctly open their 3 source orders |
| B10 | **Lists**: search, filters, sort, export, header tools | Typing "Echo" → 1 row; "nepali" → 5 rows; nonsense → "No records match these filters."; the address bar keeps the search. Stage filter *Deployed* → 3; plus agency filter → 1; *Clear filters* → 8. Sorting by name ascending and descending verified. List CSV export: header row + 8 data rows; agency-ledger report CSV export correct. Header "search everything" found the candidate, ticket and 8 updates. Alerts bell showed 4 live alerts |
| B11 | **Mobile (375 px emulation)** | No horizontal page scroll; ☰ opens the menu and the dim background closes it; table scrolls inside its own container; add-form fits the screen in a single column. (Measured from the page; the emulated screenshots were too small to judge visually.) |
| B12 | **Example projects**: open Manpower and CRM, load demo data | Both load without console errors with their own menus/cards. Manpower: fees USD 2,998.8 (= 3,000 × 12 × 8.33 %), fill rate 33 %. CRM B2B: pipeline USD 130,000, weighted forecast USD 96,000, won USD 6,000, win rate 50 %; B2C has a different menu, cards and stages. Browser storage contained three separate keys, each tagged with its own project id and only its own tables |
| B13 | **Persistence** | After a full page reload the data, counters and pipeline were unchanged |
| B14 | **Opening from the file system** | headless Edge on `file://` for Leads Global, Manpower, CRM and Blank: all rendered the dashboard, no error panel |

---

## Part 3 — Robustness and scale checks (scripted)

| Check | Result |
|---|---|
| Browser storage full (adapter that throws on save) | The error reaches the caller; the new record, its id counter and its audit entry are all rolled back (1 client remained, counter 1, 1 audit entry); the next save works (CL-0002). Now also an automated test |
| 2,000 candidates + 6,000 daily updates in memory | **Before optimisation** the dashboard cards took 3.4 s and follow-ups 4.1 s; **after** the follow-up scan and the "ever reached" history scan were rewritten: all cards ≈ 33 ms, follow-ups ≈ 26 ms. Creating the 8,000 records took ≈ 39 s (each record is fully validated) |
| Size of that data set | ≈ 5.5 MB — **above the ≈ 5 MB browser storage limit**; in a browser the save would be refused (and rolled back). So the demo storage suits hundreds of candidates, not thousands. This is a limit of browser storage, not of the screens |
| Recipes in `CUSTOMIZATION_GUIDE.md` | Applied to a scratch copy: new stage + automatic milestone date, a field only for one division, a validation rule, 12-month warranty and switching automatic warranty off all worked |

---

## Part 4 — Not tested / known issues

**Not tested**
* Browsers other than Chromium-based Chrome/Edge (Safari, Firefox, older versions), and real phones/tablets (only an emulated 375 px width).
* Screen-reader / full accessibility audit (labels and focus outlines exist; no assistive-technology test).
* Printing layout; very large CSV imports; documents near the 5 MB limit; a document download click (the stored file was read back, the browser's save dialog was not observed).
* Two people using it at once, any network or server behaviour, real security properties (there are none in this build).
* The generic (manual-date) warranty for Blue-Collar/Corporate has no menu item; its data rules exist but were not exercised through the UI.
* User acceptance by the client; the clarification items in the documentation are unresolved by definition.

**Known issues / observations**
* Back-dated entries (e.g. the demo's history) show the warning "Update date is before the candidate was registered", because registration time is the real clock. It is a warning, not an error.
* Saving a document with **no file and no type** shows the file message first; the type message appears once a file is chosen.
* Stages can be skipped (as in V8.7). Going backwards or re-opening a Rejected candidate is allowed but warned.
* Deleting a daily update does not revert the candidate's stage (history keeps the event).

**Defects found and fixed during testing**
1. Backup validation crashed on a malformed table list and repeated "missing link" warnings once per division → made robust and de-duplicated.
2. The Blue-Collar "Agencies" card always showed 0 (agencies are not division-scoped) → fixed.
3. Core framework contained two recruitment-specific defaults ("candidates") → removed; now enforced by a test.
4. Dashboard follow-up and stage-history calculations were slow at thousands of records → rewritten (see Part 3).
5. "Refunds paid out" overstated the figure (it is the sum of refund amounts *recorded*) → relabelled.
6. No warning when an update moved a candidate backwards → warning added (with test).
7. Import template header generation and several test-fixture mistakes were corrected before the final run.

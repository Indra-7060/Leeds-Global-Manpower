# Data Flow Documentation

How data is stored, how records relate, how one entry ripples into other records, and where each dashboard number comes from.

## 1. Storage layout

| What | Where (demo build) | Notes |
|---|---|---|
| All records, history, audit, ID counters | `localStorage` key `lgm_erp_final_v1` (one JSON document) | ≈ 5 MB browser limit; one browser, one device |
| Uploaded document files | IndexedDB database `lgm_erp_final_files_v1` (falls back to memory if unavailable) | The record stores only `fileId, fileName, fileType, fileSize` |
| Your display name | `localStorage` key `erp_user_leads-global-erp-final` | convenience only |

Both are reached **only through the storage adapter** (`core/js/storage.js`): `load() / save() / clear()` for records and `put / get / remove / ids / clear` for files. Nothing else in the code touches the browser's storage — that is the seam where a server API replaces it.

Snapshot shape (`format: "erp-data"`, `schema: 1`, `projectId`): `{ counters, data: { clients[], orders[], … }, history[], audit[] }`.

## 2. Record identity and relationships

* Every record has `id` = table prefix + 4-digit counter: `CL-` clients · `ORD-` orders · `AG-` agencies · `AL-` allocations · `CAN-` candidates · `AC-` accounts · `DOC-` documents · `IV-` interviews · `TK-` tickets · `UP-` updates · `WR-` warranties. Counters only go up while the data is in use, so an id is never reused after a delete (a restore brings back the counters stored in the backup).
* Scoped tables carry `division` (fixed at creation).
* Links are ids, validated on save: the target must exist, and (for scoped tables) must be in the same division.

```
 Client/Sponsor/Company (clients) ─┬─< Orders ─┬─< Allocations >─ Agencies   (Blue-Collar)
                                   │           └─< Candidates >─ Agencies   (Blue-Collar)
                                   ├─< Candidates ─┬─< Daily Updates      ── moves ──▶ Candidate.stage & milestone dates
                                   │               ├─< Interviews
                                   │               ├─< Tickets
                                   │               ├─< Documents
                                   │               ├─1 Warranty (Domestic; start = handover)
                                   │               │      └─ replacementCandidate ─▶ Candidates
                                   │               └─< Accounts (Corporate fee, optional)
                                   └─< Accounts (invoices/receipts) ──▶ Allocation (Blue-Collar agency payments)
```

Consistency rules enforced by the system (not by the UI alone):

* an order, candidate, allocation, interview, ticket, update, warranty or payment must belong to the **same client** as the record it links to;
* an update's candidate must be in the update's division and the stage must belong to that division;
* an allocation's order must belong to its client; a payment's allocation must match its client and agency;
* a replacement worker must be a different worker of the same sponsor;
* a record that other records point to **cannot be deleted** (the message names how many and which tables).

## 3. What one daily update does (the central workflow)

```
 ▶ Save "Daily update"  (candidate, date, new stage, who, action, next follow-up + due)
   1. validate: candidate exists · same client · same division · stage ∈ division workflow · due ≥ date
   2. store the update (UP-nnnn)
   3. candidate.stage := new stage                      → history event {stage: old→new, update id, date, user}
   4. milestone date for that stage filled if empty     → history event {date field}
   5. division rule:  Domestic + "Handed Over"  → create warranty {start = update date, months = 9, end = start+9m, status = Active}
   6. persist everything in ONE atomic write (any failure → nothing is saved)
   ⇒ dashboard cards, pipeline, follow-ups, agency ledger and alerts are recomputed from the stored data on the next draw
```

Deleting an update does **not** revert the candidate (the stage history keeps the event); to correct a stage, post a corrective update.

## 4. Where every dashboard number comes from

None is typed. `current` = candidates whose stage equals the label; `ever reached` = distinct candidates whose stage history contains it.

**Main Dashboard**

| Card | Formula |
|---|---|
| Clients / Sponsors, Orders, Candidates, Interview records, Tickets, Documents | row count of the table, all divisions |
| Overdue follow-ups | candidates whose latest update has a next-follow-up with due date < today |
| Open warranty complaints | Domestic warranties with a reason and status ≠ Resolved |
| Agency fee outstanding | Σ(verified deployed × fee) − Σ(payments linked to allocations) |
| Division table | per division: orders; candidates; candidates currently at Interviewed / QVC Completed / RTP / Ticket Booked / Arrived / Deployed / Handed Over / Joined ("—" if the stage is not in that division) |

**Blue-Collar**: Clients, Orders, Agencies (global), Allocations, Candidates, Interview records, Tickets, Documents = counts in the division · *Workers required* = Σ order quantity · *Verified deployed* = candidates with a verified deployment date · *Agency fee earned / paid / outstanding* = ledger totals · *Overdue follow-ups* · pipeline stage cards.

**Domestic**: Sponsors, Worker requirements, Workers, Interviews, Tickets, Documents = counts · *Handed over* = workers with a handover date · *Warranties active* = expiry ≥ today · *Expiring in 30 days* = 0 ≤ days left ≤ 30 · *Warranties expired* = expiry < today · *Open complaints* · *Handed over, no warranty* = handover date set but no warranty record · *Refund amounts recorded* = Σ refund amounts on warranties · *Overdue follow-ups*.

**Corporate**: Companies, Job requirements, Candidates, Interviews, Documents = counts · *Vacancies* = Σ vacancies · *Joined* = candidates at Joined · *Placement fees earned* = Σ fee of joined candidates · *received* = Σ payments linked to those candidates · *outstanding* = fee − received · *Overdue invoices* = joined candidates whose due date has passed with money outstanding · *Overdue follow-ups*.

Every card is a link: clicking opens the list of exactly the records behind the number (verified: for 34 count cards the list size equals the number; the two "sum" cards open their source orders).

## 5. Import, export, backup

| Flow | Steps | Safety |
|---|---|---|
| **CSV import** | choose table → file → headings matched by field key, label or alias → each row run through the *same* validation/hooks as the Add form inside a simulated (rolled-back) save → preview → confirm → one atomic commit | duplicates and invalid rows are never written; problem rows can be downloaded; audit entry written |
| **CSV export** | any table / report → file named `table_division_date.csv` | cells starting `= + - @` are neutralised to stop spreadsheet formula injection |
| **JSON backup** | whole database + history + audit + (optional) document files | `format: "erp-backup"`, `projectId`, export date |
| **JSON restore** | file → format/project/structure/duplicate-id checks → summary → confirm → replaces everything | another project's backup, corrupt or non-JSON files are refused and nothing changes; dangling links are reported as warnings |

## 6. History and audit

* **History** (per record): written for tracked fields — candidates: stage and every milestone date; clients: status; orders: status; interviews: result; tickets: status; warranties: status and expiry. Each event: field, from, to, date/time, user, note, and (for stage changes) the update id.
* **Audit log**: create / update / delete / import / restore, with record id, summary, user and time (latest 5,000 kept).

## 7. Calculation notes

* Dates are plain calendar dates (`YYYY-MM-DD`); day counts and month additions are done in UTC, so the time of day or time zone never changes a result.
* Month addition keeps the day, clamped to the month's last day.
* Money is rounded to 2 decimals after each calculation; currency label QAR.

# Leads Global ERP — Final Build: Documentation

**What this is.** A working, browser-based recruitment ERP rebuilt from the client's latest reference (V8.7, "Domestic Section + Warranty"). It is **not** a picture of a dashboard: every number is calculated from the records you enter, every form validates, and the three divisions each keep their own workflow.

**Where it is.** `Leads_Global_ERP_Final/` → open `index.html` (double-click; no server or internet needed).

> **Read this first — limits of this build.** It is a *demonstration-grade, single-browser* application. Records and uploaded documents are stored in the browser on one computer. That storage is **not secure, not shared between people, not multi-user**, and is lost if the browser's site data is cleared. There is no sign-in and no role control. Do not enter real passport, QID, financial or confidential data. A production system needs a server database, authentication, role permissions, server-side validation, audit and secure document storage (see §9 and `REUSABLE_FRAMEWORK_DOCUMENTATION.md`).

---

## 1. Folder map

```
Leads_Global_ERP_Final/
  index.html                 ← open this
  core/                      ← LAYER 1: generic framework (copied from the template; never edited here)
    css/theme.css            layout + components
    js/util.js storage.js store.js importer.js ui.js app.js boot.js
  project/                   ← everything specific to Leads Global
    config.js                ← LAYER 2: divisions, tables, fields per division, menus, dashboard, reports
    logic.js                 ← LAYER 3: business rules (daily update, warranty, agency ledger, fees)
    seed.js                  fictional demo data
    project.css              colour overrides
  tests/run.js               93 automated tests (node tests/run.js)
  tools/gen-data-dictionary.js
```

## 2. How to use it

1. Open `index.html`. The first screen is the **Main Dashboard** (empty on first use).
2. Press **Load fictional demo data** to explore (all names, passports and amounts are invented), or start entering your own records.
3. Pick a **division** in the left menu (Blue-Collar / Domestic / Corporate). Each division has its own dashboard, menu, forms and reports.
4. Work down the division's workflow (see `MODULE_WISE_WORKFLOW.md`). **Use Daily Updates to move a candidate between stages** — that is the only way a candidate's stage changes (so the history is always complete).
5. **Settings & Backup** → *Download backup* regularly. Backups include documents.

Mobile / tablet: the left menu collapses into a ☰ button.

## 3. Architecture in one picture

```
  UI (core/js/ui.js, app.js, theme.css)      shows what config + data say, never contains business rules
        │ calls
  Store (core/js/store.js)                   IDs, validation, links, duplicates, history, audit, atomic saves, backup/restore
        │ uses                      ▲ rules from
  Storage adapter (core/js/storage.js)       project/logic.js (hooks) and project/config.js (fields, stages, cards)
  LocalStorage today → server API tomorrow
```

* **Separation:** UI draws; the Store enforces data rules; `logic.js` holds Leads Global's business rules; `config.js` declares fields/menus/cards. Changing a rule never means touching UI code.
* **Relationships by ID:** a candidate points to `CL-0003` and `ORD-0007`, never to a typed name. Renaming a client changes nothing else; two clients with the same name can't be confused.
* **Atomic saves:** an operation that touches several records (e.g. a daily update that also moves the candidate and creates a warranty) either fully saves or saves nothing.
* **History is kept:** stage, milestone dates, warranty status/expiry (etc.) write a from→to event with date, user and note. Audit log records every create / update / delete / import / restore.
* **Storage adapter:** the only browser-specific piece. It is isolated behind `load / save / clear` so a server API can replace it.

## 4. The three divisions (separate workflows)

| | Blue-Collar | Domestic | Corporate |
|---|---|---|---|
| Customer called | Client | Sponsor | Company |
| Request called | Order | Worker requirement | Job requirement |
| Candidate called | Candidate | Worker | Candidate |
| Uses overseas agencies / allocations | **Yes** | No | No |
| Tickets & deployment | Yes | Yes | No |
| Warranty | — | **9-month warranty**, complaint / replacement / refund | — |
| Money | Agency fee per verified deployment | Sponsor invoices/receipts, refund amounts | Placement fee per joined candidate |
| Final stage(s) | Deployed → Handed Over | Handed Over (starts warranty) | Joined |

Stage lists (all names come from V8.7's 17 stages; each division uses only the ones that fit its workflow):

* **Blue-Collar:** CV Received → Interview Scheduled → Interviewed → Selected → Offer Issued → QVC Pending → QVC Completed → RTP → Visa Applied → Visa Printed → Ticket Pending → Ticket Booked → Arrived → Deployed → Handed Over (+ Rejected)
* **Domestic:** CV Received → Interview Scheduled → Interviewed → Selected → Offer Issued → QVC Pending → QVC Completed → RTP → Visa Applied → Visa Printed → Ticket Pending → Ticket Booked → Arrived → Handed Over (+ Rejected)
* **Corporate:** CV Received → Interview Scheduled → Interviewed → Selected → Offer Issued → Joined (+ Rejected)

No division is forced into another's workflow; a stage that does not exist in a division is rejected by the system and shown as "—" on the Main Dashboard.

## 5. Status and calculation rules (what the numbers mean)

| Item | Rule | Source |
|---|---|---|
| Candidate's current stage | Set only by the **latest daily update** (the candidate record is updated automatically). | V8.7: "Daily updates change the candidate's stage" |
| Milestone dates | When an update reaches Interviewed / QVC Completed / RTP / Visa Printed / Ticket Booked / Arrived / Deployed / Handed Over / Joined, the matching date on the candidate is filled from the **update date** — only if still empty (never overwritten; a warning is shown if different). | V8.7 fields; fill rule = development decision |
| Stage counters | **Current** = candidates whose current stage equals the label. **Ever reached** (shown in brackets) = candidates whose stage history contains it. | V8.7 note asked for history; both are shown |
| Verified deployment (Blue-Collar) | Candidate has a *Verified deployment date*. A daily update to **Deployed** sets it. | V8.7 earns on `deploymentDate`; trigger = development decision |
| Agency fee earned | Verified-deployed candidates (same order + agency) × *fee per deployed worker* of the allocation. | V8.7 |
| Agency fee paid / outstanding | Payments received **linked to the allocation**; outstanding = earned − paid. Payments with an agency but no allocation are listed separately, not silently matched. | V8.7 matched by client+agency; linking = improvement |
| Over-deployment | Verified deployed > allocated quantity is flagged. | new check |
| Domestic warranty start | A daily update to **Handed Over** records the sponsor handover date and **automatically creates the warranty with start = that date**. The start can be edited; if it differs from the recorded handover date the register shows "Start ≠ handover" so it can be confirmed. | V8.7 label "start / sponsor handover date"; *see clarification C3* |
| Warranty expiry | Start + warranty months (default **9**), calendar months, day clamped to month end (31 May + 9 months = 28 Feb). Always calculated, never typed. | V8.7 |
| Warranty active / expired | Active: expiry ≥ today (the **expiry date is the last covered day**). Expired: expiry < today. "Expiring soon": ≤ 30 days left. | V8.7 + clarification C4 |
| Open complaint | A complaint reason exists and the claim status is not *Resolved*. | V8.7 (without its expired-record quirk) |
| Corporate placement fee | Fee basis × candidate salary (falls back to the order's basic salary): 0.5 month, 1 month, or the custom fee. Earned when the candidate is **Joined**. Due date = joining date + "invoice due after joining (months)". Received = payments linked to the candidate. | V8.7 fields; formula = development decision |
| Follow-up | The *next follow-up* + due date of a candidate's **latest** update. A newer update replaces it. Overdue = due date before today. | development decision |
| Order "delivered" | Blue-Collar: verified deployed · Domestic: handed over · Corporate: joined. | development decision |

All dashboard cards and reports are functions of the stored records. `DATA_FLOW_DOCUMENTATION.md` lists the source of every card.

## 6. Features implemented

* Three divisions with their own menus, dashboards, forms (V8.7 field sets) and labels
* 11 tables: Clients/Sponsors, Orders, Agencies, Allocations, Candidates, Accounts, Documents, Interviews, Tickets, Daily Updates, Warranty
* Add / view / edit / delete everywhere; deletion blocked while other records depend on the record
* Search box (each list), filter drop-downs, sortable columns, paging, header "search everything", alerts bell
* Dashboard cards click through to the exact records behind the number
* Daily update → candidate stage + milestone date + history (+ warranty creation)
* Domestic: sponsor home page, warranty register, 9-month calculation, complaint / replacement / refund tracking
* Blue-Collar: allocation, agency ledger, over-deployment check
* Corporate: placement-fee calculation, due dates, overdue invoices
* CSV import with an exact preview (new / duplicate / rejected + reason) and one-step atomic commit; CSV export; CSV templates
* JSON backup / restore (data, history, audit, uploaded documents); wrong-project and corrupt files are refused
* Document upload (PDF, PNG, JPG, DOC, DOCX up to 5 MB) with type/size checks and download
* Duplicate handling (client name per division, passport, one warranty per worker, one allocation per order+agency, one interview per candidate per day)
* Audit log screen; per-record timeline (history + related updates)
* Responsive layout; keyboard-focus styles; labelled controls

## 7. Corrections made relative to V8.7 (and V6)

| # | Problem in the reference | What the final build does |
|---|---|---|
| 1 | V6 numbers are typed into the page | All numbers are computed (V6 was a static demo; see comparison report) |
| 2 | Records linked by **name** | Linked by **ID** with existence and same-division checks |
| 3 | CSV import had no validation / duplicate check | Full validation + duplicate detection + preview |
| 4 | Delete had no reference check | Blocked while linked records exist |
| 5 | Agency payments matched by client+agency only | Matched by allocation; unlinked payments shown separately |
| 6 | Warranty start not connected to the candidate's handover | Created from the handover automatically; differences flagged (rule awaits client confirmation) |
| 7 | "Auto-calculated" expiry was an editable box | Read-only, always calculated, previewed live |
| 8 | Remaining days used the current clock time (could be off by a day) | Calendar-date arithmetic in UTC; time of day never matters |
| 9 | Resolved claims still counted as "open"; expired records with a reason counted as open | Open = reason present and not Resolved |
| 10 | Counters used current stage only | Current **and** ever-reached |
| 11 | Documents stored as base64 in localStorage (1 MB) | Stored separately (IndexedDB), 5 MB limit, type checks |
| 12 | One stage list for all divisions | Division-specific subsets of the same stage names |
| 13 | Free-text statuses | Controlled lists (order, ticket, claim, interview, payer, transaction) |
| 14 | A failed save could leave half-written data | Atomic saves; storage-full errors roll back and are shown |

## 8. Items that need client confirmation (nothing here was invented silently)

| # | Question | What the build does meanwhile |
|---|---|---|
| C1 | Which of V8.7's 17 stages belong to each division? | Subsets in §4. Edit `project/logic.js → L.STAGES`. |
| C2 | What exactly makes a deployment "verified"? | A daily update to *Deployed* sets the Verified deployment date; only these count for agency fees. |
| C3 | Must warranty start **always** equal the verified sponsor handover date, or may it be a separately configured date? | Default = handover date; editable; any difference flagged. |
| C4 | Is the expiry date itself still covered? Is "30 days" the right "expiring soon" window? Which claim statuses are allowed? | Expiry = last covered day; 30 days; Active / Open / Resolved / Expired. |
| C5 | Corporate fee: confirm 0.5 / 1 month / custom, the trigger (joining vs invoice), VAT, and whether "month" means salary × 1. | Fee = factor × salary; earned at Joined; no VAT. |
| C6 | Do Domestic or Corporate also use overseas agencies/allocations? | No (as V8.7 shows them only for Blue-Collar). Agencies are a shared list. |
| C7 | Do Blue-Collar and Corporate have a warranty? (V8.7 shows a generic manual one.) | Hidden from the menu; the generic table still exists in the data model. |
| C8 | Are V6 modules still wanted (visits, demand letters, credentials, CV intake, costing)? | Not built — not in V8.7. |
| C9 | V6 finance rules (Cash / QIIB, MD approval)? | Not built — not in V8.7. |
| C10 | Roles, approvals and security for production? | None (demo). |
| C11 | Should refunds be posted to Accounts automatically? | Refund amount is recorded on the warranty case only. |
| C12 | Controlled values (order status, ticket status, document types, "Overseas Agent" etc.). | Reasonable lists chosen; V8.7's payer/transaction lists are exact. |

## 9. What remains incomplete / not provided

* **No real security:** no login, roles, encryption, server validation. localStorage / IndexedDB are neither secure nor multi-user.
* **One browser only:** data does not sync between computers; the backup file is the transfer mechanism.
* **Scale:** designed for hundreds of candidates. Tested in Node with 2,000 candidates + 6,000 updates: dashboards stayed fast (≈30 ms for all cards) but the data (≈5.5 MB) passes the browser's ≈5 MB storage ceiling, so storage would fail (the app reports it and saves nothing half-way). A server database removes this limit.
* **No integrations** (accounting, e-mail/SMS, government portals, e-sign) and no AI features.
* **No concurrency control** (two people editing the same record).
* **Not tested:** Safari/Firefox/older browsers, assistive-technology audit, printing layout, very large imports, real-user acceptance.
* Documents: the file *click-to-download* was not observed end to end (storage and retrieval of the file were).

## 10. Going to production (summary)

Replace `ERP.storage.LocalAdapter` with an adapter that calls a secure API; move `store.js` validation + `project/logic.js` rules to the server (same rules, authoritative); add authentication and role-based permissions; store documents in access-controlled object storage; keep the audit log server-side; schedule database backups. Details and an API sketch: `REUSABLE_FRAMEWORK_DOCUMENTATION.md §8`.

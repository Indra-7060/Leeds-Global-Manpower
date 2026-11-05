# 3. Data Flow & Architecture

## 3.1 Layers (and where each requirement lives)

```
 index.html ─ loads classic <script> files in dependency order (no build step, works from a double-click or any static host)

┌────────────────────────── UI ──────────────────────────┐   js/ui/components.js   badges, tables, modal, toast, confirm
│ pages (22)  ←→  generic CRUD / form builder             │   js/ui/crud.js         search, filters, add/edit/delete, forms
│ app shell: router, navigation, header, toolbar          │   js/ui/pages/*.js      one file per module group
└──────────────▲───────────────────────────┬──────────────┘   js/ui/app.js          bootstrap, V6 navigation
               │ reads                      │ calls (never writes storage directly)
┌──────────────┴──── BUSINESS LOGIC (pure, no DOM) ────────┐   js/domain/lifecycle.js  stage rules
│ metrics   alerts   lifecycle   rules                     │   js/domain/rules.js      duplicates, integrity, cascades
│ (every counter, report row, reminder is computed here)   │   js/domain/metrics.js    dashboard/report numbers
└──────────────▲───────────────────────────┬──────────────┘   js/domain/alerts.js     reminders
               │                            │
┌──────────────┴──── STORE (single gateway) ───────────────┐   js/core/store.js      validate → rules → save → audit → notify
│ insert / update / remove / moveCandidate / workspaces     │   js/core/schema.js     fields, types, validation
│ backup & restore                                          │   js/core/permissions.js demo roles
└──────────────▲───────────────────────────┬──────────────┘
               │                            │
┌──────────────┴──── STORAGE ADAPTER ───────▼──────────────┐   js/core/storage.js    ONLY file touching localStorage
│ get / set / remove  (memory fallback if storage blocked)  │   → replaced by an API client in production
└───────────────────────────────────────────────────────────┘

IMPORT / EXPORT / REPORTS (side modules, use Store + Schema)
  js/io/csv.js xlsx.js importer.js exporter.js cv.js     js/reports/reports.js (one report registry)
CONFIGURATION   js/config/config.js   every list, stage, mapping, default, permission (assumptions tagged)
DEMO DATA       js/data/seed.js       100 % fictional; only ever loaded into the DEMO workspace
```

**Rule of the architecture:** pages never write data; they call the Store. The Store never renders. Business formulas exist in exactly one place, so the dashboard card, the report, the export and the reminder can never disagree (this was V6 defect D-4/D-10).

## 3.2 Entities and relationships

```
Client ─┬─< Order ─┬─< Candidate ──< StageHistory
        │          ├─< AgencyAllocation          │
        │          └─< DemandLetter              ├── 0..1 TravelRecord (ticket, driver)
        ├─< Visit                                └── 0..n WarrantyCase
        └─< (Interview event, Credential record, Finance entry – by client name)
DomesticCase   FinanceEntry   CvIntakeItem   ImportRecord   ActivityLog   (stand-alone)
```
Links are by **name** for clients (as in V6) and by **id** for orders/candidates. Client rename rewrites names everywhere; deleting a client or order that is referenced is refused; deleting a candidate removes its travel record and unlinks warranty cases.

## 3.3 Candidate lifecycle (the main state machine)

```
CV Submitted → Client Review → Interview → Selected → Offer Accepted → Pre-Medical* → Visa Applied → QVC* → RTP → Visa Printed → Deployment Ready → Arrived → Joined → Warranty
                    └──────── Reject (assumption OQ-1) ────────┘                  (*optional: may be skipped)
```
Each move: `Lifecycle.moves()` decides what is allowed → `Store.moveCandidate()` appends to the candidate's history, writes the audit entry, saves, and notifies → the UI re-renders and **every counter recalculates** (Dashboard, Visa cards, Deployment cards, Master report, reminders).

### Where a candidate is counted
| Place | Stages included |
|---|---|
| Dashboard *CV Screening* | CV Submitted, Client Review |
| *Interviews & Selection* | Interview, Selected, Offer Accepted |
| *Visa Processing* / Visa Pipeline card | Pre-Medical, Visa Applied, QVC, RTP |
| *Ready to Deploy* / Ready to Fly card / Flight Pending report | Visa Printed, Deployment Ready |
| Master report *Applied / QVC / RTP / Printed* | Visa Applied / QVC / RTP / Visa Printed |
| Master report *Deployed*, Arrivals Verified | Arrived, Joined, Warranty |
| QVC Pending report | Visa Applied, QVC |
| Not counted in the pipeline | Rejected |

## 3.4 Write path (manual entry and import are the same)

```
Form / import row ──► Schema.validate (types, required, lists, dates)
                 ──► Rules.derive   (canonical country, warranty expiry, …)
                 ──► Rules.check    (duplicates, uniqueness, references, secrets guard)
                 ──► Store: assign id, history, timestamps ──► state ──► Storage (localStorage, key per workspace)
                 ──► Activity log ──► notify ──► UI re-render
   any failure ⇒ nothing written; field-level messages returned to the form / import report
```

## 3.5 Import path

```
file ─► Importer.readFile    CSV (delimiter auto-detect) | XLSX (zip → sharedStrings/styles/sheet; dates → ISO)
     ─► guessMapping         V6 alias lists, one column per field
     ─► user confirms mapping (required fields enforced)
     ─► Importer.analyse     per row: normalise → required → status/direction/category → Store.preview
                             └─ result: valid[] / duplicates[] / invalid[] (+ reasons)     ◄── DRY RUN, nothing written
     ─► user reviews, optionally downloads problem rows
     ─► Importer.commit      Store.insert for each valid row (silent audit per row, one summary entry) ─► one save ─► Import history
```

## 3.6 Report / export path

```
toolbar chip | Reports page | AI keyword box ──► Reports.run(name, state, filters{client,country,stage}, role)
      ──► definition.build(state) from live records ──► filters ──► {columns, rows}
      ──► Preview modal  or  Exporter.exportRows ──► Csv.stringify (quote all, neutralise formulas, BOM) ──► download
          file name: LGM_<DEMO|LIVE>_<Report>_<date>.csv
```

## 3.7 Workspace separation

```
localStorage keys:  lgm_v6dev_data_demo   ← seeded from js/data/seed.js on first run (fictional)
                    lgm_v6dev_data_live   ← starts empty; only user-entered/imported records
                    lgm_v6dev_prefs       ← selected role, last workspace
Switching saves the current workspace, loads the other, and returns to the Dashboard.
```
Demo data cannot reach live data (separate state objects and keys); exports and backups are labelled with their workspace; Reset-demo is refused in LIVE.

## 3.8 What the production data flow must change
The UI → logic → Store arrangement is deliberately the shape of a client/server system: replace `storage.js` with an API client and move `schema.js`/`rules.js`/`lifecycle.js` server-side (same functions, authoritative there). See doc 06.

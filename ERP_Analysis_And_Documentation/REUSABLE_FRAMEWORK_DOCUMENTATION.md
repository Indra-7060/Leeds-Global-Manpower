# Reusable ERP Framework — Documentation

`Reusable_ERP_Master_Template/` is a generic, configuration-driven ERP shell. Leads Global ERP is one project built on it; two other example projects and a blank starter ship with it to prove the core is not tied to manpower workflows.

## 1. Three layers

| Layer | Folder / file | Contains | Must NOT contain |
|---|---|---|---|
| **1 Core framework** | `core/` | store (data rules), storage adapters, CSV importer, UI components, router/views, boot, theme CSS | any company name, division name, field name, stage, rule or label of a specific business |
| **2 Project configuration** | `projects/<name>/config.js` (+ `project.css`) | name, currency, storage keys, scopes (divisions/pipelines/branches), tables and fields (per scope), lists, columns, filters, row actions, dashboard cards, reports, menus, tone map, alerts | DOM code, storage code |
| **3 Business logic** | `projects/<name>/logic.js` | rules as pure functions + hooks (`beforeSave`, `afterSave`, `beforeDelete`), metric functions used by cards/reports | DOM code, storage code |

Proof the core is generic (automated): the test suite fails if any file in `core/` mentions *Leads Global, Blue-Collar, Domestic, warranty, sponsor, QVC, manpower* or *candidate*; two different projects run on the same core in one process; and the Leads Global copy of `core/` is byte-identical to the template's.

```
Reusable_ERP_Master_Template/
  index.html                       launcher for the examples
  core/css/theme.css               layout, components, responsive, colour variables
  core/js/{util,storage,store,importer,ui,app,boot}.js
  projects/manpower/               Example 1 — Manpower Recruitment ERP (no divisions)
  projects/crm/                    Example 2 — CRM / Lead Management ERP (two pipelines: B2B, B2C)
  projects/_blank/                 smallest working project — copy to start
  tools/sync-core.js  tools/serve.js
  tests/run.js                     40 automated tests
```

Load order of a project page: `util → storage → store → importer → ui → app → boot` (core) then `logic.js → config.js → seed.js` then `ERP.boot(config, '#app')`. Plain `<script>` tags (no modules, no build step) so it runs from `file://`.

## 2. Core modules

| File | Namespace | Responsibility |
|---|---|---|
| `util.js` | `ERP.util` | escape, normalise, ISO-date maths in UTC (`addMonths`, `daysBetween`, `todayISO`), CSV parse/stringify with formula guard, money/rounding, download, debounce |
| `storage.js` | `ERP.storage` | `LocalAdapter(key)`, `MemoryAdapter()`, file stores `IndexedFiles(name)` / `MemoryFiles()` |
| `store.js` | `ERP.Store(config, adapter)` | records, ids, validation, links, duplicates, delete protection, history, audit, atomic `batch`, `simulate` (rolled-back dry run), JSON backup/validate/restore, subscribe |
| `importer.js` | `ERP.importer` | CSV `template`, `analyse` (exact preview), `commit` (atomic), `exportRows` |
| `ui.js` | `ERP.ui` | icons, `toast`, `modal`, `confirm`, `badge`, number/money/bytes formatting, `Form` (field-driven form engine) |
| `app.js` | `ERP.App(config, {store, files, mount})` | shell (sidebar, header, search, alerts), hash router, dashboard / list / report / import / settings / audit views, add-edit-view-delete, documents, backup & restore actions |
| `boot.js` | `ERP.boot(config, selector)` | wires store + files + app, falls back to memory if browser storage is blocked, refuses to overwrite unreadable data |

### Store API (what hooks and views use)

`list(entity, filter)` (object of equals / `{nonEmpty}` / `{in}` / `{not}`, or a function) · `get(entity,id)` · `count` · `byName` · `display(entity,rec)` · `fieldsFor(entity,scope)` · `optionsFor(field,scope,rec)` · `label(entity,scope)` · `create(entity,values,{scope,by,note})` → `{ok, record, warnings, notes}` or `{ok:false, errors:{field:message}}` · `update(entity,id,values,{by,note,historyExtra})` · `remove(entity,id)` · `usages(entity,id)` · `batch(fn)` · `simulate(fn)` · `historyOf(entity,id,field)` · `exportJSON()` · `validateBackup(obj)` · `restore(obj)` · `reset()` · `subscribe(fn)` · `history`, `audit`, `counters`, `raw`.

Save pipeline for every `create/update`: build record from the field list → per-field validation (required / type / range / allowed value / link exists & same scope) → duplicate check (`unique`) → `hooks.beforeSave` (may add errors, warnings, or adjust the record) → write → history for tracked fields → audit → `hooks.afterSave` (may update other records; it runs in the same atomic batch) → persist. Any exception rolls the whole operation back.

## 3. Configuration reference (`config.js`)

### Project
| Key | Meaning |
|---|---|
| `id` | unique id; a backup of one project can never be restored into another |
| `name`, `subtitle`, `currency` | shown in the sidebar / used for money formatting |
| `storageKey`, `filesKey` | browser-storage names (keep unique per project) |
| `scope` | `null` or `{ field, label, values:[…], default, colors:{value:'#hex'} }` — e.g. division, pipeline, branch |
| `lists` | named option lists, referenced by name from `select` fields |
| `tone(value)` | returns `good / warn / bad / info / ''` for coloured badges |
| `alerts(store)` | `[{tone,text,drill,scope}]` for the header bell |
| `userFields` | `{entity: field}` pre-filled with the user's name |
| `text`, `limitations` | wording overrides |
| `demo.seed(store)` | creates fictional records through `store.create` |

### Entity (`entities[key]`)
`label, plural, idPrefix, scoped, labels.byScope, display(rec,store), unique:[[fields]], track:[fields], upload:{maxBytes,accept}, fields, columns, computed, filters, actions, timeline`

* `fields`: an array, or `{ scopeValue:[…], default:[…] }` for scope-specific field sets (empty array = table not used in that scope).
* `columns`: array, or per scope. Entries: `'id'`, `'createdAt'`, a field key, or a key of `computed`.
* `computed[key]`: `{label, value(rec,store), tone(rec,store), drill(rec)}` — calculated column.
* `actions`: `[{id,label,when(rec,store),run({rec,store,ui,scope})}]` — extra row buttons (`ui.openForm`, `ui.showTimeline`, `ui.navigate`, `ui.toast`).
* `timeline.related`: `[{entity,field}]` shown in the record timeline.

### Field
`key, label, type` (`text · number · date · select · ref · email · textarea`) · `required` (true or `fn(rec,store)`) · `default` (value or `fn({scope,store})`) · `options` (array, list name, `fn({scope,rec,store})`) · `ref` (target entity) · `filter(target,rec,store)` (limit link choices) · `fills:{recKey:targetKey}` (auto-fill another field when a link is chosen) · `sameScope:false` · `min, max, integer` · `readonly` · `compute(rec,store)` (read-only, recalculated live) · `help, placeholder, computedHint, wide, hidden` · `aliases` (extra CSV heading names).

### Dashboard, menus, reports
* `home[scope]` / `overview`: `{ intro, cards, stageCards, panels, quick, notice, divisionTable }`
* **card**: `{ label, value(store, scope), format:'money', tone, drill }` — `value` is always a function (never a typed number). `drill`: `{entity, filter, filterFn, id}` opens a filtered list, `{report}` opens a report, `{view}`, with optional `scope` / `all`.
* `pipeline`: `{ entity, field, title, negative:[stages] }` + optional `pipelineReached(store, stage, scope)`
* `reports[id]`: `{ title, scoped | scope, note, columns:[{key,label,type:number|money|badge}], rows(store,scope) → [{…, tone, drill}], totals(store,scope) }` — shown on dashboards and as full pages; exportable to CSV.
* `nav`: `{ global:[…], scope:{ value:[…] }, tools:[…] }`; items `{view:'overview'|'home'|'entity'|'report'|'import', label, icon, entity, id}` or `{section:'Title'}`. Projects without scopes put everything in `nav.global`.

### Hooks (`config.hooks`)
* `beforeSave({store, entity, mode, values, old, scope}) → {errors:{field:msg}, warnings:[…]}` — may modify `values`.
* `afterSave({store, entity, mode, record, old, scope, opts}) → {warnings:[…], notes:[…]}` — may call `store.update/create`.
* `beforeDelete({store, entity, record}) → {errors}`.

## 4. UI component inventory (Phase 6)

| Component | Where |
|---|---|
| Layout (sidebar + header + main) | `app.js` shell, `.erp-shell .side .top main` |
| Sidebar / navigation / division switcher | `app.js sidebar(), navLink()`; icons `ui.icons` |
| Header: global search, alerts bell, user chip | `app.js topbar(), globalSearch()` |
| Dashboard cards (clickable KPI) | `cardsHtml()` `.kpi` |
| Pipeline strip | `pipelineHtml()` `.pstage` |
| Tables (sort, paging, badges, totals, row click) | `tableHtml()`, `listBody()` `.tbl` |
| Forms (all field types, inline errors, dependent drop-downs, live calculated fields) | `ui.Form` |
| Search / filters / drop-downs | list toolbar `#list-q`, `[data-filter]` |
| Badges / status colours | `ui.badge`, `config.tone` |
| Modals / confirm (typed confirmation option) | `ui.modal`, `ui.confirm` |
| Notifications | `ui.toast` (success / warn / error, stacked) |
| Import centre | `importView()` + preview modal |
| Export (CSV tables and reports) | `importer.exportRows`, report export |
| Document upload / download | `openForm` (upload block), `download()` |
| Reports | `reportView()`, `panelsHtml()` |
| Settings (backup, restore, demo data, delete-all, user) | `settingsView()` |
| Audit log | `auditView()` |
| Responsive behaviour | `theme.css` ≤ 900 px: off-canvas menu, 2-column cards, single-column forms |
| Theming | CSS variables (`--navy --accent …`) overridden in `project.css` |

## 5. The two example configurations (same core, different everything)

| | Manpower Recruitment ERP | CRM / Lead Management ERP | Leads Global ERP |
|---|---|---|---|
| Scopes | none (flat menu) | B2B, B2C | Blue-Collar, Domestic, Corporate |
| Tables | employers, vacancies, candidates, interviews, placements | accounts, contacts (B2B only), leads, activities | 11 tables |
| Stages | Sourced → Screened → Shortlisted → Interviewed → Offered → Placed / Rejected | B2B: New → Contacted → Qualified → Proposal → Negotiation → Won / Lost · B2C: New → Contacted → Interested → Won / Lost | per division |
| Workflow rule | interview Passed/Failed moves the candidate; placement marks Placed and fills the vacancy; fee = salary × 12 × % | activity can move the lead; Lost needs a reason; Won stamps the close date; forecast = value × stage weight | daily update; warranty; agency ledger; placement fee |
| Dashboard | employers, open vacancies, candidates, interviews, placements, fees, fill rate | per pipeline: pipeline value, weighted forecast, won value, win rate, overdue next steps | per division |
| Storage keys | `erp_example_manpower_v1` | `erp_example_crm_v1` | `lgm_erp_final_v1` |

Independence was tested (`tests/run.js` group B–C, and in a browser): different tables, menus, cards, reports, stages and field sets; writing to one never changes the other; separate storage keys; each backup carries its project id and cannot be restored into the other.

## 6. Rules for anyone extending it

1. Never edit `core/` inside a project. Fix it in the template, then run `node tools/sync-core.js <project-folder>`.
2. Put *rules* in `logic.js` and *declarations* in `config.js`. No DOM and no storage calls in either.
3. Every dashboard number is a function of the data.
4. Link records by id (`type:'ref'`), never by typed names.
5. Give every project its own `id`, `storageKey` and `filesKey`.

## 7. Known limitations of the framework

* Browser-only storage in this build (see §8 for the backend path).
* The `Store` keeps the whole database in memory and re-writes it on every save — suited to hundreds–low thousands of records.
* One user, no authentication, no roles, no concurrency control.
* Field types are limited to the seven above (no file-field inside arbitrary entities except via `upload`, no multi-select, no rich text).
* Report/table sorting is client-side and in-memory.

## 8. Backend-ready design (design only — NOT implemented)

The seams exist; the production pieces do not. Nothing here should be described as available today.

| Need | How the current design prepares for it | What a backend must add |
|---|---|---|
| **Secure database** | all persistence goes through the adapter (`load/save/clear`, file `put/get/remove`) | a database (PostgreSQL/MySQL) with one table per entity, ids as keys, foreign keys for `ref` fields, JSON columns for history/audit or their own tables |
| **Authentication** | `by` (user name) is already passed to every write | real accounts, sessions/tokens; replace the free-text name with the authenticated user |
| **Role-based access** | scope values and entities are explicit in config | permissions matrix *role × entity × action × scope* enforced **on the server**; hide UI actions accordingly (UI hiding is not security) |
| **Server validation** | `store.js` validation + `logic.js` hooks are plain JavaScript with no DOM (they run in Node in the test-suite) | run the same code (or an equivalent) in the API so the browser can never bypass a rule |
| **Audit** | the audit/history record shapes are defined | write them server-side, append-only, with the authenticated user and IP |
| **Secure document storage** | files are already separate from records and referenced by `fileId` | object storage (private bucket), signed URLs, virus scan, per-record access checks |
| **Backups** | JSON backup/restore format is defined and validated | scheduled database backups, point-in-time recovery, retention policy |
| **Multi-user** | atomic `batch` semantics | optimistic concurrency (a `version` column + `If-Match`), real-time refresh |
| **API** | `create / update / remove / list / batch` map 1-to-1 to HTTP | e.g. `GET/POST /api/{entity}`, `PATCH/DELETE /api/{entity}/{id}`, `POST /api/batch`, `POST /api/import/{entity}/preview|commit`, `GET /api/backup`, `POST /api/restore`, `POST /api/files` |

**Never claim** that the localStorage/IndexedDB build is secure, shared or multi-user. It is a single-browser demonstration.

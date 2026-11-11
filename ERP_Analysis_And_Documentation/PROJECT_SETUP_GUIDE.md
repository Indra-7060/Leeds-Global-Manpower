# Project Setup Guide

How to run the Leads Global ERP, and how to start a **new** ERP from the reusable template. No installation, build step or internet is required for either.

## 1. Run Leads Global ERP

1. Open the folder `Leads_Global_ERP_Final`.
2. Double-click `index.html` (Chrome, Edge — tested; other modern browsers should work but were not tested).
3. Press **Load fictional demo data** (optional).
4. Data is saved automatically in that browser. Use **Settings & Backup → Download backup** to keep a copy or move to another computer (**Restore backup** there).

To serve it over a local web address instead of `file://` (optional):

```bash
node ../Reusable_ERP_Master_Template/tools/serve.js . 3100
```

then open `http://127.0.0.1:3100/index.html`.

Run the automated tests (needs Node 18+):

```bash
node tests/run.js
```

## 2. See the template and its examples

Open `Reusable_ERP_Master_Template/index.html` — it links to:

* **Manpower Recruitment ERP** (`projects/manpower/`) — no divisions
* **CRM / Lead Management ERP** (`projects/crm/`) — two pipelines
* **Blank starter** (`projects/_blank/`)

Each keeps its own data in the browser (separate storage keys). Run the template tests:

```bash
node tests/run.js
```

## 3. Start a new ERP (from the blank starter)

1. **Copy** `Reusable_ERP_Master_Template/projects/_blank` to `projects/my_erp` (keep it inside `projects/` so `../../core/` still resolves).
2. Open `projects/my_erp/config.js` and change, in this order:
   * `id` (unique, e.g. `acme-erp`), `name`, `subtitle`, `currency`
   * `storageKey` and `filesKey` (unique, e.g. `erp_acme_v1`, `erp_acme_files_v1`) — **never reuse another project's keys**
   * `scope` — leave `null` for a flat system, or define divisions/branches/pipelines
   * `entities` — your tables and fields (see `CUSTOMIZATION_GUIDE.md`)
   * `reports`, `overview.cards`, `nav`
3. Open `projects/my_erp/index.html`: change the `<title>`; the script list already loads the core.
4. Optional business rules: create `logic.js`, define hooks, load it **before** `config.js`, and set `hooks:` in the config.
5. Optional demo data: create `seed.js` that exports `function(store)` calling `store.create(...)`, and set `demo.seed`.
6. Open `projects/my_erp/index.html` in the browser. Check the browser console (F12) for red errors.
7. Colours: edit `project.css` (only the `--navy / --accent` variables).

### Checklist before you hand it over

- [ ] unique `id`, `storageKey`, `filesKey`
- [ ] every dashboard card `value` is a **function** of the data
- [ ] every `ref` field points to an existing entity; every `columns` / `filters` entry exists
- [ ] statuses are `select` fields with a list (not free text)
- [ ] duplicates defined with `unique`
- [ ] a seed file with **fictional** data only; no real data in the repository
- [ ] write a small `tests/run.js` for your rules (copy the template's, it shows how to load the core + project in Node)
- [ ] state clearly to the client that this is single-browser demo storage

## 4. Make a stand-alone copy of a project (like Leads_Global_ERP_Final)

A stand-alone project folder contains its own copy of `core/` so it can be moved anywhere:

```bash
node tools/sync-core.js ../MyProject      # run inside Reusable_ERP_Master_Template
```

Create `MyProject/index.html` that loads `core/js/*.js` and `project/*.js` (see `Leads_Global_ERP_Final/index.html`). Re-run the command whenever the core changes. The template test checks that the Leads Global copy is byte-identical to the template core.

## 5. Publishing to a website

The project is plain static files: upload the folder to any static host (Vercel, Netlify, GitHub Pages, a web server). Remember: the data then lives in **each visitor's own browser** — there is no shared database. For a shared system follow the backend path in `REUSABLE_FRAMEWORK_DOCUMENTATION.md §8`.

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page | open the browser console; a script is missing or has a typo. `logic.js` must load before `config.js`, which must load before `seed.js` |
| "Saved data could not be opened" screen | the stored data is damaged or belongs to another project; download the raw data from that screen, or start empty |
| "Browser storage is blocked" toast | private window / blocked site data — nothing will be kept after closing |
| Data "disappeared" | different browser, different profile, different address (`file://` vs `http://`) or cleared site data — each has its own storage. Restore from a backup |
| Import says no columns match | use the **Template** button; headings are matched by field key or label |
| Backup refused | it belongs to another project (project id mismatch) — by design |

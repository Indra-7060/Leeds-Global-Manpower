# Customization Guide

Recipes for the most common changes. All edits are in a project's `config.js` / `logic.js` / `project.css` — never in `core/`. After editing, reload the page; run `node tests/run.js` to catch mistakes (it checks every field, link, column, filter and menu item).

The examples use Leads Global's files (`Leads_Global_ERP_Final/project/…`); the same applies to any project.

## Fields and tables

**Add a field to a table (all divisions)** — append to the field list in `config.js`:
```js
T('visaNumber', 'Visa number', { max: 30 }),
```
It appears in the form, the detail view, CSV template/import/export and search automatically. To show it in the list, add `'visaNumber'` to that entity's `columns`; to filter by it, add it to `filters`.

**Add a field to one division only** — put it in that division's list (entities with per-division fields use `fields: { 'Blue-Collar': [...], Domestic: [...], Corporate: [...] }`), or add `scopes: ['Domestic']` to a field that sits in a shared list.

**Make a field required / conditional** — `{ required: true }` or `{ required: rec => rec.stage === 'Rejected' }`.

**Add a drop-down** — add the list under `lists`, then `S('shift', 'Shift', 'shifts')` (or pass an array directly). Drop-down values are validated on save, so an imported "Banana" is rejected.

**Link to another table** — `{ key:'supervisor', label:'Supervisor', type:'ref', ref:'clients' }`. Limit the choices with `filter: (target, rec, store) => …`; auto-fill another field with `fills: { client: 'client' }`.

**Add a table** — add an entry to `entities` (`label, plural, idPrefix, scoped, fields, columns, filters`), then add a menu item `{ view:'entity', entity:'newTable', icon:'list' }` to `nav` (per division if scoped). `unique: [['a','b']]` blocks duplicates; `track: ['status']` keeps history.

**Rename labels** — change `label` / `plural` (per division: `labels.byScope`) and field `label`s. Keys stay the same so data and CSV headings keep working (old headings still match if you add `aliases: ['Old name']`).

**Calculated column in a list** — `computed: { _age: { label:'Age', value:(rec, store) => … } }` and put `'_age'` in `columns`.

## Statuses and stages

**Add a status to a list** — edit the array in `lists` (e.g. `orderStatus`). Add a colour in `tone`.

**Change a division's stages** (Leads Global) — in `project/logic.js` edit `L.STAGES['Domestic']` (the order of the array is the workflow order). New stage names must also be added to `L.ALL_STAGES`. To make a stage fill a date automatically, add it to `L.MILESTONE` (`'Medical Cleared': 'medicalDate'`) and add the `medicalDate` field to that division's candidate fields.

**Add a new division / branch / pipeline** — add the value to `scope.values` and `scope.colors`; add field sets for it in every entity that should exist there (empty array = not used); add `home[<value>]` and `nav.scope[<value>]`; add `L.STAGES[<value>]` if it has stages.

## Business rules

**Change the warranty period** — in `logic.js`: `L.WARRANTY_MONTHS = 12;` (new warranties default to it; each warranty can also be overridden on its form).

**Turn off automatic warranty creation** — `L.AUTO_WARRANTY = false;` (warranties are then added manually with the *Warranty* button on a handed-over worker).

**Change "expiring soon" from 30 days** — `logic.js → L.warrantyState` (`days <= 30`) and the dashboard label text in `config.js`.

**Change what makes a deployment "verified"** — `logic.js → L.MILESTONE`/`L.deployedCount`. For example, require a *Handed Over* date instead of *Deployed* by changing `deployedCount` to test `c.handoverDate`.

**Change the Corporate fee formula** — `logic.js → L.placementFee` (e.g. add VAT or a minimum fee) and the labels in `lists.feeBasis`.

**Add a validation rule** — in `logic.js → beforeSave`, add to `errors` (blocks the save, shown under the field) or `warnings` (saves, shows a notice):
```js
if (entity === 'candidates' && rec.passport && rec.passport.length < 6) errors.passport = 'Passport number looks too short.';
```

**Do something after a save** — `afterSave` (runs in the same atomic save; use `store.update/create`; return `{ notes:['…'] }` to show a message).

## Dashboard and reports

**Add a card** — in `home[<division>].cards` (or `overview.cards`):
```js
{ label: 'Visa printed', value: (s, sc) => L.stageCount(s, 'Visa Printed', sc), drill: { entity:'candidates', filter:{ stage:'Visa Printed' } } }
```
`value` must be a function. `format:'money'` formats as currency; `tone:'good|warn|bad'` colours it. `drill` makes it clickable (`{ report:'id' }` opens a report; `filterFn: rec => …` for custom filters).

**Add a report** — add to `reports`: `columns` (`type: 'number' | 'money' | 'badge'`) and `rows(store, scope)` returning plain objects; add `totals` for a total row; add it to a division's `panels` and `nav`. Reports export to CSV automatically.

**Add a header alert** — add to the array returned by `config.alerts(store)`.

## Look and feel

**Colours** — `project/project.css`:
```css
:root { --navy:#152b49; --navy-3:#35547c; --accent:#1766ac; --accent-2:#155e9f; }
```
Per-division accent colours: `scope.colors`.

**Currency / language of labels** — `currency` in the config; labels are plain text in the config. (There is no multi-language switch.)

**Logo letters / name** — `name` and `subtitle`.

## Data

**Start from empty** — set `demo.seed: null`, or use Settings → Delete all data.

**Reset the demo** — Settings → Load fictional demo data (replaces everything).

**Move data between computers** — Settings → Download backup → Restore backup on the other computer (same project only).

## Things you should not do

* Don't edit files under `core/` inside a project (re-sync would overwrite them; fix the template instead).
* Don't type numbers into a card; always compute them.
* Don't link records by typing names into text fields; use `type:'ref'`.
* Don't reuse `id` / `storageKey` between projects — two projects would overwrite each other's data.
* Don't put real personal or financial data into a demonstration build.

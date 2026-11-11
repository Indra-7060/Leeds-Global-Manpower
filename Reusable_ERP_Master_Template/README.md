# Reusable ERP Master Template

A generic, configuration-driven ERP framework that runs in a browser with no build step.

* `core/` — framework (data store, validation, CSV import, UI components, router, theme). Contains **no** business-specific wording; a test enforces this.
* `projects/manpower/` — Example 1: Manpower Recruitment ERP (no divisions)
* `projects/crm/` — Example 2: CRM / Lead Management ERP (two pipelines)
* `projects/_blank/` — smallest working project; copy it to start a new ERP
* `tools/` — `sync-core.js` (copy the core into a stand-alone project), `serve.js` (tiny local web server)
* `tests/run.js` — 40 automated tests: `node tests/run.js`
* `docs/` — framework documentation, setup guide, customization guide

Open `index.html` to launch the examples. Each project keeps its own data in the browser under its own storage key.

**Limits:** the shipped storage adapter is browser localStorage/IndexedDB — a single-browser demo. It is not secure, shared or multi-user. The backend-ready design (adapter seam, server validation, auth, roles, audit, secure files, backups) is described in `docs/REUSABLE_FRAMEWORK_DOCUMENTATION.md §8` and is **not implemented**.

# Leads Global ERP — Final

Browser-based recruitment ERP for the three divisions (Blue-Collar, Domestic, Corporate), rebuilt from the client's V8.7 reference.

**Run:** double-click `index.html` (no install, no internet). Optional demo data: *Load fictional demo data*.

**Important:** data is saved in this browser only. It is **not secure, not shared, not multi-user** and has no login or roles. Do not enter real personal or financial data. Use *Settings & Backup → Download backup*.

| Path | What |
|---|---|
| `index.html` | the application |
| `core/` | generic framework (copy of `Reusable_ERP_Master_Template/core`, do not edit here) |
| `project/config.js` | divisions, tables, fields, menus, dashboard, reports |
| `project/logic.js` | business rules (daily update, warranty, agency ledger, placement fees) |
| `project/seed.js` | fictional demo data |
| `tests/run.js` | 93 automated tests — `node tests/run.js` |
| `tools/` | generators for the data dictionary and testing report |

Documentation: `../ERP_Analysis_And_Documentation/` (start with `LEADS_GLOBAL_ERP_FINAL_DOCUMENTATION.md` or the short PDF).

# Leads Global ERP — V6 Developed

A working, data-driven version of the client's V6 dashboard. It keeps V6's design, navigation, vocabulary, stages, fields and formulas, and replaces V6's static/hard-coded screens with real records, validation, calculated counters, working imports/exports and demo/live data separation.

> **Status: offline browser prototype — not a production ERP.** Data lives in one browser only; there is no login, server, database or encryption; roles are a demo dropdown. Do not enter real passports, CVs, bank or credential data. See [docs/06](docs/06_Production_Requirements.md).

The original V6 (`Leads_Global_ERP_V6_Recruitment_Reports_Demo.zip`) is **untouched** (verified byte-identical).

## Run
* Double-click `index.html` (Chrome/Edge), **or** `node tools/serve.js` → http://127.0.0.1:5173. No install, no build, no internet.
* *(Launching by double-click was not observable in the test environment — see doc 04 §4.5.)*

## Documentation (the six deliverables)
| # | Document |
|---|---|
| 1 | [Technical analysis of the original V6](docs/01_Technical_Analysis_of_V6.md) · [probe output](docs/01a_V6_probe_output.txt) |
| 2 | Complete source code — this folder |
| 3 | [Module-wise functionality](docs/02_Module_Functionality.md) |
| 4 | [Data flow & architecture](docs/03_Data_Flow.md) |
| 5 | [Testing report](docs/04_Testing_Report.md) (generated from real test runs) |
| 6 | [Remaining requirements, assumptions, deviations](docs/05_Remaining_Requirements.md) · [production requirements](docs/06_Production_Requirements.md) |

## Source layout
```
index.html                     loads the scripts below in dependency order
css/styles.css                 V6 look preserved + additions (modal, forms, toasts)
js/config/config.js            every list, stage, mapping, default (assumptions tagged ASSUMPTION / OQ-n)
js/core/                       util · storage (only localStorage user) · schema · permissions · store (single write gateway)
js/domain/                     lifecycle · rules · metrics · alerts      ← business logic, pure, unit-tested
js/io/                         csv · xlsx · importer · exporter · cv     ← data processing, import/export
js/reports/reports.js          one registry of reports
js/data/seed.js                fictional demo data
js/ui/                         components · crud · pages/* · app          ← presentation
tests/                         run-tests.js (logic) · e2e-browser.js (UI) · xlsx-builder.js · harness.js
tools/                         serve.js (optional static server) · probe_v6.js · make-test-report.js
docs/                          deliverable documents
```

## Tests
```bash
node tests/run-tests.js              # 65 logic tests, no dependencies
node tools/serve.js                  # then run tests/e2e-browser.js in the page: await LGM_E2E.run()  (97 checks)
node tools/make-test-report.js       # regenerate docs/04_Testing_Report.md from the result files
```

## Open questions
V6 is silent or contradictory on 24 business rules. None were invented silently: each default is in `config.js`, shown in *Settings & Data → Configuration in force*, and listed with its question in [doc 01 §1.8](docs/01_Technical_Analysis_of_V6.md) and [doc 05 §5.2](docs/05_Remaining_Requirements.md).

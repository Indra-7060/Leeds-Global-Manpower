// Builds ../ERP_Analysis_And_Documentation/TESTING_REPORT.md from the two tests/results.json files (so automated numbers are never typed by hand).
//   node tests/run.js ; (cd ../Reusable_ERP_Master_Template && node tests/run.js) ; node tools/gen-test-report.js
const fs = require('fs'), path = require('path');
const lg = require('../tests/results.json'), tpl = require('../../Reusable_ERP_Master_Template/tests/results.json');
const tbl = r => { const groups = [...new Set(r.results.map(x => x.group))]; return groups.map(g => { const rs = r.results.filter(x => x.group === g); return '### ' + g + ' — ' + rs.filter(x => x.ok).length + ' / ' + rs.length + '\n\n| Result | Test |\n|---|---|\n' + rs.map(x => '| ' + (x.ok ? 'PASS' : '**FAIL**') + ' | ' + x.name.replace(/\|/g, '/') + (x.ok ? '' : ' — ' + x.error) + ' |').join('\n'); }).join('\n\n'); };

const md = `# Testing Report

Date of run: ${lg.ranAt.slice(0, 10)} · All data used in testing is fictional.

## Summary

| Suite | How it was run | Result |
|---|---|---|
| Leads Global ERP — business rules and data layer | \`node tests/run.js\` (Node ${process.version}, in-memory storage, same scripts the browser loads) | **${lg.passed} / ${lg.total} passed** |
| Reusable template — framework, both example projects, blank starter | \`node tests/run.js\` in \`Reusable_ERP_Master_Template\` | **${tpl.passed} / ${tpl.total} passed** |
| Browser tests (real UI: clicks, typing, file inputs) of Leads Global and both examples | Claude in-app browser (Chromium) on a local web address, see Part 2 | see Part 2 — every listed check passed |
| Opening from the file system (\`file://\`, no server) | headless Microsoft Edge on the real files | 4 / 4 pages rendered with no error |
| Storage-full and scale checks | scripted, see Part 3 | storage-full handled; scale limit found and documented |

**Honest scope statement.** "Passed" means the listed check was executed and gave the expected result in this environment. Items in Part 4 were **not** tested and must not be assumed to work.

---

## Part 1 — Automated tests

### 1.1 Leads Global ERP (${lg.passed} / ${lg.total})

${tbl(lg)}

### 1.2 Reusable ERP Master Template (${tpl.passed} / ${tpl.total})

${tbl(tpl)}

---

## Part 2 — Browser tests (executed in the real application)

Environment: Claude in-app browser (Chromium) at \`http://127.0.0.1:3100/…\` served by \`tools/serve.js\`; fictional demo data loaded with the app's own **Load fictional demo data** button. Checks were driven by real events (clicks, typing, file inputs) and read back from the page and the stored data.

| # | Test | Observed result |
|---|---|---|
| B1 | Empty first screen, then press *Load fictional demo data* | "Get started" panel shown; after loading, Main Dashboard shows 8 clients/sponsors, 9 orders, 18 candidates, 4 interviews, 3 tickets, 3 overdue follow-ups, 1 open warranty complaint, QAR 600 agency fee outstanding — identical to the Node calculation |
| B2 | Open the Domestic division dashboard | Workflow strip, Warranties active 3, Expiring in 30 days 1, Expired 1, Open complaints 1, handed over 4, refund amounts QAR 1,500, pipeline and warranty register present |
| B3 | **Daily update**: open *Daily update* on a candidate row | Form opens pre-filled (candidate, client, current stage, today's date). Setting stage *Interviewed* and saving: candidate stage became *Interviewed*; interview date filled from the update date; history shows stage and date events; message "…moved to Interviewed · interviewDate set to …" |
| B4 | **Documents**: save with nothing chosen / a \`.exe\` / a PDF | "Choose a file to upload." / "This file type is not allowed…" / PDF saved as DOC-0001 linked to the candidate and client; the file is stored in IndexedDB and was read back |
| B5 | **CSV import**: 4-row file (1 good, 1 duplicate of an existing client, 1 missing name, 1 bad e-mail) | Preview: 1 will be added, 1 duplicate skipped, 2 rejected, each with its reason. Confirm: exactly 1 client created (CL-0009) in the right division; audit entry "CSV import: 1 added, 0 failed" |
| B6 | **Delete protection** | Deleting a client with linked records is refused with the exact counts (1 order, 1 allocation, 4 candidates, 3 payments, 1 document, 1 interview, 1 ticket, 23 updates); the client remains. An unused client deletes normally |
| B7 | **Backup and restore** | Backup file contained 11 tables, 195 history events, 238 audit entries and 1 uploaded document. After deleting an interview and editing a client, restoring the file brought both back (4 interviews, original phone) and the document file was still retrievable. A backup from another project and a non-JSON file were both refused with a clear message; data unchanged |
| B8 | **Domestic warranty through the UI**: daily update *Handed Over* dated 2026-11-01 | Worker's handover date set; **warranty WR-0005 created automatically**: start 2026-11-01, 9 months, end 2027-08-01, status Active; "Warranties active" 3 → 4 and warranty count 4 → 5. In the warranty form the expiry field is read-only and recalculates live: start 31 May → 28 Feb 2027; 6 months → 30 Nov 2026. A complaint dated before the start is rejected inline. The stage drop-down for Domestic does not offer *Deployed* or *Joined* |
| B9 | **Dashboard traceability**: click every dashboard card that opens a list | 36 cards clicked; for 34 the number of records in the list equals the card. The other 2 are *sum* cards ("Workers required 19" = 6 + 10 + 3 over 3 orders; "Vacancies 6" = 2 + 3 + 1) which correctly open their 3 source orders |
| B10 | **Lists**: search, filters, sort, export, header tools | Typing "Echo" → 1 row; "nepali" → 5 rows; nonsense → "No records match these filters."; the address bar keeps the search. Stage filter *Deployed* → 3; plus agency filter → 1; *Clear filters* → 8. Sorting by name ascending and descending verified. List CSV export: header row + 8 data rows; agency-ledger report CSV export correct. Header "search everything" found the candidate, ticket and 8 updates. Alerts bell showed 4 live alerts |
| B11 | **Mobile (375 px emulation)** | No horizontal page scroll; ☰ opens the menu and the dim background closes it; table scrolls inside its own container; add-form fits the screen in a single column. (Measured from the page; the emulated screenshots were too small to judge visually.) |
| B12 | **Example projects**: open Manpower and CRM, load demo data | Both load without console errors with their own menus/cards. Manpower: fees USD 2,998.8 (= 3,000 × 12 × 8.33 %), fill rate 33 %. CRM B2B: pipeline USD 130,000, weighted forecast USD 96,000, won USD 6,000, win rate 50 %; B2C has a different menu, cards and stages. Browser storage contained three separate keys, each tagged with its own project id and only its own tables |
| B13 | **Persistence** | After a full page reload the data, counters and pipeline were unchanged |
| B14 | **Opening from the file system** | headless Edge on \`file://\` for Leads Global, Manpower, CRM and Blank: all rendered the dashboard, no error panel |

---

## Part 3 — Robustness and scale checks (scripted)

| Check | Result |
|---|---|
| Browser storage full (adapter that throws on save) | The error reaches the caller; the new record, its id counter and its audit entry are all rolled back (1 client remained, counter 1, 1 audit entry); the next save works (CL-0002). Now also an automated test |
| 2,000 candidates + 6,000 daily updates in memory | **Before optimisation** the dashboard cards took 3.4 s and follow-ups 4.1 s; **after** the follow-up scan and the "ever reached" history scan were rewritten: all cards ≈ 33 ms, follow-ups ≈ 26 ms. Creating the 8,000 records took ≈ 39 s (each record is fully validated) |
| Size of that data set | ≈ 5.5 MB — **above the ≈ 5 MB browser storage limit**; in a browser the save would be refused (and rolled back). So the demo storage suits hundreds of candidates, not thousands. This is a limit of browser storage, not of the screens |
| Recipes in \`CUSTOMIZATION_GUIDE.md\` | Applied to a scratch copy: new stage + automatic milestone date, a field only for one division, a validation rule, 12-month warranty and switching automatic warranty off all worked |

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
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'ERP_Analysis_And_Documentation', 'TESTING_REPORT.md'), md);
console.log('TESTING_REPORT.md written,', md.length, 'chars');

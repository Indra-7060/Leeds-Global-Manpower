# 5. Remaining Requirements, Assumptions and Deviations from V6

## 5.1 Honest status
This is a **fully working offline prototype built on V6's workflow** — data entry, validation, stage workflow, imports, calculated dashboards and reports, exports, demo/live separation. It is **not a production ERP**: no login, no server, no database, no encryption, no shared data between users or devices, and files (CVs, passports, letters) are not stored. Everything needed to close that gap is in doc 06.

## 5.2 Assumptions register
V6 did not define these, but the software needs *some* value to work. Each is isolated in `js/config/config.js` (marked `ASSUMPTION`) and shown read-only under **Settings & Data → Configuration in force**. **Please confirm or correct each** — changing them is a one-line edit.

| # | Assumption used | V6 evidence | Question |
|---|---|---|---|
| A-1 | **Rejected** is a candidate status, allowed only from CV Submitted / Client Review / Interview | V6 has a "Rejected Candidates" report but no such status | OQ-1 |
| A-2 | Dashboard pipeline groups: CV Screening = CV Submitted, Client Review · Interviews & Selection = Interview, Selected, Offer Accepted · Visa Processing = Pre-Medical, Visa Applied, QVC, RTP · Ready to Deploy = Visa Printed, Deployment Ready | V6 numbers were hard-coded; Visa Pipeline = bar, Ready to Fly = bar | OQ-2 |
| A-3 | An order is **open** unless its stage is *Closed* (added); other stages = V6 data values + flow diagram; set manually | V6 has no closed state or derivation | OQ-3 |
| A-4 | *Flight Pending* = Visa Printed + Deployment Ready (not RTP) | V6 has two conflicting definitions | OQ-4 |
| A-5 | *Deployed* (master report, Arrivals Verified) = Arrived + Joined + Warranty | V6 export omitted Warranty (defect) | OQ-5 |
| A-6 | Candidate ↔ order link is the **Order** field; master report groups by **client + country** | V6 only had `order_id` as an import field | OQ-6 |
| A-7 | Duplicate candidates are **skipped/blocked** (not merged/updated) | V6 skipped on import | OQ-7 |
| A-8 | Labour warranty = start + **3 months** (editable); Domestic = **no default**; reminder window **30 days** | V6: "illustrative 3-month"; domestic "verify law" | OQ-8, OQ-21 |
| A-9 | Domestic case status = V6 page's 8-step workflow; dashboard counters mapped from it | V6 had 6-step and 8-step versions | OQ-10 |
| A-10 | Travel status: Pending → Request Booking → Flight Details Shared → Arrival Notice; the 6-step deployment checklist is *derived* from stage + travel record; ticking does not change stage | V6 had two overlapping checklists | OQ-23 |
| A-11 | Agency allocation status = V6 "Agency Tasks" steps | V6 showed three of them | OQ-14 |
| A-12 | Candidate ID prefix: BD, NP (V6) + IN, PH, XX (other/unknown) | V6 shows BD/NP only | OQ-22 |
| A-13 | Numeric dates are read **day-first** (05/11/2026 = 5 Nov); Excel date cells converted exactly | V6 left dates as raw serial numbers | OQ-19 |
| A-14 | Roles: only Finance restricted for Staff (V6). Undo-stage, workspace switch, restore, reset limited to MD/Nitija | V6 only gated Finance | OQ-15 |
| A-15 | Formulas of the four "Planned" reports (country-wise, agent performance, warranty expiry, demand & sales) | V6: titles and one-line purposes only | OQ-21 |
| A-16 | Finance import: blank/unknown **direction → row rejected** (V6 defaulted to Incoming); unknown category → *Other* with the original kept in the note | V6 accepted anything | OQ-9 |
| A-17 | Unknown countries are accepted as typed (not forced into a list) | V6 import accepted any text | — |
| A-18 | Sample data uses plainly fictional company names; V6's sample used names that appear to be real clients | Confidentiality rule in the brief | — |

## 5.3 Not built — and why
| Item | Why not built | Depends on |
|---|---|---|
| Login, user accounts, real permissions, agent/client portals | Needs a server; a browser dropdown is not security | Backend + identity (doc 06) |
| Shared multi-user data, concurrency, backups, disaster recovery | Browser storage is single-profile | Database (doc 06) |
| Storage of CVs, passports, demand-letter scans, ticket copies, arrival evidence | No secure storage offline; V6 itself refused to store files | Encrypted object storage |
| Demand-letter **version history** and approvals | Needs documents + users | Backend, OQ-13 |
| Credentials **secrets** (portal passwords/OTPs) | Must never sit in browser storage | Vault product, OQ-18 |
| E-mail / WhatsApp reminders; mailbox & WeTransfer CV capture; PDF parsing/OCR; ZIP/RAR unpacking | Need services and credentials | Backend, OQ-17 |
| Native **.xlsx** and **PDF** export | V6: "require the production ERP". CSV opens in Excel | Server-side or a library decision |
| Agency-charge on verified arrival (Nepal QAR 1,500), MD approval of advance allocations, reversals, bank reconciliation, candidate-level profitability | V6 states them as text; no formula/trigger/approver defined | OQ-9 |
| Domestic fees, payment timing, guarantee/refund calculation | V6: must be validated against Qatar law | Legal input, OQ-8/OQ-10 |
| Local Corporate division data (vacancies, placements, fee milestones) | V6: "not yet started" | OQ-11 |
| Interview **attendance**; **QVC Completed** report | V6 defines no field / status | OQ-1 |
| Agent "CV quality" metric | Undefined | OQ-14, OQ-21 |
| Salesperson targets / conversion analytics | V6: "production system will record…" | OQ-12 |
| Multi-currency | V6 is QAR-only | OQ-24 |
| Real AI assistant | Brief: *no unnecessary AI*. "AI Reports" is a keyword filter and says so | OQ-20 |

## 5.4 Deviations from V6 (and why)
V6 functionality was **not removed without cause**. Differences:

| V6 | This version | Reason |
|---|---|---|
| Hard-coded dashboard/visa/deployment/master numbers | Calculated from records | Brief: counters must reflect real records |
| Imports into a hidden store | Imports into the real registers | V6 defect D-1 |
| Quick-report chips *QVC Completed*, *Interview Attendance*, *Corporate Placements* | **Removed** | Could never return data (no status/field/records); documented as not built |
| Quick-report chips *Candidate List, Agency Candidates, Agency Deployment, Warranty Cases, Domestic Worker Cases, Order Progress, Open Orders, Interview Schedule, Rejected Candidates* | **Fixed** to read the right entity | V6 defect D-9 |
| Two different "visa summary" CSVs | One *Master Recruitment Report* | V6 defect D-4 |
| AI report downloaded immediately | Preview first, with how the request was understood | Transparency; export still one click |
| Reminders table | Same "Priority" column (shows Pending) + counts, item tags, Open link | Restored to V6 wording; only additions |
| Reports toolbar | Same as V6 on every page except Dashboard, Import, CV Intake, Credentials, Finance, Settings and Corporate | Corporate has no data to report on; the others had none in V6 either |
| `confirm()` dialogs | Styled in-app confirmations | Testable, accessible, consistent |
| "Sample New Order" / "Save Sample Transaction" / "Reset Demo Entries" / costing title | **Same wording in the DEMO workspace**; plain wording in LIVE ("New Order", "Save Transaction", "Clear all entries…"). Costing title says "Sample" instead of "JAAK Sample" | "Sample" would be wrong for real records; avoids naming a possible real client |
| Finance page: no edit/delete | Edit and delete entries | Needed for correction |
| Demo role dropdown only | Same, plus workspace pill | Demo/live separation (new requirement) |
| *Settings* page absent | Added (workspaces, backup/restore, data quality, config) | Needed by brief; V6 backup had no restore |

## 5.5 Suggested next steps
1. **Client answers** to the 24 open questions in doc 01 §1.8 (especially OQ-1, 2, 3, 4, 8, 9, 19 — they change numbers on screen).
2. Fictionalised copies of **2–3 real Excel sheets** to lock import templates (OQ-19).
3. Decide hosting/data-protection posture, then build the production system from doc 06 — the logic modules port directly.

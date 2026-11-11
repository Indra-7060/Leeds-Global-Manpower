# Module-Wise Workflow

Each division is walked step by step: **what you do → which screen → what the system records and calculates automatically → which dashboard number moves.** Field-by-field detail is in `DATA_DICTIONARY.md` (generated from the code).

Legend: **▶** you enter · **⚙** the system does it · **📊** dashboard effect

---

## A. Blue-Collar

`Client → Order → Overseas Agency → Agency Allocation → Candidate Registration → Recruitment Stages → Interview → QVC → RTP → Visa → Ticket → Arrival → Deployment → Handover → Accounts`

| Step | Screen (menu) | ▶ You enter | ⚙ System | 📊 Effect |
|---|---|---|---|---|
| 1. Client | Clients | Client name (unique in the division), phone, e-mail, status | Gives `CL-nnnn`; blocks duplicate names | Clients |
| 2. Order | Orders | Client, trade, quantity, country, nationality, salary, food/accommodation/transport, hours, contract period, date, status | Gives `ORD-nnnn`; quantity ≥ 1 whole number | Orders, Workers required (Σ quantity) |
| 3. Overseas agency | Overseas Agencies | Name, country, contact (shared list, not per division) | Blocks same name + country twice | Agencies |
| 4. Allocation | Agency Allocations | Client, order, agency, allocated quantity, **fee per deployed worker (QAR)**, terms | Order must belong to the client; one allocation per order + agency; warns if total allocated > ordered | Allocations; feeds the agency ledger |
| 5. Candidate | Candidates & CVs | Name, client, order, agency (only agencies allocated to the chosen order are offered), passport (unique), nationality, trade… | Gives `CAN-nnnn`; stage starts at *CV Received* | Candidates; stage cards |
| 6. Recruitment stages | **Daily Updates** (or the *Daily update* button on a candidate row) | Candidate, update date, **new stage**, updated by, work completed, next follow-up + due date | ⚙ Saves the update · moves the candidate to the new stage · fills the milestone date if empty (Interviewed→interview date, QVC Completed→QVC date, RTP→RTP date, Visa Printed→visa date, Ticket Booked→ticket date, Arrived→arrival date, Deployed→**verified deployment date**, Handed Over→handover date) · writes a stage-history event linked to the update · warns when moving backwards or re-opening a Rejected candidate | Stage cards (current + ever reached), Follow-ups |
| 7. Interview | Interviews | Candidate, date, result, feedback | One record per candidate per day | Interview records |
| 8. Ticket / arrival | Tickets & Deployment | Candidate, flight, date, status | — | Tickets |
| 9. Deployment | Daily update → **Deployed** | (as step 6) | ⚙ Sets the *verified deployment date* | Verified deployed; **Agency fee earned** |
| 10. Handover | Daily update → **Handed Over** | (as step 6) | ⚙ Sets the handover date | Handed Over card |
| 11. Documents | Documents | Client, candidate, type, file (PDF/PNG/JPG/DOC/DOCX ≤ 5 MB) | Type/size check; file kept separately; record keeps name/size | Documents |
| 12. Accounts | Accounts & Collections | Client, agency, **allocation**, kind (Invoice / Payment received / Expense / Refund / Deposit), payer, amount, date, reference | Allocation must match client and agency | **Agency fee paid / outstanding** |

**Agency ledger (report):** per allocation → allocated, verified deployed, fee, earned, paid, outstanding, and a *Deployed > allocated* check. Payments that name an agency but no allocation are listed apart (not guessed).

---

## B. Domestic

`Sponsor → Worker Requirement → Worker Registration → Recruitment Progress → Ticket / Arrival → Sponsor Handover → 9-month Warranty → Complaint / Replacement / Refund`

| Step | Screen | ▶ You enter | ⚙ System | 📊 Effect |
|---|---|---|---|---|
| 1. Sponsor | Sponsors | Name, **QID**, phone, e-mail | Unique name in the division | Sponsors |
| 2. Worker requirement | Worker Requirements | Sponsor, category (Housemaid / Cook / Driver / Nanny / Caregiver / Gardener), quantity (usually 1), nationality, age range, language, salary, food, accommodation, contract | — | Worker requirements |
| 3. Worker registration | Domestic Workers | Name, sponsor, requirement, passport, nationality, category… | Stage starts *CV Received*; no agency / deployment fields (not part of this workflow) | Workers |
| 4. Recruitment progress | Daily Updates | as Blue-Collar step 6 | Stage must be one of Domestic's 15 stages (*Deployed* and *Joined* are refused) | Stage cards |
| 5. Interview / Ticket / Arrival | Interviews · Tickets & Deployment | candidate, dates, flight | milestone dates filled by updates | Interview records, Tickets |
| 6. **Sponsor handover** | Daily update → **Handed Over** | update date = the **verified handover date** | ⚙ sets the worker's handover date · ⚙ **creates the warranty**: start = handover date, 9 months, expiry calculated, status Active | Handed over; Warranties active |
| 7. Warranty monitoring | Domestic Warranty (9 months) · Warranty register | — | Time left in days; *Expiring in 30 days*; *Expired*; *Start ≠ handover* check | Active / Expiring / Expired |
| 8. Complaint | Edit the warranty | Reason, complaint date, claim type (Replacement / Refund / Other), status (Open …) | Complaint date can't be before the warranty start; warns if after expiry | **Open complaints** |
| 9. Replacement | Edit the warranty | Replacement worker (must be a *different* worker of the *same* sponsor) | Validated against the worker records | — |
| 10. Refund | Edit the warranty | Refund amount, resolved date, status Resolved | Warns if an amount is entered but claim type ≠ Refund; resolved date can't precede complaint date | Refund amounts recorded |
| 11. Accounts | Accounts & Collections | Sponsor invoices / receipts | Balance by sponsor (invoiced − received + refunds) | Account balances report |

**Warranty rules.** One warranty per worker. End = start + months (calendar), e.g. 15 Jan + 9 → 15 Oct; 31 May + 9 → 28 Feb. Changing the start or months recalculates the end instantly (the field is read-only). The warranty start is pre-filled from the handover date; if someone changes it the register flags *Start ≠ handover* — it is **not** silently reset (client to confirm rule C3).

---

## C. Corporate

`Company → Job Requirement → Candidate Registration → Interview → Selection → Offer → Joining → Placement Fee / Accounts`

| Step | Screen | ▶ You enter | ⚙ System | 📊 Effect |
|---|---|---|---|---|
| 1. Company | Companies | Name, phone, e-mail | Unique name | Companies |
| 2. Job requirement | Job Requirements | Company, job title, vacancies, nationality, source, location, experience, qualification, **basic / total salary, fee basis (0.5 month / 1 month / Custom), custom fee, invoice due after joining (months)** | Custom fee mandatory when basis = Custom | Job requirements, Vacancies (Σ) |
| 3. Candidate | Candidates | Name, company, requirement, passport/ID, current location, salary offered | Stage *CV Received*; no visa/ticket/agency fields | Candidates |
| 4. Interview → Selection → Offer | Daily Updates (+ Interviews) | as above | Stages: Interview Scheduled → Interviewed → Selected → Offer Issued | Stage cards |
| 5. **Joining** | Daily update → **Joined** | joining date = update date | ⚙ sets joining date | Joined |
| 6. Placement fee | Placement fees (report) | — | ⚙ fee = basis × salary (or custom) · due date = joining + months · received = linked payments · outstanding · **overdue** flag | Placement fees earned / received / outstanding / Overdue invoices |
| 7. Accounts | Accounts & Collections | Invoice / Payment received **linked to the placed candidate** | — | Invoiced / Received |

---

## D. Cross-division tools

| Tool | What it does |
|---|---|
| **Main Dashboard** | Totals across all divisions + division-wise stage table ("—" = stage not in that division) + tiles into each division |
| **Header search** | Finds records of any table across all divisions (by id, name, passport, text) |
| **Alerts bell** | Overdue follow-ups · open warranty complaints · warranties expiring ≤ 30 days · handed-over workers without a warranty · overdue placement fees · agency fee outstanding — all computed live |
| **Import / Export** | Per table: download CSV template → fill → preview (new / duplicate / rejected with reason) → confirm; export any table |
| **Settings & Backup** | JSON backup (with documents), restore, demo data, your name (stored with every change), delete-all (typed confirmation) |
| **Audit log** | Every create / update / delete / import / restore with who and when |
| **Timeline** (candidate row) | Stage history + all related updates, interviews, tickets, warranty, payments, documents |

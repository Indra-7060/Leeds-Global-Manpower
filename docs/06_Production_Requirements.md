# 6. What a Production ERP Needs (and what this offline version is not)

> **This delivery is an offline browser prototype.** It must not be described as a production ERP, and it must not hold real passports, CVs, bank/finance data or client credentials. The items below are what is *missing* and must be designed, built and security-tested before any real data is entered.

## 6.1 Architecture target
```
Browser (this UI)  ──HTTPS──►  API (authn/authz, validation, business rules)  ──►  PostgreSQL
                                   │                                         └──►  Encrypted object storage (documents)
                                   ├──►  Job queue / scheduler (reminders, imports, report builds)
                                   ├──►  Notification providers (e-mail, WhatsApp/SMS) · Mailbox API (Graph/Gmail)
                                   └──►  Secrets vault · Audit log store · Monitoring
```
**What carries over unchanged:** the UI, `config.js`, and the pure logic (`schema.js`, `rules.js`, `lifecycle.js`, `metrics.js`, `alerts.js`, `reports.js`, `importer.js`) were written without DOM/storage dependencies so they can move server-side as the *authoritative* implementation. **What is replaced:** `storage.js` (→ API client) and `permissions.js` (→ server-enforced RBAC).

## 6.2 Backend & API
* REST/JSON (or GraphQL) service in a mainstream stack; every rule currently in `rules.js` enforced **server-side** (the browser copy becomes advisory).
* Idempotent import jobs with row-level result storage; resumable; size limits; malware scan of uploads.
* Server-side report/export generation including **native .xlsx and PDF**; large exports streamed.
* Optimistic concurrency (version/ETag) so two staff editing one candidate do not overwrite each other.

## 6.3 Database (relational, e.g. PostgreSQL)
Core tables follow doc 03 §3.2, with real foreign keys (V6 links clients by *name*; production should use ids):
`clients, client_contacts, visits, demand_letters, orders, order_trades, agencies, agency_allocations, candidates, candidate_stage_history, interviews, travel_records, warranty_cases, domestic_cases, finance_accounts, finance_entries (append-only ledger), credential_records (metadata only), cv_intake_items, documents, import_jobs, import_job_rows, users, roles, role_permissions, audit_log, notifications`.
Needs: unique constraints for the duplicate rules, check constraints for stage values/quantities, soft-delete + retention, migrations, point-in-time recovery, tested restores.

## 6.4 Authentication
* Individual accounts (no shared logins), SSO with the company's identity provider if available, **MFA**, password policy, session timeout, lockout/rate-limiting.
* Separate **agent portal** accounts (each agency sees only its own orders/candidates — V6 requirement) and, if wanted, a client portal.

## 6.5 Authorisation (permissions)
V6 only restricts Finance for *Staff*. A production matrix must be agreed (OQ-15). Draft to start from:

| Capability | MD | Admin Mgr | Ops Staff | Agency user |
|---|---|---|---|---|
| Dashboard, registers (own scope) | ✔ | ✔ | ✔ | own orders only |
| Change candidate stage | ✔ | ✔ | ✔ | limited (submit CVs, interview schedule, upload passports) |
| Undo/correct stage, delete records | ✔ | ✔ | ✘ | ✘ |
| Finance (view/enter/export/import) | ✔ | ✔ | ✘ | ✘ |
| Approve manual advance allocation (V6 rule) | ✔ | ✘ | ✘ | ✘ |
| Credentials register (reveal secrets) | by policy | by policy | ✘ | ✘ |
| User & role administration, audit log | ✔ | view | ✘ | ✘ |
Enforced on the **server** on every request, never only in the UI; field-level restriction for finance and passport data.

## 6.6 Secure file storage
CVs, passports, demand-letter scans, ticket copies, arrival evidence: encrypted object storage, private buckets, short-lived signed URLs, antivirus scan on upload, file-type allow-list, size limits, per-document access control, access logged, retention/deletion schedule. Passports are **sensitive personal data**: minimise collection, restrict access, mask in lists/exports.

## 6.7 Secrets (Credentials Register)
Portal passwords/OTPs must live in a dedicated vault product (encryption at rest, per-secret access control, reveal-with-reason, rotation, full audit). The register in this prototype holds *descriptions only* and refuses password-like text.

## 6.8 Audit and finance integrity
* Immutable, server-side, append-only audit trail (who/what/when/before/after) — the in-browser log is trivially erasable.
* Finance: posted entries immutable; corrections by **reversal entries with approval**; bank reconciliation; MD approval workflow for advance allocation; candidate-level profitability; agency-charge trigger on verified arrival once the rule is defined (OQ-9).

## 6.9 Notifications & integrations
Scheduled reminders (the rules in `alerts.js`) delivered by e-mail/WhatsApp/in-app with recipient rules (OQ-17); shared recruitment mailbox capture via Microsoft Graph or Gmail API; authorised WeTransfer retrieval; ZIP/RAR unpacking; PDF/DOCX text extraction + OCR; uncertain matches routed to staff review (never auto-sent to a client).

## 6.10 Security, privacy, compliance
* TLS everywhere, HSTS, strict **Content-Security-Policy**, secure cookies, CSRF protection, output escaping (done in UI) plus server validation, dependency scanning, secrets never in the repo.
* Data protection: classify candidate/passport/finance data; consent, retention and cross-border transfer obligations under the **applicable Qatar data-protection law and the laws of candidates' home countries — to be confirmed with legal counsel** (not assessed here).
* Penetration test before go-live; least-privilege cloud roles; encrypted backups with tested restore.

## 6.11 Operations
Hosting region/vendor decision, environments (dev/test/prod), CI/CD with the test suites in `tests/` as a starting regression pack, structured logging, monitoring/alerting, backup & disaster-recovery objectives, support process, data-migration plan from the client's Excel sheets (import templates per OQ-19), user training.

## 6.12 Suggested build order
1. Confirm open questions (doc 01 §1.8 / doc 05).  2. Identity + roles + database + API for Clients/Orders/Candidates (+ import).  3. Move rules/metrics/reports server-side; keep UI.  4. Document storage + audit.  5. Finance module with ledger integrity.  6. Notifications & mailbox automation.  7. Agent portals.  8. Security review, UAT with fictionalised then real data, go-live.

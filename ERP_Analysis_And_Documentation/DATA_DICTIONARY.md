# Leads Global ERP — Data Dictionary

*Generated from `project/config.js` by `tools/gen-data-dictionary.js`. Do not edit by hand.*

Every record has a system `id` (prefix + 4-digit number per table, e.g. `CAN-0007`), `createdAt` and `updatedAt`. Records link to each other **by id**. Scoped tables also carry `division` (fixed at creation, cannot be changed).

## Clients & Sponsors  (`clients`)

* ID prefix: `CL-`   · Scoped by division: **yes**
* Duplicate rule: `name` (within a division)
* History kept for: `status`
* Delete: blocked while other records still point to the record.

**Blue-Collar — Qatar client**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `name` | Client name | text | yes |  |
| `phone` | Phone | text |  |  |
| `email` | Email | email |  |  |
| `status` | Status | select |  | Active, Inactive |
| `notes` | Notes | textarea |  |  |

**Domestic — Sponsor**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `name` | Sponsor name | text | yes |  |
| `qid` | Sponsor QID | text |  |  |
| `phone` | Phone | text |  |  |
| `email` | Email | email |  |  |
| `status` | Status | select |  | Active, Inactive |
| `notes` | Notes | textarea |  |  |

**Corporate — Corporate company**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `name` | Company name | text | yes |  |
| `phone` | Phone | text |  |  |
| `email` | Email | email |  |  |
| `status` | Status | select |  | Active, Inactive |
| `notes` | Notes | textarea |  |  |

## Orders  (`orders`)

* ID prefix: `ORD-`   · Scoped by division: **yes**
* History kept for: `status`
* Delete: blocked while other records still point to the record.

**Blue-Collar — Manpower order**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `country` | Recruitment country | text |  |  |
| `nationality` | Required nationality | text |  |  |
| `trade` | Trade / Position | text | yes |  |
| `quantity` | Number of people required | number | yes | min 1, whole number |
| `basicSalary` | Basic salary (QAR) | number |  | min 0 |
| `food` | Food allowance / provided | text |  |  |
| `accommodation` | Accommodation | text |  |  |
| `transport` | Transportation | text |  |  |
| `workingHours` | Working hours | text |  |  |
| `contractPeriod` | Contract period | text |  |  |
| `orderDate` | Order date | date |  |  |
| `status` | Order status | select |  | Open, In progress, Fulfilled, On hold, Cancelled |
| `notes` | Notes | textarea |  |  |

**Domestic — Worker requirement**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Individual sponsor | ref | yes | → `clients` |
| `nationality` | Preferred worker nationality | text |  |  |
| `country` | Recruitment country | text |  |  |
| `trade` | Domestic worker category | select | yes | Housemaid, Cook, Driver, Nanny, Caregiver, Gardener |
| `quantity` | Workers required (usually 1) | number | yes | min 1, whole number |
| `preferredAge` | Preferred age range | text |  |  |
| `language` | Language preference | text |  |  |
| `experience` | Experience / skills required | text |  |  |
| `basicSalary` | Monthly salary (QAR) | number |  | min 0 |
| `food` | Food arrangement | text |  |  |
| `accommodation` | Accommodation arrangement | text |  |  |
| `contractPeriod` | Contract period | text |  |  |
| `orderDate` | Request date | date |  |  |
| `status` | Request status | select |  | Open, In progress, Fulfilled, On hold, Cancelled |
| `notes` | Sponsor preferences / special instructions | textarea |  |  |

**Corporate — Job requirement**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Corporate company | ref | yes | → `clients` |
| `trade` | Job title / designation | text | yes |  |
| `quantity` | Number of vacancies | number | yes | min 1, whole number |
| `nationality` | Preferred nationality | text |  |  |
| `country` | Recruitment source (Qatar / overseas) | text |  |  |
| `location` | Work location | text |  |  |
| `experience` | Required experience | text |  |  |
| `qualification` | Qualification / skills | text |  |  |
| `basicSalary` | Basic monthly salary (QAR) | number |  | min 0 |
| `totalSalary` | Total monthly package (QAR) | number |  | min 0 |
| `feeBasis` | Placement fee basis | select |  | 0.5 month, 1 month, Custom |
| `customFee` | Custom fee (QAR) | number | conditional | min 0 |
| `paymentMilestone` | Invoice due after joining (months) | number |  | min 0, whole number |
| `orderDate` | Request date | date |  |  |
| `status` | Job order status | select |  | Open, In progress, Fulfilled, On hold, Cancelled |
| `notes` | Job description / conditions | textarea |  |  |

## Overseas Agencies  (`agencies`)

* ID prefix: `AG-`   · Scoped by division: **no (global)**
* Duplicate rule: `name + country`
* Delete: blocked while other records still point to the record.

**Fields**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `name` | Agency name | text | yes |  |
| `country` | Country | text | yes |  |
| `contact` | Contact | text |  |  |
| `phone` | Phone | text |  |  |
| `notes` | Notes | textarea |  |  |

## Agency Allocations  (`allocations`)

* ID prefix: `AL-`   · Scoped by division: **yes**
* Duplicate rule: `order + agency` (within a division)
* Delete: blocked while other records still point to the record.

**Blue-Collar — Allocation**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Qatar client | ref | yes | → `clients` |
| `order` | Order reference | ref | yes | → `orders` (fills client) |
| `agency` | Overseas agency | ref | yes | → `agencies` |
| `quantity` | Allocated quantity | number | yes | min 1, whole number |
| `fee` | Agency fee per deployed worker (QAR) | number | yes | min 0 |
| `notes` | Payment terms / notes | textarea |  |  |

**Domestic** — not used in this division.

**Corporate** — not used in this division.

## Candidates  (`candidates`)

* ID prefix: `CAN-`   · Scoped by division: **yes**
* Duplicate rule: `passport` (within a division)
* History kept for: `stage`, `interviewDate`, `qvcDate`, `rtpDate`, `visaDate`, `ticketDate`, `arrivalDate`, `deploymentDate`, `handoverDate`, `joiningDate`
* Delete: blocked while other records still point to the record.

**Blue-Collar — Candidate**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `name` | Candidate full name | text | yes |  |
| `client` | Client | ref | yes | → `clients` |
| `order` | Order reference | ref |  | → `orders` (fills client) |
| `agency` | Overseas agency | ref |  | → `agencies` |
| `passport` | Passport number | text |  |  |
| `nationality` | Nationality | text |  |  |
| `country` | Source country | text |  |  |
| `trade` | Trade / Role | text |  |  |
| `stage` | Current stage | select | yes | CV Received, Interview Scheduled, Interviewed, Selected … (16 values) |
| `interviewDate` | Interview date | date |  |  |
| `qvcDate` | QVC / medical date | date |  |  |
| `rtpDate` | RTP date | date |  |  |
| `visaDate` | Visa date | date |  |  |
| `ticketDate` | Ticket booking date | date |  |  |
| `flight` | Flight number | text |  |  |
| `arrivalDate` | Actual arrival date | date |  |  |
| `deploymentDate` | Verified deployment date | date |  |  |
| `handoverDate` | Handover date | date |  |  |
| `salary` | Basic salary (QAR) | number |  | min 0 |
| `notes` | Notes | textarea |  |  |

**Domestic — Worker**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `name` | Worker full name | text | yes |  |
| `client` | Individual sponsor | ref | yes | → `clients` |
| `order` | Worker requirement | ref |  | → `orders` (fills client) |
| `passport` | Passport number | text |  |  |
| `nationality` | Nationality | text |  |  |
| `country` | Source country | text |  |  |
| `trade` | Category / Role | text |  |  |
| `stage` | Current stage | select | yes | CV Received, Interview Scheduled, Interviewed, Selected … (15 values) |
| `interviewDate` | Interview date | date |  |  |
| `qvcDate` | QVC / medical date | date |  |  |
| `rtpDate` | RTP date | date |  |  |
| `visaDate` | Visa date | date |  |  |
| `ticketDate` | Ticket booking date | date |  |  |
| `flight` | Flight number | text |  |  |
| `arrivalDate` | Actual arrival date | date |  |  |
| `handoverDate` | Sponsor handover date | date |  |  |
| `salary` | Monthly salary (QAR) | number |  | min 0 |
| `notes` | Notes | textarea |  |  |

**Corporate — Candidate**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `name` | Candidate full name | text | yes |  |
| `client` | Corporate company | ref | yes | → `clients` |
| `order` | Job requirement | ref |  | → `orders` (fills client) |
| `passport` | Passport / ID number | text |  |  |
| `nationality` | Nationality | text |  |  |
| `country` | Current location | text |  |  |
| `trade` | Job title / role | text |  |  |
| `stage` | Current stage | select | yes | CV Received, Interview Scheduled, Interviewed, Selected, Offer Issued, Joined, Rejected |
| `interviewDate` | Interview date | date |  |  |
| `joiningDate` | Joining date | date |  |  |
| `salary` | Offered / basic salary (QAR) | number |  | min 0 |
| `notes` | Notes | textarea |  |  |

## Accounts & Collections  (`accounts`)

* ID prefix: `AC-`   · Scoped by division: **yes**
* Delete: blocked while other records still point to the record.

**Blue-Collar — Transaction**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client | ref | yes | → `clients` |
| `agency` | Agency (if payer / payee) | ref |  | → `agencies` |
| `allocation` | Allocation (links the payment to an agency fee) | ref |  | → `allocations` |
| `candidate` | Candidate (optional) | ref |  | → `candidates` (fills client) |
| `payer` | Payer type | select |  | Overseas Agent, Qatar Company, Sponsor, Corporate Company |
| `kind` | Transaction type | select | yes | Invoice, Payment received, Expense, Refund, Deposit |
| `amount` | Amount (QAR) | number | yes | min 0.01 |
| `date` | Transaction date | date | yes |  |
| `reference` | Invoice / receipt reference | text |  |  |
| `notes` | Notes | textarea |  |  |

**Domestic — Transaction**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Individual sponsor | ref | yes | → `clients` |
| `candidate` | Worker (optional) | ref |  | → `candidates` (fills client) |
| `payer` | Payer type | select |  | Overseas Agent, Qatar Company, Sponsor, Corporate Company |
| `kind` | Transaction type | select | yes | Invoice, Payment received, Expense, Refund, Deposit |
| `amount` | Amount (QAR) | number | yes | min 0.01 |
| `date` | Transaction date | date | yes |  |
| `reference` | Invoice / receipt reference | text |  |  |
| `notes` | Notes | textarea |  |  |

**Corporate — Transaction**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Corporate company | ref | yes | → `clients` |
| `candidate` | Placed candidate (optional) | ref |  | → `candidates` (fills client) |
| `payer` | Payer type | select |  | Overseas Agent, Qatar Company, Sponsor, Corporate Company |
| `kind` | Transaction type | select | yes | Invoice, Payment received, Expense, Refund, Deposit |
| `amount` | Amount (QAR) | number | yes | min 0.01 |
| `date` | Transaction date | date | yes |  |
| `reference` | Invoice / receipt reference | text |  |  |
| `notes` | Notes | textarea |  |  |

## Documents  (`documents`)

* ID prefix: `DOC-`   · Scoped by division: **yes**
* File upload: .pdf,.png,.jpg,.jpeg,.doc,.docx, up to 5 MB, stored separately (IndexedDB), record keeps name/type/size/file id.
* Delete: blocked while other records still point to the record.

**Blue-Collar — Document**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate (optional) | ref |  | → `candidates` (fills client) |
| `type` | Document type | select | yes | Passport copy, CV, Photo, Medical report … (10 values) |
| `fileName` | File name | text |  | system (file metadata) |
| `fileType` | File type | text |  | system (file metadata) |
| `fileSize` | File size | number |  | system (file metadata) |
| `fileId` | File id | text |  | system (file metadata) |
| `notes` | Notes | textarea |  |  |

**Domestic — Document**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate (optional) | ref |  | → `candidates` (fills client) |
| `type` | Document type | select | yes | Passport copy, CV, Photo, Medical report … (10 values) |
| `fileName` | File name | text |  | system (file metadata) |
| `fileType` | File type | text |  | system (file metadata) |
| `fileSize` | File size | number |  | system (file metadata) |
| `fileId` | File id | text |  | system (file metadata) |
| `notes` | Notes | textarea |  |  |

**Corporate — Document**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate (optional) | ref |  | → `candidates` (fills client) |
| `type` | Document type | select | yes | Passport copy, CV, Photo, Medical report … (10 values) |
| `fileName` | File name | text |  | system (file metadata) |
| `fileType` | File type | text |  | system (file metadata) |
| `fileSize` | File size | number |  | system (file metadata) |
| `fileId` | File id | text |  | system (file metadata) |
| `notes` | Notes | textarea |  |  |

## Interviews  (`interviews`)

* ID prefix: `IV-`   · Scoped by division: **yes**
* Duplicate rule: `candidate + date` (within a division)
* History kept for: `result`
* Delete: blocked while other records still point to the record.

**Blue-Collar — Interview**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `date` | Interview date | date | yes |  |
| `result` | Result | select |  | Pending, Selected, Rejected, On hold, No show |
| `notes` | Feedback | textarea |  |  |

**Domestic — Interview**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `date` | Interview date | date | yes |  |
| `result` | Result | select |  | Pending, Selected, Rejected, On hold, No show |
| `notes` | Feedback | textarea |  |  |

**Corporate — Interview**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `date` | Interview date | date | yes |  |
| `result` | Result | select |  | Pending, Selected, Rejected, On hold, No show |
| `notes` | Feedback | textarea |  |  |

## Tickets & Deployment  (`tickets`)

* ID prefix: `TK-`   · Scoped by division: **yes**
* History kept for: `status`
* Delete: blocked while other records still point to the record.

**Blue-Collar — Ticket**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `flight` | Flight number | text |  |  |
| `date` | Flight date | date | yes |  |
| `status` | Ticket status | select |  | Pending, Booked, Travelled, Cancelled |
| `notes` | Notes | textarea |  |  |

**Domestic — Ticket**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Individual sponsor | ref | yes | → `clients` |
| `candidate` | Worker | ref | yes | → `candidates` (fills client) |
| `flight` | Flight number | text |  |  |
| `date` | Flight date | date | yes |  |
| `status` | Ticket status | select |  | Pending, Booked, Travelled, Cancelled |
| `notes` | Notes | textarea |  |  |

**Corporate** — not used in this division.

## Daily Updates & Follow-ups  (`updates`)

* ID prefix: `UP-`   · Scoped by division: **yes**
* Delete: blocked while other records still point to the record.

**Blue-Collar — Daily update**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `date` | Update date | date | yes |  |
| `stage` | New recruitment stage | select | yes | CV Received, Interview Scheduled, Interviewed, Selected … (16 values) |
| `staff` | Updated by | text | yes |  |
| `action` | Work completed / action | text | yes |  |
| `nextAction` | Next follow-up | text |  |  |
| `dueDate` | Follow-up due date | date | conditional |  |
| `notes` | Remarks | textarea |  |  |

**Domestic — Daily update**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `date` | Update date | date | yes |  |
| `stage` | New recruitment stage | select | yes | CV Received, Interview Scheduled, Interviewed, Selected … (15 values) |
| `staff` | Updated by | text | yes |  |
| `action` | Work completed / action | text | yes |  |
| `nextAction` | Next follow-up | text |  |  |
| `dueDate` | Follow-up due date | date | conditional |  |
| `notes` | Remarks | textarea |  |  |

**Corporate — Daily update**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client / Sponsor | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `date` | Update date | date | yes |  |
| `stage` | New recruitment stage | select | yes | CV Received, Interview Scheduled, Interviewed, Selected, Offer Issued, Joined, Rejected |
| `staff` | Updated by | text | yes |  |
| `action` | Work completed / action | text | yes |  |
| `nextAction` | Next follow-up | text |  |  |
| `dueDate` | Follow-up due date | date | conditional |  |
| `notes` | Remarks | textarea |  |  |

## Warranty  (`warranties`)

* ID prefix: `WR-`   · Scoped by division: **yes**
* Duplicate rule: `candidate` (within a division)
* History kept for: `status`, `end`
* Delete: blocked while other records still point to the record.

**Blue-Collar — Warranty**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `start` | Verified start date | date | yes |  |
| `end` | Warranty end date | date | yes |  |
| `reason` | Claim / complaint reason | textarea |  |  |
| `status` | Claim status | select |  | Active, Open, Resolved, Expired |
| `notes` | Notes | textarea |  |  |

**Domestic — Warranty**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Individual sponsor | ref | yes | → `clients` |
| `candidate` | Domestic worker | ref | yes | → `candidates` (fills client) |
| `start` | Warranty start / sponsor handover date | date | yes |  |
| `months` | Warranty period (months) | number | yes | min 1, max 60, whole number |
| `end` | Warranty expiry date (calculated) | date |  | calculated automatically |
| `reason` | Complaint / claim reason | textarea |  |  |
| `claimDate` | Complaint received date | date |  |  |
| `claimType` | Claim type | select |  | Replacement, Refund, Other |
| `status` | Claim status | select |  | Active, Open, Resolved, Expired |
| `replacementCandidate` | Replacement worker (if any) | ref |  | → `candidates` |
| `refundAmount` | Refund amount (if applicable, QAR) | number |  | min 0 |
| `resolutionDate` | Claim resolved date | date |  |  |
| `notes` | Warranty terms / remarks | textarea |  |  |

**Corporate — Warranty**

| Field key | Label | Type | Required | Allowed values / link |
|---|---|---|---|---|
| `client` | Client | ref | yes | → `clients` |
| `candidate` | Candidate | ref | yes | → `candidates` (fills client) |
| `start` | Verified start date | date | yes |  |
| `end` | Warranty end date | date | yes |  |
| `reason` | Claim / complaint reason | textarea |  |  |
| `status` | Claim status | select |  | Active, Open, Resolved, Expired |
| `notes` | Notes | textarea |  |  |

## Stage lists per division

* **Blue-Collar**: CV Received → Interview Scheduled → Interviewed → Selected → Offer Issued → QVC Pending → QVC Completed → RTP → Visa Applied → Visa Printed → Ticket Pending → Ticket Booked → Arrived → Deployed → Handed Over → Rejected
* **Domestic**: CV Received → Interview Scheduled → Interviewed → Selected → Offer Issued → QVC Pending → QVC Completed → RTP → Visa Applied → Visa Printed → Ticket Pending → Ticket Booked → Arrived → Handed Over → Rejected
* **Corporate**: CV Received → Interview Scheduled → Interviewed → Selected → Offer Issued → Joined → Rejected

## Candidate milestone dates filled by a daily update

| Stage reached | Date field |
|---|---|
| Interviewed | `interviewDate` |
| QVC Completed | `qvcDate` |
| RTP | `rtpDate` |
| Visa Printed | `visaDate` |
| Ticket Booked | `ticketDate` |
| Arrived | `arrivalDate` |
| Deployed | `deploymentDate` |
| Handed Over | `handoverDate` |
| Joined | `joiningDate` |

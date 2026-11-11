/* Leads Global ERP — project/logic.js  (LAYER 3: business logic)
   Everything specific to Leads Global recruitment lives here and in config.js — never in core/.
   Sources of every rule are noted as  [V8.7 …] (taken from the client's V8.7 file), [DEV] (a development decision needing client
   confirmation, listed in the documentation) or [V6] (carried over from V6). Nothing here calls the DOM. */
(function (g) {
  'use strict';
  const L = g.LGM = g.LGM || {};
  const U = g.ERP.util;

  /* ======================= stages ======================= */
  /** [V8.7] one global list of 17 stages. [DEV] each division uses only the part of it that matches its stated workflow:
        Blue-Collar … Candidate → Interview → QVC → RTP → Visa → Ticket → Arrival → Deployment → Handover
        Domestic   … Worker → Recruitment progress → Ticket / Arrival → Sponsor handover → warranty
        Corporate  … Candidate → Interview → Selection → Offer → Joining
      No stage name was invented. Edit here to change a division's workflow. */
  L.ALL_STAGES = ['CV Received', 'Interview Scheduled', 'Interviewed', 'Selected', 'Offer Issued', 'QVC Pending', 'QVC Completed', 'RTP', 'Visa Applied', 'Visa Printed', 'Ticket Pending', 'Ticket Booked', 'Arrived', 'Deployed', 'Handed Over', 'Joined', 'Rejected'];
  L.STAGES = {
    'Blue-Collar': ['CV Received', 'Interview Scheduled', 'Interviewed', 'Selected', 'Offer Issued', 'QVC Pending', 'QVC Completed', 'RTP', 'Visa Applied', 'Visa Printed', 'Ticket Pending', 'Ticket Booked', 'Arrived', 'Deployed', 'Handed Over', 'Rejected'],
    Domestic: ['CV Received', 'Interview Scheduled', 'Interviewed', 'Selected', 'Offer Issued', 'QVC Pending', 'QVC Completed', 'RTP', 'Visa Applied', 'Visa Printed', 'Ticket Pending', 'Ticket Booked', 'Arrived', 'Handed Over', 'Rejected'],
    Corporate: ['CV Received', 'Interview Scheduled', 'Interviewed', 'Selected', 'Offer Issued', 'Joined', 'Rejected'],
  };
  /** [V8.7] candidate milestone date fields exist; [DEV] a daily update that reaches the stage fills the date if it is still empty (never overwrites). */
  L.MILESTONE = { Interviewed: 'interviewDate', 'QVC Completed': 'qvcDate', RTP: 'rtpDate', 'Visa Printed': 'visaDate', 'Ticket Booked': 'ticketDate', Arrived: 'arrivalDate', Deployed: 'deploymentDate', 'Handed Over': 'handoverDate', Joined: 'joiningDate' };
  L.stagesFor = scope => L.STAGES[scope] || L.ALL_STAGES;

  /* ======================= warranty (Domestic) ======================= */
  L.WARRANTY_MONTHS = 9;                                   // [V8.7] default 9 calendar months
  L.CLAIM_TYPES = ['Replacement', 'Refund', 'Other'];      // [V8.7] "Claim type (Replacement / Refund / Other)"
  L.CLAIM_STATUSES = ['Active', 'Open', 'Resolved', 'Expired'];   // [V8.7] "Claim status (Active / Open / Resolved / Expired)"
  L.warrantyEnd = (start, months) => U.addMonths(start, Number(months || L.WARRANTY_MONTHS));
  /** [V8.7] active = end ≥ today, expired = end < today, open complaint = a reason exists and status ≠ Resolved.
      [DEV] the end date is the LAST covered day (V8.7 counted it as active but displayed "Expired" on that day). */
  L.warrantyState = (w, today) => {
    today = today || U.todayISO();
    const end = w.end || '', has = !!end && U.isValidISO(end), days = has ? U.daysBetween(today, end) : NaN;
    const hasClaim = !!(w.reason && String(w.reason).trim()), open = hasClaim && w.status !== 'Resolved';
    return { end, hasEnd: has, days, active: has && days >= 0, expired: has && days < 0, hasClaim, open, expiringSoon: has && days >= 0 && days <= 30,
      text: !has ? '—' : days < 0 ? 'Expired' : days === 0 ? 'Last day' : days + ' days' };
  };
  L.warrantyOf = (store, candidateId) => store.list('warranties', { candidate: candidateId })[0] || null;
  /** [DEV] flag when the warranty start differs from the candidate's recorded sponsor handover date (the client must confirm which governs). */
  L.startMismatch = (store, w) => { const c = store.get('candidates', w.candidate); return !!(c && c.handoverDate && w.start && c.handoverDate !== w.start); };

  /* ======================= follow-ups ======================= */
  /** [DEV] a follow-up is the nextAction/dueDate of the LATEST update of a candidate (a newer update supersedes it).
      There is no "done" flag in V8.7, so this is the only traceable definition. */
  L.latestUpdate = (store, candidateId) => store.list('updates', { candidate: candidateId }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
  /** one pass over all updates → latest update per candidate (same ordering rule as latestUpdate; avoids one scan per candidate) */
  L.latestUpdateMap = store => {
    const m = new Map();
    store.list('updates').forEach(u => { const p = m.get(u.candidate); if (!p || (u.date || '') > (p.date || '') || ((u.date || '') === (p.date || '') && (u.createdAt || '') > (p.createdAt || ''))) m.set(u.candidate, u); });
    return m;
  };
  L.followUps = (store, scope, today) => {
    today = today || U.todayISO(); const out = [], latest = L.latestUpdateMap(store);
    store.list('candidates', scope ? { division: scope } : null).forEach(c => {
      const u = latest.get(c.id) || null;
      if (u && u.nextAction && u.dueDate) out.push({ update: u, candidate: c, due: u.dueDate, overdue: u.dueDate < today, days: U.daysBetween(today, u.dueDate) });
    });
    return out.sort((a, b) => a.due.localeCompare(b.due));
  };

  /* ======================= counters (every dashboard number comes from here) ======================= */
  /** current stage = V8.7 definition ("Counters show candidates whose CURRENT stage equals the label") */
  L.stageCount = (store, stage, scope) => store.count('candidates', r => r.stage === stage && (!scope || r.division === scope));
  /** reached = candidates whose history shows they were EVER at the stage (V8.7's own note: "A production ERP must additionally store all historical milestone events") */
  const reachedCache = new WeakMap();
  /** stage → Map(candidateId → division) built in ONE pass over the history; cached until the history or the candidate list changes */
  L.reachedMap = store => {
    const key = store.history.length + '|' + store.count('candidates'), hit = reachedCache.get(store.raw);
    if (hit && hit.key === key) return hit.map;
    const division = new Map(store.list('candidates').map(c => [c.id, c.division])), map = {};
    store.history.forEach(h => { if (h.entity === 'candidates' && h.field === 'stage' && division.has(h.recordId)) (map[h.to] = map[h.to] || new Map()).set(h.recordId, division.get(h.recordId)); });
    reachedCache.set(store.raw, { key, map }); return map;
  };
  L.reachedCount = (store, stage, scope) => { const m = L.reachedMap(store)[stage]; if (!m) return 0; let n = 0; m.forEach(d => { if (!scope || d === scope) n++; }); return n; };
  L.stageTable = (store, scope) => (scope ? L.stagesFor(scope) : L.ALL_STAGES).map(s => ({ stage: s, current: L.stageCount(store, s, scope), reached: L.reachedCount(store, s, scope) }));

  /* ======================= delivery per order (each division has its own meaning) ======================= */
  /** [DEV] "delivered" = Blue-Collar: verified deployment date set · Domestic: sponsor handover date set · Corporate: stage Joined. */
  L.DELIVERED_LABEL = 'Delivered';
  L.isDelivered = c => c.division === 'Blue-Collar' ? !!c.deploymentDate : c.division === 'Domestic' ? !!c.handoverDate : c.stage === 'Joined';
  L.deliveredForOrder = (store, order) => store.count('candidates', c => c.order === order.id && L.isDelivered(c));

  /* ======================= agency ledger (Blue-Collar) ======================= */
  /** [V8.7] earned = verified-deployed workers × fee per deployed worker; outstanding = earned − payments received.
      [DEV] "verified deployed" = the candidate has a Verified deployment date (set when a daily update moves the candidate to Deployed).
      [DEV] payments are matched to an allocation by the allocation link (V8.7 matched only by client + agency); unlinked payments are listed separately. */
  L.deployedCount = (store, alloc) => store.count('candidates', c => c.division === 'Blue-Collar' && c.order === alloc.order && c.agency === alloc.agency && !!c.deploymentDate);
  L.agencyLedger = store => {
    const rows = store.list('allocations').map(a => {
      const deployed = L.deployedCount(store, a), fee = Number(a.fee || 0), earned = U.round2(deployed * fee);
      const paid = U.round2(store.list('accounts', r => r.kind === 'Payment received' && r.allocation === a.id).reduce((s, r) => s + Number(r.amount || 0), 0));
      return { allocation: a, deployed, quantity: Number(a.quantity || 0), fee, earned, paid, outstanding: U.round2(earned - paid), overDeployed: deployed > Number(a.quantity || 0) };
    });
    const unlinked = store.list('accounts', r => r.division === 'Blue-Collar' && r.kind === 'Payment received' && r.agency && !r.allocation);
    return { rows, unlinked, unlinkedTotal: U.round2(unlinked.reduce((s, r) => s + Number(r.amount || 0), 0)),
      totals: { deployed: rows.reduce((s, r) => s + r.deployed, 0), earned: U.round2(rows.reduce((s, r) => s + r.earned, 0)), paid: U.round2(rows.reduce((s, r) => s + r.paid, 0)), outstanding: U.round2(rows.reduce((s, r) => s + r.outstanding, 0)) } };
  };

  /* ======================= corporate placement fees ======================= */
  /** [V8.7] corporate order fields: fee basis (0.5 month / 1 month / custom), custom fee, "invoice due after joining (months)".
      [DEV] fee = factor × candidate salary (falls back to the order's basic salary) or the custom fee; due = joining date + months;
      invoiced / received come from Accounts entries linked to the candidate. */
  L.FEE_BASIS = ['0.5 month', '1 month', 'Custom'];
  L.placementFee = (order, candidate) => {
    if (!order) return { fee: 0, basis: '', salary: 0, ok: false, why: 'No order linked' };
    const salary = Number(candidate && candidate.salary ? candidate.salary : order.basicSalary || 0);
    if (order.feeBasis === 'Custom') return { fee: U.round2(Number(order.customFee || 0)), basis: 'Custom', salary, ok: Number(order.customFee) > 0, why: Number(order.customFee) > 0 ? '' : 'Custom fee not entered' };
    const f = order.feeBasis === '0.5 month' ? 0.5 : order.feeBasis === '1 month' ? 1 : 0;
    return { fee: U.round2(f * salary), basis: order.feeBasis || '', salary, ok: f > 0 && salary > 0, why: f === 0 ? 'Fee basis not selected' : salary > 0 ? '' : 'Salary missing' };
  };
  L.corporateReceivables = (store, today) => {
    today = today || U.todayISO();
    return store.list('candidates', { division: 'Corporate' }).filter(c => c.stage === 'Joined' && c.joiningDate).map(c => {
      const o = store.get('orders', c.order), p = L.placementFee(o, c), months = o && o.paymentMilestone !== '' && o.paymentMilestone != null ? Number(o.paymentMilestone) : null;
      const due = months == null ? '' : U.addMonths(c.joiningDate, months);
      const sum = kind => U.round2(store.list('accounts', r => r.candidate === c.id && r.kind === kind).reduce((s, r) => s + Number(r.amount || 0), 0));
      const invoiced = sum('Invoice'), received = sum('Payment received'), outstanding = U.round2(p.fee - received);
      return { candidate: c, order: o, fee: p.fee, basis: p.basis, ok: p.ok, why: p.why, joined: c.joiningDate, due, overdue: !!due && due < today && outstanding > 0, invoiced, received, outstanding };
    });
  };
  /** Domestic / generic: per client totals by transaction kind */
  L.partyLedger = (store, scope) => {
    const map = {};
    store.list('accounts', scope ? { division: scope } : null).forEach(r => { const m = map[r.client] = map[r.client] || { client: r.client, Invoice: 0, 'Payment received': 0, Refund: 0, Expense: 0, Deposit: 0 }; m[r.kind] = U.round2((m[r.kind] || 0) + Number(r.amount || 0)); });
    return Object.values(map).map(m => Object.assign(m, { outstanding: U.round2(m.Invoice - m['Payment received'] + m.Refund) })).sort((a, b) => String(a.client).localeCompare(String(b.client)));
  };

  /* ======================= hooks ======================= */
  const sameClient = (store, f, rec, errors, label) => {
    const c = store.get('candidates', rec.candidate); if (c && rec.client && c.client !== rec.client) errors.candidate = (label || 'Candidate') + ' ' + c.id + ' belongs to ' + store.display('clients', store.get('clients', c.client)) + ', not to the selected client.';
  };

  function beforeSave(ctx) {
    const { store, entity, mode, values: rec, old, scope } = ctx, errors = {}, warnings = [], today = U.todayISO();
    if (entity === 'orders') {
      if (rec.orderDate && rec.orderDate > today) warnings.push('Order date is in the future.');
    }
    if (entity === 'allocations') {
      const o = store.get('orders', rec.order); if (o && o.client !== rec.client) errors.order = 'This order belongs to a different client.';
      if (o && !errors.order) { const others = store.list('allocations', r => r.order === rec.order && r.id !== rec.id).reduce((s, r) => s + Number(r.quantity || 0), 0); if (others + Number(rec.quantity || 0) > Number(o.quantity || 0)) warnings.push('Allocated quantity (' + (others + Number(rec.quantity || 0)) + ') is above the ordered quantity (' + o.quantity + ').'); }
    }
    if (entity === 'candidates') {
      const o = rec.order && store.get('orders', rec.order); if (o && o.client !== rec.client) errors.order = 'This order belongs to a different client.';
      if (rec.stage === 'Deployed' && !rec.deploymentDate && scope === 'Blue-Collar') warnings.push('Stage is Deployed but no Verified deployment date is recorded — the agency fee will not be counted until it is.');
      if (rec.deploymentDate && rec.stage !== 'Deployed' && rec.stage !== 'Handed Over' && scope === 'Blue-Collar') warnings.push('A verified deployment date exists while the stage is "' + rec.stage + '".');
      if (rec.qvcDate && rec.interviewDate && rec.qvcDate < rec.interviewDate) warnings.push('QVC date is before the interview date.');
      if (scope === 'Blue-Collar' && rec.order && rec.agency && !store.count('allocations', a => a.order === rec.order && a.agency === rec.agency)) warnings.push('This agency has no allocation for the selected order — its deployments will not appear in the agency ledger.');
    }
    if (entity === 'interviews' || entity === 'tickets' || entity === 'accounts' && rec.candidate || entity === 'documents' && rec.candidate) sameClient(store, null, rec, errors);
    if (entity === 'accounts') {
      const a = rec.allocation && store.get('allocations', rec.allocation);
      if (a && a.client !== rec.client) errors.allocation = 'This allocation belongs to a different client.';
      if (a && rec.agency && a.agency !== rec.agency) errors.allocation = 'This allocation is with a different agency.';
      if (rec.kind === 'Payment received' && !rec.payer) warnings.push('Payer type not selected.');
    }
    if (entity === 'updates') {
      sameClient(store, null, rec, errors);
      const c = store.get('candidates', rec.candidate);
      if (c && c.division !== scope) errors.candidate = 'This candidate belongs to another division.';
      if (c && !errors.candidate && !L.stagesFor(c.division).includes(rec.stage)) errors.stage = '"' + rec.stage + '" is not a stage of the ' + c.division + ' workflow.';
      if (c && !errors.stage && mode === 'create') {   // [DEV] stages may be skipped (V8.7 allows it) but a move backwards / out of Rejected is flagged
        const sl = L.stagesFor(c.division), from = sl.indexOf(c.stage), to = sl.indexOf(rec.stage);
        if (c.stage === 'Rejected' && rec.stage !== 'Rejected') warnings.push(c.name + ' was Rejected — this update re-opens the candidate.');
        else if (rec.stage !== 'Rejected' && from >= 0 && to >= 0 && to < from) warnings.push('"' + rec.stage + '" is earlier in the workflow than the current stage "' + c.stage + '" — check this is intended.');
      }
      if (rec.date > today) warnings.push('Update date is in the future.');
      if (rec.dueDate && rec.date && rec.dueDate < rec.date) errors.dueDate = 'Follow-up due date is before the update date.';
      if (c && c.createdAt && rec.date < c.createdAt.slice(0, 10) && mode === 'create') warnings.push('Update date is before the candidate was registered.');
    }
    if (entity === 'warranties' && scope === 'Domestic') {
      sameClient(store, null, rec, errors, 'Worker');
      const c = store.get('candidates', rec.candidate); if (c && c.division !== 'Domestic') errors.candidate = 'Warranties are registered for Domestic workers.';
      if (rec.start && U.isValidISO(rec.start)) { rec.end = L.warrantyEnd(rec.start, rec.months || L.WARRANTY_MONTHS); }
      if (!rec.status) rec.status = 'Active';
      if (rec.claimDate && rec.start && rec.claimDate < rec.start) errors.claimDate = 'Complaint date is before the warranty start.';
      if (rec.resolutionDate && rec.claimDate && rec.resolutionDate < rec.claimDate) errors.resolutionDate = 'Resolution date is before the complaint date.';
      if (rec.claimDate && rec.end && rec.claimDate > rec.end) warnings.push('Complaint received after the warranty expiry date (' + rec.end + ') — check the sponsor contract.');
      if (rec.reason && !rec.claimDate) warnings.push('Complaint reason entered without a complaint received date.');
      if (rec.status === 'Resolved' && !rec.resolutionDate) warnings.push('Status is Resolved but no resolution date is recorded.');
      if (Number(rec.refundAmount) > 0 && rec.claimType !== 'Refund') warnings.push('A refund amount is entered but the claim type is not "Refund".');
      if (rec.replacementCandidate && rec.claimType !== 'Replacement') warnings.push('A replacement worker is entered but the claim type is not "Replacement".');
      if (rec.replacementCandidate) { const r = store.get('candidates', rec.replacementCandidate); if (r && (r.client !== rec.client || r.id === rec.candidate)) errors.replacementCandidate = 'The replacement worker must be a different worker of the same sponsor.'; }
    }
    if (entity === 'warranties' && scope !== 'Domestic' && rec.start && rec.end && rec.end < rec.start) errors.end = 'Warranty end is before the start.';
    return { errors, warnings };
  }

  function afterSave(ctx) {
    const { store, entity, mode, record: rec, old, scope } = ctx, warnings = [], notes = [];
    if (entity === 'updates' && (mode === 'create' || L.latestUpdate(store, rec.candidate).id === rec.id)) {
      const c = store.get('candidates', rec.candidate);
      if (c && c.stage !== rec.stage || (c && mode === 'create')) {
        const patch = { stage: rec.stage };
        const m = L.MILESTONE[rec.stage];
        if (m && store.fieldsFor('candidates', c.division).some(f => f.key === m)) {
          if (!c[m]) patch[m] = rec.date;
          else if (c[m] !== rec.date) warnings.push(m + ' was already recorded as ' + c[m] + '; it was not changed.');
        }
        const r = store.update('candidates', c.id, patch, { by: rec.staff || 'local user', note: rec.action || 'Daily update ' + rec.id, historyExtra: { updateId: rec.id, date: rec.date } });
        if (!r.ok) throw new Error('Candidate could not be updated: ' + Object.values(r.errors).join(' '));
        (r.warnings || []).forEach(w => warnings.push(w));
        (r.notes || []).forEach(n => notes.push(n));
        notes.push(c.name + ' moved to "' + rec.stage + '"' + (m && patch[m] ? ' · ' + m + ' set to ' + rec.date : '') + '.');
      }
    }
    if (entity === 'candidates' && scope === 'Domestic' && rec.handoverDate && L.AUTO_WARRANTY && !L.warrantyOf(store, rec.id)) {
      // [DEV] a Domestic worker with a recorded sponsor handover date automatically gets a warranty record (start = handover date, 9 months)
      const r = store.create('warranties', { division: 'Domestic', client: rec.client, candidate: rec.id, start: rec.handoverDate, months: L.WARRANTY_MONTHS, status: 'Active' }, { scope: 'Domestic', by: 'system', note: 'auto-created from sponsor handover' });
      if (r.ok) notes.push('Warranty ' + r.record.id + ' created automatically: ' + r.record.start + ' → ' + r.record.end + ' (' + L.WARRANTY_MONTHS + ' months).'); else warnings.push('Warranty could not be created: ' + Object.values(r.errors).join(' '));
    }
    return { warnings, notes };
  }
  L.AUTO_WARRANTY = true;

  /** [DEV] block deleting an update whose stage is still the candidate's current stage: remove or correct the candidate stage deliberately instead */
  function beforeDelete() { return {}; }

  L.hooks = { beforeSave, afterSave, beforeDelete };
})(typeof window !== 'undefined' ? window : globalThis);

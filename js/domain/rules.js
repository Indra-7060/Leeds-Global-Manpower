/* BUSINESS LOGIC — integrity rules: duplicates (V6 keys), uniqueness, referential checks, cascades, client rename. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const C = LGM.Config, U = LGM.Util;
  const n = U.norm;

  // ---- duplicate keys (identical to V6 v5Import) ----
  const candidateKey = c => (c.passport ? `pp:${n(c.passport)}` : `name:${n(c.name)}:${n(c.client)}`);
  const orderKey = o => `${n(o.id || o.order_id)}:${n(o.client)}:${n(o.country)}:${n(o.trade)}`;
  const financeKey = f => `${f.date}:${n(f.ref)}:${n(f.party)}:${f.amount}:${f.direction}`;

  function findCandidateDuplicate(state, c, ignoreId) {
    const k = candidateKey(c);
    return state.candidates.find(x => x.id !== ignoreId && candidateKey(x) === k) || null;
  }

  const CLIENT_FIELD = { visits: 'client', demands: 'client', orders: 'client', candidates: 'client', interviews: 'client', warranties: 'client', finance: 'client', credentials: 'client', cvInbox: 'client' };

  /** Entity-level validation beyond field types. Returns { errors:{field|_:msg}, warnings:[msg] } */
  function check(state, entity, rec, opts = {}) {
    const errors = {}, warnings = [];
    switch (entity) {
      case 'clients': {
        const dup = state.clients.find(x => x.id !== opts.ignoreId && n(x.name) === n(rec.name));
        if (dup) errors.name = 'A client with this name already exists.';
        break;
      }
      case 'candidates': {
        const dup = findCandidateDuplicate(state, rec, opts.ignoreId);
        if (dup) errors[rec.passport ? 'passport' : 'name'] = `Duplicate of ${dup.id} (${rec.passport ? 'same passport' : 'same name and client'}).`;
        if (rec.order_id && !state.orders.some(o => o.id === rec.order_id)) warnings.push(`Order ${rec.order_id} not found.`);
        if (rec.order_id) {
          const o = state.orders.find(x => x.id === rec.order_id);
          if (o && n(o.client) !== n(rec.client)) warnings.push(`Order ${o.id} belongs to ${o.client}, not ${rec.client}.`);
        }
        break;
      }
      case 'allocations': {
        const o = state.orders.find(x => x.id === rec.order_id);
        if (!o) errors.order_id = 'Order not found.';
        else {
          const others = U.sum(state.allocations.filter(a => a.order_id === o.id && a.id !== opts.ignoreId), a => a.allocated);
          if (others + Number(rec.allocated) > o.qty) warnings.push(`Allocated total ${others + Number(rec.allocated)} exceeds order quantity ${o.qty}.`);
        }
        break;
      }
      case 'tickets': {
        if (!state.candidates.some(c => c.id === rec.candidate_id)) errors.candidate_id = 'Candidate not found.';
        else if (state.tickets.some(t => t.candidate_id === rec.candidate_id && t.id !== opts.ignoreId)) errors.candidate_id = 'This candidate already has a travel record.';
        break;
      }
      case 'warranties': {
        if (rec.warranty_start && rec.warranty_expiry && rec.warranty_expiry < rec.warranty_start) errors.warranty_expiry = 'Expiry cannot be before start.';
        break;
      }
      case 'credentials': {
        if (/pass(word|code)?\s*[:=]|otp\s*[:=]|pin\s*[:=]|secret\s*[:=]/i.test(`${rec.record} ${rec.portal}`)) errors.record = 'Do not store passwords or secrets here — describe the record only.';
        break;
      }
      default:
    }
    return { errors, warnings };
  }

  /** Apply defaults/derivations before saving. */
  function derive(entity, rec) {
    if (rec.country) { const hit = C.countries.find(x => n(x) === n(rec.country)); if (hit) rec.country = hit; }
    if (entity === 'warranties' && rec.warranty_start && !rec.warranty_expiry) {
      const months = C.warrantyMonths[rec.division];
      if (months) rec.warranty_expiry = U.addMonths(rec.warranty_start, months);
    }
    if (entity === 'credentials') rec.access = 'Authorized only';
    return rec;
  }

  /** Reason why a record cannot be deleted, or null. */
  function canDelete(state, entity, rec) {
    if (entity === 'clients') {
      const refs = [['orders', 'order(s)'], ['candidates', 'candidate(s)'], ['visits', 'visit(s)'], ['demands', 'demand letter(s)']]
        .map(([e, l]) => [state[e].filter(x => n(x.client) === n(rec.name)).length, l]).filter(x => x[0]);
      if (refs.length) return 'Client is used by ' + refs.map(x => `${x[0]} ${x[1]}`).join(', ') + '. Remove or reassign those first.';
    }
    if (entity === 'orders') {
      const cands = state.candidates.filter(c => c.order_id === rec.id).length;
      const allocs = state.allocations.filter(a => a.order_id === rec.id).length;
      const dem = state.demands.filter(d => d.order_id === rec.id).length;
      if (cands || allocs || dem) return `Order is linked to ${cands} candidate(s), ${allocs} allocation(s), ${dem} demand letter(s). Remove or unlink them first.`;
    }
    return null;
  }

  /** Side effects of deleting (mutates state). */
  function cascadeDelete(state, entity, rec) {
    if (entity === 'candidates') {
      state.tickets = state.tickets.filter(t => t.candidate_id !== rec.id);
      state.warranties.forEach(w => { if (w.candidate_id === rec.id) w.candidate_id = ''; });
    }
  }

  /** Renaming a client rewrites the name wherever it is stored as text (V6 links by name). */
  function renameClient(state, from, to) {
    let changed = 0;
    for (const [e, f] of Object.entries(CLIENT_FIELD)) (state[e] || []).forEach(r => { if (n(r[f]) === n(from)) { r[f] = to; changed++; } });
    return changed;
  }

  LGM.Rules = { candidateKey, orderKey, financeKey, findCandidateDuplicate, check, derive, canDelete, cascadeDelete, renameClient, CLIENT_FIELD };
})(typeof window !== 'undefined' ? window : globalThis);

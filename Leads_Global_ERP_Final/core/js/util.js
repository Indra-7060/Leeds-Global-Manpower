/* ERP core · util.js — pure helpers. No business knowledge, no DOM required (DOM helpers are guarded). */
(function (g) {
  'use strict';
  const ERP = g.ERP = g.ERP || {};

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
  const pad = (n, w) => String(n).padStart(w, '0');
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- dates (ISO yyyy-mm-dd strings only; arithmetic in UTC so time of day never matters) ---------- */
  const isoOf = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2);
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }; // the user's local calendar day
  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
  }
  const isValidISO = s => !!parseISO(s);
  /** Add calendar months; if the target month is shorter the day is clamped to its last day (31 Aug + 9 → 31 May, 31 May + 9 → 28 Feb). */
  function addMonths(iso, n) {
    const dt = parseISO(iso); if (!dt) return '';
    const day = dt.getUTCDate(), t = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + Number(n), 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(day, last));
    return isoOf(t);
  }
  /** whole days from a to b (b − a); positive when b is later. */
  const daysBetween = (a, b) => { const x = parseISO(a), y = parseISO(b); return x && y ? Math.round((y - x) / 86400000) : NaN; };

  const money = (n, cur) => (cur || 'QAR') + ' ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  /* ---------- CSV ---------- */
  function csvParse(text) {
    const s = String(text || '').replace(/^﻿/, ''); const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x.trim() !== '')) out.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell); if (row.some(x => x.trim() !== '')) out.push(row);
    return out;
  }
  /** neutralise spreadsheet formula injection: text starting with = + - @ gets a leading apostrophe (numbers are left alone) */
  const csvGuard = v => { const s = String(v == null ? '' : v); return /^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-\s*[\d.,]+$/.test(s)) ? "'" + s : s; };
  const csvStringify = rows => rows.map(r => r.map(v => '"' + csvGuard(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');

  /* ---------- browser helpers (no-ops outside a browser) ---------- */
  function download(content, name, mime) {
    if (typeof document === 'undefined') return false;
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain' });
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2500);
    return true;
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const get = (o, path) => String(path).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

  ERP.util = { esc, norm, pad, clone, uid, isoOf, todayISO, parseISO, isValidISO, addMonths, daysBetween, money, round2, csvParse, csvStringify, csvGuard, download, debounce, get };
})(typeof window !== 'undefined' ? window : globalThis);

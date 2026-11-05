/* UTILITIES — pure helpers, no DOM, no storage. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const pad = n => String(n).padStart(2, '0');

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Normalised comparison key (same idea as V6 v5Norm).
  function norm(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  function validYMD(y, m, d) {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  // Excel serial (1900 system) -> ISO date. 25569 = 1970-01-01.
  function serialToISO(serial) {
    const ms = Math.round((Number(serial) - 25569) * 86400000);
    const dt = new Date(ms);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  /** Parse a date from user/Excel input. Returns 'YYYY-MM-DD' or null. Day-first for numeric d/m/y (ASSUMPTION, OQ-19). */
  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) {            // Excel serial (only a plausible range, so "2026" is not read as a date)
      const n = Number(s);
      return n >= 25569 && n <= 73050 ? serialToISO(n) : null;
    }
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    if (m) return validYMD(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
    if (m) {
      let y = +m[3]; if (m[3].length === 2) y += 2000;
      return validYMD(y, +m[2], +m[1]) ? iso(y, +m[2], +m[1]) : null;
    }
    m = s.match(/^(\d{1,2})[ \-]([A-Za-z]{3,9})[ \-,]*(\d{4})$/);
    if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
      const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
      return validYMD(+m[3], mo, +m[1]) ? iso(+m[3], mo, +m[1]) : null;
    }
    return null;
  }
  const isISODate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && parseDate(s) === s;

  function todayISO() { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }

  function addMonths(isoDate, n) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, last));
  }
  function diffDays(a, b) { // b - a in whole days
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }

  function num(v) {
    if (typeof v === 'number') return v;
    const s = String(v == null ? '' : v).replace(/,/g, '').trim();
    return s === '' ? NaN : Number(s);
  }
  const money = n => 'QAR ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const uid = (() => { let c = 0; return (p = 'id') => p + '_' + Date.now().toString(36) + (c++).toString(36) + Math.random().toString(36).slice(2, 6); })();
  const clone = o => JSON.parse(JSON.stringify(o));
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  const uniqSorted = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const countBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  const sum = (arr, fn) => arr.reduce((a, x) => a + (Number(fn ? fn(x) : x) || 0), 0);
  const pctText = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');

  LGM.Util = { esc, norm, parseDate, isISODate, serialToISO, todayISO, addMonths, diffDays, num, money, uid, clone, debounce, uniqSorted, countBy, sum, pctText };
})(typeof window !== 'undefined' ? window : globalThis);

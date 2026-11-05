/* CSV — parse and serialise. Fixes V6 defects D-7 (unquoted fields, formula injection) and handles ; and tab delimiters. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});

  function detectDelimiter(text) {
    const first = text.split(/\r\n|\n|\r/).find(l => l.trim()) || '';
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let q = false;
    for (const c of first) { if (c === '"') q = !q; else if (!q && c in counts) counts[c]++; }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ',';
  }

  /** RFC-4180 style parser. Returns array of rows (arrays of strings). Blank rows are dropped. */
  function parse(text, delimiter) {
    text = String(text == null ? '' : text).replace(/^﻿/, '');
    const d = delimiter || detectDelimiter(text);
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') q = false;
        else field += c;
      } else if (c === '"') q = true;
      else if (c === d) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(x => x.trim())) rows.push(row);
        row = []; field = '';
      } else field += c;
    }
    row.push(field);
    if (row.some(x => x.trim())) rows.push(row);
    return rows;
  }

  /** Neutralise spreadsheet formula injection for text cells (=, +, @, tab, CR; '-' unless it is a number). */
  function guard(v) {
    if (typeof v !== 'string') return v;
    if (/^[=+@\t\r]/.test(v)) return "'" + v;
    if (/^-/.test(v) && !/^-\s*[\d.,]+$/.test(v)) return "'" + v;
    return v;
  }
  const cell = v => '"' + String(guard(v == null ? '' : v)).replace(/"/g, '""') + '"';
  function stringify(rows) { return rows.map(r => r.map(cell).join(',')).join('\r\n'); }

  LGM.Csv = { parse, stringify, guard, detectDelimiter };
})(typeof window !== 'undefined' ? window : globalThis);
